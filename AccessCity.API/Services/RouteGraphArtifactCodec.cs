using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Serialization;
using AccessCity.API.Models;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services;

public static class RouteGraphArtifactCodec
{
    public const string SchemaVersion = "packed-route-graph-v3";
    private static readonly JsonSerializerOptions PackedJsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static PackedRouteGraphArtifact Pack(RouteGraphData graphData)
    {
        var nodes = graphData.Nodes.Values
            .OrderBy(node => node.Id)
            .ToArray();
        var nodeById = nodes.ToDictionary(node => node.Id);
        var packedNodes = new List<PackedRouteGraphNode>(nodes.Length);
        var packedEdges = new List<PackedRouteGraphEdge>(Math.Max(0, graphData.LoadedEdgeCount));

        foreach (var node in nodes)
        {
            var firstEdgeIndex = packedEdges.Count;
            foreach (var edge in node.Edges.Values.OrderBy(edge => edge.TargetNodeId))
            {
                var edgeWithWeights = EnsureTraversalWeights(edge);
                var packedGeometry = ShouldPackGeometry(edgeWithWeights, node, nodeById)
                    ? edgeWithWeights.Geometry?.Select(coord => new PackedRouteGraphCoordinate(coord.X, coord.Y)).ToArray()
                    : null;
                packedEdges.Add(new PackedRouteGraphEdge(
                    edgeWithWeights.TargetNodeId,
                    edgeWithWeights.DistanceMetres,
                    edgeWithWeights.BaseSafetyCost,
                    edgeWithWeights.SurfaceType,
                    edgeWithWeights.HasStairs,
                    edgeWithWeights.HasCrossing,
                    edgeWithWeights.IsUnderConstruction,
                    edgeWithWeights.LightingQuality,
                    edgeWithWeights.IsSteep,
                    edgeWithWeights.KerbHeight,
                    edgeWithWeights.Smoothness,
                    edgeWithWeights.WidthMetres,
                    edgeWithWeights.HasTactilePaving,
                    edgeWithWeights.HasBarrier,
                    edgeWithWeights.Access,
                    edgeWithWeights.AccessibilityCostVersion,
                    edgeWithWeights.StandardAccessibilityPenaltySeconds,
                    edgeWithWeights.WheelchairAccessibilityPenaltySeconds,
                    edgeWithWeights.StrollerAccessibilityPenaltySeconds,
                    edgeWithWeights.AccessibilityDataQuality,
                    edgeWithWeights.EdgeWeightVersion,
                    edgeWithWeights.StandardTraversalSeconds,
                    edgeWithWeights.WheelchairTraversalSeconds,
                    edgeWithWeights.StrollerTraversalSeconds,
                    packedGeometry));
            }

            packedNodes.Add(new PackedRouteGraphNode(
                node.Id,
                node.Location.X,
                node.Location.Y,
                firstEdgeIndex,
                packedEdges.Count - firstEdgeIndex));
        }

        return new PackedRouteGraphArtifact(
            SchemaVersion,
            RouteEdgeCostModel.Version,
            RouteEdgeCostModel.EdgeWeightVersion,
            graphData.ShardKey,
            graphData.SourceShardKeys.ToArray(),
            graphData.LoadedEdgeCount,
            graphData.IsTruncated,
            graphData.SpatialBucketSizeDegrees,
            PackPreprocessing(graphData, nodes),
            packedNodes.ToArray(),
            packedEdges.ToArray());
    }

