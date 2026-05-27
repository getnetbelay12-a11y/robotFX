# Operational Modules Data Shape Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the raw-cast data shape mismatch between the NestJS/Mongoose backend and the Next.js frontend for six operational modules: Nurse Approvals, Inspection Findings + Rules, Social Work Cases, Intake Records, Medical Availability, and Expiration Records.

**Architecture:** Create a raw-backend-types file matching actual Mongoose schema output, then a mappers file that translates raw → frontend DTO (filling UI-only fields with safe defaults). Update the API client functions to apply these mappers so callers always receive the correct frontend type. Each screen is updated to start from demo data as the initial state and replace with backend data on successful fetch. Action buttons (approve, escalate, etc.) are updated to use the server response to update displayed state.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest (added for web app unit tests), existing NestJS backend schemas.

---

## File Map

| File | Create / Modify | Purpose |
|---|---|---|
| `apps/web/src/lib/api-types.ts` | Create | Raw backend response types matching Mongoose schemas exactly |
| `apps/web/src/lib/api-mappers.ts` | Create | 7 mapper functions: raw → frontend DTO |
| `apps/web/src/lib/__tests__/api-mappers.test.ts` | Create | Vitest unit tests for each mapper |
| `apps/web/vitest.config.ts` | Create | Vitest config for the web app |
| `apps/web/package.json` | Modify | Add vitest devDependency + test script |
| `apps/web/src/lib/api-client.ts` | Modify | Fix generic types, wire mappers into all 12 API functions |
| `apps/web/src/components/careproof-ui.tsx` | Modify | 6 screens: backend-first state + server-response action updates |

---

## Task 1: Create raw backend types

**Files:**
- Create: `apps/web/src/lib/api-types.ts`

- [ ] **Step 1: Write the file**

```typescript
// Raw shapes returned by the NestJS API — matches Mongoose schema fields.
// ObjectIds are serialised as strings by the JSON serialiser.
// All createdAt/updatedAt are ISO date strings from { timestamps: true }.

export type BackendNurseApproval = {
  _id: string;
  agencyId: string;
  visitId: string;
  caregiverId: string | null;
  clientName: string;
  caregiverName: string;
  visitDate: string;
  visitType: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'needs_clarification';
  nurseNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendInspectionFinding = {
  _id: string;
  agencyId: string;
  ruleId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'waived';
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendInspectionRule = {
  _id: string;
  agencyId: string;
  ruleCode: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackendSocialWorkCase = {
  _id: string;
  agencyId: string;
  clientName: string;
  clientId?: string;
  assignedWorker: string;
  category: 'housing' | 'benefits' | 'mental_health' | 'family' | 'legal' | 'other';
  status: 'active' | 'pending_review' | 'closed' | 'escalated';
  description?: string;
  nextFollowUp?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
};

export type BackendIntakeRecord = {
  _id: string;
  agencyId: string;
  clientName: string;
  agentName: string;
  stage: 'inquiry' | 'assessment' | 'authorization' | 'onboarding' | 'active';
  referralSource: string;
  primaryDiagnosis?: string;
  insuranceType?: string;
  startDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendMedicalAvailability = {
  _id: string;
  agencyId: string;
  clientName: string;
  clientId?: string;
  serviceType: string;
  status: 'confirmed' | 'pending' | 'unavailable' | 'on_hold';
  scheduledDate: string;
  providerName?: string;
  notes?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendExpirationRecord = {
  _id: string;
  agencyId: string;
  caregiverName: string;
  caregiverId?: string;
  documentType: string;
  expiryDate: string;
  status: 'current' | 'expiring_soon' | 'expired' | 'renewed';
  renewalSubmittedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors related to `api-types.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api-types.ts
git commit -m "feat(web): add raw backend API types for 6 operational modules"
```

---

## Task 2: Create mapper functions

**Files:**
- Create: `apps/web/src/lib/api-mappers.ts`

- [ ] **Step 1: Write the mappers file**

```typescript
import type {
  ApprovalStatus,
  ApprovalType,
  AvailabilityStatus,
  AvailabilityType,
  ExpirationRecord,
  ExpiryState,
  InspectionFinding,
  InspectionRule,
  InspectionSeverity,
  InspectionStatus,
  IntakeRecord,
  IntakeStage,
  MedicalAvailabilityRecord,
  NurseApproval,
  SocialWorkCase,
  SocialWorkCaseStatus,
  SocialWorkCaseType,
} from '../types/careproof';
import type {
  BackendExpirationRecord,
  BackendInspectionFinding,
  BackendInspectionRule,
  BackendIntakeRecord,
  BackendMedicalAvailability,
  BackendNurseApproval,
  BackendSocialWorkCase,
} from './api-types';

// ---------------------------------------------------------------------------
// Nurse Approvals
// ---------------------------------------------------------------------------

const NURSE_APPROVAL_STATUS: Record<BackendNurseApproval['status'], ApprovalStatus> = {
  pending_review: 'Nurse Review Required',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_clarification: 'Changes Requested',
};

function formatApiDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function mapNurseApproval(raw: BackendNurseApproval): NurseApproval {
  return {
    id: raw._id,
    clientId: raw.clientName, // used as display key; no clientId in backend schema
    visitId: raw.visitId,
    caregiverId: raw.caregiverId ?? undefined,
    assignedNurseId: raw.reviewedBy ?? '',
    approvalType: (raw.visitType as ApprovalType) ?? 'Care note approval',
    submittedTime: formatApiDate(raw.createdAt),
    priority: 'Medium',
    status: NURSE_APPROVAL_STATUS[raw.status] ?? 'Submitted',
    notesSubmitted: raw.nurseNotes ?? '',
    auditTrail: [],
    blocksFamilyVisibility: raw.status === 'pending_review',
  };
}

// ---------------------------------------------------------------------------
// Inspection Findings
// ---------------------------------------------------------------------------

const INSPECTION_SEVERITY: Record<BackendInspectionFinding['severity'], InspectionSeverity> = {
  critical: 'Critical',
  high: 'Warning',
  medium: 'Info',
  low: 'Info',
};

const INSPECTION_STATUS: Record<BackendInspectionFinding['status'], InspectionStatus> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  waived: 'Dismissed',
};

export function mapInspectionFinding(raw: BackendInspectionFinding): InspectionFinding {
  return {
    id: raw._id,
    ruleId: raw.ruleId,
    title: raw.title,
    severity: INSPECTION_SEVERITY[raw.severity] ?? 'Info',
    status: INSPECTION_STATUS[raw.status] ?? 'Open',
    relatedType: 'Visit',
    owner: raw.assignedTo ?? '',
    openedAt: formatApiDate(raw.createdAt),
    recommendedAction: raw.description ?? '',
    notificationDraft: '',
  };
}

// ---------------------------------------------------------------------------
// Inspection Rules
// ---------------------------------------------------------------------------

const RULE_SEVERITY: Record<BackendInspectionRule['severity'], InspectionSeverity> = {
  critical: 'Critical',
  high: 'Warning',
  medium: 'Info',
  low: 'Info',
};

export function mapInspectionRule(raw: BackendInspectionRule): InspectionRule {
  return {
    id: raw._id,
    category: raw.category,
    name: raw.ruleCode,
    severity: RULE_SEVERITY[raw.severity] ?? 'Info',
    description: raw.description,
    enabled: raw.active,
  };
}

// ---------------------------------------------------------------------------
// Social Work Cases
// ---------------------------------------------------------------------------

const SW_STATUS: Record<BackendSocialWorkCase['status'], SocialWorkCaseStatus> = {
  active: 'Assigned',
  pending_review: 'In Review',
  closed: 'Closed',
  escalated: 'Escalated',
};

const SW_CASE_TYPE: Record<BackendSocialWorkCase['category'], SocialWorkCaseType> = {
  housing: 'Housing/food insecurity note',
  benefits: 'Client isolation risk',
  mental_health: 'Behavioral concern',
  family: 'Family concern follow-up',
  legal: 'Abuse/neglect concern escalation',
  other: 'Transportation/support need',
};

export function mapSocialWorkCase(raw: BackendSocialWorkCase): SocialWorkCase {
  return {
    id: raw._id,
    clientId: raw.clientId ?? raw._id,
    assignedSocialWorkerId: raw.assignedWorker,
    source: '',
    caseType: SW_CASE_TYPE[raw.category] ?? 'Family concern follow-up',
    riskLevel: raw.priority === 'urgent' ? 'Critical' : raw.priority === 'high' ? 'High' : raw.priority === 'medium' ? 'Medium' : 'Low',
    status: SW_STATUS[raw.status] ?? 'New',
    nextFollowUpDate: raw.nextFollowUp ?? '',
    internalNotes: raw.description ? [raw.description] : [],
    escalationFlag: raw.status === 'escalated',
  };
}

// ---------------------------------------------------------------------------
// Intake Records
// ---------------------------------------------------------------------------

const INTAKE_STAGE: Record<BackendIntakeRecord['stage'], IntakeStage> = {
  inquiry: 'New Referral',
  assessment: 'Assessment Scheduled',
  authorization: 'Nurse Approval Required',
  onboarding: 'Ready for Scheduling',
  active: 'Active Client',
};

