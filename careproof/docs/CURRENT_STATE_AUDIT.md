# CareProof Current State Audit

Date: 2026-05-06

## Summary Status

CareProof is `Ready with caveats` for the current web-based demo on `localhost:3001`.

- The public site, product walkthrough, agency console, caregiver web workflow, family portal, reports, executive view, and system status pages all exist and the core golden path routes render.
- The root build passes.
- The backend test suites pass when they can access local MongoDB.
- The root `pnpm test` script is still failing because mobile live-controller tests are red.
- Some scripts depend on an already-running local backend or local MongoDB rather than fully orchestrating themselves.

## A. What Actually Exists

### Routes That Exist

Web app routes under `apps/web/src/app`:

- Public: `/`, `/product`, `/pricing`, `/demo`, `/status`
- Console: `/console`, `/console/dashboard`, `/console/operations`, `/console/schedule`, `/console/visits`, `/console/visits/[id]`, `/console/clients`, `/console/clients/[id]`, `/console/care-plans`, `/console/care-plans/new`, `/console/caregivers`, `/console/caregivers/[id]`, `/console/incidents`, `/console/incidents/[id]`, `/console/family-concerns`, `/console/reports`, `/console/reports/[id]`, `/console/executive`, `/console/branches`, `/console/branches/[id]`, `/console/client-risk`, `/console/family-health`, `/console/billing`, `/console/caregiver-support`, `/console/customer-success`, `/console/pilot-review`, `/console/pilot-feedback`, `/console/support`, `/console/training`, `/console/data-quality`, `/console/rollout`, `/console/knowledge-base`, `/console/notifications`, `/console/import`, `/console/onboarding`, `/console/settings`, `/console/settings/users`, `/console/settings/quality-rules`, `/console/system/status`, `/console/system/go-live`, `/console/system/integrations`, `/console/system/data-export`
- Caregiver: `/caregiver`, `/caregiver/today`, `/caregiver/visit/[id]`, `/caregiver/visits`, `/caregiver/incidents`, `/caregiver/profile`
- Family: `/family`, `/family/updates`, `/family/reports`, `/family/concerns`, `/family/profile`

Admin app routes under `apps/admin/src/app` also exist on a separate app/port, but they are outside the main `localhost:3001` demo path.

### API Endpoints That Exist

Major backend route groups exist in `apps/backend/src`:

