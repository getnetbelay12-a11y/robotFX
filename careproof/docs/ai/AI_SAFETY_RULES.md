# CareProof AI Safety Rules

## Hard rules

AI in CareProof may:

- summarize
- rewrite
- translate
- classify
- flag

AI in CareProof may not:

- diagnose
- prescribe
- recommend medication
- recommend treatment
- invent undocumented care facts
- make emergency decisions
- expose internal admin notes to families
- expose raw high-severity incident details to families

## Family-safe wording

Family-facing AI output must be:

- calm
- factual
- non-clinical
- limited to documented visit information

Required high-severity family wording:

`Today’s visit was completed and is being reviewed by the agency. The agency will follow up if needed.`

Emergency disclaimer:

`CareProof is not an emergency service. For emergencies, call 911.`

## Review policy

- caregiver-selected high/emergency severity is never downgraded by AI
- AI incident classification is advisory only
- admin digest suggests operational follow-up only
- allowed admin actions:
  - `Review visit`
  - `Call caregiver`
  - `Follow up with family`
  - `Check missing note`
  - `Review incident`

## Logging policy

Do not store:

- API keys
- JWTs
- refresh tokens
- raw prompts containing sensitive care notes
- raw model responses containing sensitive care notes

Safe metadata only is stored in `aiOperations`.
