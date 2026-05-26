# CareProof: Making Every Home Care Visit Visible, Documented, and Trusted

## Opening Pitch

CareProof is proof-of-care software for home care agencies. It helps agencies confirm visits, document care tasks, keep families informed, and catch issues early.

## Canonical Demo Records

- Agency: `CareProof Demo Agency`
- Branch: `Northside Care Team`
- Client: `Maria Johnson`
- Caregiver: `Ana Smith`
- Family member: `Emily Johnson`
- Visit: `visit-maria-am` at `9:00 AM`

## 1. Homepage

- Route: `/`
- Click: `View Product Flow`
- Expected screen: homepage hero with the product promise, operation snapshot, and clear CTA hierarchy
- Talking points:
  - Home care agencies need proof of what happened during visits.
  - Families need approved updates without exposing internal staff notes.
  - Coordinators need one queue for late visits, incidents, and follow-up.

## 2. Product Walkthrough

- Route: `/product`
- Click: `Open Agency Console`
- Expected screen: five-step workflow from agency planning to reports
- Talking points:
  - Agency plans care.
  - Caregiver completes the visit.
  - Family receives a safe update.
  - Agency reviews proof and alerts.
  - Reports are generated from the same record.

## 3. Agency Dashboard

- Route: `/console/dashboard`
- Click: `Operations`
- Expected screen: today KPIs, attention queue, report readiness, and Maria Johnson in the day’s data
- Talking points:
  - This answers one morning question: what needs attention today?
  - The dashboard is not just counts. It points into visit proof, concerns, and reports.

## 4. Operations Command Center

- Route: `/console/operations`
- Click: `View Visit` on Maria Johnson
- Expected screen: live visit board and exceptions queue
- Talking points:
  - This is where coordinators run the day.
  - You can see scheduled, late, in-progress, and blocked visits without digging.

## 5. Maria Johnson Visit Detail

- Route: `/console/visits/visit-maria-am`
- Click: none yet, review the record
- Expected screen: timeline, checklist, note area, family update panel, incident panel, and audit trail
- Talking points:
  - This is the visit proof record.
  - It combines schedule, check-in, tasks, note, family-safe summary, and audit history.

## 6. Caregiver Workflow

- Route: `/caregiver/today`
- Click path:
  - `Maria Johnson`
  - `Check In`
  - complete the checklist
  - add a note
  - `Check Out`
- Expected screen: mobile visit workflow for Ana Smith
- Talking points:
  - The caregiver app is intentionally simple.
  - Required tasks and a note must be completed before checkout unless the agency explicitly allows an override.
- Suggested note:
  - `Client completed breakfast support, medication reminder, mobility check, hygiene support, and safety check. No urgent concern observed.`

## 7. Agency Review

- Route: `/console/visits/visit-maria-am`
- Click path:
  - `Draft Family Update`
  - `Approve for Family`
- Expected screen: updated visit status, new audit entries, completed checklist, note, and approved family-safe summary
- Talking points:
  - Caregiver actions immediately update the agency record.
  - Family-facing text remains separate from internal review.

## 8. Family Portal

- Route: `/family/updates`
- Click: then open `/family/concerns`
- Expected screen: approved Maria Johnson update, weekly report card, concern form
- Talking points:
  - Families see approved care summaries, not raw staff notes.
  - The family portal is calm and status-oriented, not operationally noisy.

## 9. Family Concern Follow-Up

- Route: `/console/family-concerns`
- Click path:
  - update `Assigned owner` if needed
  - enter `Internal note`
  - enter `Family-facing response`
  - `Respond to Concern` or `Mark Resolved`
- Expected screen: concern record with separate internal and family-facing fields
- Talking points:
  - The agency can document internal follow-up without leaking it to family.
  - Families only see the approved response and status.

## 10. Reports

- Route: `/console/reports`
- Click path:
  - `Mark Ready`
  - `Send Demo Notification`
  - `Export CSV`
- Expected screen: weekly reports, visit proof report, incident report, and daily operations report
- Talking points:
  - Reports are generated from visit proof, not reconstructed later.
  - Demo-mode sends and exports are visible without pretending live external delivery is already configured.
- Backup line:
  - Demo action ready. Production integration can be connected here.

## 11. Executive Dashboard

- Route: `/console/executive`
- Click: branch filter if useful
- Expected screen: agency health score, branch performance, top risks, and next actions
- Talking points:
  - Owners see service reliability, family communication health, risk, and billing readiness from one operating record.

## 12. System Status And Go-Live

- Route: `/console/system/status`
- Then: `/console/system/go-live`
- Expected screen: health, readiness, provider mode, and deployment checklist
- Talking points:
  - The product makes demo-vs-pilot readiness explicit.
  - It does not hide that production requires final infrastructure and provider configuration.

## Closing Pitch

CareProof gives the agency one trusted operating record across visits, tasks, notes, incidents, family updates, reports, and audit history.
