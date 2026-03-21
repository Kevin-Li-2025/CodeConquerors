using Microsoft.Extensions.Caching.Hybrid;

namespace AccessCity.API.Services;

/// <summary>
/// Tile-based risk pre-caching.
/// Divides the map into ~500m × 500m tiles and caches a composite risk score per tile.
/// Routing engine lookups become O(1) instead of running the full 6-factor model per edge.
/// </summary>
public interface IRiskTileCacheService
{
    Task<double> GetTileRiskAsync(double lat, double lng);
    Task WarmTilesAsync(double minLat, double minLng, double maxLat, double maxLng);
}

public class RiskTileCacheService : IRiskTileCacheService
{
    private readonly RiskScoringService _riskService;
    private readonly HybridCache _cache;
    private readonly ILogger<RiskTileCacheService> _logger;

    // ~500m at UK latitudes (0.0045° lat ≈ 500m, 0.007° lng ≈ 500m at 52°N)
    private const double TileLatSize = 0.0045;
    private const double TileLngSize = 0.007;
    private const string CachePrefix = "risktile:";
    private static readonly TimeSpan TileTtl = TimeSpan.FromMinutes(30);

    public RiskTileCacheService(
        RiskScoringService riskService,
        HybridCache cache,
        ILogger<RiskTileCacheService> logger)
    {
        _riskService = riskService;
        _cache = cache;
        _logger = logger;
    }

    public async Task<double> GetTileRiskAsync(double lat, double lng)
    {
        var key = TileKey(lat, lng);

#pragma warning disable EXTEXP0018
        return await _cache.GetOrCreateAsync(key, _ =>
        {
            double risk = _riskService.QuickRisk(lat, lng, Enumerable.Empty<Models.HazardReport>());
            double crime = _riskService.QuickCrimeRisk(lat, lng);
            double infra = _riskService.QuickInfrastructureRisk(lat, lng);
            double lighting = _riskService.QuickLightingCoverage(lat, lng);
            double surveillance = _riskService.QuickSurveillanceCoverage(lat, lng);

            // Composite: same weights as RiskScoringService
            double result = Math.Clamp(
                risk * 0.35 + crime * 0.12 + infra * 0.15 +
                lighting * 0.10 + surveillance * 0.08 + 0.20 * 0.15, 0, 1);
            return ValueTask.FromResult(result);
        }, new HybridCacheEntryOptions { Expiration = TileTtl });
#pragma warning restore EXTEXP0018
    }

    public async Task WarmTilesAsync(double minLat, double minLng, double maxLat, double maxLng)
    {
        int count = 0;
        for (double lat = minLat; lat <= maxLat; lat += TileLatSize)
        {
            for (double lng = minLng; lng <= maxLng; lng += TileLngSize)
            {
                await GetTileRiskAsync(lat + TileLatSize / 2, lng + TileLngSize / 2);
                count++;
            }
        }
        _logger.LogInformation("Warmed {Count} risk tiles", count);
    }

    private static string TileKey(double lat, double lng)
    {
        long tileRow = (long)Math.Floor(lat / TileLatSize);
        long tileCol = (long)Math.Floor(lng / TileLngSize);
        return $"{CachePrefix}{tileRow}:{tileCol}";
    }
}
