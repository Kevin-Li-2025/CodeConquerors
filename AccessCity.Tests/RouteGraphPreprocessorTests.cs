using AccessCity.API.Configuration;
using AccessCity.API.Models;
using AccessCity.API.Services;
using NetTopologySuite.Geometries;

namespace AccessCity.Tests;

public sealed class RouteGraphPreprocessorTests
{
    [Fact]
    public void Alt_preprocessing_keeps_shorter_duplicate_queue_candidates()
    {
        var graphData = new RouteGraphData
        {
            ShardKey = "duplicate-candidates",
            LoadedEdgeCount = 5,
            Nodes = new Dictionary<long, GraphNode>
            {
                [1] = new()
                {
                    Id = 1,
                    Location = new Coordinate(-1.0000, 52.0000),
                    Edges =
                    {
                        [2] = new GraphEdge { TargetNodeId = 2, DistanceMetres = 100 },
                        [3] = new GraphEdge { TargetNodeId = 3, DistanceMetres = 10 }
                    }
                },
                [2] = new()
                {
                    Id = 2,
                    Location = new Coordinate(-0.9990, 52.0000),
                    Edges =
                    {
                        [4] = new GraphEdge { TargetNodeId = 4, DistanceMetres = 10 }
                    }
                },
                [3] = new()
                {
                    Id = 3,
                    Location = new Coordinate(-0.9995, 52.0000),
                    Edges =
                    {
                        [2] = new GraphEdge { TargetNodeId = 2, DistanceMetres = 10 },
                        [4] = new GraphEdge { TargetNodeId = 4, DistanceMetres = 100 }
                    }
                },
                [4] = new()
                {
                    Id = 4,
                    Location = new Coordinate(-0.9980, 52.0000)
                }
            }
        };

        var preprocessing = RouteGraphPreprocessor.BuildAltPreprocessing(graphData, new RoutingOptions
        {
            RouteGraphAltPreprocessingEnabled = true,
            RouteGraphAltLandmarkCount = 4,
            RouteGraphMaxAltPreprocessedNodes = 10
        });

        Assert.NotNull(preprocessing);
        var lowerBound = RouteGraphPreprocessor.ComputeAltLowerBoundSeconds(preprocessing, 1, 4);
        Assert.InRange(lowerBound, 14.99, 15);
        Assert.Equal(0, RouteGraphPreprocessor.ComputeAltLowerBoundSeconds(preprocessing, 4, 1));
    }
}
