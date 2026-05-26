# Admin Console Staging Deploy on Vercel

## App

- Root directory: `apps/admin`
- Framework: Next.js

## Build Settings

- Install command: `pnpm install`
- Build command: `pnpm build`
- Output: default Next.js output

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL=https://api-staging.careproof.app/api`
- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_SENTRY_DSN=placeholder`

## Expected Staging URL

- `https://admin-staging.careproof.app`

## Required Behavior

- Login page loads
- Environment badge shows `STAGING`
- Dashboard loads against staging API
- Session expiry routes back to login cleanly
