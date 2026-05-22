using Confluent.Kafka;
using System.Text.Json;

namespace AccessCity.API.Messaging.Kafka;

public class KafkaMessageBus : IMessageBus, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<KafkaMessageBus> _logger;
    private readonly string _bootstrapServers;
    private readonly string _consumerGroupId;
    private readonly string _topicPrefix;

    public KafkaMessageBus(IConfiguration configuration, ILogger<KafkaMessageBus> logger)
    {
        _logger = logger;
        _bootstrapServers = configuration["Kafka:BootstrapServers"] ?? "localhost:9092";
        _consumerGroupId = configuration["Kafka:ConsumerGroupId"] ?? "accesscity-workers";
        _topicPrefix = configuration["Kafka:TopicPrefix"] ?? "accesscity_";

        var config = new ProducerConfig
        {
            BootstrapServers = _bootstrapServers,
            ClientId = "AccessCity.API"
        };
        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public async Task PublishAsync<T>(T @event, CancellationToken cancellationToken = default) where T : IntegrationEvent
    {
        var topic = TopicFor<T>();
        var message = new Message<string, string>
        {
            Key = @event.Id.ToString(),
            Value = JsonSerializer.Serialize(@event)
        };

        await _producer.ProduceAsync(topic, message, cancellationToken);
    }

    public Task SubscribeAsync<T>(Func<T, Task> handler, CancellationToken cancellationToken = default) where T : IntegrationEvent
    {
        var topic = TopicFor<T>();
        _ = Task.Run(() => ConsumeLoopAsync(topic, handler, cancellationToken), cancellationToken);
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(2));
        _producer.Dispose();
    }

    private async Task ConsumeLoopAsync<T>(string topic, Func<T, Task> handler, CancellationToken cancellationToken)
        where T : IntegrationEvent
    {
        var config = new ConsumerConfig
        {
            BootstrapServers = _bootstrapServers,
            GroupId = _consumerGroupId,
            ClientId = $"AccessCity.API.{typeof(T).Name}.consumer",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };

        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(topic);
        _logger.LogInformation("Kafka consumer subscribed to {Topic} in group {GroupId}", topic, _consumerGroupId);

        while (!cancellationToken.IsCancellationRequested)
        {
            ConsumeResult<string, string>? result = null;
            try
            {
                result = consumer.Consume(cancellationToken);
                var @event = JsonSerializer.Deserialize<T>(result.Message.Value);
                if (@event is null)
                {
                    _logger.LogWarning("Skipping null Kafka event on {Topic} at {Offset}", topic, result.Offset);
                    consumer.Commit(result);
                    continue;
                }

                await handler(@event).ConfigureAwait(false);
                consumer.Commit(result);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Kafka consumer failed on {Topic} at {Offset}; message will be retried after restart if not committed.",
                    topic,
                    result?.Offset.ToString() ?? "unknown");
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken).ConfigureAwait(false);
            }
        }

        consumer.Close();
    }

    private string TopicFor<T>() => _topicPrefix + typeof(T).Name.ToLowerInvariant();
}
