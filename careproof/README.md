# CareProof

CareProof is proof-of-care software for home care agencies. The demo stack now includes:

- public marketing site on `localhost:3001`
- routed agency, caregiver, and family product demo flows
- NestJS backend API on `localhost:4000/api`
- Mongo-backed demo seed
- Playwright web verification
- backend e2e coverage

## Documentation

- UAT checklist: [/Users/getnetbelay/Documents/New project/careproof/docs/UAT_CHECKLIST.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/UAT_CHECKLIST.md)
- Demo script: [/Users/getnetbelay/Documents/New project/careproof/docs/DEMO_SCRIPT.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/DEMO_SCRIPT.md)
- Pilot handoff: [/Users/getnetbelay/Documents/New project/careproof/docs/PILOT_HANDOFF.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/PILOT_HANDOFF.md)
- Bug triage: [/Users/getnetbelay/Documents/New project/careproof/docs/BUG_TRIAGE.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/BUG_TRIAGE.md)
- Route map: [/Users/getnetbelay/Documents/New project/careproof/docs/ROUTE_MAP.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/ROUTE_MAP.md)
- API contract: [/Users/getnetbelay/Documents/New project/careproof/docs/API_CONTRACT.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/API_CONTRACT.md)
- Data model: [/Users/getnetbelay/Documents/New project/careproof/docs/DATA_MODEL.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/DATA_MODEL.md)
- Production gap report: [/Users/getnetbelay/Documents/New project/careproof/docs/PRODUCTION_GAP_REPORT.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/PRODUCTION_GAP_REPORT.md)
- Final demo handoff: [/Users/getnetbelay/Documents/New project/careproof/docs/FINAL_DEMO_HANDOFF.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/FINAL_DEMO_HANDOFF.md)

## Stack

- Backend: NestJS + TypeScript + MongoDB
- Web: Next.js + TypeScript
- Admin: Next.js + TypeScript
- Mobile: Flutter

## Demo runbook

1. Install dependencies
   - `pnpm install`
2. Configure backend env
   - copy [/Users/getnetbelay/Documents/New project/careproof/apps/backend/.env.example](/Users/getnetbelay/Documents/New%20project/careproof/apps/backend/.env.example) to `apps/backend/.env`
   - set `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET`
   - keep `DEMO_MODE=true` locally unless you intentionally want demo reset endpoints disabled
3. Seed demo data
   - `pnpm seed:demo`
4. Start the stack
   - recommended local runner: `pnpm dev:local`
   - `pnpm dev:local` preflights ports `3000`, `3001`, and `4000`, starts local MongoDB on `127.0.0.1:27017` when `mongod` is available, and defaults AI to deterministic demo mode
   - use `pnpm dev` only when MongoDB is already running and you have confirmed no stale apps are occupying the demo ports
5. Open the demo surfaces
   - web site: `http://localhost:3001`
   - backend docs: `http://localhost:4000/api/docs`
   - admin console: `http://localhost:3000`
6. Walk the product
   - public: `/`, `/product`, `/pricing`, `/demo`
   - agency: `/console/dashboard`
   - agency setup: `/console/onboarding`, `/console/settings/users`, `/console/schedule`, `/console/import`, `/console/care-plans/new`
   - caregiver: `/caregiver/today`
   - family: `/family/updates`
7. Run backend e2e
   - `pnpm test:e2e`
8. Run web e2e
   - `pnpm test:e2e:web:prod`
9. Run API smoke
   - `API_BASE_URL=http://127.0.0.1:4000/api pnpm test:api`
10. Reset the demo
   - `pnpm demo:reset`

