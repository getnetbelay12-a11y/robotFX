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
    clientId: raw.clientName,
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

const INTAKE_STAGE: Record<BackendIntakeRecord['stage'], IntakeRecord['stage']> = {
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
    priority: raw.priority === 'urgent' || raw.priority === 'high' ? 'High' : raw.priority === 'medium' ? 'Medium' : 'Low',
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
