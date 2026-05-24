using AccessCity.API.Configuration;
using AccessCity.API.Models;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services;

public static class RouteGraphPreprocessor
{
    public const int AltAlgorithmVersion = 1;
    public const string AltWeightVersion = "min-traversal-seconds-v1";
    public const double MaxLowerBoundSpeedMetresPerSecond = 2.0;
    private const double LandmarkDistanceQuantizationSafetySeconds = 0.001;

    public static void TryAttachPreprocessing(RouteGraphData graphData, RoutingOptions options)
    {
        graphData.Preprocessing = BuildAltPreprocessing(graphData, options);
    }

    public static RouteGraphPreprocessingData? BuildAltPreprocessing(RouteGraphData graphData, RoutingOptions options)
    {
        if (!options.RouteGraphAltPreprocessingEnabled
            || graphData.IsTruncated
            || graphData.Nodes.Count < 2
            || graphData.Nodes.Count > Math.Max(1, options.RouteGraphMaxAltPreprocessedNodes))
        {
            return null;
        }

        var landmarkCount = Math.Clamp(options.RouteGraphAltLandmarkCount, 0, 16);
        if (landmarkCount == 0)
        {
            return null;
        }

        var landmarks = SelectLandmarks(graphData.Nodes.Values, landmarkCount);
        if (landmarks.Count == 0)
        {
            return null;
        }

        var forward = new List<Dictionary<long, double>>(landmarks.Count);
        var reverse = new List<Dictionary<long, double>>(landmarks.Count);
        var reverseAdjacency = BuildReverseAdjacency(graphData.Nodes);

        foreach (var landmarkId in landmarks)
        {
            forward.Add(RunDijkstra(graphData.Nodes, landmarkId, reverse: false, reverseAdjacency));
            reverse.Add(RunDijkstra(graphData.Nodes, landmarkId, reverse: true, reverseAdjacency));
        }

        var nodeDistances = new Dictionary<long, RouteGraphNodePreprocessing>(graphData.Nodes.Count);
        foreach (var nodeId in graphData.Nodes.Keys)
        {
            var fromLandmark = new float[landmarks.Count];
            var toLandmark = new float[landmarks.Count];
            for (var i = 0; i < landmarks.Count; i++)
            {
                fromLandmark[i] = EncodePreprocessedSeconds(forward[i].GetValueOrDefault(nodeId, double.PositiveInfinity));
                toLandmark[i] = EncodePreprocessedSeconds(reverse[i].GetValueOrDefault(nodeId, double.PositiveInfinity));
            }

            nodeDistances[nodeId] = new RouteGraphNodePreprocessing
            {
                FromLandmarkSeconds = fromLandmark,
                ToLandmarkSeconds = toLandmark
            };
        }

        return new RouteGraphPreprocessingData
        {
            Algorithm = "ALT",
            AlgorithmVersion = AltAlgorithmVersion,
            WeightVersion = AltWeightVersion,
            LandmarkNodeIds = landmarks.ToArray(),
            NodeDistances = nodeDistances
        };
    }

    public static double ComputeAltLowerBoundSeconds(
        RouteGraphPreprocessingData? preprocessing,
        long fromNodeId,
        long targetNodeId)
    {
        if (preprocessing?.HasLandmarks != true
            || !string.Equals(preprocessing.Algorithm, "ALT", StringComparison.Ordinal)
            || preprocessing.AlgorithmVersion != AltAlgorithmVersion
            || !string.Equals(preprocessing.WeightVersion, AltWeightVersion, StringComparison.Ordinal)
            || !preprocessing.NodeDistances.TryGetValue(fromNodeId, out var from)
            || !preprocessing.NodeDistances.TryGetValue(targetNodeId, out var target))
        {
            return 0;
        }

        var landmarkCount = Math.Min(
            preprocessing.LandmarkNodeIds.Length,
            Math.Min(
                Math.Min(from.FromLandmarkSeconds.Length, from.ToLandmarkSeconds.Length),
                Math.Min(target.FromLandmarkSeconds.Length, target.ToLandmarkSeconds.Length)));

        var lowerBound = 0.0;
        for (var i = 0; i < landmarkCount; i++)
        {
            lowerBound = Math.Max(lowerBound, DifferenceIfFinite(target.FromLandmarkSeconds[i], from.FromLandmarkSeconds[i]));
            lowerBound = Math.Max(lowerBound, DifferenceIfFinite(from.ToLandmarkSeconds[i], target.ToLandmarkSeconds[i]));
        }

        return lowerBound;
    }

    private static double DifferenceIfFinite(float a, float b)
    {
        if (!float.IsFinite(a) || !float.IsFinite(b))
        {
            return 0;
        }

        var safetyMarginSeconds = LandmarkDistanceQuantizationSafetySeconds
                                  + FloatRoundoffSafetySeconds(a)
                                  + FloatRoundoffSafetySeconds(b);
        return Math.Max(0, (double)a - b - safetyMarginSeconds);
    }