export function mapIntakeRecord(raw: BackendIntakeRecord): IntakeRecord {
  return {
    id: raw._id,
    prospectName: raw.clientName,
    referralSource: raw.referralSource,
    assignedAgentId: raw.agentName,
    branchId: raw.agencyId,
    stage: INTAKE_STAGE[raw.stage] ?? 'New Referral',
    priority: raw.priority === 'urgent' ? 'High' : raw.priority === 'high' ? 'High' : raw.priority === 'medium' ? 'Medium' : 'Low',
    requiredServices: [],
    payerType: raw.insuranceType ?? '',
    documentsStatus: 'Pending',
    nurseApprovalStatus: 'Draft',
    nextAction: raw.notes ?? '',
    lastContactDate: formatApiDate(raw.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Medical Availability
// ---------------------------------------------------------------------------

const AVAIL_STATUS: Record<BackendMedicalAvailability['status'], AvailabilityStatus> = {
  confirmed: 'Available',
  pending: 'Needs Confirmation',
  unavailable: 'Missing',
  on_hold: 'Limited',
};

export function mapMedicalAvailability(raw: BackendMedicalAvailability): MedicalAvailabilityRecord {
  return {
    id: raw._id,
    clientId: raw.clientId,
    type: (raw.serviceType as AvailabilityType) ?? 'Medical supplies',
    status: AVAIL_STATUS[raw.status] ?? 'Needs Confirmation',
    owner: raw.providerName ?? '',
    detail: raw.notes ?? '',
    nextAction: '',
    blocksVisit: raw.status === 'unavailable',
  };
}

// ---------------------------------------------------------------------------
// Expiration Records
// ---------------------------------------------------------------------------

const EXPIRY_STATE: Record<BackendExpirationRecord['status'], ExpiryState> = {
  current: 'Valid',
  expiring_soon: 'Expiring in 30 days',
  expired: 'Expired',
  renewed: 'Valid',
};

export function mapExpirationRecord(raw: BackendExpirationRecord): ExpirationRecord {
  return {
    id: raw._id,
    category: 'Caregiver',
    ownerId: raw.caregiverId,
    ownerName: raw.caregiverName,
    item: raw.documentType,
    expirationDate: raw.expiryDate,
    state: EXPIRY_STATE[raw.status] ?? 'Valid',
    responsibleOwner: '',
    renewalStatus: raw.renewalSubmittedAt ? 'Submitted' : 'Not started',
    blocksVisits: raw.status === 'expired',
    notificationDraft: '',
  };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api-mappers.ts
git commit -m "feat(web): add mapper functions for 6 operational modules"
```

---

## Task 3: Add Vitest and write mapper tests

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/__tests__/api-mappers.test.ts`

- [ ] **Step 1: Install vitest**

```bash
cd apps/web && pnpm add -D vitest
```

Expected: `node_modules/vitest` present, `package.json` has `"vitest"` in `devDependencies`.

- [ ] **Step 2: Add test script to `apps/web/package.json`**

Open `apps/web/package.json` and add `"test": "vitest run"` to the `"scripts"` object:

```json
{
  "scripts": {
    "dev": "sh -c 'next dev --port ${WEB_PORT:-3001}'",
    "build": "next build",
    "start": "sh -c 'next start --port ${WEB_PORT:-3001}'",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "smoke": "next build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create test directory and test file**

```bash
mkdir -p apps/web/src/lib/__tests__
```

- [ ] **Step 5: Write `apps/web/src/lib/__tests__/api-mappers.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  mapExpirationRecord,
  mapInspectionFinding,
  mapInspectionRule,
  mapIntakeRecord,
  mapMedicalAvailability,
  mapNurseApproval,
  mapSocialWorkCase,
} from '../api-mappers';
import type {
  BackendExpirationRecord,
  BackendInspectionFinding,
  BackendInspectionRule,
  BackendIntakeRecord,
  BackendMedicalAvailability,
  BackendNurseApproval,
  BackendSocialWorkCase,
} from '../api-types';

const NOW = '2026-05-26T10:00:00.000Z';

describe('mapNurseApproval', () => {
  const raw: BackendNurseApproval = {
    _id: 'na-1',
    agencyId: 'ag-1',
    visitId: 'v-1',
    caregiverId: 'cg-1',
    clientName: 'Maria Johnson',
    caregiverName: 'Ana Smith',
    visitDate: '2026-05-26',
    visitType: 'Care note approval',
    status: 'pending_review',
    nurseNotes: 'Mobility observation needs review.',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps status pending_review → Nurse Review Required', () => {
    expect(mapNurseApproval(raw).status).toBe('Nurse Review Required');
  });

  it('maps status approved → Approved', () => {
    expect(mapNurseApproval({ ...raw, status: 'approved' }).status).toBe('Approved');
  });

  it('maps status rejected → Rejected', () => {
    expect(mapNurseApproval({ ...raw, status: 'rejected' }).status).toBe('Rejected');
  });

  it('maps status needs_clarification → Changes Requested', () => {
    expect(mapNurseApproval({ ...raw, status: 'needs_clarification' }).status).toBe('Changes Requested');
  });

  it('sets blocksFamilyVisibility=true when pending_review', () => {
    expect(mapNurseApproval(raw).blocksFamilyVisibility).toBe(true);
  });

  it('sets blocksFamilyVisibility=false when approved', () => {
    expect(mapNurseApproval({ ...raw, status: 'approved' }).blocksFamilyVisibility).toBe(false);
  });

  it('uses _id as id', () => {
    expect(mapNurseApproval(raw).id).toBe('na-1');
  });

  it('maps notesSubmitted from nurseNotes', () => {
    expect(mapNurseApproval(raw).notesSubmitted).toBe('Mobility observation needs review.');
  });

  it('returns empty auditTrail array', () => {
    expect(mapNurseApproval(raw).auditTrail).toEqual([]);
  });
});

describe('mapInspectionFinding', () => {
  const raw: BackendInspectionFinding = {
    _id: 'if-1',
    agencyId: 'ag-1',
    ruleId: 'r-1',
    title: 'Checklist incomplete',
    severity: 'critical',
    status: 'open',
    description: 'One task not done.',
    assignedTo: 'Leah Morris',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps severity critical → Critical', () => {
    expect(mapInspectionFinding(raw).severity).toBe('Critical');
  });

  it('maps severity high → Warning', () => {
    expect(mapInspectionFinding({ ...raw, severity: 'high' }).severity).toBe('Warning');
  });

  it('maps severity medium → Info', () => {
    expect(mapInspectionFinding({ ...raw, severity: 'medium' }).severity).toBe('Info');
  });

  it('maps status open → Open', () => {
    expect(mapInspectionFinding(raw).status).toBe('Open');
  });

  it('maps status in_progress → In Progress', () => {
    expect(mapInspectionFinding({ ...raw, status: 'in_progress' }).status).toBe('In Progress');
  });

  it('maps status waived → Dismissed', () => {
    expect(mapInspectionFinding({ ...raw, status: 'waived' }).status).toBe('Dismissed');
  });

  it('maps description to recommendedAction', () => {
    expect(mapInspectionFinding(raw).recommendedAction).toBe('One task not done.');
  });
});

describe('mapInspectionRule', () => {
  const raw: BackendInspectionRule = {
    _id: 'r-1',
    agencyId: 'ag-1',
    ruleCode: 'MISSED_CHECKIN',
    description: 'No check-in found.',
    severity: 'critical',
    category: 'Visit proof',
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps ruleCode to name', () => {
    expect(mapInspectionRule(raw).name).toBe('MISSED_CHECKIN');
  });

  it('maps active to enabled', () => {
    expect(mapInspectionRule(raw).enabled).toBe(true);
    expect(mapInspectionRule({ ...raw, active: false }).enabled).toBe(false);
  });

  it('maps severity critical → Critical', () => {
    expect(mapInspectionRule(raw).severity).toBe('Critical');
  });
});

