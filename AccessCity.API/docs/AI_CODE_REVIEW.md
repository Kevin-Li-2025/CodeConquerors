# AI Code Review: Dashboard + Real Hazard Service

Self-check against common AI-generated code patterns (from "I Reviewed 50 AI-Generated PRs" and similar).

---

## ✅ What doesn’t look AI

- **No over-engineering**: No extra frameworks, just service + cache + controller.
- **Bounded input**: `limit` is clamped to 1–100 in infrastructure-feed.
- **Null checks**: `h.Location == null`, `el.Center != null`, `tags ?? new Dictionary`.
- **Single responsibility**: Controllers return data; mapping lives in the service.

---

## ⚠️ Looks AI / problematic

### 1. **Silent catch — every failure looks the same** (Classic AI #1)

**Where:** `OverpassApiClient.GetHazardLikeDataAsync` (lines 75–79)

```csharp
catch
{
    return null;
}
```

- Timeout, DNS failure, 5xx, JSON parse error → all become `null`.
- Caller gets empty list and cannot tell “no data” from “Overpass down”.
- No logging → useless at 3 AM.

**Fix:** Log with context (endpoint, bbox, exception type/message); consider returning a Result type or throwing and handling in a filter so the API can return 503 + correlation id.

---

### 2. **No timeout on external HTTP** (Classic AI #2)

- `HttpClient` for Overpass has no `Timeout` or `CancellationToken`.
- If overpass-api.de hangs, the request hangs until .NET default (often 100s).
- One slow Overpass can block threads and contribute to cascading failure.

**Fix:** Configure timeout when registering the client, e.g.:

```csharp
builder.Services.AddHttpClient<IOpenStreetMapClient, OverpassApiClient>()
    .ConfigureHttpClient(c => c.Timeout = TimeSpan.FromSeconds(30));
```

---

### 3. **No logging that helps operations** (Classic AI #6)

- No logs when:
  - Overpass fails (why hazards are empty).
  - Cache hit vs miss (why responses change after 2 min).
  - Invalid or extreme bbox (abuse or bugs).
- Only “success path” is visible; failures are invisible.

**Fix:** Add structured logging (e.g. ILogger) for: Overpass errors (and optionally status code), cache hit/miss, and bbox validation failures.

---

### 4. **Bbox not validated**

- `minLat`, `maxLat`, `minLng`, `maxLng` are passed through to Overpass as-is.
- If client sends `minLat > maxLat` or out-of-range values, we still call Overpass (weird query, possible abuse or wasted load).

**Fix:** Validate `minLat <= maxLat`, `minLng <= maxLng`, and lat/lng in [-90,90] / [-180,180]; return 400 if invalid.

---

### 5. **Controllers don’t handle service failures**

- If `GetActiveHazardsAsync` throws (e.g. cache or serialization issue), the request returns 500 with no handling or logging.
- No try/catch or exception filter for this path.

**Fix:** Either let it 500 and rely on global exception handling + logging, or add a try/catch in the controller that logs and returns 503/500 with a safe message.

---

### 6. **Minor: XML comments on everything**

- Every method has a `<summary>`.
- Not wrong, but very “polite” and consistent in a way that can look AI-generated.

**Verdict:** Keep for public API; optional to trim on internals.

---

## Summary

| Pattern                         | Present? | Severity |
|---------------------------------|----------|----------|
| Silent catch (no differentiation) | Yes      | High     |
| No HTTP timeout                 | Yes      | High     |
| No operational logging         | Yes      | High     |
| No bbox validation              | Yes      | Medium   |
| No retry/backoff                | N/A      | Low (cache mitigates) |
| Over-engineering               | No       | —        |
| N+1 / performance               | No       | —        |

**Verdict:** The structure is fine and not over-engineered, but **error handling and observability are typical of AI code**: silent failure, no timeouts, no logs. Adding timeout, logging, and bbox validation would make it look more production-ready and less “AI-default”.
