# Three-Minute Demo Walkthrough

This demo is designed to prove the product path without overstating production readiness.

## Goal

Show a user planning an accessibility-aware route with a wheelchair profile, then show the route explanation and safety signals that make the recommendation auditable.

## Script

### 0:00-0:30 - Start with the map

- Open the AccessCity client.
- Confirm the map loads and the current area is visible.
- Point out that the system is not a generic map clone: the route profile, hazards, and accessibility data affect recommendations.

### 0:30-1:00 - Enter origin and destination

- Choose a realistic start point.
- Choose a destination on the map or from search.
- Keep the inputs short and legible so a reviewer can follow the workflow quickly.

### 1:00-1:40 - Select wheelchair profile

- Switch the profile to manual wheelchair.
- Submit the route request.
- Explain that route computation is deterministic and auditable. AI may explain or summarize, but it does not generate the route or mutate live edge costs.

### 1:40-2:30 - Inspect route and hazards

- Show the recommended route.
- Open the safety/accessibility details.
- Highlight any penalties such as steep incline, poor surface, construction, missing curb ramp, stairs, or nearby hazard reports.
- If a route is avoided, explain which deterministic signal caused the avoidance.

### 2:30-3:00 - Close with engineering proof

- Show the README baseline and `docs/CLAIMS.md`.
- Mention that the checked-in distributed k6 scenario reached 440.36 req/s and safe-path p95 167.56 ms for that workload.
- State the limit clearly: this is a pre-production system and still needs larger city-scale graph validation before claiming 1M DAU.

## Recording Checklist

- Use a clean seed/demo account.
- Do not expose tokens, passwords, private coordinates, or personal location data.
- Capture the API URL only if it is local or public-demo safe.
- Keep the video under three minutes.
- After recording, store the final GIF or MP4 under `docs/demo/` and update the README link if the filename changes.
