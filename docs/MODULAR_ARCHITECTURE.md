# Modular Architecture

AccessCity is intentionally kept as a modular monolith for now. The deployment already scales
API replicas, workers, Kafka, Redis, PgBouncer, and Postgres independently; splitting the code
into microservices before the domain boundaries harden would add distributed-system cost without
solving the current code coupling.

## Module Boundaries

The backend composition root is split by feature modules under `AccessCity.API/Modules`:

- `ExternalApisModule` owns OSRM, Overpass, Police, Places, Weather, and environmental clients.
- `HazardsModule` owns hazard reporting, hazard queries, live hazard merge, and dashboard reads.
- `RiskModule` owns composite and predictive risk scoring plus risk caches.
- `RoutingModule` owns safe-path orchestration, route jobs, graph repositories, and route caches.
- `MapsModule` owns tiles, POI/map overlay reads, offline map bundles, and tile warming.
- `OsmImportModule` owns OSM import execution and distributed import job queueing.

## Dependency Rules

- Controllers depend on application-facing interfaces, not `AppDbContext`.
- EF/PostGIS queries live behind services in `AccessCity.API/Services`.
- External systems are accessed through typed clients and guarded by timeouts/circuit behavior.
- Background work enters through module-owned job services or hosted workers.
- The shared database remains acceptable while the app is a modular monolith, but each module
  should treat its tables as owned data and expose behavior through interfaces.

## Next Split Points

If traffic or team size requires separate deployables, split in this order:

1. OSM import worker, because it is batch-heavy and already Kafka-triggered.
2. Routing worker, because CPU-heavy safe-path computation has clear request/job boundaries.
3. Risk/tile read model, because it can be cached and precomputed independently.
4. Identity last, unless security/compliance requires separate ownership.

References used for this direction:

- Microsoft .NET Architecture: Common web application architectures
- Microsoft .NET Microservices: Identify domain-model boundaries
- Azure Architecture Center: Microservices architecture style
- Martin Fowler: Monolith First