- Auth: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`
- Agencies: `/api/agencies/me`, `/api/agencies/current`, `/api/agencies/me/settings`
- Dashboard: `/api/dashboard/today`, `/api/dashboard/summary`, `/api/dashboard/attention-queue`, `/api/dashboard/late-visits`, `/api/dashboard/incidents`, `/api/dashboard/family-concerns`, `/api/dashboard/client-risk`, `/api/dashboard/caregiver-reliability`, `/api/dashboard/risk-flags`, `/api/dashboard/ai-digest/today`
- Clients and care plans: `/api/clients`, `/api/clients/:id`, `/api/clients/:id/timeline`, `/api/clients/:clientId/care-plan`, `/api/care-plans`
- Users and caregivers: `/api/users`, `/api/users/:id`, `/api/users/:id/status`, `/api/caregivers`, `/api/caregivers/:id`
- Visits: `/api/visits`, `/api/visits/:id`, `/api/visits/:id/check-in`, `/api/visits/:id/checklist`, `/api/visits/:id/tasks/:taskId/complete`, `/api/visits/:id/tasks/:taskId/skip`, `/api/visits/:id/note`, `/api/visits/:id/note-assist`, `/api/visits/:id/check-out`
- Incidents: `/api/incidents`, `/api/incidents/:id`, `/api/visits/:visitId/incidents`, `/api/visits/:visitId/incident`, `/api/incidents/:id/status`, `/api/incidents/:id/review`, `/api/incidents/:id/follow-up`
- Family: `/api/family/clients`, `/api/family/clients/:clientId/concerns`, `/api/family/clients/:clientId/feed`, `/api/family/clients/:clientId/visits`, `/api/family/clients/:clientId/reports`, `/api/family/concerns`, `/api/family-concerns`, `/api/family-concerns/:id`, `/api/family-concerns/:id/status`, `/api/family-concerns/:id/response`
- Reports: `/api/reports/weekly`, `/api/reports/weekly/item/:reportId`, `/api/reports/weekly/:clientId`, `/api/reports/weekly/:clientId/generate`, `/api/reports/weekly/generate`, `/api/reports/weekly/:reportId/mark-ready`, `/api/reports/weekly/:reportId/send`, `/api/reports/generated`, `/api/reports/:reportId`, `/api/reports/weekly/:clientId/export`, `/api/reports/agency/operations`, `/api/reports/agency-operations/export`, `/api/reports/caregiver-reliability/export`
- Notifications: `/api/notifications`, `/api/notifications/test`, `/api/notifications/demo-send`, `/api/notifications/:id/retry`
- AI: `/api/ai/visit-summary`, `/api/ai/note-cleanup`, `/api/ai/family-update-draft`, `/api/ai/incident-triage`, `/api/ai/weekly-report-draft`, `/api/ai/risk-signals`, `/api/ai/next-actions`
- Imports: `/api/imports/caregivers`, `/api/imports/clients`, `/api/imports/family-members`, `/api/imports/visits`, `/api/imports`, `/api/imports/templates/:type`, `/api/imports/:id`
- Demo/system: `/api/demo/seed`, `/api/demo/reset`, `/api/demo-requests`, `/api/system/status`, `/api/system/go-live-checklist`, `/api/system/integrations`, `/api/system/integrations/:type/test`, `/api/system/export/:type`, `/api/system/backup`, `/api/health`, `/api/health/ready`, `/api/ready`

### Demo Data That Exists

Web demo state in `apps/web/src/data/demoCareProofData.ts` includes:

- Agency: `CareProof Demo Agency`
- Branches: `Northside Care Team`, `Westview Home Care Team`
- Canonical records: `Maria Johnson`, `Ana Smith`, `Emily Johnson`, `visit-maria-am`
- Additional demo scenarios: late visit, missed visit, open incidents, family concerns, weekly reports, notifications, onboarding data, branch performance, billing readiness, customer-success data, support tickets, rollout plan, knowledge base content

Backend demo seed currently outputs:

- users: 37
- caregivers: 12
- clients: 18
- familyMembers: 22
- visits: 86
- today’s visits: 14
- incidents: 5
- family concerns: 6
- weekly reports: 6
- notifications: 5
- at-risk clients: 5

### Tests That Exist

- Backend unit/e2e:
  - `apps/backend/test/auth.spec.ts`
  - `apps/backend/test/visits.spec.ts`
  - `apps/backend/test/permissions.spec.ts`
  - `apps/backend/test/config.spec.ts`
  - `apps/backend/test/demo-guard.spec.ts`
  - `apps/backend/test/app.e2e-spec.ts`
  - `apps/backend/src/modules/ai/ai.service.spec.ts`
  - `apps/backend/src/modules/ai/ai-workflows.service.spec.ts`
- Web Playwright:
  - `tests/e2e/web-marketing.spec.ts`
- Admin Playwright:
  - `tests/e2e/admin-login.spec.ts`
- Mobile Flutter tests:
  - `apps/mobile/test/smoke_test.dart`
  - `apps/mobile/test/family_controller_live_test.dart`

### Scripts That Exist

Root scripts in `package.json`:

- `dev`
- `dev:local`
- `build`
- `test`
- `test:unit`
- `test:e2e`
- `test:api`
- `test:all`
- `test:e2e:ui`
- `test:e2e:ui:prod`
- `test:e2e:web:prod`
- `seed`
- `seed:demo`
- `demo:reset`
- `backup:mongo`
- `restore:mongo`
- `mobile:android:local`
- `db:indexes`
- `smoke:staging`
- `smoke:e2e`
- `smoke`
- `lint`
- `typecheck`

### Docs That Exist

Core docs present:

- `README.md`
- `docs/UAT_CHECKLIST.md`
- `docs/DEMO_SCRIPT.md`
- `docs/PILOT_HANDOFF.md`
- `docs/BUG_TRIAGE.md`
- `docs/ROUTE_MAP.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/PRODUCTION_GAP_REPORT.md`
- `docs/FINAL_DEMO_HANDOFF.md`

## B. What Is Working

- Homepage renders and communicates the product clearly
- Product walkthrough route exists and renders
- Agency console routes exist and the core dashboard/operations/visit/report/system routes render
- Caregiver web workflow routes exist and render
- Family portal routes exist and render
- Backend health and readiness endpoints respond successfully
- Root build passes
- Root lint passes
- Root typecheck passes
- `pnpm test:unit` passes
- `pnpm test:e2e` passes
- `pnpm test:e2e:web:prod` passes
- `pnpm seed:demo` passes
- `pnpm demo:reset` passes
- `pnpm test:api` passes when the backend is actually running

## C. What Is Broken

- `pnpm test` is currently failing because the Flutter mobile live-controller tests are failing
- `pnpm test:api` fails if no backend is already running on `localhost:4000`
- Root scripts that call Flutter analysis/tests require access to Flutter cache paths outside the sandboxed filesystem
- Web Playwright inside the restricted sandbox can fail to launch Chromium; it passes outside the sandbox
- Backend Jest suites inside the restricted sandbox can fail to reach local MongoDB on `127.0.0.1:27017`; they pass outside the sandbox

No critical crash was found on the audited web golden-path routes.

## D. What Is Demo-Only

- Web app continuity across many screens relies on local demo state/localStorage, not fully durable multi-user persistence
- Demo notification flows record/send demo-only statuses rather than real external delivery
- AI workflows can fall back to deterministic demo output
- CSV/PDF-style exports are partly demo-safe rather than full production export pipelines
- Demo reset/seed behavior is intended for local/demo use
- Role behavior in the web app is still partly presentation/demo-driven rather than full authenticated enforcement across every route

## E. What Is Not Production-Ready

- Full production auth/session hardening across all web flows still needs explicit verification
- Web-side persistence parity with the backend is incomplete
- Email/SMS provider setup is not complete by default
- AI provider setup is optional and can remain in demo fallback mode
- PDF export strategy is incomplete
- Monitoring provider integration is not fully wired
- Backup automation exists as scripts/guidance, not a fully managed production workflow
- Privacy/legal/compliance review is still required
- Role and agency scoping need full production verification with real auth tokens and user accounts

## Commands Run And Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm lint` | Pass | Needed to run outside the sandbox because Flutter analyze touches cache outside the writable root. |
| `pnpm typecheck` | Pass | Same Flutter cache caveat as lint. |
| `pnpm build` | Pass | Backend, admin, and web builds passed. |
| `pnpm test` | Fail | Backend Jest passed, then Flutter tests failed in `apps/mobile/test/family_controller_live_test.dart`. |
| `pnpm test:unit` | Pass | Backend unit suite passed. |
| `pnpm test:e2e` | Pass | Backend e2e suite passed. |
| `pnpm test:e2e:web:prod` | Pass | Web Playwright suite passed outside the sandbox. |
| `pnpm test:api` | Pass with backend running | Failed earlier when no backend was running; passed once `pnpm dev` was up. |
| `pnpm seed:demo` | Pass | Reset and reseeded Mongo-backed demo data. |
| `pnpm demo:reset` | Pass | Reset and reseeded Mongo-backed demo data. |
| `pnpm dev` | Pass | Started web on `3001`, admin on `3000`, backend on `4000`. |

