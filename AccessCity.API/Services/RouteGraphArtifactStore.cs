using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AccessCity.API.Configuration;
using Microsoft.Extensions.Options;

namespace AccessCity.API.Services;

public interface IRouteGraphArtifactStore
{
    bool IsEnabled { get; }

    Task<RouteGraphArtifactStoreReadResult?> TryReadAsync(
        string cacheKey,
        CancellationToken cancellationToken = default);

    Task<RouteGraphArtifactStoreWriteResult?> WriteAsync(
        string cacheKey,
        PackedRouteGraphArtifact artifact,
        byte[] redisPayload,
        string sourceType,
        CancellationToken cancellationToken = default);
}

public sealed class RouteGraphArtifactStore : IRouteGraphArtifactStore
{
    private static readonly JsonSerializerOptions MetadataJsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true
    };

    private readonly RoutingOptions _options;
    private readonly ILogger<RouteGraphArtifactStore> _logger;

    public RouteGraphArtifactStore(
        IOptions<RoutingOptions> options,
        ILogger<RouteGraphArtifactStore> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled =>
        _options.RouteGraphFileArtifactStoreEnabled
        && _options.RouteGraphPackedArtifactsEnabled
        && !string.IsNullOrWhiteSpace(_options.RouteGraphFileArtifactDirectory);

    public async Task<RouteGraphArtifactStoreReadResult?> TryReadAsync(
        string cacheKey,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled || string.IsNullOrWhiteSpace(cacheKey))
        {
            return null;
        }

        var paths = ResolvePaths(cacheKey);
        if (!File.Exists(paths.MetadataPath) || !File.Exists(paths.ArtifactPath))
        {
            return null;
        }

        try
        {
            var metadataJson = await File.ReadAllTextAsync(paths.MetadataPath, cancellationToken);
            var metadata = JsonSerializer.Deserialize<RouteGraphArtifactFileMetadata>(
                metadataJson,
                MetadataJsonOptions);
            if (metadata is null || !string.Equals(metadata.CacheKey, cacheKey, StringComparison.Ordinal))
            {
                return null;
            }

            var payload = await File.ReadAllBytesAsync(paths.ArtifactPath, cancellationToken);
            if (payload.LongLength != metadata.PayloadBytes)
            {
                _logger.LogDebug(
                    "Route graph artifact {CacheKey} file length {ActualBytes} did not match metadata {ExpectedBytes}",
                    cacheKey,
                    payload.LongLength,
                    metadata.PayloadBytes);
                return null;
            }

            if (!RouteGraphArtifactCodec.TryDeserializeRedisPayload(payload, out var artifact)
                || artifact is null
                || !RouteGraphArtifactCodec.IsCompatible(artifact))
            {
                return null;
            }

            return new RouteGraphArtifactStoreReadResult(
                artifact,
                paths.ArtifactPath,
                payload.LongLength,
                metadata.CreatedAtUtc,
                metadata.SourceType);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            _logger.LogDebug(ex, "Route graph artifact {CacheKey} could not be read from file store", cacheKey);
            return null;
        }
    }

    public async Task<RouteGraphArtifactStoreWriteResult?> WriteAsync(
        string cacheKey,
        PackedRouteGraphArtifact artifact,
        byte[] redisPayload,
        string sourceType,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled
            || string.IsNullOrWhiteSpace(cacheKey)
            || redisPayload.Length == 0
            || !RouteGraphArtifactCodec.IsCompatible(artifact))
        {
            return null;
        }

        var paths = ResolvePaths(cacheKey);
        try
        {
            Directory.CreateDirectory(paths.Directory);
            await WriteAtomicBytesAsync(paths.ArtifactPath, redisPayload, cancellationToken);

            var metadata = new RouteGraphArtifactFileMetadata(
                cacheKey,
                RouteGraphArtifactCodec.SchemaVersion,
                artifact.EdgeCostVersion,
                artifact.EdgeWeightVersion,
                artifact.ShardKey,
                artifact.SourceShardKeys,
                artifact.Nodes.Length,
                artifact.Edges.Length,
                redisPayload.LongLength,
                DateTime.UtcNow,
                sourceType,
                Path.GetFileName(paths.ArtifactPath));
            await WriteAtomicTextAsync(
                paths.MetadataPath,
                JsonSerializer.Serialize(metadata, MetadataJsonOptions),
                cancellationToken);

            return new RouteGraphArtifactStoreWriteResult(
                paths.ArtifactPath,
                redisPayload.LongLength,
                metadata.CreatedAtUtc);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException)
        {
            _logger.LogDebug(ex, "Route graph artifact {CacheKey} could not be written to file store", cacheKey);
            return null;
        }
    }

    private RouteGraphArtifactPaths ResolvePaths(string cacheKey)
    {
        var directory = Path.GetFullPath(_options.RouteGraphFileArtifactDirectory);
        var keyHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(cacheKey)))
            .ToLowerInvariant();
        return new RouteGraphArtifactPaths(
            directory,
            Path.Combine(directory, $"{keyHash}.acrg"),
            Path.Combine(directory, $"{keyHash}.json"));
    }

    private static async Task WriteAtomicBytesAsync(
        string path,
        byte[] payload,
        CancellationToken cancellationToken)
    {
        var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";
        await File.WriteAllBytesAsync(tempPath, payload, cancellationToken);
        File.Move(tempPath, path, overwrite: true);
    }

    private static async Task WriteAtomicTextAsync(
        string path,
        string payload,
        CancellationToken cancellationToken)
    {
        var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";
        await File.WriteAllTextAsync(tempPath, payload, Encoding.UTF8, cancellationToken);
        File.Move(tempPath, path, overwrite: true);
    }

    private sealed record RouteGraphArtifactPaths(
        string Directory,
        string ArtifactPath,
        string MetadataPath);

    private sealed record RouteGraphArtifactFileMetadata(
        string CacheKey,
        string SchemaVersion,
        int EdgeCostVersion,
        int EdgeWeightVersion,
        string? ShardKey,
        string[] SourceShardKeys,
        int NodeCount,
        int EdgeCount,
        long PayloadBytes,
        DateTime CreatedAtUtc,
        string SourceType,
        string ArtifactFileName);
}

public sealed record RouteGraphArtifactStoreReadResult(
    PackedRouteGraphArtifact Artifact,
    string ArtifactPath,
    long PayloadBytes,
    DateTime CreatedAtUtc,
    string SourceType);

public sealed record RouteGraphArtifactStoreWriteResult(
    string ArtifactPath,
    long PayloadBytes,
    DateTime CreatedAtUtc);
