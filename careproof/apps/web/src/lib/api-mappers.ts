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
  MedicationRecord,
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
  BackendMedicationRecord,
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
    priority: raw.priority === 'critical' ? 'Critical' : raw.priority === 'high' ? 'High' : raw.priority === 'low' ? 'Low' : 'Medium',
    status: NURSE_APPROVAL_STATUS[raw.status] ?? 'Submitted',
    notesSubmitted: raw.nurseNotes ?? '',
    nurseComments: raw.status !== 'pending_review' ? (raw.nurseNotes ?? '') : undefined,
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
  compliance: 'Compliance',
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
    relatedType: raw.visitId ? 'Visit' : raw.clientId ? 'Client' : raw.caregiverId ? 'Caregiver' : 'Agency',
    clientId: raw.clientId,
    clientName: raw.clientName,
    visitId: raw.visitId,
    caregiverId: raw.caregiverId,
    caregiverName: raw.caregiverName,
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
  compliance: 'Compliance',
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
    clientId: raw.clientId ?? '',
    assignedSocialWorkerId: raw.assignedWorker,
    source: '',
    caseType: SW_CASE_TYPE[raw.category] ?? 'Family concern follow-up',
    riskLevel: raw.priority === 'urgent' ? 'Critical' : raw.priority === 'high' ? 'High' : raw.priority === 'medium' ? 'Medium' : 'Low',
    status: SW_STATUS[raw.status] ?? 'New',
    nextFollowUpDate: raw.nextFollowUp ?? '',
    internalNotes: raw.description ? [raw.description] : [],
    escalationFlag: raw.status === 'escalated',
    linkedConcernId: raw.linkedConcernId ?? undefined,
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
    branchId: raw.branchId ?? '',
    branchName: raw.branchName,
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
    clientName: raw.clientName,
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
  const isMedication = raw.documentType.toLowerCase().includes('medication');
  return {
    id: raw._id,
    category: isMedication ? 'Medication' : 'Caregiver',
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

// ---------------------------------------------------------------------------
// Medication Management
// ---------------------------------------------------------------------------

function dateOnly(value: string): string {
  return value.includes('T') ? value.slice(0, 10) : value;
}

function medicationBlocksVisit(raw: BackendMedicationRecord): boolean {
  return ['Low Stock', 'Missing', 'Expired', 'Order Expired', 'Needs Refill', 'Needs Nurse Review'].includes(raw.status);
}

function medicationNextAction(raw: BackendMedicationRecord): string {
  if (raw.status === 'Missing') return 'Locate medication or pause medication task before visit starts.';
  if (raw.status === 'Expired') return 'Remove expired medication and obtain valid replacement.';
  if (raw.status === 'Order Expired') return 'Obtain renewed order before medication-related task continues.';
  if (raw.status === 'Low Stock') return 'Create refill follow-up and confirm supply before next visit.';
  if (raw.status === 'Needs Refill') return 'Confirm refill order and pharmacy pickup plan.';
  if (raw.status === 'Needs Nurse Review' || raw.requiresNurseReview) return 'Route to nurse review before family visibility or task clearance.';
  if (raw.nextReconciliationDue <= new Date().toISOString().split('T')[0]) return 'Mark reconciled after medication list review.';
  return 'Continue monitoring availability, order validity, and reconciliation due date.';
}

export function mapMedicationRecord(raw: BackendMedicationRecord): MedicationRecord {
  return {
    id: raw._id,
    agencyId: raw.agencyId,
    branchId: raw.branchId,
    clientId: raw.clientId,
    clientName: raw.clientName,
    visitId: raw.visitId ?? undefined,
    carePlanId: raw.carePlanId ?? undefined,
    medicationName: raw.medicationName,
    genericName: raw.genericName,
    strength: raw.strength,
    form: raw.form,
    route: raw.route,
    dose: raw.dose,
    frequency: raw.frequency,
    purpose: raw.purpose,
    prescriberName: raw.prescriberName,
    pharmacyName: raw.pharmacyName,
    startDate: dateOnly(raw.startDate),
    stopDate: raw.stopDate ? dateOnly(raw.stopDate) : undefined,
    medicationExpiryDate: dateOnly(raw.medicationExpiryDate),
    orderExpiryDate: dateOnly(raw.orderExpiryDate),
    lastReconciledAt: dateOnly(raw.lastReconciledAt),
    nextReconciliationDue: dateOnly(raw.nextReconciliationDue),
    quantityAvailable: raw.quantityAvailable,
    minimumRequiredQuantity: raw.minimumRequiredQuantity,
    storageRequirement: raw.storageRequirement,
    isHighRisk: raw.isHighRisk,
    requiresNurseReview: raw.requiresNurseReview,
    nurseApprovalId: raw.nurseApprovalId ?? undefined,
    status: raw.status,
    notes: raw.notes,
    familyVisible: raw.familyVisible,
    nextAction: medicationNextAction(raw),
    blocksVisit: medicationBlocksVisit(raw),
  };
}

export function mapMedicationToExpirationRecord(record: MedicationRecord, kind: 'medication' | 'order' = 'medication'): ExpirationRecord {
  const expirationDate = kind === 'medication' ? record.medicationExpiryDate : record.orderExpiryDate;
  const today = new Date().toISOString().split('T')[0];
  const daysUntilExpiry = Math.ceil((new Date(`${expirationDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  const state: ExpiryState = daysUntilExpiry < 0 || record.status === 'Expired' || record.status === 'Order Expired'
    ? 'Expired'
    : daysUntilExpiry <= 7
      ? 'Expiring in 7 days'
      : daysUntilExpiry <= 30
        ? 'Expiring in 30 days'
        : 'Valid';
  return {
    id: `${record.id}-${kind}-expiry`,
    category: 'Medication',
    ownerId: record.clientId,
    ownerName: record.clientName ?? record.clientId,
    item: kind === 'medication' ? `${record.medicationName} medication expiry` : `${record.medicationName} order expiry`,
    expirationDate,
    state,
    responsibleOwner: record.requiresNurseReview || record.isHighRisk ? 'Nurse' : 'Coordinator',
    renewalStatus: state === 'Valid' ? 'Verified' : 'Not started',
    blocksVisits: state === 'Expired' || record.blocksVisit,
    notificationDraft: `${record.medicationName} ${kind === 'medication' ? 'medication' : 'order'} expiration requires human review before visit readiness is cleared.`,
  };
}
