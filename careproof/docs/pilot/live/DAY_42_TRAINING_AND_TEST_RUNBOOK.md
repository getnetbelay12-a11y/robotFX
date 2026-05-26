# Day 42 Training + Controlled Test Visit

## Goal

Prove the pilot workflow with real pilot users before launch.

The test is only successful if:

- admin can see the visit
- caregiver can complete the visit
- family update is safe
- agency can verify the proof timeline

If one controlled test visit does not work end-to-end, do not launch.

## Training Order

1. Admin and champion training
2. Caregiver training
3. Family communication approval
4. Controlled test visit
5. Launch decision

## Admin / Champion Training

Duration: 30 minutes maximum

Cover:

- dashboard
- visits page
- proof timeline
- incidents
- family concerns
- reports
- daily admin routine

The champion must know how to answer:

- Which visits are scheduled today?
- Which caregiver is late?
- Which visit is missing a note?
- Which family raised a concern?
- Which visit requires review?

## Caregiver Training

Duration: 10 minutes maximum

Required flow:

1. Login
2. Open Today
3. Open assigned visit
4. Start Visit
5. Complete Checklist
6. Add Care Note
7. Report Incident if needed
8. End Visit

Say this clearly:

For the pilot, the required flow is simple: Start, Checklist, Note, End.

## Family Communication Approval

Get explicit agency approval before sending family updates.

Default message:

Hi [Family Member Name],

[Agency Name] is testing CareProof to help keep families better informed after care visits.

During the pilot, you may receive visit updates showing when a visit was completed and what care tasks were documented.

You may also submit a concern directly to the agency.

CareProof is not an emergency service. For emergencies, call 911 or your local emergency number.

## Controlled Test Visit

Use:

- 1 trained caregiver
- 1 pilot client
- 1 linked family contact
- short checklist only

Short checklist:

- Meal assistance
- Hydration
- Mobility support
- Companionship
- Safety check

## Test Workflow

1. Admin confirms visit exists
2. Caregiver logs in
3. Caregiver sees assigned visit only
4. Caregiver taps Start Visit
5. Caregiver completes checklist
6. Caregiver adds short care note
7. Caregiver optionally submits low-severity incident
8. Caregiver taps End Visit
9. Admin opens visit detail
10. Admin verifies proof timeline
11. Family update is generated
12. Family view is checked

## Severity Rules

Critical:

- wrong family sees update
- wrong client shown
- caregiver sees unassigned visit
- family sees raw incident or internal note
- login broken
- checkout impossible

High:

- checklist not saving
- care note not saving
- family update not generated
- admin timeline missing
- visit status wrong

Do not launch with critical or high unresolved issues.