describe('mapSocialWorkCase', () => {
  const raw: BackendSocialWorkCase = {
    _id: 'sw-1',
    agencyId: 'ag-1',
    clientName: 'Maria Johnson',
    clientId: 'c-1',
    assignedWorker: 'user-social-worker',
    category: 'family',
    status: 'active',
    priority: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps status active → Assigned', () => {
    expect(mapSocialWorkCase(raw).status).toBe('Assigned');
  });

  it('maps status pending_review → In Review', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'pending_review' }).status).toBe('In Review');
  });

  it('maps status escalated → Escalated', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'escalated' }).status).toBe('Escalated');
  });

  it('maps category family → Family concern follow-up', () => {
    expect(mapSocialWorkCase(raw).caseType).toBe('Family concern follow-up');
  });

  it('maps priority high → High riskLevel', () => {
    expect(mapSocialWorkCase(raw).riskLevel).toBe('High');
  });

  it('sets escalationFlag=true when status=escalated', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'escalated' }).escalationFlag).toBe(true);
  });
});

describe('mapIntakeRecord', () => {
  const raw: BackendIntakeRecord = {
    _id: 'ir-1',
    agencyId: 'ag-1',
    clientName: 'Louise Grant',
    agentName: 'agent-1',
    stage: 'authorization',
    referralSource: 'Hospital',
    priority: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps stage authorization → Nurse Approval Required', () => {
    expect(mapIntakeRecord(raw).stage).toBe('Nurse Approval Required');
  });

  it('maps stage inquiry → New Referral', () => {
    expect(mapIntakeRecord({ ...raw, stage: 'inquiry' }).stage).toBe('New Referral');
  });

  it('maps stage active → Active Client', () => {
    expect(mapIntakeRecord({ ...raw, stage: 'active' }).stage).toBe('Active Client');
  });

  it('maps clientName to prospectName', () => {
    expect(mapIntakeRecord(raw).prospectName).toBe('Louise Grant');
  });

  it('maps agentName to assignedAgentId', () => {
    expect(mapIntakeRecord(raw).assignedAgentId).toBe('agent-1');
  });
});

describe('mapMedicalAvailability', () => {
  const raw: BackendMedicalAvailability = {
    _id: 'ma-1',
    agencyId: 'ag-1',
    clientName: 'Maria Johnson',
    clientId: 'c-1',
    serviceType: 'Medication availability',
    status: 'confirmed',
    scheduledDate: '2026-05-26',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps status confirmed → Available', () => {
    expect(mapMedicalAvailability(raw).status).toBe('Available');
  });

  it('maps status pending → Needs Confirmation', () => {
    expect(mapMedicalAvailability({ ...raw, status: 'pending' }).status).toBe('Needs Confirmation');
  });

  it('maps status unavailable → Missing + blocksVisit=true', () => {
    const result = mapMedicalAvailability({ ...raw, status: 'unavailable' });
    expect(result.status).toBe('Missing');
    expect(result.blocksVisit).toBe(true);
  });

  it('maps status on_hold → Limited', () => {
    expect(mapMedicalAvailability({ ...raw, status: 'on_hold' }).status).toBe('Limited');
  });
});