    public static RouteGraphData Unpack(PackedRouteGraphArtifact artifact)
    {
        if (!IsCompatible(artifact))
        {
            throw new InvalidOperationException(
                $"Route graph artifact {artifact.SchemaVersion}/cost-v{artifact.EdgeCostVersion}/weight-v{artifact.EdgeWeightVersion} is not compatible.");
        }

        var nodes = artifact.Nodes.ToDictionary(
            node => node.Id,
            node => new GraphNode
            {
                Id = node.Id,
                Location = new Coordinate(node.X, node.Y)
            });

        foreach (var node in artifact.Nodes)
        {
            if (!nodes.TryGetValue(node.Id, out var graphNode))
            {
                continue;
            }

            var end = Math.Min(artifact.Edges.Length, node.FirstEdgeIndex + node.EdgeCount);
            for (var i = node.FirstEdgeIndex; i < end; i++)
            {
                var edge = artifact.Edges[i];
                graphNode.Edges[edge.TargetNodeId] = new GraphEdge
                {
                    TargetNodeId = edge.TargetNodeId,
                    DistanceMetres = edge.DistanceMetres,
                    BaseSafetyCost = edge.BaseSafetyCost,
                    SurfaceType = edge.SurfaceType,
                    HasStairs = edge.HasStairs,
                    HasCrossing = edge.HasCrossing,
                    IsUnderConstruction = edge.IsUnderConstruction,
                    LightingQuality = edge.LightingQuality,
                    IsSteep = edge.IsSteep,
                    KerbHeight = edge.KerbHeight,
                    Smoothness = edge.Smoothness,
                    WidthMetres = edge.WidthMetres,
                    HasTactilePaving = edge.HasTactilePaving,
                    HasBarrier = edge.HasBarrier,
                    Access = edge.Access,
                    AccessibilityCostVersion = edge.AccessibilityCostVersion,
                    StandardAccessibilityPenaltySeconds = edge.StandardAccessibilityPenaltySeconds,
                    WheelchairAccessibilityPenaltySeconds = edge.WheelchairAccessibilityPenaltySeconds,
                    StrollerAccessibilityPenaltySeconds = edge.StrollerAccessibilityPenaltySeconds,
                    AccessibilityDataQuality = edge.AccessibilityDataQuality,
                    EdgeWeightVersion = edge.EdgeWeightVersion,
                    StandardTraversalSeconds = edge.StandardTraversalSeconds,
                    WheelchairTraversalSeconds = edge.WheelchairTraversalSeconds,
                    StrollerTraversalSeconds = edge.StrollerTraversalSeconds,
                    Geometry = edge.Geometry?.Select(coord => new Coordinate(coord.X, coord.Y)).ToArray()
                };
            }
        }

        var graphData = new RouteGraphData
        {
            Nodes = nodes,
            IsTruncated = artifact.IsTruncated,
            ShardKey = artifact.ShardKey,
            SourceShardKeys = artifact.SourceShardKeys,
            LoadedEdgeCount = artifact.LoadedEdgeCount,
            SpatialBucketSizeDegrees = artifact.SpatialBucketSizeDegrees
        };
        graphData.Preprocessing = UnpackPreprocessing(artifact.Preprocessing, artifact.Nodes);
        RouteGraphSpatialIndex.BuildSpatialBuckets(graphData);
        return graphData;
    }

    public static byte[] SerializeJsonBytes(PackedRouteGraphArtifact artifact) =>
        JsonSerializer.SerializeToUtf8Bytes(artifact, PackedJsonOptions);

    public static byte[] SerializeRedisPayload(PackedRouteGraphArtifact artifact)
    {
        var json = SerializeJsonBytes(artifact);
        using var output = new MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            gzip.Write(json);
        }

