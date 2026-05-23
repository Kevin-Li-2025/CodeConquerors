using System.Text.Json;
using AccessCity.API.Data;
using AccessCity.API.Models;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services;

public interface ISpatialQueryService
{
    Task<IReadOnlyList<PointOfInterest>> GetPointsOfInterestAsync(
        double lat,
        double lng,
        double radius,
        CancellationToken cancellationToken);

    Task<MapOverlayResponse?> GetMapOverlayAsync(string layerName, CancellationToken cancellationToken);
}

public sealed class SpatialQueryService : ISpatialQueryService
{
    private readonly AppDbContext _dbContext;

    public SpatialQueryService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<PointOfInterest>> GetPointsOfInterestAsync(
        double lat,
        double lng,
        double radius,
        CancellationToken cancellationToken)
    {
        var assets = await _dbContext.InfrastructureAssets
            .FromSqlInterpolated($"""
                SELECT *
                FROM infrastructure_assets
                WHERE ST_DWithin(
                    "Geometry"::geography,
                    ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography,
                    {radius})
                ORDER BY ST_Distance(
                    "Geometry"::geography,
                    ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography)
                LIMIT 100
                """)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return assets.Select(asset =>
        {
            var centroid = asset.Geometry is Point point ? point : asset.Geometry.Centroid;
            return new PointOfInterest
            {
                Id = Guid.NewGuid(),
                Name = asset.Name ?? asset.AssetType,
                Category = asset.AssetType,
                Location = new Point(centroid.X, centroid.Y) { SRID = 4326 },
                AccessibilityTags = ParseTags(asset.AccessibilityInfo)
            };
        }).ToList();
    }

    public async Task<MapOverlayResponse?> GetMapOverlayAsync(string layerName, CancellationToken cancellationToken)
    {
        if (string.Equals(layerName, "hazards", StringComparison.OrdinalIgnoreCase))
        {
            var hazards = await _dbContext.Hazards
                .AsNoTracking()
                .OrderByDescending(hazard => hazard.ReportedAt)
                .Take(250)
                .ToListAsync(cancellationToken);

            return new MapOverlayResponse
            {
                Layer = "hazards",
                Features = hazards.Select(hazard => new MapOverlayFeature
                {
                    Geometry = hazard.Location,
                    Properties = new
                    {
                        hazard.Id,
                        hazard.Type,
                        Status = hazard.Status.ToString(),
                        hazard.Description,
                        hazard.ReportedAt
                    }
                }).ToList()
            };
        }

        if (string.Equals(layerName, "infrastructure", StringComparison.OrdinalIgnoreCase))
        {
            var assets = await _dbContext.InfrastructureAssets
                .AsNoTracking()
                .OrderByDescending(asset => asset.UpdatedAt)
                .Take(250)
                .ToListAsync(cancellationToken);

            return new MapOverlayResponse
            {
                Layer = "infrastructure",
                Features = assets.Select(asset => new MapOverlayFeature
                {
                    Geometry = asset.Geometry,
                    Properties = new
                    {
                        asset.Id,
                        asset.AssetType,
                        asset.Name,
                        asset.Status,
                        AccessibilityTags = ParseTags(asset.AccessibilityInfo)
                    }
                }).ToList()
            };
        }

        return null;
    }

    private static Dictionary<string, string> ParseTags(JsonDocument json)
    {
        return json.RootElement.ValueKind == JsonValueKind.Object
            ? json.RootElement.EnumerateObject().ToDictionary(prop => prop.Name, prop => prop.Value.ToString())
            : new Dictionary<string, string>();
    }
}
