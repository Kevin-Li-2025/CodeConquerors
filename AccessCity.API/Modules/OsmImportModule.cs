using AccessCity.API.Configuration;
using AccessCity.API.Services;

namespace AccessCity.API.Modules;

public static class OsmImportModule
{
    public static IServiceCollection AddOsmImportModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<OsmImportOptions>(configuration.GetSection(OsmImportOptions.SectionName));

        services.AddScoped<IOsmImportService, OsmImportService>();
        services.AddScoped<IOsmImportJobService, OsmImportJobService>();

        if (configuration.GetValue("Workers:OsmImport:Enabled", true))
        {
            services.AddHostedService<AccessCity.API.Services.Background.OsmImportBackgroundService>();
        }

        return services;
    }
}
