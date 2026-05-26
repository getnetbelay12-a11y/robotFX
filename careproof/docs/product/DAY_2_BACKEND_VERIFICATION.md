# Day 2 Backend Verification

## Commands Run

- `pnpm install`
- `pnpm --filter ./apps/backend build`
- `pnpm --filter ./apps/backend typecheck`
- `pnpm --filter ./apps/backend lint`
- `pnpm --filter ./apps/backend test`
- `pnpm --filter ./apps/backend test:e2e`
- `pnpm --filter ./apps/backend seed`
- `pnpm --filter ./apps/backend dev`

## Results

- `pnpm install`: passed
- `build`: passed
- `typecheck`: passed
- `lint`: passed
- `test`: passed
- `test:e2e`: passed
- `seed`: passed
- `dev`: passed
- `GET /health`: `200 OK`
- `GET /ready`: `200 OK` with `dbReady: true`
- Swagger available at `http://localhost:4000/api/docs`

## Seed Result

Seed completed successfully against local MongoDB with:

- `users: 37`
- `clients: 18`
- `visits: 86`
- `incidents: 5`
- `familyConcerns: 5`
- `weeklyReports: 3`

Demo credentials verified:

- `owner@careproof.demo / Password123!`
- `coordinator@careproof.demo / Password123!`
- `caregiver1@careproof.demo / Password123!`
- `family1@careproof.demo / Password123!`

## Demo Login Results

- Owner login: passed
- Caregiver login: passed
- Family login: passed

Observed login response contained:

- `accessToken`
- `refreshToken`
- `user.sub`
- `user.agencyId`
- `user.role`
- `user.email`

## Visit Workflow Test

Manual end-to-end workflow was executed against a real local backend and seeded data.

Controlled test setup:

- Client: `Mary Smith`
- Caregiver: `caregiver1@careproof.demo`
- Family member: `family1@careproof.demo`
- Created visit id: `69f8e51767f93d59d18e4b7a`

Manual workflow results:

1. Owner created visit: passed
2. Caregiver fetched visits: passed
3. Caregiver check-in: passed, status changed to `in_progress`
4. Task completion: passed, `meal_assistance` changed to `done`
5. Required task skip: passed, visit changed to `requires_review`
6. Care note add: passed
7. Check-out: passed, final status `requires_review`
8. Family feed: passed, safe summary visible

Generated family summary:

`Today's visit was completed. meal assistance was completed. Bathing was not completed because Client refused. The caregiver noted: Client was calm and cooperative today. No major concerns..`

Event and audit proof for the manual visit:

- `VISIT_CREATED`
- `CHECK_IN`
- `TASK_COMPLETED`
- `TASK_SKIPPED`
- `NOTE_ADDED`
- `CHECK_OUT`
- `FAMILY_UPDATE_GENERATED`

Counts observed in MongoDB:

- `visitEvents: 7`
- `auditLogs: 7`

## Security Test Results

Verified with live API requests:

- Caregiver sees assigned visits only: passed
  - caregiver visit count: `8`
  - owner visit count: `86`
- Caregiver accessing another caregiver's visit: `403`
- Second caregiver accessing the controlled visit: `403`
- Family member accessing unrelated client feed: `403`

This is the Day 2 security proof that matters. Role and agency boundary enforcement held during manual checks.

## Issues Found

The following issues were found during Day 2 verification:

1. `helmet` import caused build/typecheck failure because typings were not resolved in the current setup.
2. `AuthModule` injected `MonitoringService` without importing `MonitoringModule`, which broke test bootstrapping.
3. `CreateVisitDto` did not validate `tasks[].required`, causing valid manual visit creation requests to fail at runtime under the global validation pipe.
4. CSV import e2e fixture used a static email and was not repeatable across back-to-back test runs.

## Fixes Applied

1. Switched `helmet` to a runtime `require` import compatible with the current lint/build setup.
2. Imported `MonitoringModule` into `AuthModule`.
3. Added `@IsBoolean()` validation to `CreateVisitDto.tasks[].required`.
4. Changed the CSV import e2e fixture to generate a unique email per run.

## Fixes Needed

No blocking backend issues remain from Day 2 verification.

The remaining gap is not backend correctness. It is market execution:

- researched agencies exist
- contact list exists
- outreach materials exist
- actual outreach still must be executed manually