describe('mapExpirationRecord', () => {
  const raw: BackendExpirationRecord = {
    _id: 'er-1',
    agencyId: 'ag-1',
    caregiverName: 'Ana Smith',
    caregiverId: 'cg-1',
    documentType: 'CPR / First Aid',
    expiryDate: 'Jun 2, 2026',
    status: 'expiring_soon',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps status expiring_soon → Expiring in 30 days', () => {
    expect(mapExpirationRecord(raw).state).toBe('Expiring in 30 days');
  });

  it('maps status current → Valid', () => {
    expect(mapExpirationRecord({ ...raw, status: 'current' }).state).toBe('Valid');
  });

  it('maps status expired → Expired + blocksVisits=true', () => {
    const result = mapExpirationRecord({ ...raw, status: 'expired' });
    expect(result.state).toBe('Expired');
    expect(result.blocksVisits).toBe(true);
  });

  it('maps status renewed → Valid', () => {
    expect(mapExpirationRecord({ ...raw, status: 'renewed' }).state).toBe('Valid');
  });

  it('maps caregiverName to ownerName and documentType to item', () => {
    expect(mapExpirationRecord(raw).ownerName).toBe('Ana Smith');
    expect(mapExpirationRecord(raw).item).toBe('CPR / First Aid');
  });

  it('sets renewalStatus=Submitted when renewalSubmittedAt is present', () => {
    expect(mapExpirationRecord({ ...raw, renewalSubmittedAt: NOW }).renewalStatus).toBe('Submitted');
  });

  it('sets renewalStatus=Not started when renewalSubmittedAt absent', () => {
    expect(mapExpirationRecord(raw).renewalStatus).toBe('Not started');
  });
});
```

- [ ] **Step 6: Run the tests**

```bash
cd apps/web && pnpm test
```

Expected: All tests pass (`✓ 34 tests`).

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/lib/__tests__/api-mappers.test.ts
git commit -m "test(web): add vitest and mapper unit tests for 6 operational modules"
```

---

## Task 4: Wire mappers into the API client

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

The `callProtectedApi<T>` function casts the raw response to `T` without transformation. We keep the generic signature but correct it by calling mappers in each operational fetch function.

- [ ] **Step 1: Add mapper imports at the top of `api-client.ts`**

After the existing imports at the top of `apps/web/src/lib/api-client.ts`, add:

```typescript
import {
  mapExpirationRecord,
  mapInspectionFinding,
  mapInspectionRule,
  mapIntakeRecord,
  mapMedicalAvailability,
  mapNurseApproval,
  mapSocialWorkCase,
} from './api-mappers';
import type {
  BackendExpirationRecord,
  BackendInspectionFinding,
  BackendInspectionRule,
  BackendIntakeRecord,
  BackendMedicalAvailability,
  BackendNurseApproval,
  BackendSocialWorkCase,
} from './api-types';
```

- [ ] **Step 2: Update `fetchNurseApprovalsApi` and `decideNurseApprovalApi`**

Replace the existing implementations:

```typescript
export async function fetchNurseApprovalsApi(): Promise<NurseApproval[]> {
  const raw = await callProtectedApi<BackendNurseApproval[]>('owner', '/nurse-approvals');
  return raw.map(mapNurseApproval);
}

export async function decideNurseApprovalApi(
  id: string,
  decision: 'approved' | 'rejected' | 'needs_clarification',
  nurseNotes?: string,
): Promise<NurseApproval> {
  const raw = await callProtectedApi<BackendNurseApproval>('owner', `/nurse-approvals/${id}/decide`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, nurseNotes }),
  });
  return mapNurseApproval(raw);
}
```

- [ ] **Step 3: Update `fetchInspectionFindingsApi`, `fetchInspectionRulesApi`, and `updateFindingStatusApi`**

```typescript
export async function fetchInspectionRulesApi(): Promise<InspectionRule[]> {
  const raw = await callProtectedApi<BackendInspectionRule[]>('owner', '/inspection-findings/rules');
  return raw.map(mapInspectionRule);
}

export async function fetchInspectionFindingsApi(): Promise<InspectionFinding[]> {
  const raw = await callProtectedApi<BackendInspectionFinding[]>('owner', '/inspection-findings');
  return raw.map(mapInspectionFinding);
}

export async function updateFindingStatusApi(
  id: string,
  status: 'open' | 'in_progress' | 'resolved' | 'waived',
): Promise<InspectionFinding> {
  const raw = await callProtectedApi<BackendInspectionFinding>('owner', `/inspection-findings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapInspectionFinding(raw);
}
```

- [ ] **Step 4: Update `fetchSocialWorkCasesApi` and `updateSocialWorkCaseStatusApi`**

```typescript
export async function fetchSocialWorkCasesApi(): Promise<SocialWorkCase[]> {
  const raw = await callProtectedApi<BackendSocialWorkCase[]>('owner', '/social-work-cases');
  return raw.map(mapSocialWorkCase);
}

export async function updateSocialWorkCaseStatusApi(
  id: string,
  status: 'active' | 'pending_review' | 'closed' | 'escalated',
): Promise<SocialWorkCase> {
  const raw = await callProtectedApi<BackendSocialWorkCase>('owner', `/social-work-cases/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapSocialWorkCase(raw);
}
```

- [ ] **Step 5: Update `fetchIntakeRecordsApi` and `updateIntakeStageApi`**

```typescript
export async function fetchIntakeRecordsApi(): Promise<IntakeRecord[]> {
  const raw = await callProtectedApi<BackendIntakeRecord[]>('owner', '/intake-records');
  return raw.map(mapIntakeRecord);
}

export async function updateIntakeStageApi(id: string, stage: string): Promise<IntakeRecord> {
  const raw = await callProtectedApi<BackendIntakeRecord>('owner', `/intake-records/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });
  return mapIntakeRecord(raw);
}
```

- [ ] **Step 6: Update `fetchMedicalAvailabilityApi` and `updateMedicalAvailabilityStatusApi`**

```typescript
export async function fetchMedicalAvailabilityApi(): Promise<MedicalAvailabilityRecord[]> {
  const raw = await callProtectedApi<BackendMedicalAvailability[]>('owner', '/medical-availability');
  return raw.map(mapMedicalAvailability);
}

