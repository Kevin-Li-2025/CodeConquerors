using AccessCity.API.Configuration;
using AccessCity.API.Services;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace AccessCity.API.HealthChecks;

public sealed class RouteGraphCoverageHealthCheck : IHealthCheck
{
    private readonly IRouteGraphStatusService _routeGraphStatus;
    private readonly RoutingOptions _routingOptions;

    public RouteGraphCoverageHealthCheck(
        IRouteGraphStatusService routeGraphStatus,
        IOptions<RoutingOptions> routingOptions)
    {
        _routeGraphStatus = routeGraphStatus;
        _routingOptions = routingOptions.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var status = await _routeGraphStatus.GetStatusAsync(cancellationToken);
        var data = new Dictionary<string, object>
        {
            ["routeNodeCount"] = status.RouteNodeCount,
            ["routeEdgeCount"] = status.RouteEdgeCount,
            ["version"] = status.Version
        };

        if (status.LatestOsmRunId.HasValue)
        {
            data["latestOsmRunId"] = status.LatestOsmRunId.Value;
            data["latestOsmRunStatus"] = status.LatestOsmRunStatus ?? "unknown";
        }

        if (status.HasCoverage)
        {
            return HealthCheckResult.Healthy("Route graph coverage is available.", data);
        }

        var message = status.Warning ?? "Route graph coverage is unavailable.";
        return _routingOptions.RequireRouteGraphForReadiness
            ? HealthCheckResult.Unhealthy(message, data: data)
            : HealthCheckResult.Degraded(message, data: data);
    }
}
