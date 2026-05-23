using System.Collections.Concurrent;
using AccessCity.API.Models;

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
    private readonly ConcurrentDictionary<string, CoalescedEntry<RouteResponse>> _inflight = new();
    private readonly ConcurrentDictionary<string, CoalescedEntry<SafePathOptionsResponse>> _optionsInflight = new();
    private readonly ILogger<RouteCoalescingService> _logger;
    private readonly AccessCityMetrics _metrics;

    public RouteCoalescingService(ILogger<RouteCoalescingService> logger, AccessCityMetrics metrics)
    {
        _logger = logger;
        _metrics = metrics;
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
        if (inflight.TryGetValue(key, out var existing) && !existing.IsExpired)
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
                var result = await factory();
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
                _ = RemoveAfterDelay(inflight, key, TimeSpan.FromMilliseconds(500));
            }
        }

        if (inflight.TryGetValue(key, out var raceWinner))
        {
            _metrics.RouteCoalescing($"{kind}:joined_race_winner");
            return await raceWinner.Task;
        }

        _metrics.RouteCoalescing($"{kind}:race_miss");
        return await factory();
    }

    private static string BuildKey(RouteRequest request)
    {
        var prefs = RouteRequestFingerprint.CanonicalPreferences(request.Preferences);
        return $"{request.Start?.X:F5},{request.Start?.Y:F5}->{request.End?.X:F5},{request.End?.Y:F5}|{request.Profile}|{request.SafetyWeight:F2}|prefs:{prefs}|{RouteRequestFingerprint.AlgorithmVersion}";
    }

    private static async Task RemoveAfterDelay<T>(
        ConcurrentDictionary<string, CoalescedEntry<T>> inflight,
        string key,
        TimeSpan delay)
    {
        await Task.Delay(delay);
        inflight.TryRemove(key, out _);
    }

    private sealed record CoalescedEntry<T>(Task<T?> Task, DateTime CreatedAt)
    {
        /// <summary>Entries older than 30 seconds are considered expired.</summary>
        public bool IsExpired => DateTime.UtcNow - CreatedAt > TimeSpan.FromSeconds(30);
    }
}