        return output.ToArray();
    }

    public static bool TryDeserializeRedisPayload(byte[] payload, out PackedRouteGraphArtifact? artifact)
    {
        artifact = null;
        try
        {
            var json = IsGzipPayload(payload) ? Decompress(payload) : payload;
            artifact = JsonSerializer.Deserialize<PackedRouteGraphArtifact>(json, PackedJsonOptions);
            return artifact is not null && !string.IsNullOrWhiteSpace(artifact.SchemaVersion);
        }
        catch (Exception ex) when (ex is InvalidDataException or JsonException or NotSupportedException)
        {
            return false;
        }
    }

    public static bool IsCompatible(PackedRouteGraphArtifact artifact) =>
        string.Equals(artifact.SchemaVersion, SchemaVersion, StringComparison.Ordinal)
        && artifact.EdgeCostVersion == RouteEdgeCostModel.Version
        && artifact.EdgeWeightVersion == RouteEdgeCostModel.EdgeWeightVersion
        && IsCompatible(artifact.Preprocessing);

    private static bool IsCompatible(PackedRouteGraphPreprocessing? preprocessing) =>
        preprocessing is null
        || (string.Equals(preprocessing.Algorithm, "ALT", StringComparison.Ordinal)
            && preprocessing.AlgorithmVersion == RouteGraphPreprocessor.AltAlgorithmVersion
            && string.Equals(preprocessing.WeightVersion, RouteGraphPreprocessor.AltWeightVersion, StringComparison.Ordinal));

    private static PackedRouteGraphPreprocessing? PackPreprocessing(RouteGraphData graphData, GraphNode[] nodes)
    {
        var preprocessing = graphData.Preprocessing;
        if (preprocessing?.HasLandmarks != true || !IsCompatible(new PackedRouteGraphPreprocessing(
                preprocessing.Algorithm,
                preprocessing.AlgorithmVersion,
                preprocessing.WeightVersion,
                preprocessing.LandmarkNodeIds,
                Array.Empty<PackedRouteGraphLandmark>())))
        {
            return null;
        }

        var landmarks = preprocessing.LandmarkNodeIds
            .Select((landmarkNodeId, landmarkIndex) =>
            {
                var forward = new float[nodes.Length];
                var reverse = new float[nodes.Length];
                for (var nodeIndex = 0; nodeIndex < nodes.Length; nodeIndex++)
                {
                    if (preprocessing.NodeDistances.TryGetValue(nodes[nodeIndex].Id, out var distances)
                        && landmarkIndex < distances.FromLandmarkSeconds.Length
                        && landmarkIndex < distances.ToLandmarkSeconds.Length)
                    {
                        forward[nodeIndex] = EncodeDistance(distances.FromLandmarkSeconds[landmarkIndex]);
                        reverse[nodeIndex] = EncodeDistance(distances.ToLandmarkSeconds[landmarkIndex]);
                    }
                    else
                    {
                        forward[nodeIndex] = -1;
                        reverse[nodeIndex] = -1;
                    }
                }

                return new PackedRouteGraphLandmark(landmarkNodeId, forward, reverse);
            })
            .ToArray();

        return new PackedRouteGraphPreprocessing(
            preprocessing.Algorithm,
            preprocessing.AlgorithmVersion,
            preprocessing.WeightVersion,
            preprocessing.LandmarkNodeIds,
            landmarks);
    }

    private static RouteGraphPreprocessingData? UnpackPreprocessing(
        PackedRouteGraphPreprocessing? preprocessing,
        PackedRouteGraphNode[] nodes)
    {
        if (preprocessing is null || !IsCompatible(preprocessing) || preprocessing.Landmarks.Length == 0)
        {
            return null;
        }

        var nodeDistances = new Dictionary<long, RouteGraphNodePreprocessing>(nodes.Length);
        foreach (var node in nodes)
        {
            nodeDistances[node.Id] = new RouteGraphNodePreprocessing
            {
                FromLandmarkSeconds = new double[preprocessing.Landmarks.Length],
                ToLandmarkSeconds = new double[preprocessing.Landmarks.Length]
            };
        }

        for (var landmarkIndex = 0; landmarkIndex < preprocessing.Landmarks.Length; landmarkIndex++)
        {
            var landmark = preprocessing.Landmarks[landmarkIndex];
            if (landmark.FromLandmarkSeconds.Length != nodes.Length
                || landmark.ToLandmarkSeconds.Length != nodes.Length)
            {
                return null;
            }

            for (var nodeIndex = 0; nodeIndex < nodes.Length; nodeIndex++)
            {
                var distances = nodeDistances[nodes[nodeIndex].Id];
                distances.FromLandmarkSeconds[landmarkIndex] = DecodeDistance(landmark.FromLandmarkSeconds[nodeIndex]);
                distances.ToLandmarkSeconds[landmarkIndex] = DecodeDistance(landmark.ToLandmarkSeconds[nodeIndex]);
            }
        }

        return new RouteGraphPreprocessingData
        {
            Algorithm = preprocessing.Algorithm,
            AlgorithmVersion = preprocessing.AlgorithmVersion,
            WeightVersion = preprocessing.WeightVersion,
            LandmarkNodeIds = preprocessing.LandmarkNodeIds,
            NodeDistances = nodeDistances
        };
    }

    private static float EncodeDistance(double distanceSeconds) =>
        double.IsFinite(distanceSeconds) && distanceSeconds >= 0 ? (float)Math.Round(distanceSeconds, 3) : -1;

    private static double DecodeDistance(float encodedSeconds) =>
        encodedSeconds < 0 ? double.PositiveInfinity : encodedSeconds;

    private static GraphEdge EnsureTraversalWeights(GraphEdge edge)
    {
        if (edge.EdgeWeightVersion == RouteEdgeCostModel.EdgeWeightVersion)
        {
            return edge;
        }

        var copy = new GraphEdge
        {
            TargetNodeId = edge.TargetNodeId,
            DistanceMetres = edge.DistanceMetres,
            BaseSafetyCost = edge.BaseSafetyCost,
            SurfaceType = edge.SurfaceType,
            HasStairs = edge.HasStairs,
            HasCrossing = edge.HasCrossing,
            IsUnderConstruction = edge.IsUnderConstruction,
            LightingQuality = edge.LightingQuality,
            IsSteep = edge.IsSteep,
            KerbHeight = edge.KerbHeight,
            Smoothness = edge.Smoothness,
            WidthMetres = edge.WidthMetres,
            HasTactilePaving = edge.HasTactilePaving,
            HasBarrier = edge.HasBarrier,
            Access = edge.Access,
            AccessibilityCostVersion = edge.AccessibilityCostVersion,
            StandardAccessibilityPenaltySeconds = edge.StandardAccessibilityPenaltySeconds,
            WheelchairAccessibilityPenaltySeconds = edge.WheelchairAccessibilityPenaltySeconds,
            StrollerAccessibilityPenaltySeconds = edge.StrollerAccessibilityPenaltySeconds,
            AccessibilityDataQuality = edge.AccessibilityDataQuality,
            Geometry = edge.Geometry
        };
        RouteEdgeCostModel.PopulateTraversalWeights(copy);
        return copy;
    }

    private static bool ShouldPackGeometry(
        GraphEdge edge,
        GraphNode fromNode,
        IReadOnlyDictionary<long, GraphNode> nodes)
    {
        if (edge.Geometry is null || edge.Geometry.Length < 2)
        {
            return false;
        }

        if (edge.Geometry.Length > 2 || !nodes.TryGetValue(edge.TargetNodeId, out var targetNode))
        {
            return true;
        }

        return !SameCoordinate(edge.Geometry[0], fromNode.Location)
               || !SameCoordinate(edge.Geometry[^1], targetNode.Location);
    }

    private static bool SameCoordinate(Coordinate a, Coordinate b) =>
        Math.Abs(a.X - b.X) < 1e-9 && Math.Abs(a.Y - b.Y) < 1e-9;

    private static bool IsGzipPayload(IReadOnlyList<byte> payload) =>
        payload.Count >= 2 && payload[0] == 0x1f && payload[1] == 0x8b;

    private static byte[] Decompress(byte[] payload)
    {
        using var input = new MemoryStream(payload);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();
        gzip.CopyTo(output);
        return output.ToArray();
    }
}

