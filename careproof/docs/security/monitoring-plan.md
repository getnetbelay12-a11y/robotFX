# Monitoring Plan

- Application errors: capture with Sentry or equivalent
- Uptime: external health check against `GET /api/health`
- API latency: track p95 latency for auth, visits, dashboard, and family feed endpoints
- Database health: monitor connection failures and query latency
- Audit integrity: alert if visit actions occur without corresponding audit log or visit event records