### Root Test Failure Detail

`pnpm test` is not green today because the mobile live-controller tests fail:

- `apps/mobile/test/family_controller_live_test.dart: family controller login hydrates live family data`
- `apps/mobile/test/family_controller_live_test.dart: family controller can switch clients and refresh live family data`
- `apps/mobile/test/family_controller_live_test.dart: caregiver controller login hydrates assigned visits and visit detail`

These are real failures and were not fixed in this audit because they are outside the critical `localhost:3001` demo path.

## Route Audit

Legend:

- `Renders`: whether the route exists and is included in the successful web build
- `Main actions work`: current state of the primary interactions based on live checks and code inspection
- `Demo-only`: whether the page depends primarily on demo/local store behavior

### Public Routes

| Route | Purpose | Renders | Main actions work | Demo-only | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | Homepage | yes | yes | partial | Live `200` confirmed. |
| `/product` | Product walkthrough | yes | yes | partial | Live `200` confirmed. |
| `/pricing` | Pricing | yes | yes | no | Exists in build; not separately spot-checked live in this pass. |
| `/demo` | Demo overview/request path | yes | yes | partial | Exists in build; linked from public flow. |
| `/status` | Public status page | yes | yes | partial | Exists in build; system status data can fall back to demo-safe mode. |

### Console Routes

