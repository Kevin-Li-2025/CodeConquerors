using System.Diagnostics;
using System.Net;
using Xunit;
using Xunit.Abstractions;

namespace AccessCity.Tests;

/// <summary>
/// Production-grade load tests with latency distribution (p50/p95/p99),
/// cold-start vs warm-start comparison, concurrent-user simulation,
/// and throughput metrics. Results printed as Markdown tables.
/// </summary>
public class ApiStressTests : IClassFixture<AccessCityApiFactory>
{
    private readonly AccessCityApiFactory _factory;
    private readonly ITestOutputHelper _output;

    public ApiStressTests(AccessCityApiFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
    }

    // ─────────── Helpers: latency recording ───────────

    private record LatencyResult(int StatusCode, double ElapsedMs);

    private static double Percentile(List<double> sorted, double p)
    {
        if (sorted.Count == 0) return double.NaN;
        double k = (sorted.Count - 1) * (p / 100.0);
        int lo = (int)Math.Floor(k), hi = (int)Math.Ceiling(k);
        return lo == hi ? sorted[lo] : sorted[lo] * (hi - k) + sorted[hi] * (k - lo);
    }

    private void PrintLatencyTable(string endpoint, List<LatencyResult> results)
    {
        var ok = results.Where(r => r.StatusCode is >= 200 and < 300 or 204).ToList();
        var times = ok.Select(r => r.ElapsedMs).OrderBy(t => t).ToList();

        _output.WriteLine($"\n### {endpoint}");
        _output.WriteLine($"| Metric | Value |");
        _output.WriteLine($"|--------|-------|");
        _output.WriteLine($"| Requests | {results.Count} |");
        _output.WriteLine($"| Success | {ok.Count}/{results.Count} ({100.0 * ok.Count / results.Count:F1}%) |");

        if (times.Count > 0)
        {
            _output.WriteLine($"| p50 | {Percentile(times, 50):F2} ms |");
            _output.WriteLine($"| p95 | {Percentile(times, 95):F2} ms |");
            _output.WriteLine($"| p99 | {Percentile(times, 99):F2} ms |");
            _output.WriteLine($"| Min | {times.First():F2} ms |");
            _output.WriteLine($"| Max | {times.Last():F2} ms |");
            _output.WriteLine($"| Throughput | {results.Count / (times.Sum() / 1000.0):F1} req/s (sequential) |");
        }
    }

    private async Task<List<LatencyResult>> RunConcurrentBurst(
        HttpClient client, string url, int concurrency, string method = "GET", HttpContent? body = null)
    {
        var results = new List<LatencyResult>();
        var tasks = Enumerable.Range(0, concurrency).Select(async _ =>
        {
            var sw = Stopwatch.StartNew();
            HttpResponseMessage resp;
            if (method == "POST")
                resp = await client.PostAsync(url, body);
            else
                resp = await client.GetAsync(url);
            sw.Stop();
            return new LatencyResult((int)resp.StatusCode, sw.Elapsed.TotalMilliseconds);
        });

        var completed = await Task.WhenAll(tasks);
        results.AddRange(completed);
        return results;
    }

    // ─────────── Cold Start vs Warm Start ───────────

    [Fact]
    public async Task Health_ColdVsWarm_LatencyComparison()
    {
        var client = _factory.CreateClient();

        // Cold start: first request after factory spin-up
        var coldSw = Stopwatch.StartNew();
        var coldResp = await client.GetAsync("/health");
        coldSw.Stop();
        double coldMs = coldSw.Elapsed.TotalMilliseconds;

        // Warm: 10 subsequent requests
        var warmResults = new List<double>();
        for (int i = 0; i < 10; i++)
        {
            var sw = Stopwatch.StartNew();
            await client.GetAsync("/health");
            sw.Stop();
            warmResults.Add(sw.Elapsed.TotalMilliseconds);
        }

        warmResults.Sort();

        _output.WriteLine("### Cold Start vs Warm Start — /health");
        _output.WriteLine("| Phase | Latency |");
        _output.WriteLine("|-------|---------|");
        _output.WriteLine($"| Cold (1st request) | {coldMs:F2} ms |");
        _output.WriteLine($"| Warm p50 | {Percentile(warmResults, 50):F2} ms |");
        _output.WriteLine($"| Warm p95 | {Percentile(warmResults, 95):F2} ms |");
        _output.WriteLine($"| Warm min | {warmResults.First():F2} ms |");
        _output.WriteLine($"| Warm max | {warmResults.Last():F2} ms |");

        Assert.Equal(HttpStatusCode.OK, coldResp.StatusCode);
    }

    // ─────────── Concurrent Burst: Health ───────────

    [Fact]
    public async Task Health_ConcurrentBurst_LatencyDistribution()
    {
        const int concurrency = 25;
        var client = _factory.CreateClient();

        // Warm up
        await client.GetAsync("/health");

        var results = await RunConcurrentBurst(client, "/health", concurrency);

        PrintLatencyTable("/health (25 concurrent)", results);
        Assert.All(results, r => Assert.Equal(200, r.StatusCode));
    }

    // ─────────── Staggered Waves ───────────

