# CareProof Route Map

## Public

- Route: `/`
  - Role: Public
  - Purpose: Homepage and entry point
  - Key actions: View Product Flow, Book Demo
  - Demo status: Ready
  - Production readiness: Needs live content review and analytics setup

- Route: `/product`
  - Role: Public
  - Purpose: Product walkthrough
  - Key actions: Open Agency Console, Caregiver App, Family Portal
  - Demo status: Ready
  - Production readiness: Ready for pilot demos

- Route: `/demo`
  - Role: Public
  - Purpose: Demo booking and walkthrough entry
  - Key actions: Book Demo
  - Demo status: Ready
  - Production readiness: Needs backend notification/email decision

- Route: `/pricing`
  - Role: Public
  - Purpose: Pricing context
  - Key actions: Demo CTA
  - Demo status: Ready
  - Production readiness: Pricing policy review required

- Route: `/status`
  - Role: Public/Internal
  - Purpose: Status summary
  - Key actions: Review system posture
  - Demo status: Ready
  - Production readiness: Safe if no secrets exposed

## Agency Console

- `/console`
- `/console/dashboard`
- `/console/operations`
- `/console/onboarding`
- `/console/customer-success`
- `/console/pilot-review`
- `/console/pilot-feedback`
- `/console/branches`
- `/console/branches/[id]`
- `/console/visits`
- `/console/visits/[id]`
- `/console/schedule`
- `/console/clients`
- `/console/clients/[id]`
- `/console/client-risk`
- `/console/care-plans`
- `/console/care-plans/new`
- `/console/caregivers`
- `/console/caregivers/[id]`
- `/console/caregiver-support`
- `/console/incidents`
- `/console/incidents/[id]`
- `/console/family-concerns`
- `/console/family-health`
- `/console/billing`
- `/console/reports`
- `/console/reports/[id]`
- `/console/notifications`
- `/console/import`
- `/console/support`
- `/console/training`
- `/console/data-quality`
- `/console/rollout`
- `/console/knowledge-base`
- `/console/executive`
- `/console/settings`
- `/console/settings/users`
- `/console/settings/quality-rules`
- `/console/system/status`
- `/console/system/go-live`
- `/console/system/integrations`
- `/console/system/data-export`

### Console Route Notes

- Role: Coordinator/Admin/Owner unless route is explicitly operational or system-level
- Purpose: Daily operations, setup, management, reporting, and deployment readiness
- Key actions: View visits, resolve exceptions, update concerns/incidents, manage settings, export data
- Demo status: Ready
- Production readiness: Needs real auth, backend persistence parity, and provider configuration for live pilot use

## Caregiver

- Route: `/caregiver`
  - Role: Caregiver
  - Purpose: Entry redirect surface for mobile workflow
  - Key actions: Open today schedule
  - Demo status: Ready
  - Production readiness: Needs real session and assigned-visit enforcement verification

- Route: `/caregiver/today`
- Route: `/caregiver/visit/[id]`
- Route: `/caregiver/visits`
- Route: `/caregiver/incidents`
- Route: `/caregiver/profile`
  - Role: Caregiver
  - Purpose: Day-of-care workflow
  - Key actions: Check in, complete tasks, add note, report incident, check out
  - Demo status: Ready
  - Production readiness: Needs device/network testing and backend-backed workflow state

## Family

- Route: `/family`
- Route: `/family/updates`
- Route: `/family/reports`
- Route: `/family/concerns`
- Route: `/family/profile`
  - Role: Family
  - Purpose: Approved updates, reports, and concern tracking
  - Key actions: View updates, view report status, submit concern
  - Demo status: Ready
  - Production readiness: Needs hardened auth and family scope verification

## Scope Note

- No additional routes are documented here. If a route is not listed above, treat it as out of scope for the current demo build.
