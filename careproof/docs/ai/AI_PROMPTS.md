# CareProof AI Prompts

## Prompt design principles

- only use documented facts already present in CareProof
- never ask the model to invent missing context
- constrain outputs to structured JSON
- prefer rewriting and summarization over open-ended reasoning
- keep family output non-clinical

## Note cleanup

Inputs:

- raw caregiver note
- task outcomes
- incident severities

Output:

- `cleanText`
- `familySafeText`
- `detectedLanguage`
- `riskFlags`

## Family summary

Inputs:

- completed tasks
- skipped tasks
- family-safe caregiver note
- incident severity presence

Output:

- short family-safe summary

## Incident classification

Inputs:

- type
- severity
- description
- actions taken

Output:

- suggested type
- suggested severity
- requires review
- family-safe message
- risk flags

## Weekly report summary

Inputs:

- visit counts
- visit summaries
- safe note text
- concern counts
- incident presence

Output:

- short family-safe weekly summary

## Admin digest

Inputs:

- today visits
- late or missed visits
- requires review visits
- open incidents
- open family concerns
- repeated risk flags
- low reliability caregivers

Output:

- `urgent`
- `watch`
- `routine`

## Import suggestions

Inputs:

- field
- row error message
- row data

Output:

- short cleanup suggestion only