## Core scripts

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm test:e2e:web:prod`
- `pnpm test:api`
- `pnpm test:all`
- `pnpm seed`
- `pnpm seed:demo`
- `pnpm demo:reset`
- `pnpm backup:mongo`
- `pnpm restore:mongo`

## Demo users

- Agency owner: `owner@careproof.demo / Password123!`
- Coordinator: `coordinator@careproof.demo / Password123!`
- Caregiver: `caregiver1@careproof.demo / Password123!`
- Family: `family1@careproof.demo / Password123!`

## Demo workflow

1. Agency opens `/console/dashboard`
2. Agency completes `/console/onboarding` to set up profile, team, clients, caregivers, care plans, and first visits
3. Agency can refine setup through:
   - `/console/settings/users`
   - `/console/schedule`
   - `/console/import`
   - `/console/care-plans/new`
4. Agency reviews visits, attention queue, incidents, concerns, and reports
5. Caregiver opens `/caregiver/today`
6. Caregiver enters a visit, checks in, updates checklist, saves note, optionally reports incident, and checks out
7. Family opens `/family/updates` or `/family/concerns`
8. Agency reviews the resulting alert, concern, or report state

## Demo script

1. Open `/`
2. Click `View Product Flow`
3. Open `Agency Console`
4. Open `/console/dashboard`
5. Open `/console/operations`
6. Open Maria Johnson’s visit
7. Open `/caregiver/today`
8. Complete a caregiver visit workflow
9. Open `/family/updates`
10. Submit a family concern
11. Open `/console/family-concerns`
12. Respond to the concern
13. Open `/console/reports`
14. Mark a weekly report ready and send the demo notification
15. Open `/console/system/status`
16. Open `/console/system/go-live`
17. Open `/console/system/data-export`

## Final Demo Walkthrough

1. Homepage: `/`
2. Product Flow: `/product`
3. Agency Console: `/console/dashboard`
4. Caregiver Visit: `/caregiver/today` then `/caregiver/visit/visit-maria-am`
5. Family Portal: `/family/updates` and `/family/concerns`
6. Reports: `/console/reports`
7. Executive Dashboard: `/console/executive`
8. System Status: `/console/system/status` and `/console/system/go-live`

## Final Demo Walkthrough

1. Homepage
2. Product Flow
3. Agency Console
4. Caregiver Visit
5. Family Portal
6. Reports
7. Executive Dashboard
8. System Status

## How to run the demo

1. Run `pnpm install`
2. Start the local stack with `pnpm dev`
3. Open `http://localhost:3001`
4. Follow the walkthrough in [/Users/getnetbelay/Documents/New project/careproof/docs/DEMO_SCRIPT.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/DEMO_SCRIPT.md)

## How to reset demo data

1. Use `pnpm demo:reset` when local Mongo access is available.
2. If the backend is already running locally, `POST /api/demo/reset` is the most reliable demo restore path.
3. In demo mode, owner/admin users can also use the in-app reset action from the console banner.