export async function updateMedicalAvailabilityStatusApi(
  id: string,
  status: 'confirmed' | 'pending' | 'unavailable' | 'on_hold',
): Promise<MedicalAvailabilityRecord> {
  const raw = await callProtectedApi<BackendMedicalAvailability>('owner', `/medical-availability/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapMedicalAvailability(raw);
}
```

- [ ] **Step 7: Update `fetchExpirationRecordsApi` and `updateRenewalStatusApi`**

```typescript
export async function fetchExpirationRecordsApi(): Promise<ExpirationRecord[]> {
  const raw = await callProtectedApi<BackendExpirationRecord[]>('owner', '/expiration-records');
  return raw.map(mapExpirationRecord);
}

export async function updateRenewalStatusApi(
  id: string,
  status: 'current' | 'expiring_soon' | 'expired' | 'renewed',
): Promise<ExpirationRecord> {
  const raw = await callProtectedApi<BackendExpirationRecord>('owner', `/expiration-records/${id}/renewal-status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapExpirationRecord(raw);
}
```

- [ ] **Step 8: Also add imports for the missing return types at the top of the file**

The existing imports from `'../types/careproof'` already include `InspectionFinding`, `InspectionRule`, `IntakeRecord`, `MedicalAvailabilityRecord`, `NurseApproval`, `SocialWorkCase`, `ExpirationRecord`. Verify they are all present.

- [ ] **Step 9: Verify types compile**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Run tests again to confirm mappers still pass**

```bash
cd apps/web && pnpm test
```

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "feat(web): wire backend type mappers into operational module API client functions"
```

---

## Task 5: Update NurseApprovalsScreen to use backend data

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (NurseApprovalsScreen, lines ~4840–4925)

The screen currently reads `nurseApprovals` (demo fixture) directly and uses `statusOverrides` for optimistic updates. After this task it will keep demo data as initial state, replace with backend data on load, and merge server responses on actions.

- [ ] **Step 1: Find the NurseApprovalsScreen component**

Locate the line reading `export function NurseApprovalsScreen()` in `careproof-ui.tsx`.

- [ ] **Step 2: Replace the component state setup**

Find and replace the existing `const [backendConnected, setBackendConnected] = useState(false);` block and surrounding state with:

```tsx
const [approvals, setApprovals] = useState(nurseApprovals);
const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
const [backendConnected, setBackendConnected] = useState(false);
const selected = approvals.find((item) => item.id === selectedId) ?? approvals[0];
const visibleStatus = (item: typeof approvals[number]) => statusOverrides[item.id] ?? item.status;
const pending = approvals.filter((item) => !['Approved', 'Rejected'].includes(visibleStatus(item))).length;
const blocked = approvals.filter((item) => item.blocksFamilyVisibility && !['Approved', 'Rejected'].includes(visibleStatus(item))).length;
const highPriority = approvals.filter((item) => ['High', 'Critical'].includes(item.priority)).length;
```

- [ ] **Step 3: Update the useEffect to set state from backend data**

Replace the existing `useEffect` block:

```tsx
useEffect(() => {
  fetchNurseApprovalsApi().then((data) => {
    setApprovals(data);
    setBackendConnected(true);
  }).catch(() => {});
}, []);
```

- [ ] **Step 4: Update the DataTable to use `approvals` state instead of imported constant**

Replace `rows={nurseApprovals.map(...)` with `rows={approvals.map(...)`.

Replace all other references to the imported `nurseApprovals` constant inside this component with `approvals`.

- [ ] **Step 5: Update action buttons to update state from server response**

Replace the Approve button's onClick:

```tsx
onClick={async () => {
  setStatusOverrides((current) => ({ ...current, [selected.id]: 'Approved' }));
  try {
    const updated = await decideNurseApprovalApi(selected.id, 'approved');
    setApprovals((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setStatusOverrides((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

Replace the Request Changes button's onClick:

```tsx
onClick={async () => {
  setStatusOverrides((current) => ({ ...current, [selected.id]: 'Changes Requested' }));
  try {
    const updated = await decideNurseApprovalApi(selected.id, 'needs_clarification');
    setApprovals((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setStatusOverrides((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

Replace the Reject button's onClick:

```tsx
onClick={async () => {
  setStatusOverrides((current) => ({ ...current, [selected.id]: 'Rejected' }));
  try {
    const updated = await decideNurseApprovalApi(selected.id, 'rejected');
    setApprovals((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setStatusOverrides((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

- [ ] **Step 6: Remove the `backendCount` state (it's replaced by the live record count)**

The banner now reads the length of the `approvals` state:

```tsx
{backendConnected && (
  <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
    Live backend connected · {approvals.length} records
  </div>
)}
```

- [ ] **Step 7: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat(web): NurseApprovalsScreen uses backend data with demo fallback"
```

---

## Task 6: Update InspectionCenterScreen to use backend data

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (InspectionCenterScreen, lines ~4927–4989)

- [ ] **Step 1: Replace state setup**

```tsx
const [findings, setFindings] = useState(inspectionFindings);
const [rules, setRules] = useState(inspectionRules);
const [statuses, setStatuses] = useState<Record<string, string>>({});
const [backendConnected, setBackendConnected] = useState(false);
const visibleStatus = (finding: typeof findings[number]) => statuses[finding.id] ?? finding.status;
const open = findings.filter((item) => !['Resolved', 'Dismissed'].includes(visibleStatus(item))).length;
const compliance = findings.filter((item) => item.severity === 'Compliance').length;
const critical = findings.filter((item) => item.severity === 'Critical').length;
```

- [ ] **Step 2: Update useEffect**

```tsx
useEffect(() => {
  Promise.all([fetchInspectionFindingsApi(), fetchInspectionRulesApi()])
    .then(([findingsData, rulesData]) => {
      setFindings(findingsData);
      setRules(rulesData);
      setBackendConnected(true);
    })
    .catch(() => {});
}, []);
```

- [ ] **Step 3: Update DataTable rows to use `findings` state**

Replace `inspectionFindings.map(...)` with `findings.map(...)`.
Replace `inspectionRules.find(...)` inside the rows with `rules.find(...)`.

- [ ] **Step 4: Update rules render to use `rules` state**

Replace `{inspectionRules.map((rule) =>` with `{rules.map((rule) =>`.

- [ ] **Step 5: Update action buttons to use server response**

Replace Acknowledge button onClick:

```tsx
onClick={async () => {
  setStatuses((current) => ({ ...current, [finding.id]: 'Acknowledged' }));
  try {
    const updated = await updateFindingStatusApi(finding.id, 'in_progress');
    setFindings((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    setStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

Replace Resolve button onClick:

```tsx
onClick={async () => {
  setStatuses((current) => ({ ...current, [finding.id]: 'Resolved' }));
  try {
    const updated = await updateFindingStatusApi(finding.id, 'resolved');
    setFindings((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    setStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

- [ ] **Step 6: Update the banner**

```tsx
{backendConnected && (
  <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
    Live backend connected · {findings.length} findings
  </div>
)}
```

- [ ] **Step 7: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat(web): InspectionCenterScreen uses backend data with demo fallback"
```

---

## Task 7: Update SocialWorkScreen to use backend data

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (SocialWorkScreen, lines ~4991–5035)

- [ ] **Step 1: Replace state setup**

```tsx
const [cases, setCases] = useState(socialWorkCases);
const [caseStatuses, setCaseStatuses] = useState<Record<string, string>>({});
const [backendConnected, setBackendConnected] = useState(false);
const visibleStatus = (item: typeof cases[number]) => caseStatuses[item.id] ?? item.status;
const open = cases.filter((item) => visibleStatus(item) !== 'Closed').length;
const highRisk = cases.filter((item) => ['High', 'Critical'].includes(item.riskLevel)).length;
const followUps = cases.filter((item) => item.nextFollowUpDate.includes('Today')).length;
```

- [ ] **Step 2: Update useEffect**

```tsx
useEffect(() => {
  fetchSocialWorkCasesApi().then((data) => {
    setCases(data);
    setBackendConnected(true);
  }).catch(() => {});
}, []);
```

- [ ] **Step 3: Update DataTable rows**

Replace `socialWorkCases.map(...)` with `cases.map(...)`.

- [ ] **Step 4: Update action buttons**

Replace Escalate onClick:

```tsx
onClick={async () => {
  setCaseStatuses((current) => ({ ...current, [item.id]: 'Escalated' }));
  try {
    const updated = await updateSocialWorkCaseStatusApi(item.id, 'escalated');
    setCases((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setCaseStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

Replace Close case onClick:

```tsx
onClick={async () => {
  setCaseStatuses((current) => ({ ...current, [item.id]: 'Closed' }));
  try {
    const updated = await updateSocialWorkCaseStatusApi(item.id, 'closed');
    setCases((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setCaseStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; });
  } catch {}
}}
```

- [ ] **Step 5: Update banner and stat for linked concerns**

```tsx
{backendConnected && (
  <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
    Live backend connected · {cases.length} records
  </div>
)}
```

Update the linked concerns stat to use `cases`:
```tsx
<StatCard label="Linked family concerns" value={cases.filter((item) => item.linkedConcernId).length} tone="info" />
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat(web): SocialWorkScreen uses backend data with demo fallback"
```

---

## Task 8: Update IntakeAgentsScreen to use backend data

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (IntakeAgentsScreen, lines ~5038–5098)

- [ ] **Step 1: Replace state setup**

```tsx
const [records, setRecords] = useState(intakeRecords);
const [backendConnected, setBackendConnected] = useState(false);
const stageCounts = records.reduce<Record<string, number>>((acc, item) => {
  acc[item.stage] = (acc[item.stage] ?? 0) + 1;
  return acc;
}, {});
const activeStages = Object.entries(stageCounts);
```

- [ ] **Step 2: Update useEffect**

```tsx
useEffect(() => {
  fetchIntakeRecordsApi().then((data) => {
    setRecords(data);
    setBackendConnected(true);
  }).catch(() => {});
}, []);
```

- [ ] **Step 3: Update all render references**

Replace `intakeRecords.filter(...)` and `intakeRecords.map(...)` with `records.filter(...)` and `records.map(...)`.

- [ ] **Step 4: Update banner**

```tsx
{backendConnected && (
  <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
    Live backend connected · {records.length} records
  </div>
)}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat(web): IntakeAgentsScreen uses backend data with demo fallback"
```

---

## Task 9: Update MedicalAvailabilityScreen to use backend data

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (MedicalAvailabilityScreen, lines ~5101–5140)

- [ ] **Step 1: Replace state setup**

```tsx
const [records, setRecords] = useState(medicalAvailabilityRecords);
const [backendConnected, setBackendConnected] = useState(false);
const blocked = records.filter((item) => item.blocksVisit).length;
const missing = records.filter((item) => ['Missing', 'Expired'].includes(item.status)).length;
const needsConfirmation = records.filter((item) => item.status === 'Needs Confirmation').length;
```

- [ ] **Step 2: Update useEffect**

```tsx
useEffect(() => {
  fetchMedicalAvailabilityApi().then((data) => {
    setRecords(data);
    setBackendConnected(true);
  }).catch(() => {});
}, []);
```

- [ ] **Step 3: Update DataTable rows**

Replace `medicalAvailabilityRecords.map(...)` with `records.map(...)`.

Replace the staff coverage stat:
```tsx
<StatCard label="Staff coverage gaps" value={records.filter((item) => item.type.includes('availability') || item.type === 'Backup caregiver').length} tone="info" />
```

- [ ] **Step 4: Update banner**

```tsx
{backendConnected && (
  <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
    Live backend connected · {records.length} records
  </div>
)}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat(web): MedicalAvailabilityScreen uses backend data with demo fallback"
```

---

## Task 10: Update ExpirationCenterScreen to use backend data

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (ExpirationCenterScreen, lines ~5142–5197)

- [ ] **Step 1: Replace state setup**

```tsx
const { showToast } = useDemoStore();
const [records, setRecords] = useState(expirationRecords);
const [backendConnected, setBackendConnected] = useState(false);
const expiring30 = records.filter((item) => item.state === 'Expiring in 30 days').length;
const expiring7 = records.filter((item) => item.state === 'Expiring in 7 days').length;
const blockers = records.filter((item) => item.blocksVisits || ['Expired', 'Missing', 'Blocker'].includes(item.state)).length;
```

- [ ] **Step 2: Update useEffect**

```tsx
useEffect(() => {
  fetchExpirationRecordsApi().then((data) => {
    setRecords(data);
    setBackendConnected(true);
  }).catch(() => {});
}, []);
```

- [ ] **Step 3: Update DataTable rows**

Replace `expirationRecords.map(...)` with `records.map(...)`.

Update Renewal action onClick to use server response:

```tsx
onClick={async () => {
  showToast('Renewal action recorded.');
  try {
    const updated = await updateRenewalStatusApi(item.id, 'renewed');
    setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  } catch {}
}}
```

- [ ] **Step 4: Update Notification drafts section**

Replace `expirationRecords.filter(...)` with `records.filter(...)`.

- [ ] **Step 5: Update Visits blocked stat**

```tsx
<StatCard label="Visits blocked" value={records.filter((item) => item.blocksVisits).length} tone="danger" />
```

- [ ] **Step 6: Update banner**

```tsx
{backendConnected && (
  <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
    Live backend connected · {records.length} records
  </div>
)}
```

- [ ] **Step 7: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat(web): ExpirationCenterScreen uses backend data with demo fallback"
```

---

## Task 11: Final quality checks

- [ ] **Step 1: Run lint**

```bash
cd /path/to/careproof && pnpm --filter ./apps/web lint
```

Expected: no lint errors.

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter ./apps/web typecheck
```

Expected: no type errors.

- [ ] **Step 3: Run mapper tests**

```bash
pnpm --filter ./apps/web test
```

Expected: all 34+ tests pass.

- [ ] **Step 4: Run build**

```bash
pnpm --filter ./apps/web build
```

Expected: build completes with no errors.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore(web): final cleanup after operational module data shape fix"
```

---

## Remaining mismatches (deferred to backend schema updates)

These are gaps where the frontend expects fields not stored in the backend schemas. They remain as demo-only defaults after this plan:

| Module | Frontend field | Reason deferred |
|---|---|---|
| Nurse Approvals | `clientId` (lookup) | Backend stores `clientName` only; lookup shows 'Client' fallback for backend records |
| Nurse Approvals | `auditTrail[]` | Not in schema; empty array default |
| Nurse Approvals | `priority` | Not in schema; defaults to 'Medium' |
| Inspection Findings | `relatedType`, `clientId`, `visitId`, `caregiverId` | Not in finding schema; defaults to 'Visit' relatedType |
| Inspection Findings | `recommendedAction`, `notificationDraft` | Not in schema; uses description as recommendedAction, empty draft |
| Social Work | `familyMemberId`, `source`, `lastContactDate` | Not in schema |
| Social Work | `familySafeResponse`, `linkedConcernId` | Not in schema |
| Intake | `branchId`, `requiredServices`, `documentsStatus`, `nurseApprovalStatus`, `nextAction`, `lastContactDate` | Not in schema |
| Medical Availability | `visitId`, `nextAction`, `detail` | Not in schema |
| Expiration | `category` (Agency/Nurse/Client) | Not in schema; defaults to 'Caregiver' |
| Expiration | `responsibleOwner`, `notificationDraft` | Not in schema |

To resolve these fully, add the missing fields to the backend Mongoose schemas and seed data.
