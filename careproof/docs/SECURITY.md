# CareProof Security Notes

## Controls in this MVP

- Argon2 password hashing
- JWT access and refresh tokens
- Refresh token rotation on login and refresh
- Role-based access control
- Agency-scoped data isolation
- Audit logging for workflow, imports, notifications, and report generation
- Rate limiting on login
- CORS restricted by environment

## Claims to avoid

Do not market CareProof as HIPAA-compliant until legal, hosting, vendor, and operational controls are formally reviewed.

Safer language:

Built with privacy-first access controls, audit logs, encryption in transit, and agency-level data isolation.

## Before production

- Confirm secrets are not committed
- Configure Sentry or equivalent without PHI leakage
- Verify MongoDB Atlas backup and restore
- Review admin roles and family visibility rules
