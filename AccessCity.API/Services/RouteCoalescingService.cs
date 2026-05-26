using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using AccessCity.API.Configuration;
using AccessCity.API.Models;
using AccessCity.API.Serialization;
using Microsoft.Extensions.Options;
using NetTopologySuite.IO.Converters;
using StackExchange.Redis;

namespace AccessCity.API.Services;

/// <summary>
/// Coalesces identical route computation requests within a configurable time window.
/// If multiple clients request the same origin→destination within 500ms, only one
/// A* computation is executed and the result is shared among all waiters.
/// This dramatically reduces redundant PostGIS load under concurrent traffic.
/// </summary>
public interface IRouteCoalescingService
{
    /// <summary>
    /// Returns a cached or in-flight result for the given request.
    /// If no computation is in progress, starts one using <paramref name="factory"/>.
    /// </summary>
    Task<RouteResponse?> GetOrComputeAsync(RouteRequest request, Func<Task<RouteResponse?>> factory);

    /// <summary>
    /// Returns an in-flight route-options result for the given request.
    /// Use this around the full cache-miss path to coalesce hazard lookups, cache fill, and route computation.
    /// </summary>
    Task<SafePathOptionsResponse?> GetOrComputeOptionsAsync(
        RouteRequest request,
        Func<Task<SafePathOptionsResponse?>> factory);

    /// <summary>
    /// Returns an in-flight route-options result for the given request and context fingerprint.
    /// </summary>
    Task<SafePathOptionsResponse?> GetOrComputeOptionsAsync(
        RouteRequest request,
        string contextFingerprint,
        Func<Task<SafePathOptionsResponse?>> factory);
}

public sealed class RouteCoalescingService : IRouteCoalescingService
{
    private const string ReleaseLockScript =
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    private static readonly JsonSerializerOptions DistributedResultJsonOptions = CreateDistributedResultJsonOptions();

    private readonly ConcurrentDictionary<string, CoalescedEntry<RouteResponse>> _inflight = new();
    private readonly ConcurrentDictionary<string, CoalescedEntry<SafePathOptionsResponse>> _optionsInflight = new();
    private readonly ILogger<RouteCoalescingService> _logger;
    private readonly AccessCityMetrics _metrics;
    private readonly RoutingOptions _options;
    private readonly TimeSpan _localEntryTtl;
    private readonly IConnectionMultiplexer? _redis;

    public RouteCoalescingService(ILogger<RouteCoalescingService> logger, AccessCityMetrics metrics)
        : this(logger, metrics, Options.Create(new RoutingOptions()), null)
    {
    }

    public RouteCoalescingService(
        ILogger<RouteCoalescingService> logger,
        AccessCityMetrics metrics,
        IOptions<RoutingOptions> options,
        IConnectionMultiplexer? redis = null)
    {
        _logger = logger;
        _metrics = metrics;
        _options = options.Value;
        _localEntryTtl = TimeSpan.FromSeconds(Math.Clamp(_options.LocalCoalescingEntryTtlSeconds, 1, 300));
        _redis = redis;
    }

    public async Task<RouteResponse?> GetOrComputeAsync(RouteRequest request, Func<Task<RouteResponse?>> factory)
    {
        var key = BuildKey(request);
        return await GetOrComputeCoreAsync(_inflight, key, "route", factory);
    }

    public async Task<SafePathOptionsResponse?> GetOrComputeOptionsAsync(
        RouteRequest request,
        Func<Task<SafePathOptionsResponse?>> factory)
    {
        var key = $"options:{BuildKey(request)}";
        return await GetOrComputeCoreAsync(_optionsInflight, key, "options", factory);
    }

    public async Task<SafePathOptionsResponse?> GetOrComputeOptionsAsync(
        RouteRequest request,
        string contextFingerprint,
        Func<Task<SafePathOptionsResponse?>> factory)
    {
        var key = $"options:{BuildKey(request)}|ctx:{contextFingerprint}";
        return await GetOrComputeCoreAsync(_optionsInflight, key, "options", factory);
    }

