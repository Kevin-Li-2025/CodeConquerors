using System.Globalization;
using AccessCity.API.Configuration;
using NetTopologySuite.Geometries;

namespace AccessCity.API.Services;

public static class RouteGraphShardPlanner
{
    private const double MetresPerLatitudeDegree = 111_320.0;

    public static GraphShardRegion ComputePaddedRegion(
        Coordinate start,
        Coordinate end,
        RoutingOptions options)
    {
        var padding = ComputePaddingDegrees(start, end);
        var shardSize = ClampShardSize(options.RouteGraphShardSizeDegrees);
        var minLon = Math.Min(start.X, end.X) - padding;
        var maxLon = Math.Max(start.X, end.X) + padding;
        var minLat = Math.Min(start.Y, end.Y) - padding;
        var maxLat = Math.Max(start.Y, end.Y) + padding;

        return new GraphShardRegion(
            Math.Floor(minLon / shardSize) * shardSize,
            Math.Floor(minLat / shardSize) * shardSize,
            Math.Ceiling(maxLon / shardSize) * shardSize,
            Math.Ceiling(maxLat / shardSize) * shardSize);
    }

    public static IReadOnlyList<GraphShardRegion> ComputeLoadRegions(
        GraphShardRegion region,
        Coordinate start,
        Coordinate end,
        RoutingOptions options)
    {
        if (!options.RouteGraphPrepartitionedShardsEnabled)
        {
            return new[] { region };
        }

        var shardSize = ClampShardSize(options.RouteGraphShardSizeDegrees);
        var cells = EnumerateCells(region, shardSize);
        if (cells.Count <= 1)
        {
            return new[] { region };
        }

        var maxShardCount = Math.Max(1, options.RouteGraphMaxPrepartitionedShardCount);
        if (options.RouteGraphCorridorSlicingEnabled)
        {
            var corridorCells = cells
                .Where(cell => IntersectsCorridor(cell, start, end, options.RouteGraphCorridorPaddingMetres))
                .OrderBy(cell => cell.MinLon)
                .ThenBy(cell => cell.MinLat)
                .ToArray();

            if (corridorCells.Length > 1
                && corridorCells.Length < cells.Count
                && corridorCells.Length <= maxShardCount
                && ContainsEndpointCells(corridorCells, start, end))
            {
                return corridorCells;
            }
        }

        return cells.Count <= maxShardCount
            ? cells
            : new[] { region };
    }

    public static string BuildRegionSetFingerprint(IReadOnlyList<GraphShardRegion> regions)
    {
        var ordered = regions
            .OrderBy(region => region.MinLon)
            .ThenBy(region => region.MinLat)
            .ThenBy(region => region.MaxLon)
            .ThenBy(region => region.MaxLat);
        var hash = 1469598103934665603UL;
        foreach (var region in ordered)
        {
            AddQuantized(ref hash, region.MinLon);
            AddQuantized(ref hash, region.MinLat);
            AddQuantized(ref hash, region.MaxLon);
            AddQuantized(ref hash, region.MaxLat);
        }

        return hash.ToString("x16", CultureInfo.InvariantCulture);
    }

    public static double ClampShardSize(double shardSizeDegrees) =>
        Math.Clamp(shardSizeDegrees, 0.002, 0.05);

    private static double ComputePaddingDegrees(Coordinate start, Coordinate end)
    {
        var latitudeDelta = Math.Abs(start.Y - end.Y);
        var longitudeDelta = Math.Abs(start.X - end.X);
        return Math.Max(0.01, Math.Max(latitudeDelta, longitudeDelta) * 0.35);
    }

    private static List<GraphShardRegion> EnumerateCells(GraphShardRegion region, double shardSize)
    {
        var minX = (int)Math.Floor(region.MinLon / shardSize);
        var minY = (int)Math.Floor(region.MinLat / shardSize);
        var maxX = (int)Math.Ceiling(region.MaxLon / shardSize) - 1;
        var maxY = (int)Math.Ceiling(region.MaxLat / shardSize) - 1;
        var shardCount = Math.Max(0, (maxX - minX + 1) * (maxY - minY + 1));
        var regions = new List<GraphShardRegion>(shardCount);
        for (var x = minX; x <= maxX; x++)
        {
            for (var y = minY; y <= maxY; y++)
            {
                regions.Add(new GraphShardRegion(
                    x * shardSize,
                    y * shardSize,
                    (x + 1) * shardSize,
                    (y + 1) * shardSize));
            }
        }

        return regions;
    }

