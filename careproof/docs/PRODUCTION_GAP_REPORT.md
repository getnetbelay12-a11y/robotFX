# CareProof Production Gap Report

## A. Ready For Demo

- Public homepage and product walkthrough
- Agency dashboard, operations, visits, incidents, concerns, reports
- Caregiver mobile workflow
- Family portal workflow
- Executive, branch, billing, customer-success, rollout, and system-readiness surfaces
- Demo reset protections in production mode
- System status, go-live checklist, integration readiness, and data export screens
- Demo documentation set for UAT and pilot handoff
- Canonical demo story centered on Maria Johnson, Ana Smith, Emily Johnson, CareProof Demo Agency, and Northside Care Team

## B. Ready For Pilot With Configuration

- Backend API with real environment variables
- MongoDB-backed demo and pilot data
- Branch-aware agency setup
- Weekly reports and CSV exports
- AI-assisted drafts with server-side fallback behavior
- Notification architecture in demo mode or with a configured provider

## C. Not Production-Ready Yet

- Full production authentication and session hardening still need explicit verification end to end
- Web app still relies on shared local demo state for continuity across many product screens
- Real SMS/email provider delivery is not configured by default
- AI provider can run entirely in deterministic demo mode if no real provider is configured
- PDF export is not fully implemented yet
- Legal, privacy, and compliance review are still required
- Backup automation exists as guidance/scripts, not as a full managed production workflow
- Monitoring provider integration and alerting are not fully wired
- Load testing and capacity testing are not documented as complete
- Demo role separation in the web shell is still presentation-driven in places and needs full authenticated enforcement for production

## D. Highest Priority Before Paid Pilot

1. Finish real auth and role enforcement across all web flows.
2. Move high-value web workflows from local demo state to backend persistence.
3. Validate family visibility boundaries with real auth tokens and seeded accounts.
4. Configure and test production-like MongoDB backup and restore in staging.
5. Replace demo notification mode with a controlled provider or keep it intentionally disabled.
6. Add durable error monitoring and alerting.
7. Validate export permissions and agency scoping against real authenticated users.
8. Complete PDF/report delivery strategy or remove any user expectation of it.
9. Run a staging go-live drill with real env settings.
10. Perform a structured permissions and security review before external pilot users are onboarded.

## E. Ready For Limited Pilot After Configuration

- Configure production-like MongoDB and validate backups in staging
- Apply real authentication and role/session controls
- Set secrets and disable demo reset publicly
- Configure email and SMS providers or keep them intentionally disabled
- Review family visibility rules with agency stakeholders
- Train pilot users and confirm support ownership

## F. Highest Risk Areas

- Permissions
- Family visibility
- Agency scoping
- Production demo reset posture
- Data persistence across users/devices
- Notification safety

## G. Top 10 Priority Fixes Before Paid Pilot

1. Replace presentation-only role separation with real authenticated authorization checks.
2. Move visit, concern, and report state to durable backend persistence for multi-user reliability.
3. Validate family visibility rules against real family accounts, not only demo navigation states.
4. Configure notification providers and test controlled sends in staging.
5. Add production monitoring and alerting for backend, frontend, and database health.
6. Automate backup verification and test restore in staging.
7. Run full permissions and agency-scope regression testing with seeded multi-branch users.
8. Add performance and load testing for dashboard, visits, and reporting paths.
9. Finalize legal, privacy, and compliance review before real client data is used.
10. Complete production import and migration runbooks for agency onboarding.

## H. QA Command Notes

- Command: `pnpm demo:reset`
  - Error: may fail in restricted environments when direct Mongo access to `127.0.0.1:27017` is blocked
  - Suspected root cause: local sandbox/runtime networking limitation, not necessarily an app defect
  - Recommended fix: use the running backend’s protected `/api/demo/reset` endpoint during demo QA or ensure local Mongo is reachable outside the sandbox

- Command: starting local web/backend directly inside a restricted sandbox
  - Error: local port bind or localhost fetch can fail with permission errors
  - Suspected root cause: execution environment restrictions
  - Recommended fix: run the stack with approved local execution or use already-running local services for browser/API QA
