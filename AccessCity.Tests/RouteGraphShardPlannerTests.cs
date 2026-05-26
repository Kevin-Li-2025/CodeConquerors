using AccessCity.API.Configuration;
using AccessCity.API.Services;
using NetTopologySuite.Geometries;
using Xunit;

namespace AccessCity.Tests;

public sealed class RouteGraphShardPlannerTests
{
    [Fact]
    public void CorridorSlicing_Reduces_CrossCity_Bundle_Shards()
    {
        var start = new Coordinate(-1.8985, 52.4814);
        var end = new Coordinate(-1.9300, 52.4510);
        var region = RouteGraphShardPlanner.ComputePaddedRegion(start, end, new RoutingOptions
        {
            RouteGraphShardSizeDegrees = 0.01
        });

        var full = RouteGraphShardPlanner.ComputeLoadRegions(region, start, end, new RoutingOptions
        {
            RouteGraphPrepartitionedShardsEnabled = true,
            RouteGraphCorridorSlicingEnabled = false,
            RouteGraphShardSizeDegrees = 0.01,
            RouteGraphMaxPrepartitionedShardCount = 64
        });
        var corridor = RouteGraphShardPlanner.ComputeLoadRegions(region, start, end, new RoutingOptions
        {
            RouteGraphPrepartitionedShardsEnabled = true,
            RouteGraphCorridorSlicingEnabled = true,
            RouteGraphCorridorPaddingMetres = 600,
            RouteGraphShardSizeDegrees = 0.01,
            RouteGraphMaxPrepartitionedShardCount = 64
        });

        Assert.Equal(49, full.Count);
        Assert.InRange(corridor.Count, 2, 25);
        Assert.True(corridor.Count < full.Count);
        Assert.Contains(corridor, cell => Contains(cell, start));
        Assert.Contains(corridor, cell => Contains(cell, end));
    }

    [Fact]
    public void RegionSetFingerprint_Changes_When_Corridor_Cells_Differ()
    {
        var first = new[]
        {
            new GraphShardRegion(-1.90, 52.48, -1.89, 52.49),
            new GraphShardRegion(-1.89, 52.48, -1.88, 52.49)
        };
        var second = new[]
        {
            new GraphShardRegion(-1.90, 52.48, -1.89, 52.49),
            new GraphShardRegion(-1.90, 52.49, -1.89, 52.50)
        };

        Assert.NotEqual(
            RouteGraphShardPlanner.BuildRegionSetFingerprint(first),
            RouteGraphShardPlanner.BuildRegionSetFingerprint(second));
    }

    private static bool Contains(GraphShardRegion region, Coordinate coordinate) =>
        coordinate.X >= region.MinLon
        && coordinate.X <= region.MaxLon
        && coordinate.Y >= region.MinLat
        && coordinate.Y <= region.MaxLat;
}
