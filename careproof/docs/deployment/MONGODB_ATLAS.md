# MongoDB Atlas Staging Setup

## Day 10 Scope

Only configure staging.

## Databases

- `careproof_staging`
- `careproof_production`

Use separate databases. Do not use one database with environment-prefixed collections.

## Atlas Checklist

- [ ] Create Atlas project
- [ ] Create staging cluster or staging database
- [ ] Create database user with strong password
- [ ] Add IP access rule for backend host
- [ ] Copy MongoDB connection string
- [ ] Store URI only in hosting environment variables
- [ ] Do not commit URI to GitHub

## Staging Connection Example

`mongodb+srv://<user>:<password>@<cluster>/careproof_staging`

## Indexes

After staging is connected, run:

```bash
pnpm db:indexes
```

That is not optional. Staging should behave like production, not like a dev sandbox.
