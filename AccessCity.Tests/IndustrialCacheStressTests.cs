using AccessCity.API.Models;
using AccessCity.API.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Diagnostics;
using Xunit;
using Xunit.Abstractions;

namespace AccessCity.Tests
{
    public class IndustrialCacheStressTests : IClassFixture<AccessCityApiFactory>
    {
        private readonly ISpatialCacheService _spatialCache;
        private readonly ITestOutputHelper _output;

        public IndustrialCacheStressTests(AccessCityApiFactory factory, ITestOutputHelper output)
        {
            var scope = factory.Services.CreateScope();
            _spatialCache = scope.ServiceProvider.GetRequiredService<ISpatialCacheService>();
            _output = output;
        }

        [Fact]
        public async Task StressTest_HighConcurrency_Reads_And_Writes()
        {
            // 1. Arrange: Prepare 10,000 hazards
            int count = 10000;
            var hazards = Enumerable.Range(0, count).Select(i => new HazardReport
            {
                Id = Guid.NewGuid(),
                Location = new Point(i * 0.0001, i * 0.0001),
                Type = "stress",
                Status = HazardStatus.Reported,
                Description = "stress test",
                PhotoUrl = "url"
            }).ToList();

            _output.WriteLine($"Starting stress test with {count} items...");

            // 2. Act: High-concurrency writes
            var sw = Stopwatch.StartNew();
            var writeTasks = hazards.Select(h => _spatialCache.UpdateHazardCacheAsync(h));
            await Task.WhenAll(writeTasks);
            sw.Stop();
            _output.WriteLine($"Concurrent write of {count} items took: {sw.ElapsedMilliseconds}ms");

            // 3. Act: High-concurrency reads (simulating multiple users panning map)
            sw.Restart();
            var readTasks = Enumerable.Range(0, 100).Select(i => 
                _spatialCache.GetHazardsInBoundsAsync(new Envelope(0, 0.1, 0, 0.1))
            );
            var results = await Task.WhenAll(readTasks);
            sw.Stop();
            _output.WriteLine($"100 concurrent spatial queries took: {sw.ElapsedMilliseconds}ms");

            // 4. Assert
            Assert.All(results, r => Assert.NotEmpty(r));
            _output.WriteLine($"Benchmark: Average query time: {sw.ElapsedMilliseconds / 100.0}ms per user.");
        }
    }
}