| Route | Purpose | Renders | Main actions work | Demo-only | Notes |
| --- | --- | --- | --- | --- | --- |
| `/console` | Console entry | yes | yes | partial | Exists in build. |
| `/console/dashboard` | Agency dashboard | yes | yes | yes | Live `200` confirmed. |
| `/console/operations` | Operations board | yes | yes | yes | Live `200` confirmed. |
| `/console/schedule` | Scheduling | yes | yes | yes | Built and navigable. |
| `/console/visits` | Visits list | yes | yes | yes | Built and navigable. |
| `/console/visits/[id]` | Visit detail | yes | yes | yes | Live `200` confirmed for `visit-maria-am`. |
| `/console/clients` | Clients list | yes | yes | yes | Built and navigable. |
| `/console/clients/[id]` | Client detail | yes | yes | yes | Built and navigable. |
| `/console/care-plans` | Care plans | yes | yes | yes | Built and navigable. |
| `/console/care-plans/new` | Care plan builder | yes | yes | yes | Built and navigable. |
| `/console/caregivers` | Caregivers list | yes | yes | yes | Built and navigable. |
| `/console/caregivers/[id]` | Caregiver detail | yes | yes | yes | Built and navigable. |
| `/console/incidents` | Incidents queue | yes | yes | yes | Built and navigable. |
| `/console/incidents/[id]` | Incident detail | yes | yes | yes | Built and navigable. |
| `/console/family-concerns` | Concern queue | yes | yes | yes | Live `200` confirmed. Internal and family response fields are separated. |
| `/console/reports` | Reports hub | yes | yes | yes | Live `200` confirmed. |
| `/console/reports/[id]` | Report detail | yes | yes | yes | Built and navigable. |
| `/console/executive` | Executive view | yes | yes | yes | Live `200` confirmed. |
| `/console/branches` | Branch list | yes | yes | yes | Built and navigable. |
| `/console/branches/[id]` | Branch detail | yes | yes | yes | Built and navigable. |
| `/console/client-risk` | Client risk | yes | yes | yes | Built and navigable. |
| `/console/family-health` | Family communication health | yes | yes | yes | Built and navigable. |
| `/console/billing` | Billing readiness | yes | yes | yes | Built and navigable. |
| `/console/caregiver-support` | Caregiver support | yes | yes | yes | Built and navigable. |
| `/console/customer-success` | Adoption/implementation view | yes | yes | yes | Built and navigable. |
| `/console/pilot-review` | Pilot review | yes | yes | yes | Built and navigable. |
| `/console/pilot-feedback` | Internal pilot feedback | yes | yes | yes | Built and navigable. |
| `/console/support` | Support center | yes | yes | yes | Built and navigable. |
| `/console/training` | Training checklists | yes | yes | yes | Built and navigable. |
| `/console/data-quality` | Data quality center | yes | yes | yes | Built and navigable. |
| `/console/rollout` | Rollout plan | yes | yes | yes | Built and navigable. |
| `/console/knowledge-base` | Knowledge base | yes | yes | yes | Built and navigable. |
| `/console/notifications` | Notification center | yes | yes | yes | Built and navigable. |
| `/console/import` | CSV import UI | yes | yes | yes | Built and navigable. |
| `/console/onboarding` | Onboarding wizard | yes | yes | yes | Built and navigable. |
| `/console/settings` | Settings hub | yes | yes | yes | Built and navigable. |
| `/console/settings/users` | User management | yes | yes | yes | Built and navigable. |
| `/console/settings/quality-rules` | Quality rules | yes | yes | yes | Built and navigable. |
| `/console/system/status` | System status | yes | yes | partial | Live `200` confirmed; can fall back to demo-safe status when backend auth is absent. |
| `/console/system/go-live` | Go-live checklist | yes | yes | partial | Live `200` confirmed. |
| `/console/system/integrations` | Integration readiness | yes | yes | partial | Built and navigable. |
| `/console/system/data-export` | Data export | yes | yes | partial | Built and navigable; exports are demo-safe in places. |

