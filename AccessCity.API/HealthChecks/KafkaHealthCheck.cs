using AccessCity.API.Messaging.Kafka;
using Confluent.Kafka;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace AccessCity.API.HealthChecks;

public sealed class KafkaHealthCheck : IHealthCheck
{
    private const string CacheKey = "health:kafka";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(5);

    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly IOptions<KafkaOptions> _options;

    public KafkaHealthCheck(
        IConfiguration configuration,
        IMemoryCache cache,
        IOptions<KafkaOptions> options)
    {
        _configuration = configuration;
        _cache = cache;
        _options = options;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (!_configuration.GetValue<bool>("Messaging:UseKafka"))
        {
            return Task.FromResult(HealthCheckResult.Healthy("Kafka disabled."));
        }

        if (_cache.TryGetValue(CacheKey, out HealthCheckResult cached))
        {
            return Task.FromResult(cached);
        }

        try
        {
            using var admin = new AdminClientBuilder(new AdminClientConfig
            {
                BootstrapServers = _options.Value.BootstrapServers,
                ClientId = "AccessCity.API.health"
            }).Build();

            var metadata = admin.GetMetadata(TimeSpan.FromSeconds(2));
            var result = metadata.Brokers.Count > 0
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Kafka returned no brokers.");
            _cache.Set(CacheKey, result, CacheTtl);
            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            var result = HealthCheckResult.Unhealthy("Kafka is not reachable.", ex);
            _cache.Set(CacheKey, result, CacheTtl);
            return Task.FromResult(result);
        }
    }
}