## How to run QA

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:api`
- `pnpm test:e2e:web:prod`
- `pnpm build`

Use the formal QA/UAT artifact here:
- [/Users/getnetbelay/Documents/New project/careproof/docs/UAT_CHECKLIST.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/UAT_CHECKLIST.md)

## Developer testing note

Backend Jest tests require MongoDB running and reachable at `127.0.0.1:27017`.

Start MongoDB locally before running backend tests:

```bash
mongod --dbpath /tmp/careproof-mongo
```

If the database path does not exist yet:

```bash
mkdir -p /tmp/careproof-mongo
mongod --dbpath /tmp/careproof-mongo
```

Run backend tests from the repo root:

```bash
pnpm --filter ./apps/backend test
```

The root test command also runs backend Jest before mobile tests:

```bash
pnpm test
```

Sandboxed agents may need approved local network/socket access because the backend test suites connect to MongoDB through `127.0.0.1:27017`. When that socket is blocked, failures typically look like:

```text
MongooseServerSelectionError: connect EPERM 127.0.0.1:27017 - Local (0.0.0.0:0)
```

Do not report that as a code failure until MongoDB is confirmed running and the test process is allowed to reach the local socket.

## How to prepare pilot

1. Review [/Users/getnetbelay/Documents/New project/careproof/docs/PILOT_HANDOFF.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/PILOT_HANDOFF.md)
2. Review [/Users/getnetbelay/Documents/New project/careproof/docs/PRODUCTION_GAP_REPORT.md](/Users/getnetbelay/Documents/New%20project/careproof/docs/PRODUCTION_GAP_REPORT.md)
3. Confirm system posture in `/console/system/status` and `/console/system/go-live`
4. Reset demo data before every buyer-facing walkthrough

## Pilot setup walkthrough

1. Open `/console/onboarding`
2. Complete agency profile and default visit rules
3. Add a coordinator and at least one caregiver
4. Add clients and family contacts
5. Create a care plan template with checklist tasks
6. Schedule first visits in `/console/schedule`
7. Use `/console/import` for CSV pilot onboarding when needed
8. Review onboarding readiness and pilot readiness on `/console/dashboard`
9. Launch caregiver and family flows once visits are scheduled

## Management workflow

1. Open `/console/executive`
2. Review the agency health score, branch performance, and top risks
3. Filter the console by branch from the top bar
4. Open `/console/operations` to review the live visit board and exceptions queue
5. Open `/console/client-risk` and review high-risk clients
6. Open `/console/family-health` to see overdue concerns and missing family updates
7. Open `/console/billing` and approve visits that are ready for billing
8. Open `/console/caregiver-support` to review support signals without blame-driven language
9. Open `/console/reports` and generate the daily operations report
10. Open `/console/notifications` and mark operational notifications as read
11. Open `/console/settings/quality-rules` to adjust management thresholds

## Branch and management routes

- `/console/operations`
- `/console/executive`
- `/console/branches`
- `/console/client-risk`
- `/console/family-health`
- `/console/billing`
- `/console/caregiver-support`
- `/console/notifications`
- `/console/settings/quality-rules`

## Adoption and support routes

- `/console/customer-success`
- `/console/pilot-review`
- `/console/pilot-feedback`
- `/console/support`
- `/console/training`
- `/console/data-quality`
- `/console/rollout`
- `/console/knowledge-base`

## Deployment and system routes

- `/status`
- `/console/system/status`
- `/console/system/go-live`
- `/console/system/integrations`
- `/console/system/data-export`

## Adoption and expansion walkthrough

1. Open `/console/customer-success` and review implementation progress and adoption gaps
2. Open `/console/pilot-review` and review pilot outcomes and expansion recommendations
3. Open `/console/support` and create a demo support ticket
4. Open `/console/training` and complete a training checklist item
5. Open `/console/data-quality` and review data cleanup issues
6. Open `/console/rollout` and update the rollout checklist
7. Open `/console/knowledge-base` and search internal help content

## Known demo limitations

- no real SMS or email delivery unless external providers are configured
- report export buttons are demo-safe unless real delivery/export is wired
- some web product flows still use local persisted demo state for UI continuity
- role switching is still demo-oriented, not a production auth experience
- demo reset and seed endpoints are intentionally disabled when `APP_ENV=production` or `DEMO_MODE=false`
- full backend Jest suites depend on a reachable MongoDB instance and may time out in restricted environments even when the app itself builds cleanly
- if the homepage unexpectedly shows a different product, stop the stale process on port `3001` and restart with `pnpm dev:local`

## QA checklist

- Public routes render and CTA links work
- Maria Johnson walkthrough works across agency, caregiver, family, and reports
- Family-facing screens do not expose internal notes
- Demo reset restores seeded walkthrough state
- System status and go-live screens load without blank states
- Mobile caregiver workflow remains usable

## Environment notes

- `APP_ENV` supports `development`, `demo`, `staging`, `production`, and `test`
- `DEMO_MODE=true` keeps demo reset/seed and local walkthrough flows available
- `DISABLE_DEMO_RESET=true` hard-disables reset and seed endpoints even if demo mode is otherwise enabled
- `CORS_ORIGINS` should include every local or deployed frontend origin
- `API_BASE_URL` and web-facing URLs must be set per environment; do not hardcode localhost for production
- `NEXT_PUBLIC_API_BASE_URL` should point the web app to the deployed API when frontend and backend are separate
- Notification providers are optional in demo mode and should stay demo values until configured

## Deployment overview

- Web: Next.js application on port `3001` locally
- Backend: NestJS API on port `4000` locally
- Database: MongoDB via `MONGODB_URI`
- Existing deployment file: [/Users/getnetbelay/Documents/New project/careproof/render.yaml](/Users/getnetbelay/Documents/New%20project/careproof/render.yaml)
- Existing backend container file: [/Users/getnetbelay/Documents/New project/careproof/Dockerfile](/Users/getnetbelay/Documents/New%20project/careproof/Dockerfile)

## System readiness walkthrough

1. Open `/console/system/status`
2. Review environment, database, notification mode, AI mode, and demo reset posture
3. Open `/console/system/go-live`
4. Work through checklist failures before a pilot deployment
5. Open `/console/system/integrations`
6. Confirm which providers are configured, demo-only, or future-ready
7. Open `/console/system/data-export`
8. Export agency-scoped CSV data for validation

## API summary

- health: `/api/health`, `/api/ready`
- dashboard: `/api/dashboard/today`, `/api/dashboard/summary`, `/api/dashboard/attention-queue`
- agencies: `/api/agencies/current`, `/api/agencies/me/settings`
- visits: `/api/visits`, `/api/visits/:id`, `/api/visits/:id/check-in`, `/api/visits/:id/checklist`, `/api/visits/:id/note`, `/api/visits/:id/incident`, `/api/visits/:id/check-out`
- clients and care plans: `/api/clients`, `/api/clients/:id`, `/api/clients/:id/care-plan`, `/api/care-plans`, `/api/care-plans/:id`
- users: `/api/users`, `/api/users/:id`, `/api/users/:id/status`
- incidents: `/api/incidents`, `/api/incidents/:id`, `/api/incidents/:id/status`, `/api/incidents/:id/follow-up`
- family concerns: `/api/family-concerns`, `/api/family-concerns/:id`, `/api/family-concerns/:id/status`, `/api/family-concerns/:id/response`
- reports: `/api/reports/weekly`, `/api/reports/weekly/:id`, `/api/reports/weekly/generate`, `/api/reports/weekly/:id/mark-ready`, `/api/reports/weekly/:id/send`
- imports: `/api/imports`, `/api/imports/clients`, `/api/imports/caregivers`, `/api/imports/family-members`, `/api/imports/visits`
- demo requests: `/api/demo-requests`
- demo tools: `/api/demo/reset`, `/api/demo/seed`
- system: `/api/system/status`, `/api/system/go-live-checklist`, `/api/system/integrations`, `/api/system/export/:type`, `/api/system/backup`

## Production readiness checklist

- configure MongoDB and verify backups
- set strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET`
- set `APP_ENV=production`
- set `DEMO_MODE=false`
- set `DISABLE_DEMO_RESET=true`
- configure frontend/backend URLs and HTTPS
- configure notification providers if real delivery is needed
- review CORS origins
- run `pnpm lint`, `pnpm typecheck`, `pnpm test:all`, and `pnpm build`
- verify health and readiness endpoints after deploy
- review monitoring/logging and avoid logging sensitive care-note contents

