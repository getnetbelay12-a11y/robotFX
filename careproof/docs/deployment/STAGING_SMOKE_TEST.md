# Staging Smoke Test

## Automated API Smoke Test

Run this after staging deploy and demo seed:

```bash
API_BASE_URL=https://api-staging.careproof.app/api \
OWNER_EMAIL=owner@careproof.demo \
OWNER_PASSWORD='Password123!' \
CAREGIVER_EMAIL=caregiver1@careproof.demo \
CAREGIVER_PASSWORD='Password123!' \
FAMILY_EMAIL=family1@careproof.demo \
FAMILY_PASSWORD='Password123!' \
pnpm smoke:staging
```

This checks:

- `/health`
- `/ready`
- owner login
- caregiver login
- family login
- dashboard endpoint
- visits endpoint
- family clients/feed endpoints

## Manual Backend

- [ ] `GET /health` returns 200
- [ ] `GET /ready` returns 200
- [ ] Swagger opens
- [ ] Login works for owner
- [ ] Login works for caregiver
- [ ] Login works for family

## Manual Admin

- [ ] Admin login page loads
- [ ] Owner can log in
- [ ] `STAGING` environment label is visible
- [ ] Dashboard loads demo metrics
- [ ] Visits page loads
- [ ] Visit detail opens
- [ ] Timeline displays
- [ ] Clients page loads
- [ ] Caregivers page loads
- [ ] Incidents page loads
- [ ] Family concerns page loads
- [ ] Reports page loads
- [ ] Imports page loads
- [ ] Logout works

## Manual Caregiver Flow

- [ ] Caregiver gets assigned visits
- [ ] Caregiver checks in
- [ ] Caregiver completes checklist
- [ ] Caregiver adds note
- [ ] Caregiver checks out
- [ ] Family summary generated

## Manual Family Flow

- [ ] Family logs in
- [ ] Family sees assigned client only
- [ ] Updates feed loads
- [ ] Family submits concern
- [ ] Family reports page loads

## Manual Security

- [ ] Caregiver cannot access unassigned visit
- [ ] Family cannot access unrelated client
- [ ] Admin cannot access another agency data
- [ ] Raw high-severity incident details are not visible to family
