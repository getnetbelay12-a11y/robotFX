# CareProof Pilot Risk Register

## Product Risks

- Admin pages still contain some fallback/mock sections outside the core workflow.
- Mobile reliability depends on continued live-backend verification, not just UI completion.
- Family report shaping must stay sanitized as report formats evolve.

## Security Risks

- Cross-agency exposure remains the highest-risk defect category.
- Logging regressions could leak sensitive operational detail if not reviewed.
- New endpoints must keep `agencyId` filtering by default.

## Operational Risks

- Backup strategy is only real after a tested restore drill.
- Notification providers are still placeholder-grade until real delivery services are wired.
- Pilot support load may be high if onboarding data is poor.

## Business Risks

- Demo story may be stronger than current live admin wiring in some secondary screens.
- Agencies may like the concept but still resist pilot behavior change.
- If pilots do not reduce update calls or increase trust, willingness to pay will stay weak.