    private async Task<T?> GetOrComputeCoreAsync<T>(
        ConcurrentDictionary<string, CoalescedEntry<T>> inflight,
        string key,
        string kind,
        Func<Task<T?>> factory)
    {
        if (TryGetActiveEntry(inflight, key, _localEntryTtl, out var existing))
        {
            _logger.LogDebug("Route {Kind} request coalesced for key {Key}", kind, key);
            _metrics.RouteCoalescing($"{kind}:joined_existing");
            return await existing.Task;
        }

        var tcs = new TaskCompletionSource<T?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var entry = new CoalescedEntry<T>(tcs.Task, DateTime.UtcNow);

        if (inflight.TryAdd(key, entry))
        {
            _metrics.RouteCoalescing($"{kind}:started");
            try
            {
                var result = await RunDistributedSingleFlightAsync(kind, key, factory);
                tcs.SetResult(result);
                return result;
            }
            catch (Exception ex)
            {
                tcs.SetException(ex);
                throw;
            }
            finally
            {
                // Allow re-computation after a short window while still absorbing near-simultaneous duplicates.
                _ = RemoveAfterDelay(inflight, key, entry, TimeSpan.FromMilliseconds(500));
            }
        }

        if (TryGetActiveEntry(inflight, key, _localEntryTtl, out var raceWinner))
        {
            _metrics.RouteCoalescing($"{kind}:joined_race_winner");
            return await raceWinner.Task;
        }

        _metrics.RouteCoalescing($"{kind}:race_miss");
        return await RunDistributedSingleFlightAsync(kind, key, factory);
    }

    private async Task<T?> RunDistributedSingleFlightAsync<T>(
        string kind,
        string key,
        Func<Task<T?>> factory)
    {
        if (!CanUseDistributedCoalescing())
        {
            return await factory();
        }

        var database = _redis!.GetDatabase();
        var lockKey = $"route:coalesce:{key}";
        var resultKey = $"route:coalesce:result:{key}";
        var lockToken = Guid.NewGuid().ToString("N");
        var lockTtl = TimeSpan.FromSeconds(Math.Clamp(_options.DistributedCoalescingLockTtlSeconds, 1, 60));

        try
        {
            var recentResult = await TryReadDistributedResultAsync<T>(database, resultKey);
            if (recentResult is not null)
            {
                _metrics.RouteCoalescing($"{kind}:distributed_result_hit");
                return recentResult;
            }

            var acquired = await database.StringSetAsync(lockKey, lockToken, lockTtl, When.NotExists);
            if (acquired)
            {
                _metrics.RouteCoalescing($"{kind}:distributed_started");
                try
                {
                    var result = await factory();
                    await TryWriteDistributedResultAsync(database, resultKey, result);
                    return result;
                }
                finally
                {
                    await ReleaseDistributedLockAsync(database, lockKey, lockToken);
                }
            }

            _metrics.RouteCoalescing($"{kind}:distributed_wait");
            var peerResult = await WaitForDistributedPeerAsync<T>(database, lockKey, resultKey);
            if (peerResult is not null)
            {
                _metrics.RouteCoalescing($"{kind}:distributed_wait_result_hit");
                return peerResult;
            }

            _metrics.RouteCoalescing($"{kind}:distributed_after_wait");
            return await factory();
        }
        catch (RedisTimeoutException ex)
        {
            _logger.LogDebug(ex, "Redis route coalescing timed out for {Kind}; falling back to local execution.", kind);
            _metrics.RouteCoalescing($"{kind}:distributed_timeout");
            return await factory();
        }
        catch (RedisException ex)
        {
            _logger.LogDebug(ex, "Redis route coalescing unavailable for {Kind}; falling back to local execution.", kind);
            _metrics.RouteCoalescing($"{kind}:distributed_unavailable");
            return await factory();
        }
    }

    private bool CanUseDistributedCoalescing() =>
        _options.DistributedCoalescingEnabled
        && _redis is { IsConnected: true };