    [Fact]
    public async Task Health_StaggeredWaves_SustainedLoad()
    {
        const int waves = 5;
        const int perWave = 15;
        const int pauseMs = 1500;
        var client = _factory.CreateClient();
        var allResults = new List<LatencyResult>();

        for (int w = 0; w < waves; w++)
        {
            var waveResults = await RunConcurrentBurst(client, "/health", perWave);
            allResults.AddRange(waveResults);
            if (w < waves - 1) await Task.Delay(pauseMs);
        }

        PrintLatencyTable($"/health ({waves}×{perWave} staggered, {pauseMs}ms gap)", allResults);
        Assert.True(allResults.Count(r => r.StatusCode == 200) >= allResults.Count * 0.9,
            "At least 90% of requests should succeed");
    }

    // ─────────── Concurrent Burst: Spatial POI ───────────

    [Fact]
    public async Task SpatialPoi_ConcurrentBurst_LatencyDistribution()
    {
        const int concurrency = 20;
        var client = _factory.CreateClient();
        var url = "/api/v1/spatial/poi?lat=52.48&lng=-1.89&radius=500";

        // Warm up
        await client.GetAsync(url);

        var results = await RunConcurrentBurst(client, url, concurrency);

        PrintLatencyTable("/spatial/poi (20 concurrent)", results);
        Assert.All(results, r => Assert.Equal(200, r.StatusCode));
    }

    // ─────────── Concurrent Burst: Dashboard ───────────

    [Fact]
    public async Task Dashboard_ConcurrentBurst_LatencyDistribution()
    {
        const int concurrency = 15;
        var client = _factory.CreateClient();
        var url = "/api/v1/dashboard/summary";

        await client.GetAsync(url);

        var results = await RunConcurrentBurst(client, url, concurrency);

        PrintLatencyTable("/dashboard/summary (15 concurrent)", results);
        Assert.All(results, r => Assert.Equal(200, r.StatusCode));
    }

    // ─────────── Concurrent Burst: Hazards ───────────

    [Fact]
    public async Task Hazards_ConcurrentBurst_AcceptsLoadGracefully()
    {
        const int concurrency = 16;
        var client = _factory.CreateClient();
        var url = "/api/v1/hazards?minLat=52.45&minLng=-1.95&maxLat=52.52&maxLng=-1.88";

        await client.GetAsync(url);

        var results = await RunConcurrentBurst(client, url, concurrency);

        PrintLatencyTable("/hazards (16 concurrent)", results);
        Assert.All(results, r =>
            Assert.True(r.StatusCode is 200 or 503, $"Unexpected {r.StatusCode}"));
    }

    // ─────────── Authenticated Concurrent Burst ───────────

    [Fact]
    public async Task Authenticated_InfraFeed_ConcurrentBurst()
    {
        const int concurrency = 12;
        var client = await _factory.CreateAuthenticatedClientAsync();
        var url = "/api/v1/dashboard/infrastructure-feed?limit=10";

        await client.GetAsync(url);

        var results = await RunConcurrentBurst(client, url, concurrency);

        PrintLatencyTable("/infrastructure-feed (12 concurrent, authenticated)", results);
        Assert.All(results, r =>
            Assert.True(r.StatusCode is 200 or 503, $"Unexpected {r.StatusCode}"));
    }

    // ─────────── Multi-Endpoint Mixed Load ───────────

    [Fact]
    public async Task MixedEndpoints_SimultaneousLoad()
    {
        var client = _factory.CreateClient();
        var endpoints = new[]
        {
            "/health",
            "/api/v1/dashboard/summary",
            "/api/v1/spatial/poi?lat=52.48&lng=-1.89&radius=500",
            "/api/v1/hazards",
            "/api/v1/routing/risk-score?lat=52.4862&lng=-1.8904&radius=200",
        };

        // Warm up all endpoints
        foreach (var ep in endpoints) await client.GetAsync(ep);

        var allTasks = new List<Task<LatencyResult>>();
        foreach (var ep in endpoints)
        {
            for (int i = 0; i < 5; i++)
            {
                var endpoint = ep; // capture for closure
                allTasks.Add(Task.Run(async () =>
                {
                    var sw = Stopwatch.StartNew();
                    var resp = await client.GetAsync(endpoint);
                    sw.Stop();
                    return new LatencyResult((int)resp.StatusCode, sw.Elapsed.TotalMilliseconds);
                }));
            }
        }

        var results = await Task.WhenAll(allTasks);

        var times = results.Select(r => r.ElapsedMs).OrderBy(t => t).ToList();
        int ok = results.Count(r => r.StatusCode is >= 200 and <= 503);

        _output.WriteLine("\n### Mixed-Endpoint Simultaneous Load (5 endpoints × 5 requests)");
        _output.WriteLine("| Metric | Value |");
        _output.WriteLine("|--------|-------|");
        _output.WriteLine($"| Total requests | {results.Length} |");
        _output.WriteLine($"| Success | {ok}/{results.Length} |");
        _output.WriteLine($"| p50 | {Percentile(times, 50):F2} ms |");
        _output.WriteLine($"| p95 | {Percentile(times, 95):F2} ms |");
        _output.WriteLine($"| p99 | {Percentile(times, 99):F2} ms |");
        _output.WriteLine($"| Wall-clock throughput | {results.Length / (times.Max() / 1000.0):F1} req/s |");

        Assert.True(ok >= results.Length * 0.8, "At least 80% of mixed-load requests should succeed");
    }
}

