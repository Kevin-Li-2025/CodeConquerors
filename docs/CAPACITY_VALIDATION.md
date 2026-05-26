# Production Capacity Validation

This is the repo's production-like validation path for proving whether AccessCity scales linearly
under real distributed pressure. It is separate from local unit/stress tests because it needs an
actual Kubernetes cluster with Kafka, Redis, PgBouncer, and Postgres/PostGIS replicas.

## Target Topology

The capacity overlay starts with:

- 10 API pods
- 30 worker pods
- 96 Kafka topic partitions
- Redis shared cache
- PgBouncer read/write pooler for writes
- PgBouncer read-only pooler/read replica path for hot reads
- KEDA configured to scale API pods up to 40 and workers up to 100

Files:

- `deploy/kubernetes-capacity/`
- `deploy/kubernetes/capacitytest-configmap.yaml`
- `tools/run-k8s-capacity-validation.sh`
- `deploy/kubernetes/cnpg-pooler.example.yaml`

## Prerequisites

Apply or provide the platform dependencies before running this test:

- Kafka brokers with at least 96 partitions available for AccessCity topics.
- Redis or Redis-compatible shared cache configured in `ConnectionStrings__Redis`.
- Postgres/PostGIS primary plus read replicas.
- PgBouncer transaction poolers:
  - `accesscity-postgres-rw-pooler`
  - `accesscity-postgres-ro-pooler`
- KEDA and Prometheus if you want autoscaling during the run.
- Enough node capacity for the selected matrix. The default two-step run can request roughly:
  - 20 API pods at 750m CPU / 1536Mi
  - 60 worker pods at 500m CPU / 1Gi
  - one k6 pod up to 6 CPU / 2Gi

Secrets must include both runtime and read-only DB URLs:

```yaml
DATABASE_URL: postgresql://...@accesscity-postgres-rw-pooler:5432/accesscitydb?sslmode=disable
READONLY_DATABASE_URL: postgresql://...@accesscity-postgres-ro-pooler:5432/accesscitydb?sslmode=disable
DIRECT_DATABASE_URL: postgresql://...@accesscity-postgres-rw:5432/accesscitydb?sslmode=require
ConnectionStrings__Redis: redis:6379
```

## Run

Short capacity matrix:

```bash
kubectl apply -k deploy/kubernetes-capacity

TEST_DURATION=10m \
MATRIX="10:30:80:220:80:60:40:40:0 20:60:160:440:160:120:80:60:0" \
tools/run-k8s-capacity-validation.sh
```

Matrix columns:

```text
apiPods:workerPods:routeRate:riskRate:poiRate:hazardRate:dashboardRate:readinessRate:tileRate
```

Example 24-hour soak after the short matrix passes:

```bash
TEST_DURATION=24h \
JOB_TIMEOUT=26h \
MATRIX="10:30:80:220:80:60:40:40:0" \
tools/run-k8s-capacity-validation.sh
```

The script writes artifacts under `/tmp/accesscity-capacity-<timestamp>` by default:

- k6 log
- k6 summary JSON
- workload snapshots
- KEDA objects
- runtime ConfigMaps
- events and `kubectl top pods` output when metrics-server is available

During each matrix step, the script temporarily locks KEDA min/max replicas to the requested
topology so the run measures a fixed cluster size. At the end it reapplies the capacity overlay,
restoring the normal 10-40 API and 30-100 worker autoscaling bounds.

## Success Criteria

Do not translate a run into DAU/MAU claims unless all of these hold:

- k6 `http_req_failed < 1%`
- route critical failures `< 1%`
- route job timeout rate `< 1%`
- hot read failure rate `< 0.5%`
- readiness failure rate `< 0.1%`
- overall p95 `< 1200ms`
- overall p99 `< 3000ms`
- route submit p95 `< 350ms`
- route poll p95 `< 250ms`
- risk-score p95 `< 250ms`
- POI and hazard page p95 `< 350ms`
- Kafka route job lag drains back to near zero after the run
- Postgres primary CPU and lock waits do not grow over the run
- PgBouncer wait time stays bounded
- no API or worker restart loop
- no monotonic memory growth during soak

## Linear Scaling Evidence

The default matrix doubles API pods, workers, and request rates:

```text
10 API / 30 workers -> route 80 rps, total mixed traffic about 520 rps
20 API / 60 workers -> route 160 rps, total mixed traffic about 1020 rps
```

Treat scaling as healthy only if the second step keeps roughly the same or better:

- p95/p99 latency
- failure rate
- route job completion rate
- Kafka lag recovery time normalized by request rate
- PgBouncer wait time
- Postgres CPU and I/O saturation

If the second step doubles pods but latency grows sharply, the bottleneck has moved to PostGIS,
Kafka partitions, Redis bandwidth, route graph artifact load/deserialize, or worker CPU.

## DAU/MAU Estimate Method

After a passing soak, estimate DAU from sustained successful requests per second rather than peak
RPS:

```text
daily_requests = sustained_success_rps * 86400
requests_per_dau = measured_average_requests_per_daily_user
dau_capacity = daily_requests / requests_per_dau
mau_capacity = dau_capacity * active_day_ratio_denominator
```

Use product telemetry for `requests_per_dau`. Until then, report ranges:

- light usage: 30 requests / DAU / day
- normal usage: 80 requests / DAU / day
- heavy usage: 200 requests / DAU / day

Do not use this formula when route job timeout rate, Kafka lag, or Postgres wait time fails the
success criteria. That run proves the bottleneck, not user capacity.

## Failure Diagnosis

- Route submit latency high, Kafka lag low: API rate limiting/backpressure or Postgres read path.
- Route submit fast, route jobs timeout, Kafka lag high: add workers or partitions; profile route graph artifact load.
- Risk/POI p95 high: read replica, materialized aggregates, spatial indexes, cache bucket hit ratio.
- PgBouncer wait time high: reduce per-pod pool size, add PgBouncer instances, or split read/write pools.
- Redis CPU/network high: reduce payload size, raise local L1 hit ratio, or keep large graph bundles file-backed.
- Readiness p95 high: readiness cache or health dependency probes are too expensive.
