using System.Diagnostics;
using AccessCity.API.Models;
using AccessCity.API.Services;
using NetTopologySuite.Geometries;
using Xunit;
using Xunit.Abstractions;

namespace AccessCity.Tests;

public class SoakTests
{
    private readonly ITestOutputHelper _output;

    public SoakTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task H3Grid_HighIntensity_MultiThreaded_SoakTest()
    {
        _output.WriteLine("=== Starting High-Intensity Soak Test ===");

        // 1. Setup high-density spatial index (5,000 hazards dynamically updating)
        var random = new Random(1337);
        var baseLat = 52.4862;
        var baseLon = -1.8904;

        var spatialIndex = new HazardSpatialIndex();
        var riskGrid = new H3HazardRiskGrid();

        // 2. Generate simulated query points representing massive user traffic (10,000 points)
        var queryPoints = new List<(double Lat, double Lon)>();
        for (int i = 0; i < 10000; i++)
        {
            double latOffset = (random.NextDouble() - 0.5) * 0.1;
            double lonOffset = (random.NextDouble() - 0.5) * 0.1;
            queryPoints.Add((baseLat + latOffset, baseLon + lonOffset));
        }

        // Helper to generate dynamic updates
        List<HazardReport> GenerateHazards(int count)
        {
            var list = new List<HazardReport>();
            for (int i = 0; i < count; i++)
            {
                double latOffset = (random.NextDouble() - 0.5) * 0.15;
                double lonOffset = (random.NextDouble() - 0.5) * 0.15;
                list.Add(new HazardReport
                {
                    Id = Guid.NewGuid(),
                    Location = new Point(baseLon + lonOffset, baseLat + latOffset) { SRID = 4326 },
                    Type = random.Next(3) switch
                    {
                        0 => "broken_sidewalk",
                        1 => "pothole",
                        _ => "obstruction"
                    },
                    Status = HazardStatus.Reported
                });
            }
            return list;
        }

        // Initialize grid
        spatialIndex.Rebuild(GenerateHazards(1000));
        riskGrid.Rebuild(spatialIndex);
        GC.Collect(2, GCCollectionMode.Forced, blocking: true);
        long memoryBeforeBytes = GC.GetTotalMemory(forceFullCollection: true);

        // 3. Soak Phase: Run 15 parallel threads performing continuous concurrent reads
        // while a background writer thread continually rebuilds the grid to simulate
        // real-time telemetry updates. This tests lock-free snapshot isolation under heavy race pressure.
        const int readerThreads = 15;
        const int readIterationsPerThread = 50000; // 50,000 reads per thread = 750,000 total reads!
        const int writeIntervalMs = 50; // Rebuild index every 50ms

        var cts = new CancellationTokenSource();
        var sw = Stopwatch.StartNew();

        long totalReads = 0;
        long totalRebuilds = 0;
        long totalErrors = 0;

        // Background Writer Thread
        var writerTask = Task.Run(async () =>
        {
            try
            {
                while (!cts.Token.IsCancellationRequested)
                {
                    var freshHazards = GenerateHazards(1000 + random.Next(500));
                    spatialIndex.Rebuild(freshHazards);
                    riskGrid.Rebuild(spatialIndex);
                    Interlocked.Increment(ref totalRebuilds);
                    await Task.Delay(writeIntervalMs, cts.Token);
                }
            }
            catch (OperationCanceledException) when (cts.Token.IsCancellationRequested)
            {
                // Normal test shutdown.
            }
            catch (Exception ex)
            {
                _output.WriteLine($"Writer error: {ex.Message}");
                Interlocked.Increment(ref totalErrors);
            }
        });

        // Parallel Reader Threads
        var readerTasks = new List<Task>();
        for (int t = 0; t < readerThreads; t++)
        {
            int threadId = t;
            readerTasks.Add(Task.Run(() =>
            {
                var localRand = new Random(threadId);
                for (int i = 0; i < readIterationsPerThread; i++)
                {
                    // Select a random query point
                    var pt = queryPoints[localRand.Next(queryPoints.Count)];
                    try
                    {
                        double risk = riskGrid.GetRisk(pt.Lat, pt.Lon);
                        // Access value to prevent optimization compiler stripping
                        if (risk < 0 || risk > 1.0)
                        {
                            Interlocked.Increment(ref totalErrors);
                        }
                        Interlocked.Increment(ref totalReads);
                    }
                    catch (Exception ex)
                    {
                        _output.WriteLine($"Reader thread {threadId} error: {ex.Message}");
                        Interlocked.Increment(ref totalErrors);
                    }
                }
            }));
        }

        // Wait for readers to finish
        await Task.WhenAll(readerTasks);
        cts.Cancel(); // Stop the writer
        await writerTask;
        sw.Stop();

        // 4. Memory Profiling Check
        long memoryAfterBytes = GC.GetTotalMemory(forceFullCollection: true);
        double memoryAfterMb = memoryAfterBytes / 1024.0 / 1024.0;
        double memoryDeltaMb = Math.Max(0.0, (memoryAfterBytes - memoryBeforeBytes) / 1024.0 / 1024.0);

        double durationSec = sw.Elapsed.TotalSeconds;
        double throughput = totalReads / durationSec;

        _output.WriteLine("=== Soak Test Completed Successfully ===");
        _output.WriteLine($"| Metric | Value |");
        _output.WriteLine($"| :--- | :--- |");
        _output.WriteLine($"| **Duration** | {durationSec:F2} seconds |");
        _output.WriteLine($"| **Total Readers** | {readerThreads} threads |");
        _output.WriteLine($"| **Total Concurrent Reads** | {totalReads:N0} queries |");
        _output.WriteLine($"| **Background Grid Rebuilds** | {totalRebuilds} times |");
        _output.WriteLine($"| **Read Throughput** | {throughput:N0} ops/sec |");
        _output.WriteLine($"| **Total Execution Errors** | {totalErrors} |");
        _output.WriteLine($"| **Heap Memory Usage** | {memoryAfterMb:F2} MB |");
        _output.WriteLine($"| **Heap Memory Delta** | {memoryDeltaMb:F2} MB |");

        // Assertions for high reliability under stress
        Assert.Equal(0, totalErrors); // No null references, race exceptions, or index-out-of-bounds
        Assert.True(throughput > 100000, $"Throughput of {throughput:N0} should be > 100,000 ops/sec");
        Assert.True(memoryDeltaMb < 50.0, $"Heap memory delta ({memoryDeltaMb:F2} MB) should remain tiny");
    }
}