## Production go-live checklist

1. Configure MongoDB
2. Set secrets
3. Disable demo reset
4. Configure domain and HTTPS
5. Configure email or SMS providers, or intentionally leave them disabled
6. Confirm family visibility rules
7. Run seed carefully only in non-production or controlled staging
8. Run tests
9. Confirm backup path and restore procedure
10. Confirm `/api/health` and `/api/ready`
11. Create admin users
12. Import agency data
13. Pilot with limited users first
14. Monitor errors and readiness warnings

## Backups and restore

- Scripts:
  - `pnpm backup:mongo`
  - `pnpm restore:mongo`
- Required env:
  - `MONGODB_URI`
  - `BACKUP_DIR` for backup target
  - `BACKUP_SOURCE` for restore source
- Recommendation:
  - run backups on a fixed schedule outside the app
  - keep backups encrypted in production
  - test restore in staging before relying on backups operationally

## Notifications and AI configuration

- Notification providers:
  - `EMAIL_PROVIDER=demo` and `SMS_PROVIDER=demo` keep sends demo-only
  - set real provider credentials only when you are ready for controlled external delivery
- AI provider:
  - `AI_ENABLED=false` keeps the product on deterministic demo AI
  - `AI_ENABLED=true` with `AI_PROVIDER=openai` and `OPENAI_API_KEY` enables real server-side AI calls
  - family-facing AI output still requires human approval

## Common deployment issues

- `NEXT_PUBLIC_API_BASE_URL` still points to localhost
- demo reset endpoints left enabled in a non-demo environment
- MongoDB connected locally but not from the deployed runtime
- notification providers still in demo mode when live sends are expected
- CORS origins do not include the deployed frontend
- weak or missing JWT/session secrets

## QA checklist

- Verify public routes: `/`, `/product`, `/demo`, `/pricing`, `/status`
- Verify console routes render without crashes
- Verify caregiver visit workflow: check in, checklist, note, incident, check out
- Verify family route shows updates and concern submission
- Verify report workflow and notification send actions in demo mode
- Verify `/console/system/status`, `/console/system/go-live`, and `/console/system/data-export`
- Verify mobile caregiver workflow stays readable and tappable
- Verify demo reset works in demo mode and is blocked in production mode

## Troubleshooting

- If `pnpm test:e2e:web:prod` cannot bind its internal port, start the web app separately and run:
  - `PLAYWRIGHT_WEB_BASE_URL=http://127.0.0.1:3001 pnpm test:e2e:web:prod`
- If API smoke fails with invalid credentials, reset the demo baseline:
  - `curl -X POST http://127.0.0.1:4000/api/demo/reset`
- If backend runtime complains about missing modules after package changes:
  - `pnpm install`

## Rollback plan

1. Revert to the previous deploy artifact
2. Restore MongoDB from the latest verified backup
3. Re-run health and readiness checks
4. Reconfirm family visibility and notification settings
5. Re-enable limited pilot access only after validation

## Product focus

CareProof is focused on the home care visit lifecycle:

- visit proof
- caregiver checklist completion
- note and incident capture
- family-facing updates
- weekly reports
- auditability
- role-based operational visibility

## AI features

CareProof includes AI-assisted workflows that support staff review instead of replacing staff judgment:

- caregiver note cleanup
- visit summary draft
- family update draft
- incident triage suggestion
- weekly report draft
- risk signal detection
- coordinator next-action suggestions

These workflows are available through the backend AI endpoints and the product demo UI. If a real AI provider is not configured, CareProof falls back to deterministic demo AI so local development and demos still work.

### AI environment behavior

- `AI_ENABLED=true` with `AI_PROVIDER=openai` and a valid `OPENAI_API_KEY` enables real provider calls
- `AI_PROVIDER=fallback` or missing provider credentials keeps deterministic demo AI active
- AI calls stay server-side only
- family-facing drafts require human approval before they become visible to family users

## AI safety principles

- AI assists, humans decide
- AI drafts are labeled and require review
- family-facing AI content requires approval
- no medical diagnosis or treatment advice
- internal notes are not automatically shared with families
- demo mode uses deterministic mock AI when no real provider is available
