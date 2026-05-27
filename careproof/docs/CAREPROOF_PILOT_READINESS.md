# CareProof Pilot Readiness

This document is the current pilot-readiness view for CareProof. It is written for a go/no-go decision: what is already strong enough for a controlled pilot, what is demo-ready only, and what still blocks production.

CareProof should be described as demo-ready and controlled-pilot-ready in selected areas. It should not be described as production-ready.

## 1. Current Verified Status

Latest successful checks in the current repo state:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm --filter ./apps/backend test`
- `pnpm --filter ./apps/web test`

Verified implementation status:

- DTO mapping fixes are in place for the operational modules.
- Backend operational modules exist for nurse approvals, inspection findings, social work cases, intake records, medical availability, and expiration records.
- RBAC and branch/agency hardening are implemented server-side for the key operational paths.
- Family-safe access hardening is implemented for family-facing data paths.
- The web build and tests have passed after the latest UI extraction and schema alignment work.

Backend test requirements:

- Backend Jest tests require MongoDB running at `127.0.0.1:27017`.
- Sandboxed agents may need approved socket access before backend Jest tests can connect to local MongoDB.

## 2. Demo-Ready Features

The following features are demo-ready with seeded or prepared data:

- Proof-of-care visit flow: visit proof, checklist status, timestamps, notes, and audit trail review.
- Caregiver mobile flow: caregiver visit execution and assigned-visit experience.
- Family-safe updates: family views show approved family-safe content instead of raw internal notes.
- Incidents: incident review and operational follow-up flows are available for demo.
- Family concerns: family concern submission and linked follow-up workflows are available.
- Reports: reporting screens are available for controlled walkthroughs.
- Nurse approvals: clinical/operational review queue with decision actions.
- Inspection center: inspection findings with severity, status, linked records, and ownership.
- Social work: social work cases, linked concern context, and follow-up date handling.
- Intake / agents: referral pipeline, branch-scoped intake records, and intake-agent workflow.
- Medical availability: readiness records for staff, supplies, medications, equipment, and coverage.
- Expiration / compliance: license, certification, care plan, authorization, and compliance expiration tracking.
- System readiness: readiness view that should remain explicit about demo/pilot state and production blockers.

## 3. Pilot-Ready Areas

These areas are strong enough for a controlled pilot with a small agency, narrow scope, active support, and clear limits on production promises:

- Agency/branch scoping: backend queries enforce tenant and branch boundaries for the key operational records.
- Family-safe visibility controls: family users are restricted to linked clients and approved family-safe content.
- Caregiver assigned-visit enforcement: caregivers are restricted to visits assigned to them.
- Operational modules with backend persistence: the six operational modules have backend APIs, schemas, DTO mapping, and frontend API preference over demo fallback.
- Unauthorized access tests: backend tests cover important role and scope denial cases.
- Demo-safe AI drafts: AI-assisted content is treated as draft/review-only, not final, sent, or approved.

Pilot constraints:

- Keep the pilot small and supervised.
- Validate the exact pilot roles, branches, and family links before onboarding real users.
- Do not promise automated notifications, compliance certification, disaster recovery, or production-grade uptime until the blockers below are closed.

## 4. Not Production-Ready Yet

The following items block production launch:

- Real auth/session hardening beyond current JWT basics.
- JWT revocation / refresh token rotation.
- Production MongoDB backup and restore automation.
- Monitoring and alerting for API health, auth failures, MongoDB connectivity, notification failures, and elevated error rates.
- Email/SMS provider setup with real credentials, verified delivery, retry behavior, and failure reporting.
- Privacy/compliance/legal review for live agency, client, caregiver, and family data.
- Deployment hardening, including secrets management, CORS policy, rate limiting, environment separation, and least-privilege access.
- Audit log retention policy and implementation.
- Disaster recovery plan with tested restore time and restore point expectations.
- Penetration/security review covering auth, tenant isolation, branch isolation, family visibility, and operational workflows.

## 5. Auth/RBAC Status

- Agency scoping: tenant-owned records are filtered by `agencyId` on the backend.
- Branch scoping: branch-scoped records are filtered by `branchId` where branch boundaries apply.
- Role-based access: owner/admin, nurse, social worker, intake agent, caregiver, and family routes/actions have server-side restrictions for key workflows.
- Caregiver assigned-visit restriction: caregivers should only access visits assigned to them.
- Family-safe restrictions: family users should only access linked-client content that is approved, sent, or explicitly family-safe.

Known remaining risks:

- New endpoints can still introduce authorization drift unless every new controller action includes role and scope tests.
- Frontend route guards need to stay aligned with backend rules, but frontend hiding is not a security control.
- Current auth/session posture is acceptable for controlled pilot testing only; token revocation and refresh rotation remain production blockers.

## 6. Family-Safe Communication Status

- Internal notes must not be family-visible.
- Review-only summaries must not be exposed to family users.
- Only completed, sent, or explicitly family-safe summaries should show in family-facing views.
- Raw incident detail, clinical review detail, compliance-only findings, staff-only comments, and unrelated client records must remain server-restricted.
- AI drafts require human review before they can become family-visible.

## 7. AI Safety Boundaries

AI features must remain inside these boundaries:

- AI Draft: AI output is draft text only.
- Needs Human Review: a qualified user must review AI output before use.
- Not Sent: AI output must not be treated as delivered communication.
- Not Final: AI output must not be treated as the final clinical, operational, or compliance record.
- No auto-approval: AI must not approve family updates, nurse approvals, inspections, incidents, or compliance items.
- No auto-send: AI must not send family communications, email, SMS, or portal updates.
- No auto-close: AI must not close incidents, family concerns, inspection findings, social work cases, or compliance tasks.

AI must not bypass RBAC, agency scoping, branch scoping, caregiver assigned-visit restrictions, family-safe filtering, or approval workflows.

## 8. Local Test Requirements

- MongoDB must run at `127.0.0.1:27017` for backend Jest tests.
- `connect EPERM 127.0.0.1:27017` usually means environment or socket access is blocked, not necessarily that application code is broken.
- Sandboxed agents may need approved socket or network access to connect to local MongoDB.
- Agents should not claim a test failure is fixed unless the relevant command exits with status `0`.

Run the relevant checks with:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter ./apps/backend test
pnpm --filter ./apps/web test
```

