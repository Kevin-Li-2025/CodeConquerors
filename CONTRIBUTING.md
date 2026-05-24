# Contributing

AccessCity is an active pre-production portfolio and research system for accessibility-aware urban routing. Contributions should improve correctness, reliability, performance, accessibility data quality, or operational clarity without overstating production maturity.

## Ground Rules

- Keep routing decisions deterministic, reproducible, testable, and auditable.
- Do not use an LLM to generate routes or change edge costs at request time.
- Do not commit secrets, API keys, training tokens, private model weights, personal data, or production credentials.
- Do not weaken safety, accessibility, security, or CI gates to make a change pass.
- Keep public performance claims tied to checked-in benchmark logs or repeatable commands.

## Development Setup

Run the full local backing stack when a change needs PostGIS, Redis, Kafka, workers, or the gateway:

```bash
docker compose --profile worker up -d --build
```

Run the API directly against local backing services when debugging:

```bash
cd AccessCity.API
ASPNETCORE_ENVIRONMENT=Development dotnet run
```

Run the Expo client:

```bash
cd AccessCity.App
npm ci
npm run web
```

## Required Validation

Backend changes:

```bash
dotnet format CodeConquerors.sln --verify-no-changes --verbosity minimal
dotnet build CodeConquerors.sln --configuration Release
dotnet test AccessCity.Tests/AccessCity.Tests.csproj --configuration Release --no-build --verbosity normal
dotnet list CodeConquerors.sln package --vulnerable --include-transitive
```

Frontend changes:

```bash
cd AccessCity.App
npm ci
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run test:ci
npm audit --audit-level=high
```

Deployment/config changes:

```bash
docker compose config --quiet
docker compose --profile worker config --quiet
docker compose --profile migrate config --quiet
kubectl kustomize deploy/kubernetes >/tmp/accesscity-kubernetes.yaml
```

## Routing and Risk Changes

For any change that can alter routes, route scores, graph preprocessing, safety/risk scoring, accessibility penalties, cache keys, or worker dispatch:

- Add or update route quality tests and benchmark fixtures.
- Explain which accessibility profiles are affected.
- Document whether the change affects edge weights, graph artifact versions, or cache invalidation.
- Compare correctness before/after on representative routes, not only on latency.
- Keep external APIs off the synchronous hot path unless the endpoint has an explicit degraded fallback.

## AI and Vision Changes

AI is allowed for hazard text normalization, duplicate-report suggestions, admin summaries, route explanations, and offline accessibility data enrichment. It must not be the source of truth for live routing decisions.

For model, prompt, or training changes:

- Keep training, validation, calibration, and holdout splits separate.
- Do not tune on holdout results.
- Record dataset sources, label policy, calibration method, and known failure modes.
- Add smoke tests for inference contracts and fallback behavior.
- Keep route decision logic deterministic even when AI explanations are enabled.

## Pull Requests

Each pull request should include:

- Problem statement.
- Summary of changes.
- Validation commands and results.
- New or updated documentation when public claims change.
- Screenshots or demo clips for user-visible changes.

If a change is only a design target and not yet validated, keep it out of the README baseline and put it in the roadmap or in `docs/CLAIMS.md` as unproven.
