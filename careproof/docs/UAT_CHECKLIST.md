# CareProof UAT Checklist

Use this checklist before any buyer demo, pilot handoff, or branch rollout review.

Status values:
- `Pass`
- `Fail`
- `Blocked`
- `Needs Retest`

Severity values:
- `P0`
- `P1`
- `P2`
- `P3`

Owner examples:
- `Product`
- `Engineering`
- `Implementation`
- `Customer Success`
- `Agency Admin`

| Area | Test Item | Pass/Fail | Notes | Severity | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Public Website | Homepage loads |  |  | P1 | Engineering |  |
| Public Website | CTA buttons work |  |  | P1 | Engineering |  |
| Public Website | Product message clear |  |  | P2 | Product |  |
| Public Website | Pricing and demo pages work |  |  | P2 | Engineering |  |
| Public Website | Mobile layout works |  |  | P2 | Product |  |
| Agency Console | Dashboard loads |  |  | P1 | Engineering |  |
| Agency Console | KPIs display correctly |  |  | P1 | Engineering |  |
| Agency Console | Operations board works |  |  | P1 | Engineering |  |
| Agency Console | Visits list works |  |  | P1 | Engineering |  |
| Agency Console | Visit detail works |  |  | P1 | Engineering |  |
| Agency Console | Client page works |  |  | P2 | Engineering |  |
| Agency Console | Caregiver page works |  |  | P2 | Engineering |  |
| Agency Console | Reports page works |  |  | P1 | Engineering |  |
| Caregiver App | Today page loads |  |  | P1 | Engineering |  |
| Caregiver App | Assigned visits display |  |  | P1 | Engineering |  |
| Caregiver App | Check-in works |  |  | P0 | Engineering |  |
| Caregiver App | Checklist works |  |  | P1 | Engineering |  |
| Caregiver App | Note works |  |  | P1 | Engineering |  |
| Caregiver App | Incident report works |  |  | P1 | Engineering |  |
| Caregiver App | Checkout works |  |  | P0 | Engineering |  |
| Caregiver App | Completion summary works |  |  | P2 | Product |  |
| Family Portal | Latest update displays |  |  | P1 | Engineering |  |
| Family Portal | Weekly report displays |  |  | P1 | Engineering |  |
| Family Portal | Concern form works |  |  | P1 | Engineering |  |
| Family Portal | Concern status updates |  |  | P1 | Engineering |  |
| Family Portal | Internal notes hidden |  |  | P0 | Engineering |  |
| Admin / Setup | Onboarding wizard works |  |  | P1 | Engineering |  |
| Admin / Setup | User management works |  |  | P2 | Engineering |  |
| Admin / Setup | Client creation works |  |  | P1 | Engineering |  |
| Admin / Setup | Family member linking works |  |  | P1 | Engineering |  |
| Admin / Setup | Care plan builder works |  |  | P1 | Engineering |  |
| Admin / Setup | Visit scheduling works |  |  | P1 | Engineering |  |
| Admin / Setup | CSV import preview works |  |  | P2 | Engineering |  |
| Reports / Audit | Weekly report generation works |  |  | P1 | Engineering |  |
| Reports / Audit | Daily operations report works |  |  | P2 | Engineering |  |
| Reports / Audit | Audit timeline updates |  |  | P1 | Engineering |  |
| Reports / Audit | CSV export works or a demo-mode export message appears |  |  | P2 | Engineering |  |
| Security / Roles | Caregiver cannot see unassigned visits |  |  | P0 | Engineering |  |
| Security / Roles | Family cannot see internal notes |  |  | P0 | Engineering |  |
| Security / Roles | Agency scoping respected |  |  | P0 | Engineering |  |
| Security / Roles | System pages are owner/admin only |  |  | P0 | Engineering |  |
| Security / Roles | Demo reset disabled in production mode |  |  | P0 | Engineering |  |
| Mobile | Homepage mobile |  |  | P2 | Product |  |
| Mobile | Caregiver workflow mobile |  |  | P1 | Product |  |
| Mobile | Family portal mobile |  |  | P1 | Product |  |
| Mobile | Console usable on tablet/mobile |  |  | P2 | Product |  |

## UAT Exit Criteria

- No unresolved `P0` defects.
- No unresolved `P1` defects on the main demo path.
- Any `P2` or `P3` defects are documented with workaround notes.
- Demo reset and seeded walkthrough state are verified before the meeting.