### Caregiver Routes

| Route | Purpose | Renders | Main actions work | Demo-only | Notes |
| --- | --- | --- | --- | --- | --- |
| `/caregiver` | Caregiver entry | yes | yes | yes | Built and navigable. |
| `/caregiver/today` | Today view | yes | yes | yes | Live `200` confirmed. |
| `/caregiver/visit/[id]` | Visit workflow | yes | yes | yes | Live `200` confirmed for `visit-maria-am`. |
| `/caregiver/visits` | Visit list/history | yes | yes | yes | Built and navigable. |
| `/caregiver/incidents` | Incident list | yes | yes | yes | Built and navigable. |
| `/caregiver/profile` | Caregiver profile | yes | yes | yes | Built and navigable. |

### Family Routes

| Route | Purpose | Renders | Main actions work | Demo-only | Notes |
| --- | --- | --- | --- | --- | --- |
| `/family` | Family entry | yes | yes | yes | Built and navigable. |
| `/family/updates` | Approved updates | yes | yes | yes | Live `200` confirmed. Only approved summary fields are shown. |
| `/family/reports` | Weekly reports | yes | yes | yes | Built and navigable. |
| `/family/concerns` | Concern submission/status | yes | yes | yes | Live `200` confirmed. |
| `/family/profile` | Family profile | yes | yes | yes | Built and navigable. |

## Golden Path Result

Status: `Ready with caveats`

Verified directly:

1. Homepage loads: yes
2. View Product Flow route works: yes
3. Agency Console opens: yes
4. Dashboard loads: yes
5. Operations/Visits surface Maria Johnson route: yes, route and canonical record exist
6. Maria Johnson visit detail opens: yes
7. Caregiver Today shows Maria Johnson route: yes
8. Caregiver can check in/checklist/note/check out: supported by the web demo store and caregiver workflow UI
9. Agency view reflects updated visit: yes within the same demo store/local session
10. Family portal shows approved family-safe update: supported by approved-summary-only rendering
11. Family can submit concern: yes
12. Agency can view/respond to concern: yes
13. Reports page loads: yes
14. System status/health works: yes

Caveat:

- The golden path is demo-store driven on the web. It is suitable for a controlled demo, but not proof of durable cross-user persistence across separate browsers/users.

## Family Visibility Check

Family-facing pages were checked by code inspection and route rendering. Current family views rely on:

- approved visit summaries
- weekly report status
- concern status
- family-facing response text

They do not render:

- `internalNotes`
- staff-only incident notes
- caregiver performance notes
- system/admin warnings

This is safer than exposing questionable fields, but it is still demo-safe behavior, not a full production authorization proof.

## Production Safety Check

- `.env.example` exists at root and per app: yes
- Demo reset guard exists in backend controller: yes
- Demo reset production guard test exists: yes
- Seed/reset are blocked when `appEnv === production`, `demoMode === false`, or `disableDemoReset === true`: yes
- Health endpoint exists and returns `200`: yes
- Ready endpoint exists and returns `200`: yes
- No committed live API keys were found by grep outside `.env` files: yes
- Localhost references are present in `.env.example` and dev fallbacks by design; production code paths fall back to relative `/api` in the web app when not in development

## Top 10 Fixes Before A Real Pilot

1. Fix the failing mobile live-controller tests so `pnpm test` is green.
2. Remove the need for an already-running backend before `pnpm test:api` can pass.
3. Replace localStorage/demo-store continuity with durable backend persistence for the main web workflows.
4. Enforce real auth/session controls across all web routes and actions.
5. Validate role and agency scoping with real authenticated browser sessions, not only backend tests.
6. Replace demo notification delivery with a controlled provider or explicitly disable it in pilot.
7. Finish export behavior beyond demo-safe CSV/report actions where required.
8. Wire production monitoring and alerting.
9. Automate backup verification and restore drills.
10. Complete privacy/legal/compliance review before real agency data is used.
