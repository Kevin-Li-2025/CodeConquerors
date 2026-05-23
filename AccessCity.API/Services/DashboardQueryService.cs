using AccessCity.API.Data;
using AccessCity.API.Models;
using Microsoft.EntityFrameworkCore;

namespace AccessCity.API.Services;

public interface IDashboardQueryService
{
    Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken);

    Task<object> GetHeatMapAsync(CancellationToken cancellationToken);

    Task<IReadOnlyList<InfrastructureFeedItem>> GetInfrastructureFeedAsync(
        int limit,
        CancellationToken cancellationToken);
}

public sealed record DashboardSummary(
    int TotalHazards,
    int ActiveUsers,
    string ActiveUsersDefinition,
    int PendingAlerts,
    int Resolved);

public sealed record InfrastructureFeedItem(
    Guid Id,
    string Type,
    string Description,
    string Status,
    DateTime ReportedAt,
    double[]? Coordinates);

public sealed class DashboardQueryService : IDashboardQueryService
{
    private readonly IRealHazardDataService _realHazardData;
    private readonly AppDbContext _dbContext;

    public DashboardQueryService(IRealHazardDataService realHazardData, AppDbContext dbContext)
    {
        _realHazardData = realHazardData;
        _dbContext = dbContext;
    }

    public async Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var hazards = await _realHazardData.GetActiveHazardsAsync();
        var totalHazards = hazards.Count;
        var pendingAlerts = hazards.Count(h =>
            h.Status == HazardStatus.Reported || h.Status == HazardStatus.UnderReview);

        var now = DateTime.UtcNow;
        var activeUsers = await _dbContext.RefreshTokens.AsNoTracking()
            .Where(t => t.Revoked == null && t.Expires > now)
            .Select(t => t.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        return new DashboardSummary(
            totalHazards,
            activeUsers,
            "Distinct accounts with at least one non-revoked, non-expired refresh token.",
            pendingAlerts,
            hazards.Count(h => h.Status == HazardStatus.Resolved));
    }

    public async Task<object> GetHeatMapAsync(CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var hazards = await _realHazardData.GetActiveHazardsAsync();
        var features = new List<object>();

        foreach (var hazard in hazards)
        {
            if (hazard.Location == null) continue;

            features.Add(new
            {
                type = "Feature",
                geometry = new
                {
                    type = "Point",
                    coordinates = new[] { hazard.Location.X, hazard.Location.Y },
                },
                properties = new
                {
                    id = hazard.Id,
                    type = hazard.Type,
                    status = hazard.Status.ToString(),
                    reportedAt = hazard.ReportedAt,
                },
            });
        }

        return new
        {
            type = "FeatureCollection",
            features,
        };
    }

    public async Task<IReadOnlyList<InfrastructureFeedItem>> GetInfrastructureFeedAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var hazards = await _realHazardData.GetActiveHazardsAsync();

        return hazards
            .OrderByDescending(h => h.ReportedAt)
            .Take(Math.Clamp(limit, 1, 100))
            .Select(h => new InfrastructureFeedItem(
                h.Id,
                h.Type,
                h.Description,
                h.Status.ToString(),
                h.ReportedAt,
                h.Location != null ? new[] { h.Location.X, h.Location.Y } : null))
            .ToList();
    }
}
