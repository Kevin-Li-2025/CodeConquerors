# Test Architecture

> AccessCity follows a **test pyramid** strategy: fast isolated unit tests at the base, integration tests in the middle, and stress/benchmark + E2E at the top.

---

## Test Pyramid

```
        ┌──────────┐
        │   E2E    │  Python probe scripts (real Docker stack)
        ├──────────┤
        │  Stress  │  Concurrent load, latency distribution (p50/p95/p99)
        ├──────────┤
        │  Integ.  │  WebApplicationFactory + real PostGIS + Redis
        ├──────────┤
        │   Unit   │  Validators, Services (Moq isolation), pure math
        └──────────┘
```

---

## Layer Details

### Unit Tests (fastest, most numerous)

| File | What It Tests | Isolation |
|------|---------------|-----------|
| `ValidatorUnitTests.cs` | FluentValidation rules for `RouteRequest`, `RiskScoreRequest`, `CreateHazardRequest` | No dependencies |
| `RiskScoringServiceTests.cs` | Haversine math, risk evaluation, hazard proximity weighting, crime/lighting data (Moq) | Mocked `IUkPoliceDataClient`, `IEnvironmentalDataClient`, `IMemoryCache` |
| `TokenServiceTests.cs` | JWT creation, claim verification, signature validation, refresh token generation | In-memory `IConfiguration` |

**Mock Strategy**: Uses [Moq](https://github.com/moq/moq4) for interface isolation. External APIs (`IUkPoliceDataClient`, `ILiveHazardClient`, `IEnvironmentalDataClient`) are mocked to ensure determinism. Cache hit/miss behavior is verified with real `MemoryCache`.

### Integration Tests (medium speed)

| File | What It Tests | Dependencies |
|------|---------------|--------------|
| `ApiIntegrationTests.cs` | Full API round-trip: auth, CRUD, spatial queries | `WebApplicationFactory` + PostGIS |
| `ApiEdgeCoverageTests.cs` | Edge cases: malformed input, boundary values | Same |
| `DeepApiTests.cs` | Deep business logic: routing, risk scoring via HTTP | Same |
| `AuthTests.cs`, `AuthTokenLifecycleTests.cs` | Registration, login, token refresh/revoke | Same |
| `RoutingTests.cs` | Safe-path routing with real OSM fixture data | Same + `test-network.osm` |
| `BirminghamRouteTests.cs`, `LondonRouteTests.cs` | City-specific routing with real geographic data | Same |
| `SpatialCacheTests.cs`, `SpatialCachePerformanceTests.cs` | Cache correctness and performance | Same + Redis |
| `SchemaAlignmentTests.cs` | DB schema matches entity model | PostGIS |
| `HazardAlertHubTests.cs` | SignalR hub notifications | `WebApplicationFactory` |

**Factory**: `AccessCityApiFactory` extends `WebApplicationFactory<Program>` with automatic database reset, OSM fixture loading, and authenticated client helpers.

### Stress / Benchmark Tests (load simulation)

| File | What It Tests | Technique |
|------|---------------|-----------|
| `ApiStressTests.cs` | Concurrent burst, staggered waves, cold/warm start, mixed-endpoint load | `Task.WhenAll`, latency distribution (p50/p95/p99), throughput metrics |
| `ApiSuperStressTests.cs` | Extended stress scenarios | High-concurrency bursts |
| `BenchmarkTests.cs`, `SpeedBenchmarkTests.cs` | Performance baselines | Timed assertions |

**Metrics Reported**: p50, p95, p99, min, max latency + requests/second throughput, all output as Markdown tables via `ITestOutputHelper`.

### E2E (full Docker stack)

| Script | What It Tests |
|--------|---------------|
| `scripts/probe_api_endpoints.py` | All API endpoints: anonymous + authenticated, expected status codes |
| `scripts/measure_api_latency.py` | Client-side latency benchmarking across all endpoints |

---

## CI/CD Enforcement

Pipeline (`.gitlab-ci.yml`) runs on every push and merge request:

| Stage | Job | Description |
|-------|-----|-------------|
| `quality` | `frontend-lint`, `frontend-typecheck`, `security-npm`, `security-dotnet` | Static analysis & dependency audit |
| `test` | `backend:test` | xUnit + Cobertura coverage |
| `test` | `api:probe` | Live API smoke test |
| `test` | `frontend:test` | Jest |
| `test` | `e2e:playwright` | Playwright E2E |

Coverage reports are uploaded as Cobertura artifacts for GitLab visualization.

---

## Running Tests Locally

```bash
# Unit + Integration (requires PostGIS + Redis running)
dotnet test AccessCity.Tests/ --verbosity normal

# With coverage
dotnet test AccessCity.Tests/ --collect:"XPlat Code Coverage"

# E2E probe (requires docker compose up)
python3 scripts/probe_api_endpoints.py http://localhost:8080

# Latency benchmark
python3 scripts/measure_api_latency.py http://localhost:8080 25 3
```
