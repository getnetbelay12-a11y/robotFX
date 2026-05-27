# CareProof Technical Pilot Readiness Checklist

This checklist is for deciding whether CareProof is safe to put in front of a small pilot agency. It is intentionally stricter than demo readiness and less forgiving than a sales checklist.

## 1. Current verified status

- Operational DTO mapping work is in place for nurse approvals, inspection findings, social work cases, intake records, medical availability, and expiration records.
- Backend schema alignment has been added for the operational module fields that the frontend renders.
- Server-side RBAC and branch/agency isolation have been hardened in commit `c29a9e2`.
- Backend Jest tests that touch MongoDB require a local MongoDB server at `127.0.0.1:27017`.
- A green local test result is only valid when the required local services and socket permissions are available.

## 2. Demo-ready

CareProof is demo-ready when the following are true:

- Seeded demo data loads without empty-state confusion.
- Admin, caregiver, family, and operational role logins work with known demo accounts.
- The dashboard renders live API data when available and falls back to demo fixtures only when the API is unavailable or empty.
- Core demo flows are usable: visit review, family updates, incidents, family concerns, intake records, nurse approvals, inspection findings, medical availability, and expiration records.
- Family-facing views avoid raw internal notes and unsafe clinical/compliance detail.
- Demo walkthrough can be completed without editing database records manually.

## 3. Pilot-ready

CareProof is pilot-ready only when these technical gates pass:

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` exit with status `0` in the target environment.
- Backend MongoDB-backed tests pass against a reachable MongoDB instance.
- Agency isolation is enforced by backend queries, not only frontend route hiding.
- Branch isolation is enforced for branch-scoped operational records.
- Role-based access is enforced server-side for routes and actions.
- Caregivers can access only assigned visits.
- Family users can access only approved, family-safe updates for their linked clients.
- Pilot seed/onboarding process creates realistic agencies, users, branches, clients, caregivers, visits, and family links.
- Health and readiness endpoints are available to hosting infrastructure.
- Backup and restore procedure has been rehearsed at least once against non-production data.

## 4. Production-blocking

The following should block production launch even if a controlled pilot can proceed:

- No automated backup verification or restore drill.
- No production monitoring alert path for API failures, auth failures, background jobs, or database connectivity.
- Email/SMS providers are placeholders or unverified in the production environment.
- No incident response runbook for data exposure, wrong-family visibility, or failed visit workflows.
- No formal audit of environment secrets, hosting permissions, and database access controls.
- No load or concurrency test for expected agency usage.
- No retention/deletion policy implementation for regulated records.
- No documented support process with owner, response window, and escalation path.

## 5. Required environment variables

Backend:

- `APP_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`

Backend optional or environment-specific:

- `PORT`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `EMAIL_FROM`
- `SMS_PROVIDER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SENTRY_DSN`
- `LOG_LEVEL`
- `AI_ENABLED`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `AI_MODEL`
- `OPENAI_RETRY_COOLDOWN_MINUTES`

Web/admin:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_BOOK_DEMO_URL`
- `NEXT_PUBLIC_PILOT_URL`
- `NEXT_PUBLIC_SENTRY_DSN`

Secrets must live in hosting environment settings. Do not commit live JWT secrets, database URIs, provider tokens, or OpenAI keys.

## 6. MongoDB requirement for tests

Backend Jest tests require MongoDB running locally at:

```text
127.0.0.1:27017
```

Local start options:

```bash
brew services start mongodb-community
```

or:

```bash
mongod --dbpath ./tmp/mongo-data
```

Run backend tests with:

```bash
pnpm --filter ./apps/backend test
```

Sandboxed agents may need approved network or socket access because the test process opens a local TCP connection to MongoDB. If MongoDB is blocked by sandbox policy, the failure can look like:

```text
connect EPERM 127.0.0.1:27017
```

Do not report that as a code failure unless the same test fails after MongoDB is running and local socket access is approved.

## 7. Auth/RBAC status

- JWT authentication exists for backend routes that require a logged-in user.
- Role guards exist and have been hardened for operational modules.
- Frontend route hiding is not sufficient and must not be treated as security.
- Unauthorized access tests should remain mandatory for every role-sensitive controller.
- Any new endpoint must declare who can access it and which agency/branch scope applies.

## 8. Branch/agency isolation status

- Agency filtering is required on all tenant-owned records.
- Branch filtering is required on branch-scoped records such as intake, nurse approvals, inspection findings, and other operational workflows.
- Branch-scoped users must not see records from unrelated branches in the same agency unless their role explicitly allows cross-branch access.
- Tests should cover both cross-agency denial and same-agency cross-branch denial.

## 9. Family-safe communication status

- Family users must only receive approved family-safe summaries and updates.
- Raw incidents, internal notes, clinical review details, compliance severity detail, staff-only comments, and unrelated client data must stay server-side restricted.
- Family feed and concern endpoints must enforce client/family membership on the backend.
- Do not rely on frontend filtering to hide unsafe data.

## 10. Backup, monitoring, email, and SMS gaps

- Backup plan exists, but production launch requires automated backup verification.
- Restore process must be tested before a real pilot stores live agency data.
- Monitoring must include API health, readiness, MongoDB connectivity, auth failures, failed notification sends, and elevated error rates.
- Email provider configuration must be verified end-to-end before promising email notifications.
- SMS provider configuration must be verified end-to-end before promising SMS notifications.
- Placeholder notification records are acceptable for demo, but not enough for production communication guarantees.

## 11. Go/no-go checklist

Go only if every item below is true:

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes with MongoDB running and reachable.
- [ ] `pnpm build` passes.
- [ ] Demo seed completes and creates realistic pilot data.
- [ ] Admin, caregiver, family, nurse, social worker, and intake-agent access paths have been tested.
- [ ] Cross-agency access is denied by the backend.
- [ ] Cross-branch access is denied by the backend where branch scope applies.
- [ ] Family users cannot access unsafe or unrelated records.
- [ ] Backup and restore have been tested against non-production data.
- [ ] Monitoring alerts are configured and routed to a real owner.
- [ ] Email/SMS behavior is either verified or explicitly excluded from pilot promises.
- [ ] Pilot support owner and response window are documented.
- [ ] Known production blockers are disclosed before onboarding a real agency.

No-go if any item below is true:

- [ ] Tests fail for a code reason.
- [ ] MongoDB connectivity is unverified.
- [ ] Any role can access unrelated agency, branch, client, visit, or family records.
- [ ] Family users can see internal notes or unsafe operational detail.
- [ ] Backup/restore has not been proven.
- [ ] Notification behavior is promised but provider credentials are placeholders.
