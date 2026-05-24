using AccessCity.API.Models;
using AccessCity.API.Services;
using AccessCity.API.Configuration;
using NetTopologySuite.Geometries;

namespace AccessCity.Tests;

public sealed class RouteGraphArtifactCodecTests
{
    [Fact]
    public void Packed_route_graph_artifact_round_trips_static_edge_weights()
    {
        var graphData = new RouteGraphData
        {
            ShardKey = "test-shard",
            SourceShardKeys = new[] { "cell-a" },
            LoadedEdgeCount = 1,
            Nodes = new Dictionary<long, GraphNode>
            {
                [1] = new()
                {
                    Id = 1,
                    Location = new Coordinate(-1.8904, 52.4862),
                    Edges =
                    {
                        [2] = new GraphEdge
                        {
                            TargetNodeId = 2,
                            DistanceMetres = 90,
                            BaseSafetyCost = 0.2,
                            SurfaceType = "unknown",
                            AccessibilityCostVersion = RouteEdgeCostModel.Version,
                            StandardAccessibilityPenaltySeconds = 10,
                            WheelchairAccessibilityPenaltySeconds = 120,
                            StrollerAccessibilityPenaltySeconds = 90
                        }
                    }
                },
                [2] = new()
                {
                    Id = 2,
                    Location = new Coordinate(-1.8894, 52.4862)
                }
            }
        };
        RouteGraphSpatialIndex.BuildSpatialBuckets(graphData);
        RouteGraphPreprocessor.TryAttachPreprocessing(graphData, new RoutingOptions
        {
            RouteGraphAltPreprocessingEnabled = true,
            RouteGraphAltLandmarkCount = 2,
            RouteGraphMaxAltPreprocessedNodes = 100
        });

        var artifact = RouteGraphArtifactCodec.Pack(graphData);
        var unpacked = RouteGraphArtifactCodec.Unpack(artifact);

        Assert.Equal(RouteGraphArtifactCodec.SchemaVersion, artifact.SchemaVersion);
        Assert.Equal(RouteEdgeCostModel.EdgeWeightVersion, artifact.EdgeWeightVersion);
        Assert.NotNull(artifact.Preprocessing);
        Assert.Single(artifact.SourceShardKeys);
        Assert.Single(artifact.Edges);
        Assert.Equal(0, artifact.Nodes.Single(node => node.Id == 1).FirstEdgeIndex);

        var edge = unpacked.Nodes[1].Edges[2];
        Assert.Equal(RouteEdgeCostModel.EdgeWeightVersion, edge.EdgeWeightVersion);
        Assert.True(edge.WheelchairTraversalSeconds > edge.StandardTraversalSeconds);
        Assert.True(unpacked.SpatialBuckets.Count > 0);
        Assert.NotNull(unpacked.Preprocessing);
        Assert.True(unpacked.Preprocessing!.HasLandmarks);
        Assert.Equal("cell-a", unpacked.SourceShardKeys.Single());
    }

    [Fact]
    public void Alt_preprocessing_computes_deterministic_landmark_lower_bounds()
    {
        var graphData = new RouteGraphData
        {
            ShardKey = "line",
            LoadedEdgeCount = 2,
            Nodes = new Dictionary<long, GraphNode>
            {
                [1] = new()
                {
                    Id = 1,
                    Location = new Coordinate(-1.000, 52.000),
                    Edges =
                    {
                        [2] = new GraphEdge { TargetNodeId = 2, DistanceMetres = 100 }
                    }
                },
                [2] = new()
                {
                    Id = 2,
                    Location = new Coordinate(-0.999, 52.000),
                    Edges =
                    {
                        [3] = new GraphEdge { TargetNodeId = 3, DistanceMetres = 100 }
                    }
                },
                [3] = new()
                {
                    Id = 3,
                    Location = new Coordinate(-0.998, 52.000)
                }
            }
        };

        var preprocessing = RouteGraphPreprocessor.BuildAltPreprocessing(graphData, new RoutingOptions
        {
            RouteGraphAltPreprocessingEnabled = true,
            RouteGraphAltLandmarkCount = 2,
            RouteGraphMaxAltPreprocessedNodes = 10
        });

        Assert.NotNull(preprocessing);
        Assert.True(preprocessing!.HasLandmarks);
        Assert.Equal(RouteGraphPreprocessor.AltAlgorithmVersion, preprocessing.AlgorithmVersion);

        var lowerBound = RouteGraphPreprocessor.ComputeAltLowerBoundSeconds(preprocessing, 1, 3);
        Assert.True(lowerBound >= 100);
        Assert.Equal(0, RouteGraphPreprocessor.ComputeAltLowerBoundSeconds(preprocessing, 3, 1));
    }

    [Fact]
    public void Packed_route_graph_artifact_omits_redundant_endpoint_geometry()
    {
        var from = new Coordinate(-1.8904, 52.4862);
        var to = new Coordinate(-1.8894, 52.4862);
        var graphData = new RouteGraphData
        {
            ShardKey = "geometry-shard",
            LoadedEdgeCount = 1,
            Nodes = new Dictionary<long, GraphNode>
            {
                [1] = new()
                {
                    Id = 1,
                    Location = from,
                    Edges =
                    {
                        [2] = new GraphEdge
                        {
                            TargetNodeId = 2,
                            DistanceMetres = 90,
                            Geometry = new[] { from, to }
                        }
                    }
                },
                [2] = new() { Id = 2, Location = to }
            }
        };

        var artifact = RouteGraphArtifactCodec.Pack(graphData);

        Assert.Null(artifact.Edges.Single().Geometry);
    }

    [Fact]
    public void Packed_route_graph_binary_redis_payload_round_trips()
    {
        var graphData = new RouteGraphData
        {
            ShardKey = "binary-shard",
            LoadedEdgeCount = 2,
            Nodes = new Dictionary<long, GraphNode>
            {
                [1] = new()
                {
                    Id = 1,
                    Location = new Coordinate(-1.8904, 52.4862),
                    Edges =
                    {
                        [2] = new GraphEdge { TargetNodeId = 2, DistanceMetres = 90 },
                        [3] = new GraphEdge { TargetNodeId = 3, DistanceMetres = 110 }
                    }
                },
                [2] = new() { Id = 2, Location = new Coordinate(-1.8894, 52.4862) },
                [3] = new() { Id = 3, Location = new Coordinate(-1.8884, 52.4862) }
            }
        };

        var artifact = RouteGraphArtifactCodec.Pack(graphData);
        var json = RouteGraphArtifactCodec.SerializeJsonBytes(artifact);
        var payload = RouteGraphArtifactCodec.SerializeRedisPayload(artifact);

        Assert.Equal((byte)'A', payload[0]);
        Assert.Equal((byte)'C', payload[1]);
        Assert.True(payload.Length < json.Length);
        Assert.True(RouteGraphArtifactCodec.TryDeserializeRedisPayload(payload, out var restored));
        Assert.NotNull(restored);
        var unpacked = RouteGraphArtifactCodec.Unpack(restored!);
        Assert.Equal(3, unpacked.Nodes.Count);
        Assert.Equal(2, unpacked.LoadedEdgeCount);
    }
}