Start MongoDB locally with Homebrew:

```bash
brew services start mongodb-community
```

Or run `mongod` directly:

```bash
mkdir -p ./tmp/mongo-data
mongod --dbpath ./tmp/mongo-data
```

## 9. Pilot Go / No-Go Checklist

| Area | Current Status | Evidence | Required Before Pilot | Required Before Production |
| --- | --- | --- | --- | --- |
| Authentication | Pilot-limited | JWT auth exists for protected backend paths | Verify pilot accounts, roles, and session behavior | Harden sessions, add JWT revocation and refresh rotation |
| RBAC | Pilot-usable | Server-side role restrictions and unauthorized access tests exist | Re-run role denial tests for pilot roles | Security review and CI coverage for every sensitive endpoint |
| Agency isolation | Pilot-usable | Backend records are scoped by `agencyId` | Verify seeded/live pilot users cannot cross agencies | Ongoing regression tests and audit review |
| Branch isolation | Pilot-usable | Branch-scoped operational records use `branchId` filtering | Verify same-agency cross-branch denial | Full branch policy review and monitoring |
| Family-safe communication | Pilot-usable with controls | Family-safe access hardening exists | Confirm no internal/review-only notes appear in family views | Privacy/legal review and communication audit process |
| Caregiver workflow | Demo-ready / pilot-usable | Assigned-visit restrictions and caregiver flow exist | Manual caregiver walkthrough on pilot data | Mobile release hardening, monitoring, and offline policy |
| Nurse approvals | Pilot-usable | Backend module, DTO mapping, priority field, and tests exist | Manual nurse approval workflow verification | Clinical governance review and audit retention |
| Inspection findings | Pilot-usable | Backend module, severity alignment, linked records, and scoped access exist | Verify branch-specific inspection views | Compliance review and remediation process |
| Social work | Pilot-usable | Linked concern and follow-up date handling exist | Verify family concern to social work handoff | Formal case management policy and SLA |
| Intake | Pilot-usable | Branch-scoped intake records and intake-agent boundaries exist | Verify intake cannot access nurse-only data | Full onboarding controls and audit policy |
| Medical availability | Demo-ready / pilot-usable | Backend module and DTO mapping exist | Verify live pilot records display from API | Staffing escalation policy and monitoring |
| Expiration/compliance | Demo-ready / pilot-usable | Backend module and DTO mapping exist | Verify expiration records by branch/agency | Compliance owner, retention policy, and remediation workflow |
| AI workflows | Draft-only | AI safety boundaries documented | Keep AI as draft/review-only | Governance, logging, privacy review, and model/provider policy |
| Notifications | Not production-ready | Notification drafts exist; real providers are not fully verified | Exclude from pilot promises or manually verify scope | Real email/SMS providers, delivery monitoring, retries, and alerting |
| Backups | Not production-ready | Backup docs/scripts exist, but automation is not proven | Run a non-production restore drill | Automated backup/restore verification and DR targets |
| Monitoring | Not production-ready | Health/readiness surfaces exist; full alerting is not configured | Assign owner and basic manual monitoring | Production monitoring, alert routing, and incident response |
| Deployment | Pilot-limited | Builds pass locally | Verify staging environment, secrets, CORS, and API URLs | Harden hosting, secrets, rate limits, permissions, and environment separation |
| Compliance/legal | Not production-ready | Family-safe rules and audit patterns exist | Define pilot data handling expectations | Privacy/compliance/legal review, retention, deletion, and audit policy |

## 10. Recommended Next Engineering Work

- Split `careproof-ui.tsx` into feature files.
- Add or verify frontend route guards for all operational roles.
- Improve deployment configuration for staging/production parity, secrets, CORS, and environment separation.
- Add monitoring and backup automation.
- Add real notification providers for email and SMS with delivery tracking and failure handling.
- Create a privacy/compliance checklist for pilot onboarding, family communication, audit retention, and data deletion.
- Add an audit retention policy.
- Run the manual pilot demo script end to end with owner, nurse, family, social worker, intake agent, and branch-restricted users.
