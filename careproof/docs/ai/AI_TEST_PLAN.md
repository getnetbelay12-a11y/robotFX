# CareProof AI Test Plan

## Unit coverage

- fallback provider returns deterministic note cleanup
- `AiService` does not call OpenAI when `AI_ENABLED=false`
- `AiService` falls back if OpenAI throws

## Backend integration coverage

- caregiver note keeps:
  - raw text
  - cleaned text
  - family-safe text
  - risk flags
- checkout still completes when AI uses fallback
- high-severity incident family summary stays sanitized
- weekly report generation includes AI summary
- import validation includes suggestions
- admin-only AI digest route is protected

## Smoke coverage

`scripts/smoke/full-e2e-smoke.mjs` verifies:

- health
- readiness
- auth
- caregiver workflow
- family-safe feed
- reports
- imports
- role security
- audit and notification evidence

## Manual review points

- verify AI wording is calm and non-clinical
- verify admin sees AI-assisted labels but family does not
- verify no raw high-severity incident description appears in family surfaces
