# CareProof Pilot Readiness

This document is the current technical readiness view for a controlled CareProof pilot. It is intentionally honest: CareProof is demo-ready and has meaningful pilot-grade controls, but it is not production-ready until the operational, security, compliance, and infrastructure gaps below are closed.

## 1. Current Verified Status

Current verified checks:

- `pnpm --filter ./apps/backend test` has passed with MongoDB available.
- `pnpm --filter ./apps/web test` has passed.
- `pnpm lint` has passed.
- `pnpm typecheck` has passed.
- `pnpm test` has passed with required local services available.
- `pnpm build` has passed.

Current implementation status:

- DTO mapping fixes are in place for operational modules.
- Backend operational modules exist for nurse approvals, inspection findings, social work cases, intake records, medical availability, and expiration records.
- Backend schema/API/frontend gaps have been closed for the known operational fields audited so far.
- RBAC, agency scoping, branch scoping, caregiver visit restrictions, and family-safe restrictions have been hardened server-side.
- Frontend operational screens prefer API data and retain demo fallback behavior only for unavailable or empty API data.

Backend test requirements:

- Backend Jest tests require a reachable MongoDB instance.
- Tests that touch MongoDB are not valid unless MongoDB is running and the process can open a local socket.

MongoDB requirement:

- Local backend Jest tests require MongoDB at `127.0.0.1:27017`.

## 2. Demo-Ready Features

The following are strong enough for a controlled demo using seeded or prepared data:

- Proof-of-care visit flow: visit status, visit proof, checklist completion, notes, timestamps, and audit trail review.
- Caregiver mobile flow: caregiver-oriented visit execution and proof capture workflow.
- Family-safe updates: approved family-facing summaries instead of raw internal notes.
- Incidents: incident visibility and operational review flows.
- Family concerns: family concern submission and linked social work follow-up.
- Reports: basic reporting/export surfaces for demo walkthroughs.
- Nurse approvals: review and approval workflow for clinical/operational items.
- Inspection center: inspection findings with severity, status, linked client/visit/caregiver context, and branch/agency scoping.
- Social work: social work case list, linked family concern context, and follow-up date handling.
- Intake/agents: intake records scoped by branch and agency with intake-agent access boundaries.
- Medical availability: availability review surface for operational staffing readiness.
- Expiration/compliance: expiration and compliance review surface for staff/document readiness.
- System readiness: readiness screen that should not represent CareProof as production-ready.

## 3. Pilot-Ready Features

These areas are strong enough for a controlled pilot when the pilot scope is narrow, support is hands-on, and production promises are limited:

- Server-side access control exists for sensitive operational modules.
- Agency and branch isolation are enforced by backend filtering, not only frontend hiding.
- Caregiver access is restricted to assigned visits.
- Family users are restricted to linked clients and approved family-safe content.
- Operational DTOs and mappers now match backend response shapes for the known six operational modules.
- Demo fallback behavior is controlled so live API data is preferred when present.
- Backend and frontend tests cover mapper behavior, operational schema alignment, RBAC, and isolation boundaries.
- Local build/test commands have passed in the current repo state when MongoDB is available.

Pilot constraints:

- Use a small number of trained users.
- Keep a support engineer available during onboarding and first live workflows.
- Do not promise automated notifications, disaster recovery, or compliance certification until those systems are verified.
- Treat AI output as draft-only.

## 4. Not Production-Ready Yet

These items block production launch:

- Real auth/session hardening beyond basic JWT auth.
- JWT revocation and refresh token rotation.
- Production MongoDB backup and restore automation.
- Monitoring and alerting for API health, auth failures, MongoDB connectivity, notification failures, and elevated error rates.
- Email/SMS provider setup with real credentials, verified sender identity, delivery testing, and failure handling.
- Privacy, compliance, and legal review for real agency/client data.
- Deployment hardening, including secrets management, CORS review, host permissions, rate limits, and environment separation.
- Audit log retention policy and retention/deletion implementation for regulated records.
- Disaster recovery plan with tested recovery time and recovery point expectations.
- Penetration/security review covering auth, tenant isolation, family visibility, and operational workflows.

## 5. Auth/RBAC Status

- Agency scoping: backend records are filtered by `agencyId` for tenant-owned data.
- Branch scoping: branch-scoped operational records are filtered by `branchId` where branch isolation applies.
- Role access: owner/admin, nurse, social worker, intake agent, caregiver, and family access paths have server-side restrictions.
- Family-safe restrictions: family users should only see approved/sent/family-safe updates for linked clients.
- Caregiver assigned-visit restrictions: caregivers should only access visits assigned to them.

Remaining risks:

- Every new backend endpoint still needs explicit role and scope tests. The current hardening does not protect future endpoints automatically.
- Frontend route guards should be kept aligned with backend authorization, but frontend hiding must never be treated as the security boundary.
- Session hardening, token revocation, and refresh rotation remain production blockers.

## 6. Family-Safe Communication Status

- Internal notes must not be family-visible.
- Raw incident detail, clinical review detail, compliance-only findings, staff-only comments, and unrelated client records must remain server-restricted.
- Only approved, sent, or explicitly family-safe summaries should appear in family-facing views.
- Family visibility must come from server-approved state, not local optimistic UI state.
- AI drafts require human review before they can become family-visible.

