using AccessCity.API.Configuration;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services.Background;

public sealed class RouteGraphWarmupBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RoutingOptions _options;
    private readonly ILogger<RouteGraphWarmupBackgroundService> _logger;

    public RouteGraphWarmupBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<RoutingOptions> options,
        ILogger<RouteGraphWarmupBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.RouteGraphWarmupEnabled)
        {
            return;
        }

        var routes = _options.RouteGraphWarmupRoutes
            .Where(IsValidWarmupRoute)
            .ToList();
        if (routes.Count == 0)
        {
            _logger.LogInformation("Route graph warmup is enabled but no valid warmup routes are configured.");
            return;
        }

        var delay = TimeSpan.FromSeconds(Math.Clamp(_options.RouteGraphWarmupDelaySeconds, 0, 300));
        if (delay > TimeSpan.Zero)
        {
            await Task.Delay(delay, stoppingToken);
        }

        var interval = TimeSpan.FromSeconds(Math.Clamp(_options.RouteGraphWarmupIntervalSeconds, 60, 3600));
        using var timer = new PeriodicTimer(interval);

        do
        {
            await WarmConfiguredRoutesAsync(routes, stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task WarmConfiguredRoutesAsync(
        IReadOnlyList<RouteGraphWarmupRouteOptions> routes,
        CancellationToken cancellationToken)
    {
        foreach (var route in routes)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var repository = scope.ServiceProvider.GetRequiredService<IRouteGraphRepository>();
                var start = new Coordinate(route.StartLng, route.StartLat);
                var end = new Coordinate(route.EndLng, route.EndLat);
                var graph = await repository.LoadGraphAsync(start, end, cancellationToken);
                _logger.LogInformation(
                    "Warmed route graph shard for {RouteName}: {NodeCount} nodes, {EdgeCount} edges, truncated={IsTruncated}.",
                    route.Name,
                    graph.Nodes.Count,
                    graph.LoadedEdgeCount,
                    graph.IsTruncated);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Route graph warmup failed for {RouteName}.", route.Name);
            }
        }
    }

    private static bool IsValidWarmupRoute(RouteGraphWarmupRouteOptions route) =>
        IsValidLatitude(route.StartLat)
        && IsValidLatitude(route.EndLat)
        && IsValidLongitude(route.StartLng)
        && IsValidLongitude(route.EndLng);

    private static bool IsValidLatitude(double value) => value is >= -90 and <= 90;

    private static bool IsValidLongitude(double value) => value is >= -180 and <= 180;
}
