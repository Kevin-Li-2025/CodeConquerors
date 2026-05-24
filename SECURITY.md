# Security Policy

AccessCity is pre-production software. Do not use the checked-in development configuration for production deployments.

## Supported Versions

Security fixes target the current `master` branch. Historical commits and experimental branches are not maintained as supported release lines.

## Reporting a Vulnerability

Prefer a private GitHub Security Advisory if repository security advisories are enabled. If that path is unavailable, contact the maintainers privately and avoid publishing exploit details until a fix or mitigation has been prepared.

Please include:

- Affected component and version or commit SHA.
- Reproduction steps or proof of concept.
- Impact assessment.
- Whether credentials, personal data, route history, location data, or model artifacts are exposed.
- Suggested mitigation if known.

## Secret Handling

- Never commit real JWT signing keys, database passwords, Redis/Kafka credentials, cloud tokens, Hugging Face tokens, Nebius keys, SSH passwords, or production API keys.
- Use Kubernetes Secrets, ExternalSecrets, or a managed secret store for deployed environments.
- Rotate JWT signing keys with `Jwt__Key` and `Jwt__PreviousKeys`.
- Revoke any credential that appears in logs, screenshots, issues, commits, model configs, notebooks, or benchmark artifacts.

## Production Hardening Checklist

Before running AccessCity outside a controlled development or benchmark environment:

- Replace all example secrets and development passwords.
- Use TLS for external traffic and private networking for Postgres, Redis, Kafka, and workers.
- Put Postgres behind PgBouncer and restrict direct database access.
- Keep public Overpass, OSRM, weather, environmental, and safety APIs off the synchronous hot path.
- Enable vulnerability scanning for application images and dependencies.
- Configure observability, SLO alerts, backups, restore drills, and incident ownership.
- Confirm that accessibility/risk explanations are advisory and do not claim emergency-service reliability.

## AI Safety Boundary

LLMs and vision models may assist with text normalization, duplicate-report suggestions, summaries, explanations, and offline accessibility data enrichment. Live routing decisions must remain deterministic, reproducible, and auditable.