## 7. AI Safety Boundaries

AI features must stay inside these boundaries:

- AI Draft: AI output is draft text only.
- Needs Human Review: a qualified user must review AI-generated content before use.
- Not Sent: AI output must not be treated as delivered communication.
- Not Final: AI output must not be treated as the final clinical, operational, or compliance record.
- No auto-approval: AI must not approve family updates, nurse approvals, inspections, incidents, or compliance items.
- No auto-send: AI must not send family communications, email, SMS, or portal updates.
- No auto-close: AI must not close incidents, family concerns, inspection findings, social work cases, or compliance tasks.

AI must not bypass RBAC, agency scoping, branch scoping, family-safe filtering, or approval workflows.

## 8. Test Commands

Run the full verification set before claiming readiness:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter ./apps/backend test
pnpm --filter ./apps/web test
```

## 9. Local Test Requirements

- MongoDB must be running at `127.0.0.1:27017` for backend Jest tests.
- Sandboxed agents may need approved socket or network access to connect to local MongoDB.
- A failure containing `EPERM 127.0.0.1:27017` means the environment blocked local MongoDB socket access. That is not automatically a code failure.

Start MongoDB locally with Homebrew:

```bash
brew services start mongodb-community
```

Or run `mongod` directly:

```bash
mkdir -p ./tmp/mongo-data
mongod --dbpath ./tmp/mongo-data
```

Run backend tests:

```bash
pnpm --filter ./apps/backend test
```

## 10. Pilot Go / No-Go Checklist

| Area | Status | Evidence | Required before pilot | Required before production |
| --- | --- | --- | --- | --- |
| Lint/typecheck/test/build | Ready for controlled pilot | Required commands have passed in the current repo state | Re-run in target environment | CI gating on every release |
| Backend MongoDB tests | Ready with dependency | Backend Jest tests pass when MongoDB is reachable | MongoDB running at `127.0.0.1:27017` or configured test DB | Dedicated test DB and CI service dependency |
| Proof-of-care visit flow | Demo-ready / pilot-usable | Visit proof and audit trail surfaces exist | Manual pilot script verification | Load, audit retention, and recovery validation |
| Caregiver mobile flow | Demo-ready / pilot-usable | Caregiver assigned-visit restrictions exist | Device/browser walkthrough with pilot users | Mobile release, crash monitoring, and offline policy |
| Family-safe updates | Pilot-usable with controls | Family-safe access hardening and approval state | Confirm no internal notes appear in family views | Privacy/legal review and monitoring |
| Incidents | Demo-ready | Incident workflows are present | Confirm pilot incident handling procedure | Incident response runbook and retention policy |
| Family concerns | Pilot-usable | Concern submission and social work linkage exist | Verify family-to-social-work handoff | SLA, escalation, and notification guarantees |
| Reports | Demo-ready | Reporting surfaces exist | Confirm reports needed by pilot agency | Data accuracy audit and export controls |
| Nurse approvals | Pilot-usable | Backend module, DTO mapping, priority field, tests | Manual nurse approval verification | Clinical governance review |
| Inspection center | Pilot-usable | Severity, linked records, and scoped access exist | Verify branch-specific inspection views | Compliance/legal review |
| Social work | Pilot-usable | Linked concern and follow-up date handling exist | Verify next-follow-up workflow | Formal case management policy |
| Intake/agents | Pilot-usable | Branch-scoped intake records and access boundaries exist | Verify intake cannot access nurse-only data | Full onboarding controls and audit policy |
| Medical availability | Demo-ready / pilot-usable | Operational module and DTO mapping exist | Verify live API data in pilot seed | Staffing policy and escalation process |
| Expiration/compliance | Demo-ready / pilot-usable | Operational module and DTO mapping exist | Verify expiration records by branch/agency | Compliance owner and remediation process |
| System readiness | Demo-ready | Readiness view exists | Confirm it never says production-ready | Real production readiness automation |
| Auth/RBAC | Pilot-usable | Server-side RBAC/branch hardening exists | Re-run unauthorized access tests | Session hardening, revocation, rotation, pen test |
| Agency/branch isolation | Pilot-usable | Backend scoping is enforced | Confirm pilot users by branch | Continuous regression tests and audit logging |
| AI safety | Draft-only | AI boundaries documented | Keep AI as draft/review-only | Governance, logging, privacy review |
| Email/SMS | Not production-ready | Provider setup is not fully verified | Exclude from pilot promises or verify manually | Real providers, delivery monitoring, retry policy |
| Backups/restore | Not production-ready | Documentation exists, automation not proven | Manual non-production restore drill | Automated backups and tested DR plan |
| Monitoring/alerts | Not production-ready | Gaps documented | Basic owner-monitored health checks | Full alerting and on-call path |

## 11. Recommended Next Engineering Work

- Finish schema gap audit if anything remains after future backend/frontend changes.
- Continue splitting `careproof-ui.tsx` to reduce blast radius and review risk.
- Add frontend route guards if they are not fully wired for every operational role.
- Improve deployment config for staging/production parity, secrets, CORS, and environment separation.
- Add monitoring and backup automation.
- Add real notification providers for email and SMS with delivery tracking and failure handling.
- Create a privacy/compliance checklist for pilot onboarding, family communication, audit retention, and data deletion.
