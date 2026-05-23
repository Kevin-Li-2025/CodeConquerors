using System.Collections.Concurrent;
using System.Diagnostics;

namespace AccessCity.API.Services;

public interface IExternalDependencyGuard
{
    Task<T> ExecuteAsync<T>(
        string dependencyName,
        Func<CancellationToken, Task<T>> operation,
        Func<T> fallback,
        CancellationToken cancellationToken = default);
}

public sealed class ExternalDependencyGuard : IExternalDependencyGuard
{
    private readonly ConcurrentDictionary<string, DependencyState> _states = new(StringComparer.OrdinalIgnoreCase);
    private readonly IConfiguration _configuration;
    private readonly ILogger<ExternalDependencyGuard> _logger;
    private readonly AccessCityMetrics _metrics;

    public ExternalDependencyGuard(
        IConfiguration configuration,
        ILogger<ExternalDependencyGuard> logger,
        AccessCityMetrics metrics)
    {
        _configuration = configuration;
        _logger = logger;
        _metrics = metrics;
    }

    public async Task<T> ExecuteAsync<T>(
        string dependencyName,
        Func<CancellationToken, Task<T>> operation,
        Func<T> fallback,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var state = _states.GetOrAdd(dependencyName, CreateState);
        var now = DateTimeOffset.UtcNow;
        if (state.OpenUntilUtc > now)
        {
            _logger.LogDebug(
                "External dependency {DependencyName} circuit is open until {OpenUntilUtc}",
                dependencyName,
                state.OpenUntilUtc);
            _metrics.ExternalDependencyFallback(dependencyName, "circuit_open");
            _metrics.ExternalDependencyCompleted(dependencyName, "circuit_open", stopwatch.Elapsed.TotalMilliseconds);
            return fallback();
        }

        var queueTimeout = TimeSpan.FromMilliseconds(
            Math.Max(1, _configuration.GetValue("ExternalApis:CircuitBreaker:QueueTimeoutMilliseconds", 50)));

        if (!await state.Semaphore.WaitAsync(queueTimeout, cancellationToken).ConfigureAwait(false))
        {
            _logger.LogWarning("External dependency {DependencyName} concurrency queue is saturated", dependencyName);
            RecordFailure(dependencyName, state);
            _metrics.ExternalDependencyFallback(dependencyName, "bulkhead_saturated");
            _metrics.ExternalDependencyCompleted(dependencyName, "bulkhead_saturated", stopwatch.Elapsed.TotalMilliseconds);
            return fallback();
        }

        try
        {
            var timeout = TimeSpan.FromSeconds(
                Math.Max(1, _configuration.GetValue($"ExternalApis:{dependencyName}:TimeoutSeconds", 3)));

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(timeout);

            var result = await operation(timeoutCts.Token).ConfigureAwait(false);
            Interlocked.Exchange(ref state.ConsecutiveFailures, 0);
            state.OpenUntilUtc = DateTimeOffset.MinValue;
            _metrics.ExternalDependencyCompleted(dependencyName, "success", stopwatch.Elapsed.TotalMilliseconds);
            return result;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("External dependency {DependencyName} timed out", dependencyName);
            RecordFailure(dependencyName, state);
            _metrics.ExternalDependencyFallback(dependencyName, "timeout");
            _metrics.ExternalDependencyCompleted(dependencyName, "timeout", stopwatch.Elapsed.TotalMilliseconds);
            return fallback();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "External dependency {DependencyName} failed and returned fallback",
                dependencyName);
            RecordFailure(dependencyName, state);
            _metrics.ExternalDependencyFallback(dependencyName, "failure");
            _metrics.ExternalDependencyCompleted(dependencyName, "failure", stopwatch.Elapsed.TotalMilliseconds);
            return fallback();
        }
        finally
        {
            state.Semaphore.Release();
        }
    }

    private DependencyState CreateState(string dependencyName)
    {
        var maxConcurrent = Math.Max(1, _configuration.GetValue($"ExternalApis:{dependencyName}:MaxConcurrentRequests", 8));
        return new DependencyState(maxConcurrent);
    }

    private void RecordFailure(string dependencyName, DependencyState state)
    {
        var failureThreshold = Math.Max(1, _configuration.GetValue("ExternalApis:CircuitBreaker:FailureThreshold", 3));
        var failures = Interlocked.Increment(ref state.ConsecutiveFailures);
        if (failures < failureThreshold)
        {
            return;
        }

        var breakSeconds = Math.Max(1, _configuration.GetValue("ExternalApis:CircuitBreaker:BreakSeconds", 30));
        state.OpenUntilUtc = DateTimeOffset.UtcNow.AddSeconds(breakSeconds);
        _metrics.ExternalDependencyCircuitOpened(dependencyName);
        _logger.LogWarning(
            "External dependency {DependencyName} circuit opened for {BreakSeconds}s after {FailureCount} failures",
            dependencyName,
            breakSeconds,
            failures);
    }

    private sealed class DependencyState
    {
        public DependencyState(int maxConcurrentRequests)
        {
            Semaphore = new SemaphoreSlim(maxConcurrentRequests, maxConcurrentRequests);
        }

        public SemaphoreSlim Semaphore { get; }
        public int ConsecutiveFailures;
        public DateTimeOffset OpenUntilUtc;
    }
}
