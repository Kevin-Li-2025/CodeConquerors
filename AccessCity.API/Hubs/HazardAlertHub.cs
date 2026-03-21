using Microsoft.AspNetCore.SignalR;

namespace AccessCity.API.Hubs;

/// <summary>
/// Real-time hazard alerting hub.
/// Clients subscribe to route-specific groups; the server broadcasts
/// when a new hazard is reported near an active route.
/// </summary>
public class HazardAlertHub : Hub
{
    /// <summary>Subscribe to alerts for a specific route.</summary>
    public async Task JoinRouteGroup(string routeId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, routeId);
    }

    /// <summary>Unsubscribe from a route's alerts.</summary>
    public async Task LeaveRouteGroup(string routeId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, routeId);
    }
}

/// <summary>Alert message pushed to connected clients.</summary>
public record RouteAlert(
    string Type,
    string Description,
    double Latitude,
    double Longitude,
    DateTime Timestamp);
