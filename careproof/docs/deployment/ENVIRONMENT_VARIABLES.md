# CareProof Environment Variables

## Backend

### Required in all environments

- `APP_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`

### Optional or placeholder for staging

- `PORT`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `EMAIL_FROM`
- `SMS_PROVIDER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `SENTRY_DSN`
- `LOG_LEVEL`
- `AI_ENABLED`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `AI_MODEL`
- `OPENAI_RETRY_COOLDOWN_MINUTES`

## AI Mode Decision

You must choose one live AI mode deliberately:

- Fallback-first live mode:
  - `AI_ENABLED=true`
  - `AI_PROVIDER=fallback`
  - `OPENAI_API_KEY=` may stay empty
- AI-disabled live mode:
  - `AI_ENABLED=false`
  - `AI_PROVIDER=fallback`
- OpenAI live mode:
  - `AI_ENABLED=true`
  - `AI_PROVIDER=openai`
  - `OPENAI_API_KEY=sk-...`
  - `OPENAI_RETRY_COOLDOWN_MINUTES=30`

If OpenAI returns rate-limit or billing/quota failures, CareProof now trips a temporary cooldown and uses fallback directly until that cooldown expires.

If you do not have a real OpenAI key yet, fallback-first is the correct production-safe default for CareProof.

## Backend Staging Example

```env
APP_ENV=staging
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/careproof_staging
JWT_SECRET=<long_random_secret>
JWT_REFRESH_SECRET=<another_long_random_secret>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
CORS_ORIGINS=https://admin-staging.careproof.app,https://staging.careproof.app
EMAIL_PROVIDER=placeholder
EMAIL_API_KEY=placeholder
EMAIL_FROM=CareProof Staging <no-reply@careproof.app>
SMS_PROVIDER=placeholder
TWILIO_ACCOUNT_SID=placeholder
TWILIO_AUTH_TOKEN=placeholder
TWILIO_FROM_NUMBER=placeholder
SENTRY_DSN=placeholder
LOG_LEVEL=info
AI_ENABLED=true
AI_PROVIDER=fallback
OPENAI_API_KEY=
AI_MODEL=gpt-5.4-mini
OPENAI_RETRY_COOLDOWN_MINUTES=30
```

## Admin Staging Example

```env
NEXT_PUBLIC_API_BASE_URL=https://api-staging.careproof.app/api
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_SENTRY_DSN=placeholder
```

## Web Staging Example

```env
NEXT_PUBLIC_APP_ENV=staging
NEXT_PUBLIC_ADMIN_URL=https://admin-staging.careproof.app
NEXT_PUBLIC_API_BASE_URL=https://api-staging.careproof.app/api
NEXT_PUBLIC_BOOK_DEMO_URL=mailto:getnet@kelelitsolution.com?subject=CareProof%20Demo
NEXT_PUBLIC_PILOT_URL=mailto:getnet@kelelitsolution.com?subject=CareProof%2030-Day%20Pilot
```

## Secret Handling Rules

- Generate real random JWT secrets.
- Store secrets only in hosting environment settings.
- Never commit secrets or live URIs to Git.
- Never put `OPENAI_API_KEY` in admin, web, or mobile client code.
