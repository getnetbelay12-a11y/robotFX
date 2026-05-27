# CareProof Pilot Readiness Checklist

This document is the technical go/no-go checklist for putting CareProof in front of a small pilot agency. It is stricter than demo readiness. A demo can tolerate controlled seed data and manual recovery; a pilot cannot tolerate unclear data boundaries, broken auth, or unverified operational dependencies.

## 1. Current Verified Status

- Backend and frontend operational DTO mapping is in place for nurse approvals, inspection findings, social work cases, intake records, medical availability, and expiration records.
- Backend schema/API gaps for the operational modules have been closed for known branch, priority, linked concern, follow-up date, and linked inspection record fields.
- Server-side RBAC and agency/branch isolation have been hardened and covered by tests.
- Family-safe communication paths exist for approved family-facing updates and concerns.
- Local backend Jest tests that touch MongoDB require MongoDB at `127.0.0.1:27017`.
- The product should not be described as production-ready until backup, monitoring, notification provider, and operational support gaps are closed.

## 2. Demo-Ready Features

- Seeded demo login flows for owner/admin, caregiver, family, nurse, social worker, and intake agent.
- Dashboard views that prefer API data and fall back to demo data only when API data is unavailable or empty.
- Visit proof review, audit trail display, nurse approval review, inspection findings, social work cases, intake records, medical availability, expiration records, and system readiness views.
- Family-facing feed that shows approved, family-safe content instead of raw internal operational detail.
- Demo seed data for realistic clients, visits, caregivers, family members, approvals, concerns, and operational records.

## 3. Pilot-Ready Features

- Authentication and role guards are enforced on backend routes, not only by hiding frontend controls.
- Agency filtering is required for tenant-owned records.
- Branch filtering is required for branch-scoped operational workflows.
- Caregivers are restricted to assigned visits.
- Family users are restricted to approved family-safe updates for linked clients.
- Nurse, social worker, and intake-agent roles have server-side access boundaries for their operational responsibilities.
- Health/readiness endpoints and local test commands are documented.
- Core lint, typecheck, test, and build commands must pass in the target pilot environment before onboarding live users.

## 4. Production Blockers

- No verified automated backup and restore drill for production data.
- No complete production monitoring and alert routing for API failures, MongoDB connectivity, auth failures, notification failures, or elevated error rates.
- Email and SMS provider behavior is not proven end-to-end with real credentials.
- No finalized incident response process for wrong-family visibility, data exposure, failed visit workflows, or auth boundary failures.
- No formal retention/deletion policy implementation for regulated records.
- No load/concurrency validation against expected agency usage.
- No documented support owner, response window, and escalation process for live agencies.

## 5. Required Environment Variables

Backend required:

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

Secrets must live only in hosting environment settings. Do not commit live JWT secrets, database URIs, provider tokens, or OpenAI keys.

## 6. MongoDB Local Test Requirement

Backend Jest tests require MongoDB running locally at:

```text
127.0.0.1:27017
```

Start MongoDB locally with Homebrew:

```bash
brew services start mongodb-community
```

Or run `mongod` directly with a local data directory:

```bash
mkdir -p ./tmp/mongo-data
mongod --dbpath ./tmp/mongo-data
```

Run backend tests with:

```bash
pnpm --filter ./apps/backend test
```

Sandboxed agents may need approved network or socket access because the Jest process opens a local TCP connection to MongoDB. If sandbox policy blocks that socket, the failure can look like:

```text
connect EPERM 127.0.0.1:27017
```

Do not report that as a code failure unless the same test fails after MongoDB is running and local socket access is approved.

## 7. Auth/RBAC Status

- JWT authentication exists for protected backend routes.
- Role guards exist for operational modules and sensitive actions.
- Backend tests cover unauthorized access for key role boundaries.
- Frontend route hiding is only usability; it is not security.
- Every new endpoint must define allowed roles plus agency, branch, client, visit, or family scope.

## 8. Branch/Agency Isolation Status

- Agency-scoped records must always be filtered by `agencyId`.
- Branch-scoped records must also be filtered by `branchId` unless the actor has an explicitly cross-branch role.
- Nurse users must not access unrelated branch records.
- Intake agents must not access nurse-only or clinical review records.
- Social workers must not access intake or nurse-only records unless explicitly authorized by the backend.
- Cross-agency and cross-branch denial tests must remain mandatory for new operational endpoints.

## 9. Family-Safe Communication Status

- Family users should only see approved updates for clients they are linked to.
- Internal notes, raw incident detail, clinical review detail, compliance-only findings, staff-only comments, and unrelated client data must remain server-restricted.
- Family concern submission should create backend records scoped to the correct family member, client, agency, and branch context.
- Approval state must come from server data; do not rely on local optimistic state as the source of truth for family visibility.

## 10. AI Safety Boundaries

- AI output must be treated as assistive text, not clinical instruction, legal advice, or compliance certification.
- AI must not override RBAC, agency isolation, branch isolation, family-safe filtering, or approval workflows.
- AI prompts and responses must not expose unrelated clients, internal notes, secrets, or staff-only operational records to unauthorized users.
- Fallback mode is acceptable when OpenAI is disabled, unavailable, rate-limited, or not configured.
- Any AI-generated summary shown to family users must pass the same family-safe approval boundary as manually written content.
- Do not promise emergency response, diagnosis, medical triage, or guaranteed regulatory compliance from AI features.

## 11. Backup, Monitoring, Email, And SMS Gaps

- Backup documentation exists, but production launch requires automated backup verification and a tested restore procedure.
- Monitoring must cover API health, readiness, MongoDB connectivity, auth failures, failed notification sends, and elevated error rates.
- Alert routing must point to a real owner with a documented response window.
- Email provider credentials and sender identity must be verified before promising email notifications.
- SMS provider credentials, sender number, and delivery behavior must be verified before promising SMS notifications.
- Placeholder notification records are acceptable for demo only; they are not enough for production communication guarantees.

## 12. Go / No-Go Checklist

Go only if every item below is true:

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes with MongoDB running and reachable.
- [ ] `pnpm build` passes.
- [ ] Demo seed creates realistic pilot data.
- [ ] Owner/admin, caregiver, family, nurse, social worker, and intake-agent paths have been manually verified.
- [ ] Backend denies cross-agency access.
- [ ] Backend denies cross-branch access where branch scope applies.
- [ ] Family users cannot access unsafe or unrelated records.
- [ ] AI mode is deliberately configured as disabled, fallback-first, or OpenAI-backed.
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
- [ ] AI can bypass access controls or approval workflows.
- [ ] Backup/restore has not been proven.
- [ ] Notification behavior is promised while provider credentials are placeholders.
