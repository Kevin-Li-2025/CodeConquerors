namespace AccessCity.API.Services.Background;

/// <summary>
/// Background service that pre-warms risk tiles every 30 minutes
/// for Birmingham and London city centres.
/// </summary>
public class TileWarmingBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TileWarmingBackgroundService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    // Birmingham city centre bounding box
    private const double BhamMinLat = 52.46, BhamMaxLat = 52.50;
    private const double BhamMinLng = -1.93, BhamMaxLng = -1.87;

    // London (Elephant & Castle area) bounding box
    private const double LdnMinLat = 51.48, LdnMaxLat = 51.52;
    private const double LdnMinLng = -0.13, LdnMaxLng = -0.07;

    public TileWarmingBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<TileWarmingBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for app startup to complete
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var tileCache = scope.ServiceProvider.GetRequiredService<IRiskTileCacheService>();

                _logger.LogInformation("Starting risk tile warming cycle");
                await tileCache.WarmTilesAsync(BhamMinLat, BhamMinLng, BhamMaxLat, BhamMaxLng);
                await tileCache.WarmTilesAsync(LdnMinLat, LdnMinLng, LdnMaxLat, LdnMaxLng);
                _logger.LogInformation("Risk tile warming cycle complete");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tile warming failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }
}
