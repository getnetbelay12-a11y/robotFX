# Landing Page Staging Deploy on Vercel

## App

- Root directory: `apps/web`
- Framework: Next.js

## Build Settings

- Install command: `pnpm install`
- Build command: `pnpm build`
- Output: default Next.js output

## Environment Variables

- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_ADMIN_URL=https://admin-staging.careproof.app`
- `NEXT_PUBLIC_API_BASE_URL=https://api-staging.careproof.app/api`
- `NEXT_PUBLIC_BOOK_DEMO_URL=<Calendly or mailto>`
- `NEXT_PUBLIC_PILOT_URL=<Calendly or mailto>`

## Expected Staging URL

- `https://staging.careproof.app`

The landing page does not need internal operational features. It needs clear positioning and working CTA links.
