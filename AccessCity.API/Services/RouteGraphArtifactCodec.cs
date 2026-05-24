using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Serialization;
using AccessCity.API.Models;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services;

public static class RouteGraphArtifactCodec
{
    public const string SchemaVersion = "packed-route-graph-v3";
    private static readonly byte[] BinaryMagic = "ACRG"u8.ToArray();
    private const byte BinaryPayloadVersion = 1;
    private const int NullStringIndex = -1;
    private const int MaxBinaryStringTableEntries = 16_384;
    private const int MaxBinarySourceShardKeys = 65_536;
    private const int MaxBinaryNodes = 2_000_000;
    private const int MaxBinaryEdges = 5_000_000;
    private const int MaxBinaryGeometryCoordinates = 16_384;
    private const int MaxBinaryLandmarks = 64;
    private const int MaxBinaryPreprocessingDistanceEntries = MaxBinaryNodes;
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
        using var output = new MemoryStream();
        using var writer = new BinaryWriter(output);
        WriteBinaryArtifact(writer, artifact);
        return output.ToArray();
    }

    public static bool TryDeserializeRedisPayload(byte[] payload, out PackedRouteGraphArtifact? artifact)
    {
        artifact = null;
        try
        {
            if (IsBinaryPayload(payload))
            {
                using var input = new MemoryStream(payload);
                using var reader = new BinaryReader(input);
                artifact = ReadBinaryArtifact(reader);
                return artifact is not null && !string.IsNullOrWhiteSpace(artifact.SchemaVersion);
            }

            var json = IsGzipPayload(payload) ? Decompress(payload) : payload;
            artifact = JsonSerializer.Deserialize<PackedRouteGraphArtifact>(json, PackedJsonOptions);
            return artifact is not null && !string.IsNullOrWhiteSpace(artifact.SchemaVersion);
        }
        catch (Exception ex) when (ex is EndOfStreamException or IOException or InvalidDataException or JsonException or NotSupportedException)
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
                FromLandmarkSeconds = new float[preprocessing.Landmarks.Length],
                ToLandmarkSeconds = new float[preprocessing.Landmarks.Length]
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

    private static float EncodeDistance(float distanceSeconds) =>
        float.IsFinite(distanceSeconds) && distanceSeconds >= 0 ? (float)Math.Round(distanceSeconds, 3) : -1;

    private static float DecodeDistance(float encodedSeconds) =>
        encodedSeconds < 0 ? float.PositiveInfinity : encodedSeconds;

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

    private static void WriteBinaryArtifact(BinaryWriter writer, PackedRouteGraphArtifact artifact)
    {
        writer.Write(BinaryMagic);
        writer.Write(BinaryPayloadVersion);

        writer.Write(artifact.SchemaVersion);
        writer.Write(artifact.EdgeCostVersion);
        writer.Write(artifact.EdgeWeightVersion);
        WriteNullableString(writer, artifact.ShardKey);
        WriteStringArray(writer, artifact.SourceShardKeys);
        writer.Write(artifact.LoadedEdgeCount);
        writer.Write(artifact.IsTruncated);
        writer.Write(artifact.SpatialBucketSizeDegrees);

        WriteStringTable(writer, artifact.Edges, out var stringIndexes);
        WritePreprocessing(writer, artifact.Preprocessing);

        writer.Write(artifact.Nodes.Length);
        foreach (var node in artifact.Nodes)
        {
            writer.Write(node.Id);
            writer.Write(node.X);
            writer.Write(node.Y);
            writer.Write(node.FirstEdgeIndex);
            writer.Write(node.EdgeCount);
        }

        writer.Write(artifact.Edges.Length);
        foreach (var edge in artifact.Edges)
        {
            writer.Write(edge.TargetNodeId);
            writer.Write(edge.DistanceMetres);
            writer.Write(edge.BaseSafetyCost);
            writer.Write(stringIndexes[NormalizeRequiredString(edge.SurfaceType)]);
            writer.Write(edge.HasStairs);
            writer.Write(edge.HasCrossing);
            writer.Write(edge.IsUnderConstruction);
            writer.Write(edge.LightingQuality);
            writer.Write(edge.IsSteep);
            writer.Write(edge.KerbHeight);
            writer.Write(GetStringIndex(stringIndexes, edge.Smoothness));
            WriteNullableDouble(writer, edge.WidthMetres);
            writer.Write(edge.HasTactilePaving);
            writer.Write(edge.HasBarrier);
            writer.Write(GetStringIndex(stringIndexes, edge.Access));
            writer.Write(edge.AccessibilityCostVersion);
            writer.Write(edge.StandardAccessibilityPenaltySeconds);
            writer.Write(edge.WheelchairAccessibilityPenaltySeconds);
            writer.Write(edge.StrollerAccessibilityPenaltySeconds);
            writer.Write(edge.AccessibilityDataQuality);
            writer.Write(edge.EdgeWeightVersion);
            writer.Write(edge.StandardTraversalSeconds);
            writer.Write(edge.WheelchairTraversalSeconds);
            writer.Write(edge.StrollerTraversalSeconds);
            WriteCoordinates(writer, edge.Geometry);
        }
    }

    private static PackedRouteGraphArtifact ReadBinaryArtifact(BinaryReader reader)
    {
        var magic = reader.ReadBytes(BinaryMagic.Length);
        if (!magic.SequenceEqual(BinaryMagic))
        {
            throw new InvalidDataException("Route graph payload is not an AccessCity binary artifact.");
        }

        var version = reader.ReadByte();
        if (version != BinaryPayloadVersion)
        {
            throw new InvalidDataException($"Unsupported route graph binary payload version {version}.");
        }

        var schemaVersion = reader.ReadString();
        var edgeCostVersion = reader.ReadInt32();
        var edgeWeightVersion = reader.ReadInt32();
        var shardKey = ReadNullableString(reader);
        var sourceShardKeys = ReadStringArray(reader);
        var loadedEdgeCount = reader.ReadInt32();
        var isTruncated = reader.ReadBoolean();
        var spatialBucketSizeDegrees = reader.ReadDouble();
        var stringTable = ReadStringTable(reader);
        var preprocessing = ReadPreprocessing(reader);

        var nodes = new PackedRouteGraphNode[ReadCount(reader, "route graph node count", MaxBinaryNodes)];
        for (var i = 0; i < nodes.Length; i++)
        {
            nodes[i] = new PackedRouteGraphNode(
                reader.ReadInt64(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                reader.ReadInt32(),
                reader.ReadInt32());
        }

        var edges = new PackedRouteGraphEdge[ReadCount(reader, "route graph edge count", MaxBinaryEdges)];
        for (var i = 0; i < edges.Length; i++)
        {
            edges[i] = new PackedRouteGraphEdge(
                reader.ReadInt64(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                ReadRequiredStringIndex(reader, stringTable),
                reader.ReadBoolean(),
                reader.ReadBoolean(),
                reader.ReadBoolean(),
                reader.ReadDouble(),
                reader.ReadBoolean(),
                reader.ReadDouble(),
                ReadNullableStringIndex(reader, stringTable),
                ReadNullableDouble(reader),
                reader.ReadBoolean(),
                reader.ReadBoolean(),
                ReadNullableStringIndex(reader, stringTable),
                reader.ReadInt32(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                reader.ReadInt32(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                reader.ReadDouble(),
                ReadCoordinates(reader));
        }

        return new PackedRouteGraphArtifact(
            schemaVersion,
            edgeCostVersion,
            edgeWeightVersion,
            shardKey,
            sourceShardKeys,
            loadedEdgeCount,
            isTruncated,
            spatialBucketSizeDegrees,
            preprocessing,
            nodes,
            edges);
    }

    private static void WriteStringTable(
        BinaryWriter writer,
        IReadOnlyCollection<PackedRouteGraphEdge> edges,
        out Dictionary<string, int> stringIndexes)
    {
        var values = edges
            .SelectMany(edge => new[] { NormalizeRequiredString(edge.SurfaceType), edge.Smoothness, edge.Access })
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        stringIndexes = values
            .Select((value, index) => (value, index))
            .ToDictionary(pair => pair.value, pair => pair.index, StringComparer.Ordinal);

        writer.Write(values.Length);
        foreach (var value in values)
        {
            writer.Write(value);
        }
    }

    private static string[] ReadStringTable(BinaryReader reader)
    {
        var count = ReadCount(reader, "route graph string table length", MaxBinaryStringTableEntries);
        var values = new string[count];
        for (var i = 0; i < values.Length; i++)
        {
            values[i] = reader.ReadString();
        }

        return values;
    }

    private static int GetStringIndex(IReadOnlyDictionary<string, int> stringIndexes, string? value) =>
        value is not null && stringIndexes.TryGetValue(value, out var index) ? index : NullStringIndex;

    private static string NormalizeRequiredString(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "unknown" : value;

    private static string ReadRequiredStringIndex(BinaryReader reader, IReadOnlyList<string> stringTable)
    {
        var index = reader.ReadInt32();
        if (index < 0 || index >= stringTable.Count)
        {
            throw new InvalidDataException($"Required string table index {index} is out of range.");
        }

        return stringTable[index];
    }

    private static string? ReadNullableStringIndex(BinaryReader reader, IReadOnlyList<string> stringTable)
    {
        var index = reader.ReadInt32();
        if (index == NullStringIndex)
        {
            return null;
        }

        if (index < 0 || index >= stringTable.Count)
        {
            throw new InvalidDataException($"Nullable string table index {index} is out of range.");
        }

        return stringTable[index];
    }

    private static void WritePreprocessing(BinaryWriter writer, PackedRouteGraphPreprocessing? preprocessing)
    {
        writer.Write(preprocessing is not null);
        if (preprocessing is null)
        {
            return;
        }

        writer.Write(preprocessing.Algorithm);
        writer.Write(preprocessing.AlgorithmVersion);
        writer.Write(preprocessing.WeightVersion);
        WriteLongArray(writer, preprocessing.LandmarkNodeIds);
        writer.Write(preprocessing.Landmarks.Length);
        foreach (var landmark in preprocessing.Landmarks)
        {
            writer.Write(landmark.LandmarkNodeId);
            WriteFloatArray(writer, landmark.FromLandmarkSeconds);
            WriteFloatArray(writer, landmark.ToLandmarkSeconds);
        }
    }

    private static PackedRouteGraphPreprocessing? ReadPreprocessing(BinaryReader reader)
    {
        if (!reader.ReadBoolean())
        {
            return null;
        }

        var algorithm = reader.ReadString();
        var algorithmVersion = reader.ReadInt32();
        var weightVersion = reader.ReadString();
        var landmarkNodeIds = ReadLongArray(reader);
        var landmarks = new PackedRouteGraphLandmark[ReadCount(reader, "route graph landmark count", MaxBinaryLandmarks)];
        for (var i = 0; i < landmarks.Length; i++)
        {
            landmarks[i] = new PackedRouteGraphLandmark(
                reader.ReadInt64(),
                ReadFloatArray(reader),
                ReadFloatArray(reader));
        }

        return new PackedRouteGraphPreprocessing(
            algorithm,
            algorithmVersion,
            weightVersion,
            landmarkNodeIds,
            landmarks);
    }

    private static void WriteCoordinates(BinaryWriter writer, PackedRouteGraphCoordinate[]? coordinates)
    {
        writer.Write(coordinates?.Length ?? -1);
        if (coordinates is null)
        {
            return;
        }

        foreach (var coordinate in coordinates)
        {
            writer.Write(coordinate.X);
            writer.Write(coordinate.Y);
        }
    }

    private static PackedRouteGraphCoordinate[]? ReadCoordinates(BinaryReader reader)
    {
        var count = ReadNullableCount(reader, "route graph geometry coordinate count", MaxBinaryGeometryCoordinates);
        if (!count.HasValue)
        {
            return null;
        }

        var coordinates = new PackedRouteGraphCoordinate[count.Value];
        for (var i = 0; i < coordinates.Length; i++)
        {
            coordinates[i] = new PackedRouteGraphCoordinate(reader.ReadDouble(), reader.ReadDouble());
        }

        return coordinates;
    }

    private static void WriteStringArray(BinaryWriter writer, string[] values)
    {
        writer.Write(values.Length);
        foreach (var value in values)
        {
            writer.Write(value);
        }
    }

    private static string[] ReadStringArray(BinaryReader reader)
    {
        var values = new string[ReadCount(reader, "route graph string array length", MaxBinarySourceShardKeys)];
        for (var i = 0; i < values.Length; i++)
        {
            values[i] = reader.ReadString();
        }

        return values;
    }

    private static void WriteLongArray(BinaryWriter writer, long[] values)
    {
        writer.Write(values.Length);
        foreach (var value in values)
        {
            writer.Write(value);
        }
    }

    private static long[] ReadLongArray(BinaryReader reader)
    {
        var values = new long[ReadCount(reader, "route graph long array length", MaxBinaryLandmarks)];
        for (var i = 0; i < values.Length; i++)
        {
            values[i] = reader.ReadInt64();
        }

        return values;
    }

    private static void WriteFloatArray(BinaryWriter writer, float[] values)
    {
        writer.Write(values.Length);
        foreach (var value in values)
        {
            writer.Write(value);
        }
    }

    private static float[] ReadFloatArray(BinaryReader reader)
    {
        var values = new float[ReadCount(reader, "route graph preprocessing distance length", MaxBinaryPreprocessingDistanceEntries)];
        for (var i = 0; i < values.Length; i++)
        {
            values[i] = reader.ReadSingle();
        }

        return values;
    }

    private static void WriteNullableString(BinaryWriter writer, string? value)
    {
        writer.Write(value is not null);
        if (value is not null)
        {
            writer.Write(value);
        }
    }

    private static string? ReadNullableString(BinaryReader reader) =>
        reader.ReadBoolean() ? reader.ReadString() : null;

    private static void WriteNullableDouble(BinaryWriter writer, double? value)
    {
        writer.Write(value.HasValue);
        if (value.HasValue)
        {
            writer.Write(value.Value);
        }
    }

    private static double? ReadNullableDouble(BinaryReader reader) =>
        reader.ReadBoolean() ? reader.ReadDouble() : null;

    private static bool IsBinaryPayload(IReadOnlyList<byte> payload) =>
        payload.Count > BinaryMagic.Length
        && payload.Take(BinaryMagic.Length).SequenceEqual(BinaryMagic);

    private static int ReadCount(BinaryReader reader, string fieldName, int maxCount)
    {
        var count = reader.ReadInt32();
        if (count < 0 || count > maxCount)
        {
            throw new InvalidDataException($"{fieldName} {count} is outside the supported range 0..{maxCount}.");
        }

        return count;
    }

    private static int? ReadNullableCount(BinaryReader reader, string fieldName, int maxCount)
    {
        var count = reader.ReadInt32();
        if (count < 0)
        {
            return null;
        }

        if (count > maxCount)
        {
            throw new InvalidDataException($"{fieldName} {count} exceeds the supported maximum {maxCount}.");
        }

        return count;
    }

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
