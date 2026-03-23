# k6 Load Test Results — AccessCity API

**Date**: 2026-03-23
**Base URL**: `http://localhost:8080`
**Tool**: k6 v1.6.1 (Grafana Labs)
**Rate Limiter**: 10,000 req/min (relaxed for testing)

---

## Load Profile

| Phase | Duration | Virtual Users |
|-------|----------|---------------|
| Ramp-up | 30s | 0 → 50 |
| Sustained | 2m | 50 |
| Spike | 30s | 50 → 100 |
| Cool-down | 30s | 100 → 0 |

**Total Duration**: 3m 35s
**Total Iterations**: 2,030
**Max Concurrent Users**: 100

---

## Key Metrics

| Metric | Value |
|--------|-------|
| **Total Requests** | 18,669 |
| **RPS (avg)** | 87.7 req/s |
| **Latency p50** | 1.33 ms |
| **Latency p90** | 16.79 ms |
| **Latency p95** | 21.50 ms |
| **Error Rate** | **0.92%** |
| **HTTP Failures** | **0 / 18,669 (0.00%)** |
| **Data Received** | 11 MB (49 KB/s) |

---

## System Resources (Peak)

| Resource | Value |
|----------|-------|
| **CPU Usage** | 15.2% |
| **Memory** | 525.4 MB |

---

## Per-Endpoint Latency

| Endpoint | Median | p90 | p95 |
|----------|--------|-----|-----|
| Health | 18.01 ms | 28.48 ms | 34.29 ms |
| Dashboard | 0.95 ms | 2.82 ms | 3.86 ms |
| Spatial | 1.30 ms | 3.51 ms | 4.56 ms |
| Risk Score | 1.61 ms | 4.23 ms | 6.21 ms |
| Hazards | 0.78 ms | 2.06 ms | 2.96 ms |
| Auth | 65.69 ms | 145.39 ms | 181.19 ms |
| **Safe Path** | **18.25 s** | **30.00 s** | **30.01 s** |

---

## Threshold Results

| Threshold | Criteria | Result |
|-----------|----------|--------|
| Global latency | p(95) < 3,000ms | ✅ PASS (21.50ms) |
| Health latency | p(95) < 500ms | ✅ PASS (34.29ms) |
| Dashboard latency | p(95) < 1,000ms | ✅ PASS (3.86ms) |
| Spatial latency | p(95) < 500ms | ✅ PASS (4.56ms) |
| Error rate | < 10% | ✅ PASS (0.92%) |

---

## Conclusion

All performance thresholds **passed**. HTTP failure rate is **0%**. System resource utilization remains stable (Peak Memory 525MB). Safe-path routing (median 18.2s under load) remains the primary scalability constraint due to A* pathfinding over the real OSM graph. Read-heavy endpoints demonstrate production-ready scaling (sub-5ms p95) with effective Redis L2 caching.
