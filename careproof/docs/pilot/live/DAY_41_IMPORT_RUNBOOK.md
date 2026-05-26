# Day 41 Data Import + Pilot Environment Setup

## Goal

Turn agency CSV files into a usable CareProof pilot workspace where:

- admin can log in
- champion can log in
- caregivers can log in
- family access is correct
- one controlled test visit can run before launch

If the test visit fails, do not launch.

## Required Files

- `caregivers.csv`
- `clients.csv`
- `family_members.csv`
- `visits.csv`

## Import Order

1. Caregivers
2. Clients
3. Family members
4. Visits

Do not import visits first. Visits depend on caregiver and client mapping.

## Validation Rules

### Caregivers

- names present
- email valid and unique
- phone usable
- status valid

### Clients

- names present
- date of birth valid
- caregiver mapping valid if used
- status valid
- risk level valid

### Family Members

- client match exists
- relationship present
- email valid if supplied
- preferred contact method valid

### Visits

- client match exists
- caregiver match exists
- scheduled start and end valid
- end is after start
- timezone is explicit

## Common Failure Modes

- duplicate caregiver email
- client name mismatch
- missing client DOB
- family member linked to wrong client
- visit email does not map to caregiver
- visit end time before start time
- timezone missing

Do not silently fix everything. Document the errors and decide whether to import only clean rows or return the file for correction.

## Verification After Import

- admin can see caregivers
- admin can see clients
- admin can see family members linked correctly
- admin can see visits
- caregiver sees only assigned visits
- family sees only assigned client
- dashboard counts are sane

## Test Visit Workflow

1. Admin verifies the test visit
2. Caregiver logs in
3. Caregiver opens Today
4. Caregiver starts visit
5. Caregiver completes checklist
6. Caregiver adds note
7. Caregiver checks out
8. Family update is generated
9. Family sees safe update
10. Admin sees proof timeline

## Non-Negotiables

- wrong family sees wrong client -> pause immediately
- caregiver sees another caregiver's visit -> pause immediately
- test visit fails -> do not launch
