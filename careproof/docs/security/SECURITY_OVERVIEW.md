# CareProof Security Overview

## Core Rules

- Every agency-scoped query must filter by `agencyId`.
- Role-based access is enforced on backend endpoints.
- Family members can only access assigned client data.
- Caregivers can only access assigned visits and limited assigned client records.
- Raw high-severity incident details are not exposed to families automatically.

## Authentication

- Passwords are hashed with `argon2`.
- Access tokens are short-lived JWTs.
- Refresh token secret is required.
- Refresh tokens are stored hashed.
- Login failures are rate limited.

## Auditability

Critical actions create audit logs, including visit execution, reports, imports, and notifications.

Audit logs must not store:

- passwords
- JWTs
- refresh tokens
- API keys
- infrastructure secrets

## Operational Safety

- `GET /health` confirms the service is running.
- `GET /ready` confirms MongoDB connectivity.
- Structured request logging avoids logging secrets or raw sensitive payloads.

## Highest-Risk Failure

The highest-risk failure is cross-agency data exposure.

If Agency A can see Agency B data, the product is not pilot-safe.
