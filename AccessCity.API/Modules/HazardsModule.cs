using AccessCity.API.Services;

namespace AccessCity.API.Modules;

public static class HazardsModule
{
    public static IServiceCollection AddHazardsModule(this IServiceCollection services)
    {
        services.AddSingleton<ISpatialCacheService, SpatialCacheService>();

        services.AddScoped<IRealHazardDataService, RealHazardDataService>();
        services.AddScoped<IHazardReportService, HazardReportService>();
        services.AddScoped<IDashboardQueryService, DashboardQueryService>();

        return services;
    }
}
