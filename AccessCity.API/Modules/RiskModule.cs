using AccessCity.API.Services;

namespace AccessCity.API.Modules;

public static class RiskModule
{
    public static IServiceCollection AddRiskModule(this IServiceCollection services)
    {
        services.AddScoped<RiskScoringService>();
        services.AddScoped<IRiskScoringService>(sp => sp.GetRequiredService<RiskScoringService>());

        services.AddScoped<PredictiveRiskModel>();
        services.AddScoped<IPredictiveRiskModel>(sp => sp.GetRequiredService<PredictiveRiskModel>());

        services.AddScoped<IRiskTileCacheService, RiskTileCacheService>();
        services.AddScoped<IRiskScoreCacheService, RiskScoreCacheService>();

        return services;
    }
}
