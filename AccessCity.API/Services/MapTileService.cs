using System.Diagnostics;
using System.Diagnostics.Metrics;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO.VectorTiles;
using NetTopologySuite.IO.VectorTiles.Mapbox;
using AccessCity.API.Models;
using Microsoft.Extensions.Caching.Hybrid;

namespace AccessCity.API.Services
{
    public interface IMapTileService
    {
        Task<MapTileResult> GetVectorTileAsync(int z, int x, int y, CancellationToken cancellationToken = default);
    }

    public sealed record MapTileResult(
        byte[] Data,
        int HazardCount,
        long LookupMilliseconds,
        long EncodeMilliseconds,
        long TotalMilliseconds,
        bool CacheHit,
        DateTimeOffset GeneratedAt);

    public sealed record MapTileProfile(
        int Z,
        int X,
        int Y,
        int HazardCount,
        int ByteLength,
        long LookupMilliseconds,
        long EncodeMilliseconds,
        long TotalMilliseconds,
        bool CacheHit,
        DateTimeOffset GeneratedAt);

    internal sealed record CachedVectorTile(
        byte[] Data,
        int HazardCount,
        long LookupMilliseconds,
        long EncodeMilliseconds,
        long GenerateMilliseconds,
        DateTimeOffset GeneratedAt);

    public class MapTileService : IMapTileService
    {
        private static readonly Meter Meter = new("AccessCity.API");
        private static readonly Histogram<double> TileGenerationDuration =
            Meter.CreateHistogram<double>("accesscity.tile.generation.duration", "ms");
        private static readonly Histogram<long> TilePayloadBytes =
            Meter.CreateHistogram<long>("accesscity.tile.payload.bytes", "bytes");

        private readonly ISpatialCacheService _spatialCache;
        private readonly HybridCache _cache;
        private readonly ILogger<MapTileService> _logger;
        private static readonly TimeSpan TileTtl = TimeSpan.FromMinutes(10);

        public MapTileService(
            ISpatialCacheService spatialCache,
            HybridCache cache,
            ILogger<MapTileService> logger)
        {
            _spatialCache = spatialCache;
            _cache = cache;
            _logger = logger;
        }

        public async Task<MapTileResult> GetVectorTileAsync(int z, int x, int y, CancellationToken cancellationToken = default)
        {
            var key = $"mvt:hazards:{z}:{x}:{y}";
            var cacheHit = true;
            var total = Stopwatch.StartNew();

#pragma warning disable EXTEXP0018
            var cached = await _cache.GetOrCreateAsync(
                key,
                async _ =>
                {
                    cacheHit = false;
                    return await GenerateVectorTileAsync(z, x, y).ConfigureAwait(false);
                },
                new HybridCacheEntryOptions { Expiration = TileTtl },
                cancellationToken: cancellationToken);
#pragma warning restore EXTEXP0018

            total.Stop();
            TileGenerationDuration.Record(total.Elapsed.TotalMilliseconds);
            TilePayloadBytes.Record(cached.Data.LongLength);

            return new MapTileResult(
                cached.Data,
                cached.HazardCount,
                cached.LookupMilliseconds,
                cached.EncodeMilliseconds,
                total.ElapsedMilliseconds,
                cacheHit,
                cached.GeneratedAt);
        }

        private async Task<CachedVectorTile> GenerateVectorTileAsync(int z, int x, int y)
        {
            var generate = Stopwatch.StartNew();
            var lookup = Stopwatch.StartNew();
            var envelope = TileToEnvelope(z, x, y);
            var hazards = await _spatialCache.GetHazardsInBoundsAsync(envelope).ConfigureAwait(false);
            lookup.Stop();

            if (hazards.Count == 0)
            {
                generate.Stop();
                return new CachedVectorTile(
                    Array.Empty<byte>(),
                    0,
                    lookup.ElapsedMilliseconds,
                    0,
                    generate.ElapsedMilliseconds,
                    DateTimeOffset.UtcNow);
            }

            var features = new List<Feature>();
            foreach (var h in hazards)
            {
                var attributes = new AttributesTable
                {
                    { "id", h.Id.ToString() },
                    { "type", h.Type },
                    { "status", h.Status.ToString() }
                };
                features.Add(new Feature(h.Location, attributes));
            }

            var encode = Stopwatch.StartNew();
            try
            {
                var vectorTile = new VectorTile();
                var layer = new Layer { Name = "hazards" };

                foreach (var f in features)
                {
                    layer.Features.Add(f);
                }

                vectorTile.Layers.Add(layer);
                using var ms = new MemoryStream();
#pragma warning disable CS0618
                MapboxTileWriter.Write(vectorTile, ms, (uint)z);
#pragma warning restore CS0618

                var data = ms.ToArray();
                encode.Stop();
                generate.Stop();

                _logger.LogInformation(
                    "Generated vector tile {Z}/{X}/{Y}: {HazardCount} hazards, {ByteLength} bytes, lookup {LookupMs}ms, encode {EncodeMs}ms",
                    z,
                    x,
                    y,
                    hazards.Count,
                    data.Length,
                    lookup.ElapsedMilliseconds,
                    encode.ElapsedMilliseconds);

                return new CachedVectorTile(
                    data,
                    hazards.Count,
                    lookup.ElapsedMilliseconds,
                    encode.ElapsedMilliseconds,
                    generate.ElapsedMilliseconds,
                    DateTimeOffset.UtcNow);
            }
            catch (Exception ex)
            {
                encode.Stop();
                generate.Stop();
                _logger.LogError(ex, "Failed to generate MVT for {Z}/{X}/{Y}", z, x, y);
                return new CachedVectorTile(
                    Array.Empty<byte>(),
                    hazards.Count,
                    lookup.ElapsedMilliseconds,
                    encode.ElapsedMilliseconds,
                    generate.ElapsedMilliseconds,
                    DateTimeOffset.UtcNow);
            }
        }

        private Envelope TileToEnvelope(int z, int x, int y)
        {
            double n = Math.Pow(2.0, z);
            double lonMin = x / n * 360.0 - 180.0;
            double lonMax = (x + 1) / n * 360.0 - 180.0;

            double latMinRad = Math.Atan(Math.Sinh(Math.PI * (1 - 2 * (y + 1) / n)));
            double latMaxRad = Math.Atan(Math.Sinh(Math.PI * (1 - 2 * y / n)));

            double latMin = latMinRad * 180.0 / Math.PI;
            double latMax = latMaxRad * 180.0 / Math.PI;

            return new Envelope(lonMin, lonMax, latMin, latMax);
        }
    }
}
