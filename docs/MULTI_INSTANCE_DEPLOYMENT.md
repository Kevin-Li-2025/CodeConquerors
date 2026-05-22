# Multi-Instance Deployment

## Local Single-Node Mode

Use the in-memory bus only for local development:

```bash
MESSAGING_USE_KAFKA=false docker compose up api
```

In this mode queued jobs are process-local and should not be used for scaled API replicas.

## Worker/Kafka Mode

Run API replicas with Kafka enabled and OSM/tile workers disabled on API containers:

```bash
MESSAGING_USE_KAFKA=true \
API_OSM_WORKER_ENABLED=false \
API_TILE_WORKER_ENABLED=false \
docker compose --profile worker up --scale api=2 api worker kafka redis db
```

The API publishes `OsmImportStartedEvent` messages to Kafka. Worker containers consume the
same topic through the shared `accesscity-workers` consumer group, so only one worker processes
each import job even when multiple workers are running.

## Shared Cache

Set `REDIS_CONNECTION=redis:6379` for API and worker containers. HybridCache then uses Redis as
the shared L2 cache for tile, route, and risk lookups instead of per-process memory only.

## Operational Notes

- Keep `OsmImport__ImportOnStartup=false` on API replicas.
- Mount the same OSM files into workers that receive import jobs.
- Rotate `Jwt__Key` with `Jwt__PreviousKeys` as described in `docs/SECRET_ROTATION.md`.
- Use the tile profile endpoint, `/api/v1/tiles/{z}/{x}/{y}/profile`, to compare cold vs warm cache latency.
