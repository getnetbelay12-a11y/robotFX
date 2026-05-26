# CareProof Release Checklist

## Code Quality

- [ ] `pnpm install` passes
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm test:e2e` passes

## Security

- [ ] No secrets committed
- [ ] CORS restricted
- [ ] Login rate limiting enabled
- [ ] Agency isolation tests pass
- [ ] Role tests pass
- [ ] Family data safety tests pass
- [ ] Audit logs verified

## Database

- [ ] Staging database configured
- [ ] Indexes created
- [ ] `seed:demo` works on staging
- [ ] Backup settings reviewed

## Deployment

- [ ] Backend deployed
- [ ] Admin deployed
- [ ] Web deployed
- [ ] Environment variables configured
- [ ] Live AI mode chosen explicitly:
  - fallback-first, AI-disabled, or OpenAI
- [ ] If `AI_PROVIDER=openai`, real `OPENAI_API_KEY` configured
- [ ] `/health` works
- [ ] `/ready` works
- [ ] Smoke test completed

## Demo

- [ ] Demo owner login works
- [ ] Demo caregiver login works
- [ ] Demo family login works
- [ ] Dashboard looks meaningful
- [ ] Demo script tested
