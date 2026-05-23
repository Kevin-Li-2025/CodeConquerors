using System.Diagnostics;
using AccessCity.API.Configuration;
using Microsoft.Extensions.Options;

namespace AccessCity.API.Services;

public interface IRouteComputationLimiter
{
    ValueTask<RouteComputationLease?> TryAcquireAsync(TimeSpan waitTimeout, CancellationToken cancellationToken);
}

public sealed class RouteComputationLimiter : IRouteComputationLimiter
{
    private readonly SemaphoreSlim _semaphore;
    private readonly AccessCityMetrics _metrics;

    public RouteComputationLimiter(IOptions<RoutingOptions> options, AccessCityMetrics metrics)
    {
        var maxConcurrency = Math.Max(1, options.Value.MaxConcurrentComputations);
        _semaphore = new SemaphoreSlim(maxConcurrency, maxConcurrency);
        _metrics = metrics;
    }

    public async ValueTask<RouteComputationLease?> TryAcquireAsync(
        TimeSpan waitTimeout,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            var acquired = await _semaphore.WaitAsync(waitTimeout, cancellationToken).ConfigureAwait(false);
            _metrics.RouteComputationQueueWait(
                acquired ? "acquired" : "saturated",
                stopwatch.Elapsed.TotalMilliseconds);

            if (!acquired)
            {
                _metrics.RouteComputationSaturated();
                return null;
            }

            _metrics.RouteComputationStarted();
            return new RouteComputationLease(_semaphore, _metrics);
        }
        catch (OperationCanceledException)
        {
            _metrics.RouteComputationQueueWait("cancelled", stopwatch.Elapsed.TotalMilliseconds);
            throw;
        }
    }
}

public sealed class RouteComputationLease : IAsyncDisposable, IDisposable
{
    private readonly SemaphoreSlim _semaphore;
    private readonly AccessCityMetrics _metrics;
    private int _released;

    internal RouteComputationLease(SemaphoreSlim semaphore, AccessCityMetrics metrics)
    {
        _semaphore = semaphore;
        _metrics = metrics;
    }

    public ValueTask DisposeAsync()
    {
        Dispose();
        return ValueTask.CompletedTask;
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _released, 1) == 0)
        {
            _semaphore.Release();
            _metrics.RouteComputationCompleted();
        }
    }
}
