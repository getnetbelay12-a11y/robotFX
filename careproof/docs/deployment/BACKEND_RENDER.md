# Backend Staging Deploy on Render

## Recommended Service

- Type: Web Service
- Runtime: Node
- Root directory: repository root
- Health check path: `/health`

## Build and Start

Use the checked-in [render.yaml](/Users/getnetbelay/Documents/New%20project/careproof/render.yaml) or configure manually:

- Build command: `pnpm install --frozen-lockfile && pnpm --filter @careproof/backend build`
- Start command: `pnpm --filter @careproof/backend start`

## Required Environment Variables

- `APP_ENV=staging`
- `PORT=4000`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS=https://admin-staging.careproof.app,https://staging.careproof.app`
- `EMAIL_PROVIDER=placeholder`
- `EMAIL_API_KEY=placeholder`
- `SMS_PROVIDER=placeholder`
- `SENTRY_DSN=placeholder`
- `LOG_LEVEL=info`

## Post-Deploy Checks

- `GET /health` returns `200`
- `GET /ready` returns `200`
- `GET /api/docs` loads Swagger

If `/ready` fails, stop. That means staging is not real yet.
