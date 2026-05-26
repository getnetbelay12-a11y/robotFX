# Rollback Plan

## When to Roll Back

Rollback if:

- login breaks
- visit workflow breaks
- family feed exposes unsafe data
- agency isolation fails
- database migration corrupts data
- dashboard cannot load for demo

## Backend Rollback

1. Revert to previous deployed backend version.
2. Confirm `/health`.
3. Confirm `/ready`.
4. Run smoke login.
5. Test visit workflow.

## Admin/Web Rollback

1. Revert to previous Vercel deployment.
2. Confirm login.
3. Confirm dashboard loads.
4. Confirm visit detail loads.

## Database Rollback

1. Do not manually edit production or staging data unless necessary.
2. Restore from latest backup into temporary database first.
3. Validate restored data.
4. Switch app connection only after validation.

## Critical Rule

Never restore over production without first validating the backup in a temporary database.
