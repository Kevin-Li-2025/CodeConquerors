using System.Text;
using System.Threading.RateLimiting;
using AccessCity.API.Configuration;
using AccessCity.API.Data;
using AccessCity.API.Models.Identity;
using AccessCity.API.Services;
using AccessCity.API.Services.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.IdentityModel.Tokens;

EnvironmentBootstrap.LoadRepoRootDotEnv();

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<PostgresOptions>(builder.Configuration.GetSection(PostgresOptions.SectionName));
builder.Services.Configure<OsmImportOptions>(builder.Configuration.GetSection(OsmImportOptions.SectionName));

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
});

builder.Services.AddMemoryCache();
#pragma warning disable EXTEXP0018
builder.Services.AddHybridCache(options =>
{
    options.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromHours(1)
    };
});
#pragma warning restore EXTEXP0018

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        var factory = new NetTopologySuite.IO.Converters.GeoJsonConverterFactory();
        options.JsonSerializerOptions.Converters.Add(factory);
        options.JsonSerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowNamedFloatingPointLiterals;
    });

builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
{
    ConfigureDatabase(options, serviceProvider.GetRequiredService<IConfiguration>());
});

builder.Services.AddIdentityCore<AccessCityUser>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

builder.Services.AddScoped<IPasswordHasher<AccessCityUser>, Argon2PasswordHasher<AccessCityUser>>();

builder.Configuration["Jwt:Key"] ??= "AccessCity_Secret_Key_Secure_Long_Enough_For_HS512_2026_Development_Phase_64_Bytes_Long_!!!_STILL_ENFORCING_LENGTH_HE_HE";
builder.Configuration["Jwt:Issuer"] ??= "AccessCity.API";
builder.Configuration["Jwt:Audience"] ??= "AccessCity.App";
builder.Configuration["Jwt:AccessTokenExpirationMinutes"] ??= "60";
builder.Configuration["Jwt:RefreshTokenExpirationDays"] ??= "7";

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT key is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddSingleton<ISpatialCacheService, SpatialCacheService>();
builder.Services.AddSingleton<IBloomFilterService, BloomFilterService>();
builder.Services.AddScoped<IMapTileService, MapTileService>();
builder.Services.AddScoped<IRouteGraphRepository, RouteGraphRepository>();
builder.Services.AddScoped<IOsmImportService, OsmImportService>();
builder.Services.AddScoped<RiskScoringService>();
builder.Services.AddScoped<RoutingService>();
builder.Services.AddScoped<ITokenService, TokenService>();

builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
});

builder.Services.AddHttpClient<AccessCity.API.Services.External.IOpenStreetMapClient, AccessCity.API.Services.External.OverpassApiClient>();
builder.Services.AddHttpClient<AccessCity.API.Services.External.IUkPoliceDataClient, AccessCity.API.Services.External.UkPoliceDataClient>();
builder.Services.AddHttpClient<AccessCity.API.Services.External.ISafeHavenPlacesClient, AccessCity.API.Services.External.GooglePlacesClient>();
builder.Services.AddHttpClient<AccessCity.API.Services.External.ILiveHazardClient, AccessCity.API.Services.External.OpenWeatherClient>();

builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

await MigrateDatabaseAsync(app);
await RunOptionalOsmImportAsync(app);

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();

app.Run();

static void ConfigureDatabase(DbContextOptionsBuilder options, IConfiguration configuration)
{
    var connectionString = PostgresConnectionStringResolver.Resolve(configuration);
    var migrationsHistorySchema = PostgresConnectionStringResolver.GetPrimarySearchPath(connectionString);

    options.UseNpgsql(connectionString, npgsql =>
    {
        npgsql.UseNetTopologySuite();
        if (!string.IsNullOrWhiteSpace(migrationsHistorySchema))
        {
            npgsql.MigrationsHistoryTable("__EFMigrationsHistory", migrationsHistorySchema);
        }
    });
}

static async Task MigrateDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var postgresOptions = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<PostgresOptions>>();
    if (!postgresOptions.Value.AutoMigrate)
    {
        return;
    }

    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

static async Task RunOptionalOsmImportAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var osmOptions = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<OsmImportOptions>>();
    if (!osmOptions.Value.ImportOnStartup)
    {
        return;
    }

    var importer = scope.ServiceProvider.GetRequiredService<IOsmImportService>();
    await importer.ImportConfiguredAsync();
}

public partial class Program { }
