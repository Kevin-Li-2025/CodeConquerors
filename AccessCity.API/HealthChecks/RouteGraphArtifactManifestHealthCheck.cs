using AccessCity.API.Configuration;
using AccessCity.API.Services;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace AccessCity.API.HealthChecks;

public sealed class RouteGraphArtifactManifestHealthCheck : IHealthCheck
{
    private readonly IRouteGraphArtifactStore _artifactStore;
    private readonly RoutingOptions _options;

    public RouteGraphArtifactManifestHealthCheck(
        IRouteGraphArtifactStore artifactStore,
        IOptions<RoutingOptions> options)
    {
        _artifactStore = artifactStore;
        _options = options.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var data = new Dictionary<string, object>
        {
            ["fileArtifactStoreEnabled"] = _artifactStore.IsEnabled,
            ["manifestEnabled"] = _options.RouteGraphFileArtifactManifestEnabled
        };

        if (!_artifactStore.IsEnabled || !_options.RouteGraphFileArtifactManifestEnabled)
        {
            return HealthCheckResult.Healthy("Route graph artifact manifest is disabled.", data);
        }

        var manifest = await _artifactStore.TryReadManifestAsync(cancellationToken);
        if (manifest is null || manifest.Shards.Length == 0)
        {
            data["shardCount"] = 0;
            const string message = "Route graph artifact manifest is missing, empty, or incompatible.";
            return _options.RequireRouteGraphForReadiness
                ? HealthCheckResult.Unhealthy(message, data: data)
                : HealthCheckResult.Degraded(message, data: data);
        }

        data["schemaVersion"] = manifest.SchemaVersion;
        data["edgeCostVersion"] = manifest.EdgeCostVersion;
        data["edgeWeightVersion"] = manifest.EdgeWeightVersion;
        data["altAlgorithmVersion"] = manifest.AltAlgorithmVersion;
        data["sourceName"] = manifest.SourceName;
        data["artifactSetId"] = manifest.ArtifactSetId;
        data["shardCount"] = manifest.Shards.Length;
        data["totalPayloadBytes"] = manifest.TotalPayloadBytes;

        var shardsToVerify = SelectShardsForValidation(manifest).ToArray();
        data["verifiedShardCount"] = shardsToVerify.Length;
        foreach (var shard in shardsToVerify)
        {
            var read = await _artifactStore.TryReadManifestShardAsync(shard, cancellationToken);
            if (read is not null)
            {
                continue;
            }

            data["invalidShardCacheKey"] = shard.CacheKey;
            data["invalidShardArtifactFileName"] = shard.ArtifactFileName;
            var message = $"Route graph artifact manifest shard {shard.CacheKey} is missing, corrupt, or incompatible.";
            return _options.RequireRouteGraphForReadiness
                ? HealthCheckResult.Unhealthy(message, data: data)
                : HealthCheckResult.Degraded(message, data: data);
        }

        return HealthCheckResult.Healthy("Route graph artifact manifest is available.", data);
    }

    private IEnumerable<RouteGraphArtifactManifestShard> SelectShardsForValidation(RouteGraphArtifactManifest manifest)
    {
        var limit = Math.Max(0, _options.RouteGraphFileArtifactReadinessValidationShardLimit);
        if (limit == 0)
        {
            return Array.Empty<RouteGraphArtifactManifestShard>();
        }

        return manifest.Shards
            .OrderByDescending(shard => shard.PayloadBytes)
            .ThenBy(shard => shard.CacheKey, StringComparer.Ordinal)
            .Take(limit);
    }
}
