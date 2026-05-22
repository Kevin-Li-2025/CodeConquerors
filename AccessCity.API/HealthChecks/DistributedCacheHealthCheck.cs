using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AccessCity.API.HealthChecks;

public sealed class DistributedCacheHealthCheck : IHealthCheck
{
    private const string CacheKey = "health:distributed-cache";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(5);
    private static readonly byte[] Payload = "ok"u8.ToArray();

    private readonly IMemoryCache _memoryCache;
    private readonly IDistributedCache _cache;

    public DistributedCacheHealthCheck(IMemoryCache memoryCache, IDistributedCache cache)
    {
        _memoryCache = memoryCache;
        _cache = cache;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (_memoryCache.TryGetValue(CacheKey, out HealthCheckResult cached))
        {
            return cached;
        }

        var key = $"health:cache:{Guid.NewGuid():N}";
        try
        {
            await _cache.SetAsync(
                key,
                Payload,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(15) },
                cancellationToken);
            var value = await _cache.GetAsync(key, cancellationToken);
            var result = value is { Length: > 0 }
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Degraded("Cache write succeeded but read returned no value.");
            _memoryCache.Set(CacheKey, result, CacheTtl);
            return result;
        }
        catch (Exception ex)
        {
            var result = HealthCheckResult.Unhealthy("Distributed cache is not reachable.", ex);
            _memoryCache.Set(CacheKey, result, CacheTtl);
            return result;
        }
    }
}
