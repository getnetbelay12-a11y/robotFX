# Backup and Restore Plan

## Minimum Backup Strategy

- MongoDB Atlas daily backups
- Separate staging and production databases
- Production data never mixed with demo data
- Weekly export of critical operational records if needed

## Restore Test

1. Create backup
2. Restore to temporary database
3. Point staging backend to restored DB
4. Login as test admin
5. Verify dashboard
6. Verify visits
7. Verify family feed
8. Verify reports

## Restore Frequency

A restore drill should be tested before the first real pilot and then monthly.

Brutal truth: if you have not tested restore, you do not really have backups.
