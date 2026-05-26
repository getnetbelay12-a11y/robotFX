# Day 18 Stabilization Runbook

## Goal

Stabilize the pilot after launch so real users can complete visits safely, repeatedly, and with less confusion than Day 17.

## Start With Day 17 Review

Open:

- `docs/pilot/live/[agency_name]/DAY_17_ISSUE_LOG.md`
- `docs/pilot/live/[agency_name]/DAY_17_METRICS.md`

## Severity Order

### Critical

Fix immediately. Pause pilot if needed.

- Wrong client shown
- Wrong family received update
- Agency data isolation issue
- Caregiver sees another caregiver's visit
- Family sees raw incident or internal notes
- Login broken for multiple users
- Checkout impossible for real visits

### High

Fix before expanding pilot.

- Caregiver cannot check in
- Checklist not saving
- Care note not saving
- Checkout fails
- Family update not generated
- Admin timeline missing
- Dashboard metrics wrong

### Medium

Fix after critical and high.

- Confusing labels
- Bad error messages
- Slow page
- Missing non-critical fields
- Import cleanup needed

### Low

Defer.

- Color polish
- Spacing
- Wording improvements
- Nice-to-have report formatting

## Fix Order

1. Data safety and security
2. Login and access
3. Visit visibility
4. Check-in and check-out
5. Checklist save
6. Care note save
7. Family update generation
8. Incident and family concern queues
9. Dashboard metrics
10. Reports
11. UI wording and polish

## Decision Rule

If critical issues remain unresolved, do not expand the pilot. Reduce scope or pause.