public static class RouteGraphSpatialIndex
{
    public static void BuildSpatialBuckets(RouteGraphData graphData)
    {
        graphData.SpatialBuckets.Clear();
        var bucketSize = graphData.SpatialBucketSizeDegrees;
        foreach (var node in graphData.Nodes.Values)
        {
            var bucket = (
                X: (int)Math.Floor(node.Location.X / bucketSize),
                Y: (int)Math.Floor(node.Location.Y / bucketSize));
            if (!graphData.SpatialBuckets.TryGetValue(bucket, out var nodeIds))
            {
                nodeIds = new List<long>();
                graphData.SpatialBuckets[bucket] = nodeIds;
            }

            nodeIds.Add(node.Id);
        }
    }
}

public sealed record PackedRouteGraphArtifact(
    string SchemaVersion,
    int EdgeCostVersion,
    int EdgeWeightVersion,
    string? ShardKey,
    string[] SourceShardKeys,
    int LoadedEdgeCount,
    bool IsTruncated,
    double SpatialBucketSizeDegrees,
    PackedRouteGraphPreprocessing? Preprocessing,
    PackedRouteGraphNode[] Nodes,
    PackedRouteGraphEdge[] Edges);

public sealed record PackedRouteGraphPreprocessing(
    string Algorithm,
    int AlgorithmVersion,
    string WeightVersion,
    long[] LandmarkNodeIds,
    PackedRouteGraphLandmark[] Landmarks);

public sealed record PackedRouteGraphLandmark(
    long LandmarkNodeId,
    float[] FromLandmarkSeconds,
    float[] ToLandmarkSeconds);

public sealed record PackedRouteGraphNode(
    long Id,
    double X,
    double Y,
    int FirstEdgeIndex,
    int EdgeCount);

public sealed record PackedRouteGraphEdge(
    long TargetNodeId,
    double DistanceMetres,
    double BaseSafetyCost,
    string SurfaceType,
    bool HasStairs,
    bool HasCrossing,
    bool IsUnderConstruction,
    double LightingQuality,
    bool IsSteep,
    double KerbHeight,
    string? Smoothness,
    double? WidthMetres,
    bool HasTactilePaving,
    bool HasBarrier,
    string? Access,
    int AccessibilityCostVersion,
    double StandardAccessibilityPenaltySeconds,
    double WheelchairAccessibilityPenaltySeconds,
    double StrollerAccessibilityPenaltySeconds,
    double AccessibilityDataQuality,
    int EdgeWeightVersion,
    double StandardTraversalSeconds,
    double WheelchairTraversalSeconds,
    double StrollerTraversalSeconds,
    PackedRouteGraphCoordinate[]? Geometry);

public sealed record PackedRouteGraphCoordinate(double X, double Y);
