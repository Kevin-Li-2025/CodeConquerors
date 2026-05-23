using AccessCity.API.Data;
using AccessCity.API.Models;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services;

public interface IOfflineMapBundleService
{
    Task<OfflineMapBundle> GetBundleAsync(
        double minLat,
        double minLng,
        double maxLat,
        double maxLng,
        CancellationToken cancellationToken);
}

public sealed record OfflineMapArea(double MinLat, double MinLng, double MaxLat, double MaxLng);

public sealed record OfflineMapBundle(
    OfflineMapArea Area,
    IReadOnlyList<HazardReport> Hazards,
    IReadOnlyList<InfrastructureAsset> Infrastructure,
    DateTime Timestamp,
    string Version);

public sealed class OfflineMapBundleService : IOfflineMapBundleService
{
    private readonly ISpatialCacheService _spatialCache;
    private readonly AppDbContext _dbContext;

    public OfflineMapBundleService(ISpatialCacheService spatialCache, AppDbContext dbContext)
    {
        _spatialCache = spatialCache;
        _dbContext = dbContext;
    }

    public async Task<OfflineMapBundle> GetBundleAsync(
        double minLat,
        double minLng,
        double maxLat,
        double maxLng,
        CancellationToken cancellationToken)
    {
        var bounds = new Envelope(minLng, maxLng, minLat, maxLat);
        var hazards = await _spatialCache.GetHazardsInBoundsAsync(bounds);

        var infrastructure = await _dbContext.InfrastructureAssets
            .FromSqlInterpolated($"""
                SELECT *
                FROM infrastructure_assets
                WHERE ST_Intersects(
                    "Geometry",
                    ST_MakeEnvelope({minLng}, {minLat}, {maxLng}, {maxLat}, 4326))
                """)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new OfflineMapBundle(
            new OfflineMapArea(minLat, minLng, maxLat, maxLng),
            hazards,
            infrastructure,
            DateTime.UtcNow,
            "1.0.0");
    }
}