    private static float EncodePreprocessedSeconds(double seconds) =>
        double.IsFinite(seconds) && seconds >= 0 ? (float)Math.Round(seconds, 3) : float.PositiveInfinity;

    private static double FloatRoundoffSafetySeconds(float seconds)
    {
        var next = MathF.BitIncrement(seconds);
        return float.IsFinite(next) ? Math.Abs((double)next - seconds) : 0;
    }

    private static IReadOnlyList<long> SelectLandmarks(IEnumerable<GraphNode> nodes, int landmarkCount)
    {
        var ordered = nodes
            .OrderBy(node => node.Id)
            .ToArray();
        if (ordered.Length == 0)
        {
            return Array.Empty<long>();
        }

        var minX = ordered.Min(node => node.Location.X);
        var maxX = ordered.Max(node => node.Location.X);
        var minY = ordered.Min(node => node.Location.Y);
        var maxY = ordered.Max(node => node.Location.Y);
        var targets = new[]
        {
            new Coordinate(minX, minY),
            new Coordinate(minX, maxY),
            new Coordinate(maxX, minY),
            new Coordinate(maxX, maxY),
            new Coordinate((minX + maxX) / 2.0, (minY + maxY) / 2.0)
        };

        var selected = new List<GraphNode>(landmarkCount);
        foreach (var target in targets)
        {
            if (selected.Count >= landmarkCount)
            {
                break;
            }

            var nearest = ordered
                .Where(node => selected.All(existing => existing.Id != node.Id))
                .MinBy(node => SquaredDistance(node.Location, target));
            if (nearest is not null)
            {
                selected.Add(nearest);
            }
        }

        while (selected.Count < Math.Min(landmarkCount, ordered.Length))
        {
            var next = ordered
                .Where(node => selected.All(existing => existing.Id != node.Id))
                .MaxBy(node => selected.Min(existing => SquaredDistance(node.Location, existing.Location)));
            if (next is null)
            {
                break;
            }

            selected.Add(next);
        }

        return selected
            .Select(node => node.Id)
            .ToArray();
    }

    private static double SquaredDistance(Coordinate a, Coordinate b)
    {
        var dx = a.X - b.X;
        var dy = a.Y - b.Y;
        return dx * dx + dy * dy;
    }

    private static Dictionary<long, List<(long TargetNodeId, double CostSeconds)>> BuildReverseAdjacency(
        IReadOnlyDictionary<long, GraphNode> graph)
    {
        var reverse = graph.Keys.ToDictionary(nodeId => nodeId, _ => new List<(long TargetNodeId, double CostSeconds)>());
        foreach (var node in graph.Values)
        {
            foreach (var edge in node.Edges.Values)
            {
                if (!graph.ContainsKey(edge.TargetNodeId))
                {
                    continue;
                }

                if (!reverse.TryGetValue(edge.TargetNodeId, out var edges))
                {
                    edges = new List<(long TargetNodeId, double CostSeconds)>();
                    reverse[edge.TargetNodeId] = edges;
                }

                edges.Add((node.Id, LowerBoundTraversalSeconds(edge)));
            }
        }

        return reverse;
    }

    private static Dictionary<long, double> RunDijkstra(
        IReadOnlyDictionary<long, GraphNode> graph,
        long startNodeId,
        bool reverse,
        IReadOnlyDictionary<long, List<(long TargetNodeId, double CostSeconds)>> reverseAdjacency)
    {
        var distances = new Dictionary<long, double> { [startNodeId] = 0 };
        var queue = new PriorityQueue<long, double>();
        queue.Enqueue(startNodeId, 0);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            var currentDistance = distances[current];
            var edges = reverse
                ? reverseAdjacency.GetValueOrDefault(current) ?? new List<(long TargetNodeId, double CostSeconds)>()
                : EnumerateForwardEdges(graph, current);

            foreach (var (targetNodeId, costSeconds) in edges)
            {
                var tentative = currentDistance + costSeconds;
                if (tentative >= distances.GetValueOrDefault(targetNodeId, double.PositiveInfinity))
                {
                    continue;
                }

                distances[targetNodeId] = tentative;
                queue.Enqueue(targetNodeId, tentative);
            }
        }

        return distances;
    }

    private static IReadOnlyList<(long TargetNodeId, double CostSeconds)> EnumerateForwardEdges(
        IReadOnlyDictionary<long, GraphNode> graph,
        long nodeId)
    {
        if (!graph.TryGetValue(nodeId, out var node))
        {
            return Array.Empty<(long TargetNodeId, double CostSeconds)>();
        }

        return node.Edges.Values
            .Where(edge => graph.ContainsKey(edge.TargetNodeId))
            .Select(edge => (edge.TargetNodeId, LowerBoundTraversalSeconds(edge)))
            .ToArray();
    }

    private static double LowerBoundTraversalSeconds(GraphEdge edge)
        => Math.Max(0.001, edge.DistanceMetres / MaxLowerBoundSpeedMetresPerSecond);
}
