# CareProof API Contract Summary

Base path: `/api`

## Health

- `GET /health`
  - Purpose: Liveness check
  - Request body: none
  - Response: status, version, environment, timestamp, uptime
  - Permissions: public
  - Demo/production status: Ready

- `GET /ready`
  - Purpose: Readiness check
  - Request body: none
  - Response: status, database status, demo mode, provider readiness
  - Permissions: public
  - Demo/production status: Ready

## Agencies

- `GET /agencies/current`
- `GET /agencies/me`
- `PATCH /agencies/me/settings`
  - Purpose: Agency metadata and settings
  - Permissions: authenticated agency users
  - Demo/production status: Partially demo-backed on the frontend

## Dashboard

- `GET /dashboard/today`
- `GET /dashboard/summary`
- `GET /dashboard/attention-queue`
- `GET /dashboard/late-visits`
- `GET /dashboard/incidents`
- `GET /dashboard/family-concerns`
- `GET /dashboard/client-risk`
- `GET /dashboard/caregiver-reliability`
- `GET /dashboard/risk-flags`
- `GET /dashboard/ai-digest/today`
  - Purpose: Coordinator and management overview data
  - Permissions: authenticated agency users
  - Demo/production status: Backend endpoints exist, web demo still uses shared local state for continuity

## Visits

- `GET /visits`
- `POST /visits`
- `GET /visits/:id`
- `PATCH /visits/:id`
- `POST /visits/:id/check-in`
- `POST /visits/:id/checklist`
- `POST /visits/:id/tasks/:taskId/complete`
- `POST /visits/:id/tasks/:taskId/skip`
- `POST /visits/:id/note`
- `POST /visits/:id/note-assist`
- `POST /visits/:id/check-out`
  - Purpose: Visit lifecycle and caregiver documentation
  - Request body: DTO-based JSON payloads
  - Permissions: authenticated agency or caregiver roles depending on action
  - Demo/production status: Ready for API testing, frontend still partly local-state driven

## Incidents

- `GET /incidents`
- `GET /incidents/:id`
- `POST /visits/:visitId/incidents`
- `POST /visits/:visitId/incident`
- `PATCH /incidents/:id/status`
- `PATCH /incidents/:id/review`
- `POST /incidents/:id/follow-up`
  - Purpose: Incident creation and follow-up
  - Permissions: authenticated agency roles, caregiver reporting for visit-scoped creation
  - Demo/production status: Ready in demo mode

## Family And Concerns

- `GET /family/clients`
- `POST /family/clients/:clientId/concerns`
- `GET /family/clients/:clientId/feed`
- `GET /family/clients/:clientId/visits`
- `GET /family/clients/:clientId/reports`
- `GET /family/concerns`
- `GET /family-concerns`
- `GET /family-concerns/:id`
- `PATCH /family-concerns/:id`
- `PATCH /family-concerns/:id/status`
- `POST /family-concerns/:id/response`
  - Purpose: Family portal data and concern management
  - Permissions: family-scoped or agency-scoped depending on endpoint
  - Demo/production status: Ready in demo mode

## Clients And Care Plans

- `GET /clients`
- `POST /clients`
- `GET /clients/:id`
- `GET /clients/:id/timeline`
- `PATCH /clients/:id`
- `GET /clients/:clientId/care-plan`
- `PUT /clients/:clientId/care-plan`
- `GET /care-plans`
- `GET /care-plans/:id`
- `POST /care-plans`
- `PUT /care-plans/:id`
  - Purpose: Client profiles and care plan management
  - Permissions: authenticated agency roles
  - Demo/production status: Ready for pilot setup workflows

## Users And Caregivers

- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `PATCH /users/:id/status`
- `GET /caregivers`
- `GET /caregivers/:id`
  - Purpose: User and caregiver management
  - Permissions: authenticated agency roles
  - Demo/production status: Ready in demo mode

## Reports

- `GET /reports/weekly`
- `GET /reports/weekly/item/:reportId`
- `GET /reports/weekly/:clientId`
- `POST /reports/weekly/:clientId/generate`
- `POST /reports/weekly/generate`
- `POST /reports/weekly/:reportId/mark-ready`
- `POST /reports/weekly/:reportId/send`
- `GET /reports/generated`
- `GET /reports/:reportId`
- `POST /reports/weekly/:clientId/export`
- `GET /reports/agency/operations`
- `POST /reports/agency-operations/export`
- `POST /reports/caregiver-reliability/export`
  - Purpose: Weekly and operational reporting
  - Permissions: authenticated agency roles
  - Demo/production status: Ready with CSV export posture and controlled demo-mode actions where live delivery is not configured

## Notifications

- `GET /notifications`
- `POST /notifications/test`
- `POST /notifications/demo-send`
- `PATCH /notifications/:id/retry`
  - Purpose: Notification visibility and demo-safe sending
  - Permissions: authenticated agency roles
  - Demo/production status: Demo-safe

## AI

- `POST /ai/visit-summary`
- `POST /ai/note-cleanup`
- `POST /ai/family-update-draft`
- `POST /ai/incident-triage`
- `POST /ai/weekly-report-draft`
- `POST /ai/risk-signals`
- `POST /ai/next-actions`
  - Purpose: AI-assisted drafts and operational suggestions
  - Permissions: authenticated roles with feature access
  - Demo/production status: Demo AI fallback ready, real provider optional

## Imports

- `POST /imports/caregivers`
- `POST /imports/clients`
- `POST /imports/family-members`
- `POST /imports/visits`
- `GET /imports`
- `GET /imports/templates/:type`
- `GET /imports/:id`
  - Purpose: CSV import workflows
  - Permissions: authenticated agency roles
  - Demo/production status: Demo-ready

## Demo Requests

- `POST /demo-requests`
  - Purpose: Public demo booking
  - Request body: agencyName, contactName, email, phone, caregiverCount, mainChallenge, message
  - Permissions: public
  - Demo/production status: Ready with validation

## Demo Control

- `POST /demo/seed`
- `POST /demo/reset`
  - Purpose: Restore baseline demo data
  - Permissions: environment-protected
  - Demo/production status: Disabled when production protections are active

## System

- `GET /system/status`
- `GET /system/go-live-checklist`
- `GET /system/integrations`
- `POST /system/integrations/:type/test`
- `POST /system/export/:type`
- `POST /system/backup`
  - Purpose: Deployment posture, integration readiness, export, backup summary
  - Permissions: owner/admin/platform admin roles
  - Demo/production status: Ready with demo-safe integration testing
