using AccessCity.API.Data;
using AccessCity.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AccessCity.API.Services;

public interface IRouteGraphStatusService
{
    Task<RouteGraphCoverageStatus> GetStatusAsync(CancellationToken cancellationToken = default);
    Task<string> GetVersionAsync(CancellationToken cancellationToken = default);
    void InvalidateLocalCache();
}

public sealed class RouteGraphStatusService : IRouteGraphStatusService
{
    private const string CacheKey = "route_graph_status:v1";
    private static readonly TimeSpan StatusTtl = TimeSpan.FromSeconds(5);

    private readonly AppDbContext _dbContext;
    private readonly IMemoryCache _memoryCache;

    public RouteGraphStatusService(AppDbContext dbContext, IMemoryCache memoryCache)
    {
        _dbContext = dbContext;
        _memoryCache = memoryCache;
    }

    public async Task<RouteGraphCoverageStatus> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        if (_memoryCache.TryGetValue(CacheKey, out RouteGraphCoverageStatus? cached) && cached is not null)
        {
            return cached;
        }

        var nodeCount = await _dbContext.RouteNodes
            .AsNoTracking()
            .LongCountAsync(cancellationToken);
        var edgeCount = await _dbContext.RouteEdges
            .AsNoTracking()
            .LongCountAsync(cancellationToken);

        var latestRun = await _dbContext.FeedIngestionRuns
            .AsNoTracking()
            .Where(run => run.SourceType == "osm")
            .OrderByDescending(run => run.FinishedAt ?? run.StartedAt)
            .ThenByDescending(run => run.Id)
            .Select(run => new
            {
                run.Id,
                run.Status,
                run.FinishedAt,
                run.SourceName
            })
            .FirstOrDefaultAsync(cancellationToken);

        var hasCoverage = nodeCount > 0 && edgeCount > 0;
        var version = hasCoverage
            ? $"osm:{latestRun?.Id ?? 0}:n{nodeCount}:e{edgeCount}"
            : $"osm:empty:{latestRun?.Id ?? 0}";

        string? warning = null;
        if (!hasCoverage)
        {
            warning = latestRun is null
                ? "Route graph is empty and no completed OSM import has been recorded; safe-path may use fallback routing."
                : "Route graph is empty after the latest OSM import; safe-path may use fallback routing.";
        }

        var status = new RouteGraphCoverageStatus(
            nodeCount,
            edgeCount,
            hasCoverage,
            version,
            latestRun?.Id,
            latestRun?.Status,
            latestRun?.FinishedAt,
            latestRun?.SourceName,
            warning);

        _memoryCache.Set(CacheKey, status, StatusTtl);
        return status;
    }

    public async Task<string> GetVersionAsync(CancellationToken cancellationToken = default) =>
        (await GetStatusAsync(cancellationToken)).Version;

    public void InvalidateLocalCache()
    {
        _memoryCache.Remove(CacheKey);
    }
}
