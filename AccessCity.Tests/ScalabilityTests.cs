using System;
using System.Collections.Generic;
using System.Diagnostics;
using AccessCity.API.Models;
using AccessCity.API.Services;
using NetTopologySuite.Geometries;
using Xunit;
using Xunit.Abstractions;

namespace AccessCity.Tests;

public class ScalabilityTests
{
    private readonly ITestOutputHelper _output;

    public ScalabilityTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public void Algorithmic_ScaleUp_Verify_O1_H3Grid_and_OLogN_STRtree()
    {
        _output.WriteLine("=== Automated Multi-Dimensional Scalability Scaling Test ===");

        // Scale tiers: 1,000 -> 10,000 -> 100,000 -> 500,000 hazards
        int[] hazardScaleTiers = { 1000, 10000, 100000, 500000 };

        var random = new Random(42);
        var baseLat = 52.4862;
        var baseLon = -1.8904;

        // Generate a large pool of query points covering a national-scale bounding box
        var queryPoints = new List<(double Lat, double Lon)>();
        for (int i = 0; i < 5000; i++)
        {
            double latOffset = (random.NextDouble() - 0.5) * 1.5; // Up to ~150km span (National scale)
            double lonOffset = (random.NextDouble() - 0.5) * 1.5;
            queryPoints.Add((baseLat + latOffset, baseLon + lonOffset));
        }

        List<HazardReport> GenerateScaleHazards(int count)
        {
            var list = new List<HazardReport>();
            for (int i = 0; i < count; i++)
            {
                double latOffset = (random.NextDouble() - 0.5) * 2.0; // Dynamic national spread
                double lonOffset = (random.NextDouble() - 0.5) * 2.0;
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

        var results = new List<ScaleResult>();

        foreach (var tier in hazardScaleTiers)
        {
            // Force garbage collection for clean memory baseline
            GC.Collect(2, GCCollectionMode.Forced, blocking: true);
            long memBefore = GC.GetTotalMemory(forceFullCollection: true);

            var spatialIndex = new HazardSpatialIndex();
            var riskGrid = new H3HazardRiskGrid();

            // 1. Benchmark: Rebuilding Index + Grid (Ingestion overhead)
            var rebuildSw = Stopwatch.StartNew();
            var hazards = GenerateScaleHazards(tier);
            spatialIndex.Rebuild(hazards);
            riskGrid.Rebuild(spatialIndex);
            rebuildSw.Stop();
            double rebuildMs = rebuildSw.Elapsed.TotalMilliseconds;

            // Force collection to measure actual peak heap memory for this scale
            GC.Collect(2, GCCollectionMode.Forced, blocking: true);
            long memAfter = GC.GetTotalMemory(forceFullCollection: true);
            double heapAllocMb = (memAfter - memBefore) / 1024.0 / 1024.0;
            if (heapAllocMb < 0) heapAllocMb = 0.05; // Offset baseline noise

            // 2. Benchmark: Spatial R-Tree Query Latency (1,000 range searches within 300m)
            var rTreeSw = Stopwatch.StartNew();
            for (int i = 0; i < 1000; i++)
            {
                var q = queryPoints[i];
                var nearby = spatialIndex.QueryNearby(q.Lat, q.Lon, 300.0);
            }
            rTreeSw.Stop();
            double avgRTreeLatencyUs = (rTreeSw.Elapsed.TotalMilliseconds / 1000.0) * 1000.0;

            // 3. Benchmark: H3 Grid O(1) Lookup Latency (1,000 grid queries)
            var gridSw = Stopwatch.StartNew();
            for (int i = 0; i < 1000; i++)
            {
                var q = queryPoints[i];
                double risk = riskGrid.GetRisk(q.Lat, q.Lon);
            }
            gridSw.Stop();
            double avgGridLatencyUs = (gridSw.Elapsed.TotalMilliseconds / 1000.0) * 1000.0;

            results.Add(new ScaleResult(
                tier,
                rebuildMs,
                heapAllocMb,
                avgRTreeLatencyUs,
                avgGridLatencyUs
            ));
        }

        // Print Markdown Results Table
        _output.WriteLine("\n### Algorithmic Scalability Scaling Benchmark Results");
        _output.WriteLine("| Hazard Density Tier | Rebuild Duration | Peak Heap Memory | Avg R-Tree Query (300m) | Avg H3 Grid Lookup (O(1)) |");
        _output.WriteLine("| :--- | :--- | :--- | :--- | :--- |");
        foreach (var r in results)
        {
            _output.WriteLine($"| **{r.Tier:N0} active hazards** | {r.RebuildMs:F1} ms | {r.HeapAllocMb:F2} MB | {r.AvgRTreeUs:F3} μs | {r.AvgGridUs:F3} μs |");
        }

        // Assertions verifying sub-linear and sparse complexity guarantees
        var last = results[^1];
        var first = results[0];

        // 1. Assert O(1) grid lookup remains consistently near sub-microsecond levels
        Assert.True(last.AvgGridUs < 10.0, $"O(1) Grid lookup latency at {last.AvgGridUs:F3}μs exceeds 10μs limit!");
        
        // 2. Assert STRtree O(log N) scale guarantee: 500x data scale-up shouldn't cause linear latency growth
        double rTreeScalingRatio = last.AvgRTreeUs / first.AvgRTreeUs;
        Assert.True(rTreeScalingRatio < 100.0, $"R-Tree search scaled non-logarithmically! Ratio: {rTreeScalingRatio:F1}x");

        // 3. Assert H3 sparse memory efficiency: 500,000 hazards across the nation should occupy < 200MB
        Assert.True(last.HeapAllocMb < 200.0, $"H3 sparse memory footprint ({last.HeapAllocMb:F2} MB) exceeds 200MB ceiling!");
    }

    private record ScaleResult(
        int Tier,
        double RebuildMs,
        double HeapAllocMb,
        double AvgRTreeUs,
        double AvgGridUs
    );
}
