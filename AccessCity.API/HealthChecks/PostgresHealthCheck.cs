using System.Data;
using AccessCity.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AccessCity.API.HealthChecks;

public sealed class PostgresHealthCheck : IHealthCheck
{
    private const string CacheKey = "health:postgres";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(5);

    private readonly IMemoryCache _cache;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    public PostgresHealthCheck(IMemoryCache cache, IServiceScopeFactory scopeFactory)
    {
        _cache = cache;
        _scopeFactory = scopeFactory;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(CacheKey, out HealthCheckResult cached))
        {
            return cached;
        }

        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            if (_cache.TryGetValue(CacheKey, out cached))
            {
                return cached;
            }

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            HealthCheckResult result;
            if (string.Equals(dbContext.Database.ProviderName, "Npgsql.EntityFrameworkCore.PostgreSQL", StringComparison.Ordinal))
            {
                result = await CheckPostgresAsync(dbContext, cancellationToken);
            }
            else
            {
                result = await dbContext.Database.CanConnectAsync(cancellationToken)
                    ? HealthCheckResult.Healthy()
                    : HealthCheckResult.Unhealthy("Database is not reachable.");
            }

            _cache.Set(CacheKey, result, CacheTtl);
            return result;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            var result = HealthCheckResult.Unhealthy("Database is not reachable.", ex);
            _cache.Set(CacheKey, result, CacheTtl);
            return result;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private static async Task<HealthCheckResult> CheckPostgresAsync(
        AppDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var connection = dbContext.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1";
            command.CommandTimeout = 2;
            var value = await command.ExecuteScalarAsync(cancellationToken);
            return value is 1
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Database health query returned an unexpected result.");
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }
}
