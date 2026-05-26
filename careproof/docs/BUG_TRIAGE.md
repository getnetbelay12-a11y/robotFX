# CareProof Bug Triage

## Severity Definitions

### P0 Critical

- App crash
- Data exposure
- Family sees internal notes
- Caregiver can access wrong visit
- Production reset or seed exposed

### P1 High

- Core workflow blocked
- Check-in or check-out broken
- Family concern flow broken
- Report generation broken
- Dashboard not loading

### P2 Medium

- Broken filter
- Bad status count
- Export action shows the wrong demo-mode message
- UI layout issue

### P3 Low

- Copy issue
- Spacing issue
- Minor visual polish

## Bug Template

- Title:
- Severity:
- Route:
- User role:
- Steps to reproduce:
- Expected:
- Actual:
- Screenshot:
- Console error:
- Status:
- Owner:
- Fix notes:

## Triage Rule

If a defect touches permissions, family visibility, or demo reset protections, start by assuming it is more severe than it looks. Those are trust-breakers, not polish issues.