    private static bool IntersectsCorridor(
        GraphShardRegion cell,
        Coordinate start,
        Coordinate end,
        double paddingMetres)
    {
        var padding = Math.Clamp(paddingMetres, 0, 5_000);
        var meanLatitudeRadians = ((start.Y + end.Y) * 0.5) * Math.PI / 180.0;
        var longitudeScale = Math.Max(0.2, Math.Abs(Math.Cos(meanLatitudeRadians)));
        var latPadding = padding / MetresPerLatitudeDegree;
        var lonPadding = padding / (MetresPerLatitudeDegree * longitudeScale);
        var expanded = new GraphShardRegion(
            cell.MinLon - lonPadding,
            cell.MinLat - latPadding,
            cell.MaxLon + lonPadding,
            cell.MaxLat + latPadding);

        return SegmentIntersectsRegion(start, end, expanded);
    }

    private static bool ContainsEndpointCells(
        IReadOnlyCollection<GraphShardRegion> cells,
        Coordinate start,
        Coordinate end) =>
        cells.Any(cell => Contains(cell, start))
        && cells.Any(cell => Contains(cell, end));

    private static bool SegmentIntersectsRegion(
        Coordinate start,
        Coordinate end,
        GraphShardRegion region)
    {
        if (Contains(region, start) || Contains(region, end))
        {
            return true;
        }

        if (Math.Max(start.X, end.X) < region.MinLon
            || Math.Min(start.X, end.X) > region.MaxLon
            || Math.Max(start.Y, end.Y) < region.MinLat
            || Math.Min(start.Y, end.Y) > region.MaxLat)
        {
            return false;
        }

        return SegmentsIntersect(start.X, start.Y, end.X, end.Y, region.MinLon, region.MinLat, region.MaxLon, region.MinLat)
            || SegmentsIntersect(start.X, start.Y, end.X, end.Y, region.MaxLon, region.MinLat, region.MaxLon, region.MaxLat)
            || SegmentsIntersect(start.X, start.Y, end.X, end.Y, region.MaxLon, region.MaxLat, region.MinLon, region.MaxLat)
            || SegmentsIntersect(start.X, start.Y, end.X, end.Y, region.MinLon, region.MaxLat, region.MinLon, region.MinLat);
    }

    private static bool Contains(GraphShardRegion region, Coordinate coordinate) =>
        coordinate.X >= region.MinLon
        && coordinate.X <= region.MaxLon
        && coordinate.Y >= region.MinLat
        && coordinate.Y <= region.MaxLat;

    private static bool SegmentsIntersect(
        double ax,
        double ay,
        double bx,
        double by,
        double cx,
        double cy,
        double dx,
        double dy)
    {
        var o1 = Orientation(ax, ay, bx, by, cx, cy);
        var o2 = Orientation(ax, ay, bx, by, dx, dy);
        var o3 = Orientation(cx, cy, dx, dy, ax, ay);
        var o4 = Orientation(cx, cy, dx, dy, bx, by);

        if (o1 * o2 < 0 && o3 * o4 < 0)
        {
            return true;
        }

        const double epsilon = 1e-12;
        return Math.Abs(o1) <= epsilon && IsBetween(ax, ay, cx, cy, bx, by)
            || Math.Abs(o2) <= epsilon && IsBetween(ax, ay, dx, dy, bx, by)
            || Math.Abs(o3) <= epsilon && IsBetween(cx, cy, ax, ay, dx, dy)
            || Math.Abs(o4) <= epsilon && IsBetween(cx, cy, bx, by, dx, dy);
    }

    private static double Orientation(
        double ax,
        double ay,
        double bx,
        double by,
        double cx,
        double cy) =>
        (by - ay) * (cx - bx) - (bx - ax) * (cy - by);

    private static bool IsBetween(
        double ax,
        double ay,
        double bx,
        double by,
        double cx,
        double cy) =>
        bx >= Math.Min(ax, cx) - 1e-12
        && bx <= Math.Max(ax, cx) + 1e-12
        && by >= Math.Min(ay, cy) - 1e-12
        && by <= Math.Max(ay, cy) + 1e-12;

    private static void AddQuantized(ref ulong hash, double value)
    {
        var quantized = BitConverter.GetBytes((long)Math.Round(value * 1_000_000.0));
        foreach (var b in quantized)
        {
            hash ^= b;
            hash *= 1099511628211UL;
        }
    }
}
