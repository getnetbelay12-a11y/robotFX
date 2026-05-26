# CareProof Deployment

## Recommended pilot stack

- MongoDB Atlas for database and backups
- Render or Railway for backend
- Vercel for admin
- TestFlight and Google Play internal testing for mobile
- Resend or SendGrid for email
- Twilio for SMS
- Sentry-compatible logging for error capture

## Environments

- `local` for development
- `staging` for demos and QA with demo data
- `production` for real agency data only

Never mix demo and production data.

## Environment variables

Backend requires:

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `APP_ENV`
- `CORS_ORIGINS`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `SMS_PROVIDER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `SENTRY_DSN`

## Release order

1. Deploy backend to staging and verify `/api/health` and `/api/ready`.
2. Deploy admin to staging.
3. Distribute mobile builds to internal testers.
4. Seed demo data in staging only.
5. Promote to production after restore drill and smoke verification.
