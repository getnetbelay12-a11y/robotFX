# Import Templates

Use the CSV templates in `docs/import-templates`.

## Files

- `caregivers.csv`
- `clients.csv`
- `family_members.csv`
- `care_plans.csv`
- `visits.csv`

## Import endpoints

- `POST /api/imports/caregivers`
- `POST /api/imports/clients`
- `POST /api/imports/family-members`
- `POST /api/imports/visits`

## Response contract

Each import returns:

- `successCount`
- `failureCount`
- `errors[]` with `rowNumber` and `error`

Imports should be treated as onboarding tools, not silent background jobs. Row-level errors must be visible.
