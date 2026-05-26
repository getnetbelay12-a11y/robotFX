# CareProof AI Architecture

## Purpose

CareProof uses AI only as an assistance layer inside the existing MVP workflow:

1. caregiver writes a note
2. CareProof cleans the note
3. CareProof generates a family-safe summary
4. agency sees proof, flags, digest, reports, and import suggestions

CareProof does not expose a generic chatbot.

## Backend module

Path:

- `apps/backend/src/modules/ai`

Key services:

- `AiService`
- `PromptGuardService`
- `AiAuditService`
- `FallbackAiProvider`
- `OpenAiProvider`

## Provider model

Provider selection is controlled by environment variables:

- `AI_ENABLED`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `AI_MODEL`

Rules:

- if `AI_ENABLED=false`, CareProof uses deterministic fallback only
- if `AI_PROVIDER=openai` but `OPENAI_API_KEY` is missing, CareProof uses fallback
- if OpenAI fails at runtime, CareProof falls back without breaking the workflow

## AI-assisted MVP-safe operations

- `NOTE_CLEANUP`
- `FAMILY_SUMMARY`
- `INCIDENT_CLASSIFICATION`
- `WEEKLY_REPORT_SUMMARY`
- `ADMIN_DIGEST`
- `IMPORT_SUGGESTION`

## Data flow

### Caregiver note

- raw note is stored unchanged
- AI/fallback generates:
  - `cleanText`
  - `familySafeText`
  - `language`
  - `riskFlags`
  - `aiAssisted`

### Checkout

- checkout uses documented tasks, note fields, and incident severity
- family summary is generated safely
- high-severity incidents force agency-review wording

### Incident classification

- caregiver/admin chosen severity remains authoritative
- AI adds suggestions only:
  - `suggestedType`
  - `suggestedSeverity`
  - `requiresReview`
  - `familySafeMessage`
  - `riskFlags`

### Dashboard

- `/api/dashboard/risk-flags`
- `/api/dashboard/ai-digest/today`

### Reports

- weekly reports keep deterministic structure
- AI adds `aiSummary`

### Imports

- invalid rows receive `suggestion`
- invalid rows are never auto-imported

## Observability

AI metadata is stored in `aiOperations`:

- `agencyId`
- `entityType`
- `entityId`
- `operationType`
- `provider`
- `model`
- `status`
- `errorCode`
- `inputTokens`
- `outputTokens`

Sensitive prompts and raw model responses are not stored.
