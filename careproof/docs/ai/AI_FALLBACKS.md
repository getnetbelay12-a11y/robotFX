# CareProof AI Fallbacks

## Why fallback exists

CareProof cannot let visit completion, family updates, reports, or imports fail because an external AI provider is unavailable.

## Fallback behavior

### Note cleanup

- normalize spacing and punctuation
- preserve raw note
- generate `cleanText`
- generate `familySafeText`
- detect language with simple heuristics
- extract rule-based risk flags

### Family summary

- deterministic summary from tasks plus safe note
- force agency-review wording for high-severity incidents

### Incident classification

- rule-based severity suggestions
- emergency keyword detection
- safe family message

### Weekly report summary

- deterministic family-safe summary from visit counts and notes

### Admin digest

- deterministic grouping into:
  - urgent
  - watch
  - routine

### Import suggestions

- field/message-based cleanup hints

## Failure handling

- if OpenAI is disabled, fallback is primary
- if OpenAI is enabled but unavailable, fallback is automatic
- fallback result is still audited in `aiOperations`
