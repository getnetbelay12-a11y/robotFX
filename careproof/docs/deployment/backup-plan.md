# Backup Plan

- MongoDB backups: daily snapshot backups with 7-day retention minimum
- Seed/demo database: disposable, can be recreated with `pnpm seed`
- Restore drill: verify weekly on staging by restoring the latest snapshot
- Secrets: store `MONGODB_URI`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` in deployment secret storage only
- Monitoring trigger: alert if backup job fails once or if restore verification fails