    private async Task<T?> WaitForDistributedPeerAsync<T>(
        IDatabase database,
        RedisKey lockKey,
        RedisKey resultKey)
    {
        var waitBudget = TimeSpan.FromMilliseconds(
            Math.Clamp(_options.DistributedCoalescingWaitMilliseconds, 0, 10_000));
        if (waitBudget == TimeSpan.Zero)
        {
            return default;
        }

        var poll = TimeSpan.FromMilliseconds(
            Math.Clamp(_options.DistributedCoalescingPollMilliseconds, 5, 500));
        var deadline = DateTime.UtcNow + waitBudget;

        while (DateTime.UtcNow < deadline)
        {
            await Task.Delay(poll);
            var result = await TryReadDistributedResultAsync<T>(database, resultKey);
            if (result is not null)
            {
                return result;
            }

            if (!await database.KeyExistsAsync(lockKey))
            {
                return await TryReadDistributedResultAsync<T>(database, resultKey);
            }
        }

        return default;
    }

    private async Task TryWriteDistributedResultAsync<T>(IDatabase database, RedisKey resultKey, T? result)
    {
        if (result is null)
        {
            return;
        }

        try
        {
            var ttl = TimeSpan.FromSeconds(Math.Clamp(_options.DistributedCoalescingResultTtlSeconds, 1, 30));
            var json = JsonSerializer.Serialize(result, DistributedResultJsonOptions);
            await database.StringSetAsync(resultKey, json, ttl);
        }
        catch (Exception ex) when (ex is JsonException or RedisException)
        {
            _logger.LogDebug(ex, "Redis route coalescing result {ResultKey} could not be written.", resultKey);
        }
    }

    private async Task<T?> TryReadDistributedResultAsync<T>(IDatabase database, RedisKey resultKey)
    {
        try
        {
            var json = await database.StringGetAsync(resultKey);
            if (json.IsNullOrEmpty)
            {
                return default;
            }

            return JsonSerializer.Deserialize<T>(json!, DistributedResultJsonOptions);
        }
        catch (Exception ex) when (ex is JsonException or RedisException)
        {
            _logger.LogDebug(ex, "Redis route coalescing result {ResultKey} could not be read.", resultKey);
            return default;
        }
    }

    private async Task ReleaseDistributedLockAsync(IDatabase database, RedisKey lockKey, RedisValue lockToken)
    {
        try
        {
            await database.ScriptEvaluateAsync(
                ReleaseLockScript,
                new RedisKey[] { lockKey },
                new RedisValue[] { lockToken });
        }
        catch (RedisException ex)
        {
            _logger.LogDebug(ex, "Redis route coalescing lock {LockKey} could not be released.", lockKey);
        }
    }

    private static string BuildKey(RouteRequest request)
    {
        var prefs = RouteRequestFingerprint.CanonicalPreferences(request.Preferences);
        return $"{request.Start?.X:F5},{request.Start?.Y:F5}->{request.End?.X:F5},{request.End?.Y:F5}|{request.Profile}|{request.SafetyWeight:F2}|prefs:{prefs}|{RouteRequestFingerprint.AlgorithmVersion}";
    }

    private static async Task RemoveAfterDelay<T>(
        ConcurrentDictionary<string, CoalescedEntry<T>> inflight,
        string key,
        CoalescedEntry<T> entry,
        TimeSpan delay)
    {
        await Task.Delay(delay);
        inflight.TryRemove(new KeyValuePair<string, CoalescedEntry<T>>(key, entry));
    }

    private sealed record CoalescedEntry<T>(Task<T?> Task, DateTime CreatedAt)
    {
        public bool IsExpired(TimeSpan ttl) => DateTime.UtcNow - CreatedAt > ttl;
    }

    private static bool TryGetActiveEntry<T>(
        ConcurrentDictionary<string, CoalescedEntry<T>> inflight,
        string key,
        TimeSpan ttl,
        out CoalescedEntry<T> entry)
    {
        while (inflight.TryGetValue(key, out var current))
        {
            if (!current.IsExpired(ttl))
            {
                entry = current;
                return true;
            }

            inflight.TryRemove(new KeyValuePair<string, CoalescedEntry<T>>(key, current));
        }

        entry = null!;
        return false;
    }

    private static JsonSerializerOptions CreateDistributedResultJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals
        };
        options.Converters.Add(new CoordinateJsonConverter());
        options.Converters.Add(new GeoJsonConverterFactory());
        return options;
    }
}
