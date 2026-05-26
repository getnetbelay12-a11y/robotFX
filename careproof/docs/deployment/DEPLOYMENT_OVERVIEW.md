# CareProof Deployment Overview

## Goal

Deploy CareProof to a staging environment so demos and pilot rehearsals run outside localhost.

## Recommended MVP Stack

- Database: MongoDB Atlas
- Backend API: Render
- Admin console: Vercel
- Landing page: Vercel
- Mobile: local/internal test builds for now
- Monitoring: Sentry placeholder
- Email/SMS: placeholder providers until real credentials are available

## Environment Split

- Local: development only
- Staging: demos, QA, pilot rehearsal
- Production: real agency data later

## Critical Rules

- Never point staging and production to the same database.
- Never seed demo data into production.
- Never test fake users inside a real agency account.
- Never deploy production first. Stage it, smoke test it, then decide.
- Never leave AI mode ambiguous at release time. Choose fallback-first, AI-disabled, or OpenAI explicitly.

## Current Safe Default

Until a real `OPENAI_API_KEY` exists and is live-verified, the safe production path for CareProof is:

- `AI_ENABLED=true`
- `AI_PROVIDER=fallback`

That keeps the workflow assistance active without depending on OpenAI availability.
