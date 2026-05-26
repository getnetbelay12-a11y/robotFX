# CareProof Data Model Summary

## Agency

- Purpose: Top-level tenant for all operational data
- Important fields: `id`, `name`, counts, setup state
- Relationships: branches, users, clients, caregivers, visits, incidents, concerns, reports
- Scoping: all records should be agency-scoped

## Branch

- Purpose: Optional multi-location grouping
- Important fields: `id`, `agencyId`, `name`, `managerId`, `timezone`, `active`
- Relationships: users, clients, caregivers, visits, incidents, concerns, reports
- Scoping: branch data remains inside agency scope

## User

- Purpose: Agency-side and family-side identity
- Important fields: `id`, `agencyId`, `role`, `status`, `email`, `phone`
- Relationships: branch, client links, audit actions
- Scoping: agency-scoped
- Family visibility notes: family users should only access approved client-facing records

## Client

- Purpose: Person receiving care
- Important fields: `id`, `agencyId`, `branchId`, `name`, address, risk flags, care plan, assigned caregiver
- Relationships: family members, care plan, visits, incidents, reports
- Scoping: agency and optional branch scope
- Family visibility notes: client profile should expose only approved family-facing content

## FamilyMember

- Purpose: Family portal access and communication targets
- Important fields: `id`, `agencyId`, `clientId`, `name`, `relationship`, contact info, portal/report permissions
- Relationships: client, concerns, notifications
- Scoping: agency + client scope
- Family visibility notes: sees approved summaries and sent/ready reports only

## Caregiver

- Purpose: Assigned field staff
- Important fields: `id`, `agencyId`, `branchId`, name, availability, skills, assigned clients, operational metrics
- Relationships: visits, incidents, support signals
- Scoping: agency + branch scope

## CarePlan

- Purpose: Visit structure and task expectations
- Important fields: `id`, `agencyId`, `clientId`, `name`, frequency, duration, task definitions, family visibility preferences
- Relationships: client, visits, care tasks
- Scoping: agency + client scope

## CareTask

- Purpose: Reusable task definition inside care plans
- Important fields: `id`, `taskName`, `required`, `familyVisible`, `noteRequired`, `order`
- Relationships: care plan, visit checklist items
- Scoping: inherited from care plan
- Family visibility notes: only family-visible tasks should appear in summaries

## Visit

- Purpose: Core proof-of-care record
- Important fields: `id`, `agencyId`, `branchId`, `clientId`, `caregiverId`, scheduled times, status, checklist, note, events, audit logs
- Relationships: client, caregiver, incident, weekly report, notifications
- Scoping: agency + branch scope
- Family visibility notes: families should see approved summaries, not internal-only notes

## VisitEvent

- Purpose: Human-readable timeline entry
- Important fields: `id`, `label`, `time`, `actor`
- Relationships: visit
- Scoping: inherited from visit

## ChecklistItem

- Purpose: Visit-level task completion record
- Important fields: `id`, `label`, `completed`, `status`, `unableReason`
- Relationships: visit, care task definition
- Scoping: inherited from visit
- Family visibility notes: only family-visible completed task summaries should flow outward

## CareNote

- Purpose: Caregiver documentation for a visit
- Important fields: `id`, `text`, `createdAt`, approved summary
- Relationships: visit
- Scoping: inherited from visit
- Family visibility notes: raw internal note should not auto-share

## Incident

- Purpose: Operational issue reported during or after a visit
- Important fields: `id`, `agencyId`, `branchId`, `visitId`, `clientId`, `caregiverId`, `severity`, `status`, internal/family communication notes
- Relationships: visit, client, caregiver, audit log
- Scoping: agency + branch scope
- Family visibility notes: only approved family-safe incident summaries should be shared

## FamilyConcern

- Purpose: Family-submitted follow-up request or concern
- Important fields: `id`, `agencyId`, `branchId`, `clientId`, `familyMemberId`, priority, status, internal note, family-facing response
- Relationships: client, family member, notifications
- Scoping: agency + client scope
- Family visibility notes: internal notes remain hidden

## WeeklyReport

- Purpose: Family-facing weekly summary
- Important fields: `id`, `agencyId`, `branchId`, `clientId`, period, status, summary, sent state
- Relationships: client, visits, incidents, concerns
- Scoping: agency + client scope
- Family visibility notes: visible only when approved and status allows

## Notification

- Purpose: In-app or provider-ready communication event
- Important fields: `id`, `agencyId`, recipient fields, channel, status, createdAt, sentAt
- Relationships: visits, incidents, concerns, reports
- Scoping: agency-scoped
- Family visibility notes: only recipient-safe records should surface in portal

## AuditLog

- Purpose: Human-readable proof of key system actions
- Important fields: `id`, `agencyId`, actor, action, entity type, entity id, metadata, createdAt
- Relationships: visit, incident, concern, report, exports, AI actions
- Scoping: agency-scoped
- Family visibility notes: internal only

## SupportTicket

- Purpose: Internal support and implementation follow-up
- Important fields: `id`, subject, category, priority, status, responses
- Relationships: optional client or visit
- Scoping: agency-scoped
- Family visibility notes: internal only

## Settings

- Purpose: Agency configuration for visit rules, family visibility, notifications, quality thresholds, and demo posture
- Important fields: profile, visit rules, notification preferences, family visibility, quality rules
- Relationships: affects status engine, reporting, system readiness
- Scoping: agency-scoped
