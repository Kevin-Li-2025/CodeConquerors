using System.Collections.Concurrent;
using System.Globalization;
using AccessCity.API.Models;
using Microsoft.Extensions.Caching.Hybrid;

namespace AccessCity.API.Services;

public interface IRiskScoreCacheService
{
    Task<RiskScoreResponse> GetOrComputeAsync(
        string cacheKey,
        Func<CancellationToken, Task<RiskScoreResponse>> factory,
        CancellationToken cancellationToken = default);

    Task<T> GetOrComputeAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken = default);

    string BuildKey(double latitude, double longitude, double radiusMetres);

    string BuildKey(string prefix, double latitude, double longitude, double radiusMetres);
}

public sealed class RiskScoreCacheService : IRiskScoreCacheService
{
    private readonly HybridCache _cache;
    private readonly TimeSpan _ttl;
    private readonly TimeSpan _fillTimeout;
    private readonly int _coordinatePrecision;
    private readonly int _radiusBucketMetres;
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> _inflightFills = new();

    public RiskScoreCacheService(HybridCache cache, IConfiguration configuration)
    {
        _cache = cache;
        _ttl = TimeSpan.FromSeconds(Math.Max(1, configuration.GetValue("RiskScoring:CacheTtlSeconds", 30)));
        _fillTimeout = TimeSpan.FromSeconds(Math.Clamp(
            configuration.GetValue("RiskScoring:CacheFillTimeoutSeconds", 5),
            1,
            60));
        _coordinatePrecision = Math.Clamp(configuration.GetValue("RiskScoring:CacheCoordinatePrecision", 4), 3, 6);
        _radiusBucketMetres = Math.Max(1, configuration.GetValue("RiskScoring:CacheRadiusBucketMetres", 50));
    }

    public async Task<RiskScoreResponse> GetOrComputeAsync(
        string cacheKey,
        Func<CancellationToken, Task<RiskScoreResponse>> factory,
        CancellationToken cancellationToken = default)
    {
        return await GetOrComputeAsync<RiskScoreResponse>(cacheKey, factory, cancellationToken);
    }

    public async Task<T> GetOrComputeAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken = default)
    {
        var inflightKey = $"{typeof(T).FullName}:{cacheKey}";
        var newFill = new Lazy<Task<object?>>(
            () => FillCacheAsync(cacheKey, factory),
            LazyThreadSafetyMode.ExecutionAndPublication);
        var fill = _inflightFills.GetOrAdd(inflightKey, newFill);

        if (ReferenceEquals(fill, newFill))
        {
            _ = fill.Value.ContinueWith(
                completed =>
                {
                    _ = completed.Exception;
                    _inflightFills.TryRemove(new KeyValuePair<string, Lazy<Task<object?>>>(inflightKey, fill));
                },
                CancellationToken.None,
                TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
        }

        var result = await fill.Value.WaitAsync(cancellationToken);
        return (T)result!;
    }

    private async Task<object?> FillCacheAsync<T>(
        string cacheKey,
        Func<CancellationToken, Task<T>> factory)
    {
#pragma warning disable EXTEXP0018
        return await _cache.GetOrCreateAsync(
            cacheKey,
            async _ =>
            {
                using var timeout = new CancellationTokenSource(_fillTimeout);
                return await factory(timeout.Token);
            },
            new HybridCacheEntryOptions { Expiration = _ttl },
            cancellationToken: CancellationToken.None);
#pragma warning restore EXTEXP0018
    }

    public string BuildKey(double latitude, double longitude, double radiusMetres)
    {
        return BuildKey("risk-score", latitude, longitude, radiusMetres);
    }

    public string BuildKey(string prefix, double latitude, double longitude, double radiusMetres)
    {
        var roundedLatitude = Math.Round(latitude, _coordinatePrecision, MidpointRounding.AwayFromZero);
        var roundedLongitude = Math.Round(longitude, _coordinatePrecision, MidpointRounding.AwayFromZero);
        var radiusBucket = (int)Math.Ceiling(Math.Max(0, radiusMetres) / _radiusBucketMetres) * _radiusBucketMetres;
        var coordinateFormat = "F" + _coordinatePrecision.ToString(CultureInfo.InvariantCulture);

        return string.Create(
            CultureInfo.InvariantCulture,
            $"{prefix}:{roundedLatitude.ToString(coordinateFormat, CultureInfo.InvariantCulture)}:{roundedLongitude.ToString(coordinateFormat, CultureInfo.InvariantCulture)}:{radiusBucket}");
    }
}
