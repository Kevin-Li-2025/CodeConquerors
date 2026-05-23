# Route Graph Preprocessing

AccessCity now has a staged route graph preprocessing path:

- packed graph artifacts: flat node/edge arrays for Redis and worker hot-load;
- prepartitioned grid cells: nearby routes reuse stable cell artifacts instead of exact route-shaped blobs only;
- versioned edge weights: artifacts are invalidated when accessibility cost or traversal-weight logic changes;
- ALT landmarks: each non-truncated shard can carry landmark distance tables so A* gets a stronger admissible lower bound than straight-line distance alone.
- compressed Redis payloads: packed artifacts are stored as gzip bytes in L2 cache while keeping legacy JSON read compatibility.

## Why ALT First

CH/CCH/CRP are the long-term target for city and region scale. They need a larger graph build pipeline and careful customization for accessibility, hazards, closures, and profile-specific weights. ALT is the safe intermediate step: it is deterministic, testable, works on directed graphs, preserves exact shortest-path results when the lower bound is admissible, and can be packed into the current shard artifact.

The checked-in implementation computes ALT landmarks over the minimum traversal-time metric (`distance / 2.0m/s`). Runtime route cost is always at least that lower bound, so the heuristic does not change route decisions; it only reduces search work.

## Profiling Real Extracts

Use the profile command against a real OSM extract before raising shard sizes or worker counts:

```bash
tools/profile-city-route-graph.sh
```

The script downloads the BBBike Birmingham `.osm.pbf` extract if `data/osm/birmingham.osm.pbf` is absent, then runs the API in an offline profile-and-exit mode. This path builds the routing graph, shard index, packed artifact, ALT tables, and compressed Redis payload without importing the city graph into PostGIS first. Override the file path or cap when needed:

```bash
OSM_FILE=data/osm/birmingham.osm.pbf \
Routing__MaxRouteGraphEdges=2000000 \
tools/profile-city-route-graph.sh
```

The JSON result reports source graph size, source shard count, shard reuse ratio, uncompressed artifact size, compressed Redis payload bytes, cold shard merge/preprocessing time, worker hot-load time from compressed payload, artifact pack time, and artifact unpack time.

Latest Birmingham extract check (`Birmingham.osm.pbf`, 53.6MB, `Routing__MaxRouteGraphEdges=2000000`) built a non-truncated graph of 661,852 nodes and 1,428,512 directed edges into 1,419 shards. The four warmup routes reused 53 unique shards across 89 references (`shardReuseRatio=0.4045`), all carried ALT-v1 preprocessing, and the largest route artifact compressed from about 69.5MB JSON to about 13.3MB Redis payload. With the shard index in place, max cold shard merge/preprocessing time was about 514ms and max compressed Redis hot-load restore was about 816ms on the local Docker profile.

## Reading Results

- `shardReuseRatio`: should increase as warmup/profile routes overlap. Low values mean route requests are too dispersed for exact route cache to matter and the graph needs larger precomputed partitions or route bucketing.
- `artifactBytes` / `redisPayloadBytes`: `artifactBytes` is uncompressed JSON; `redisPayloadBytes` is the gzip-compressed L2 payload. Watch both before raising landmark count. ALT tables scale with `nodes * landmarks * 2`.
- `artifactUnpackMilliseconds` / `hotLoadMilliseconds`: proxy for new worker hot-load time from Redis, including compressed payload restore.
- `isTruncated`: any `true` profile route means the route graph cap is too low or the bbox is too broad for the current shard settings.
- `hasAltPreprocessing`: should be true for non-truncated shards under `RouteGraphMaxAltPreprocessedNodes`.

## Next Preprocessing Layer

For 1M+ DAU, the next substantial step is a dedicated city graph build artifact outside request workers:

1. Persist the offline shard artifacts instead of rebuilding them from the OSM extract in process.
2. Store immutable graph/weight artifacts with explicit version ids and warm them in workers before traffic.
3. Add a customization phase for accessibility costs, temporary closures, and hazard overlays.
4. Move from ALT to CCH or CRP for larger city/region graphs once the weight customization model is stable.
