import {
  fallbackFamilyUpdate,
  fallbackIncidentTriage,
  fallbackNextActions,
  fallbackRiskSignals,
  fallbackVisitSummary,
  fallbackWeeklyReport,
} from './demo-ai';
import type {
  CareNote,
  ChecklistItem,
  ExpirationRecord,
  InspectionFinding,
  InspectionRule,
  IntakeRecord,
  MedicalAvailabilityRecord,
  MedicationRecord,
  MedicationStatus,
  NurseApproval,
  SocialWorkCase,
  Visit,
} from '../types/careproof';
import {
  mapExpirationRecord,
  mapInspectionFinding,
  mapInspectionRule,
  mapIntakeRecord,
  mapMedicalAvailability,
  mapMedicationRecord,
  mapNurseApproval,
  mapSocialWorkCase,
} from './api-mappers';
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL
  ?? (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4000/api' : '/api');

export type DemoRequestPayload = {
  agencyName: string;
  contactName: string;
  email: string;
  phone: string;
  caregiverCount: string;
  challenge: string;
  message: string;
};

type DemoRole = 'owner' | 'caregiver';

type BackendVisitTask = {
  taskId: string;
  label: string;
  status: 'done' | 'skipped' | 'refused' | 'not_required' | 'pending';
  note?: string;
  skipReason?: string;
};

type BackendVisitClient = {
  firstName?: string;
  lastName?: string;
};

type BackendVisit = {
  _id?: string;
  id?: string;
  client?: BackendVisitClient;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  status?: string;
  tasks?: BackendVisitTask[];
  caregiverNote?: {
    rawText?: string;
    cleanText?: string;
    familySafeText?: string;
  };
  familySummary?: {
    text?: string;
    sentAt?: string | null;
  };
  events?: BackendVisitEvent[];
  auditLogs?: BackendAuditLog[];
};

type BackendVisitEvent = {
  type?: string;
  message?: string;
  createdAt?: string;
};

type BackendAuditLog = {
  action?: string;
  createdAt?: string;
};

type BackendVisitProof = {
  visit: BackendVisit;
  events: BackendVisitEvent[];
  auditLogs: BackendAuditLog[];
};

export type SystemStatusPayload = {
  status: string;
  environment: string;
  demoMode: boolean;
  disableDemoReset?: boolean;
  appUrl?: string;
  apiBaseUrl?: string;
  database?: { status: string; engine?: string };
  notificationProviders?: { email: string; sms: string };
  ai?: { mode: string; provider?: string };
  storage?: { type: string; seedProtection?: string };
  version?: string;
  warnings?: string[];
  timestamp?: string;
};

export type GoLiveChecklistPayload = {
  summaryStatus: 'pass' | 'warning' | 'fail';
  items: Array<{ id: string; label: string; status: 'pass' | 'warning' | 'fail'; detail: string }>;
};

export type IntegrationCardPayload = {
  id: string;
  label: string;
  status: string;
  description: string;
  requiredConfig: string;
};

type VisitSummaryPayload = {
  visitId: string;
  careNote: string;
  checklist: Array<{ label: string; required: boolean; status?: string; completed?: boolean }>;
  incidentSeverities?: string[];
  visitStatus?: string;
};

type IncidentTriagePayload = {
  type: string;
  severity: string;
  description: string;
  clientName?: string;
};

type WeeklyReportDraftPayload = {
  clientId: string;
  clientName: string;
  weekPeriod: string;
  visits: Array<{ id: string; status: string; tasks: Array<{ label: string; required: boolean; status?: string; completed?: boolean }>; caregiverNote?: string; familySummary?: string }>;
  incidents?: string[];
  concerns?: string[];
};

type RiskSignalsPayload = {
  records: Array<{
    clientId: string;
    clientName?: string;
    caregiverId?: string;
    caregiverName?: string;
    lateVisits?: number;
    incompleteTasks?: number;
    concerns?: number;
    incidents?: number;
    missingNotes?: number;
    checkoutMissing?: number;
  }>;
};

type NextActionsPayload = {
  attentionQueue: Array<{
    id: string;
    type: string;
    trigger: string;
    recommendedAction: string;
    clientName?: string;
    caregiverName?: string;
  }>;
};

const demoAuthCache = new Map<DemoRole, string>();
const CANONICAL_DEMO_LOCATION = { lat: 38.9074, lng: -77.0371 };

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function demoLogin(role: DemoRole) {
  const cached = demoAuthCache.get(role);
  if (cached) return cached;
  const credentials =
    role === 'caregiver'
      ? { email: 'caregiver1@careproof.demo', password: 'Password123!' }
      : { email: 'owner@careproof.demo', password: 'Password123!' };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const body = (await response.json().catch(() => ({}))) as { accessToken?: string };
    if (response.ok && body.accessToken) {
      demoAuthCache.set(role, body.accessToken);
      return body.accessToken;
    }
    if (response.status !== 429 || attempt === 2) {
      throw new Error('Demo authentication failed.');
    }
    await wait(1250 * (attempt + 1));
  }

  throw new Error('Demo authentication failed.');
}

async function callProtectedApi<T>(role: DemoRole, path: string, init?: RequestInit): Promise<T> {
  const token = await demoLogin(role);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function callAiEndpoint<T, F>(role: DemoRole, path: string, payload: unknown, fallback: () => F): Promise<T | F> {
  try {
    const response = await callProtectedApi<T>(role, path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response;
  } catch {
    return fallback();
  }
}

function findCanonicalVisit(backendVisits: BackendVisit[], canonicalVisitId: string) {
  if (canonicalVisitId !== 'visit-maria-am') {
    return null;
  }
  const matches = backendVisits.filter((visit) => {
    const fullName = `${visit.client?.firstName ?? ''} ${visit.client?.lastName ?? ''}`.trim();
    const start = visit.scheduledStart ? new Date(visit.scheduledStart) : null;
    return fullName === 'Maria Johnson' && start && start.getHours() === 9;
  });
  return matches.find((visit) => visit.status === 'scheduled' && !visit.actualStart && !visit.actualEnd)
    ?? matches.find((visit) => !visit.actualEnd)
    ?? matches[0]
    ?? null;
}

function formatTime(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatProofTime(value?: string | null) {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function mapBackendStatus(status?: string): Visit['status'] {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'late':
      return 'Late';
    case 'missed':
      return 'Missed';
    case 'requires_review':
      return 'Needs Review';
    default:
      return 'Scheduled';
  }
}

function mapBackendTimingState(backendVisit: BackendVisit, previousVisit: Visit): Visit['timingState'] {
  if (backendVisit.actualEnd) return 'ended';
  if (backendVisit.actualStart) return 'current';
  switch (backendVisit.status) {
    case 'late':
      return 'late';
    case 'missed':
      return 'missed';
    default:
      return previousVisit.timingState;
  }
}

function mapBackendChecklist(tasks: BackendVisitTask[] | undefined, previousVisit: Visit): ChecklistItem[] {
  if (!tasks?.length) return previousVisit.checklist;
  return tasks.map((task) => ({
    id: task.taskId,
    label: task.label,
    completed: task.status === 'done',
    status: task.status === 'done' ? 'Completed' : task.status === 'pending' ? 'Pending' : 'Unable',
    unableReason: task.skipReason && ['Client declined', 'Safety concern', 'Not enough time', 'Supplies unavailable', 'Other'].includes(task.skipReason)
      ? task.skipReason as ChecklistItem['unableReason']
      : task.skipReason
        ? 'Other'
        : undefined,
    note: task.note,
  }));
}

export function mapBackendVisitToDemoVisit(previousVisit: Visit, backendVisit: BackendVisit): Partial<Visit> {
  const approvedSummary = backendVisit.familySummary?.text?.trim()
    ? backendVisit.familySummary.text.trim()
    : backendVisit.caregiverNote?.familySafeText?.trim()
      ? backendVisit.caregiverNote.familySafeText.trim()
      : previousVisit.careNote?.approvedSummary ?? '';
  const noteText = backendVisit.caregiverNote?.cleanText?.trim()
    ? backendVisit.caregiverNote.cleanText.trim()
    : backendVisit.caregiverNote?.rawText?.trim()
      ? backendVisit.caregiverNote.rawText.trim()
      : previousVisit.careNote?.text ?? '';
  const careNote: CareNote | undefined = noteText || approvedSummary
    ? {
        id: previousVisit.careNote?.id ?? `note-${previousVisit.id}`,
        text: noteText,
        createdAt: previousVisit.careNote?.createdAt ?? 'Now',
        approvedSummary,
      }
    : previousVisit.careNote;

  const familyUpdateStatus: Visit['familyUpdateStatus'] = backendVisit.familySummary?.sentAt
    ? 'Sent'
    : approvedSummary
      ? 'Ready'
      : 'Pending';

  return {
    checklist: mapBackendChecklist(backendVisit.tasks, previousVisit),
    checkInTime: formatTime(backendVisit.actualStart) ?? previousVisit.checkInTime,
    checkOutTime: formatTime(backendVisit.actualEnd) ?? previousVisit.checkOutTime,
    timingState: mapBackendTimingState(backendVisit, previousVisit),
    status: mapBackendStatus(backendVisit.status),
    careNote,
    familyUpdateStatus,
    events: backendVisit.events?.length
      ? backendVisit.events.map((event, index) => ({
          id: `backend-event-${index}-${event.type ?? 'event'}`,
          label: event.message ?? event.type ?? 'Visit event recorded',
          time: formatProofTime(event.createdAt),
          actor: event.type?.startsWith('TASK') || event.type === 'CHECK_IN' || event.type === 'CHECK_OUT' || event.type === 'NOTE_ADDED'
            ? 'Ana Smith'
            : 'CareProof',
        }))
      : previousVisit.events,
    auditLogs: backendVisit.auditLogs?.length
      ? backendVisit.auditLogs.map((auditLog, index) => ({
          id: `backend-audit-${index}-${auditLog.action ?? 'audit'}`,
          action: auditLog.action ?? 'Visit proof updated',
          time: formatProofTime(auditLog.createdAt),
          actor: auditLog.action?.startsWith('TASK') || auditLog.action === 'CHECK_IN' || auditLog.action === 'CHECK_OUT' || auditLog.action === 'NOTE_ADDED'
            ? 'Ana Smith'
            : 'CareProof',
        }))
      : previousVisit.auditLogs,
  };
}

function mergeProofIntoVisit(proof: BackendVisitProof): BackendVisit {
  return {
    ...proof.visit,
    events: proof.events,
    auditLogs: proof.auditLogs,
  };
}

export async function loadCanonicalDemoVisitApi(canonicalVisitId: string, previousVisit: Visit, role: DemoRole = 'owner') {
  const backendVisits = await callProtectedApi<BackendVisit[]>(role, '/visits');
  const match = findCanonicalVisit(backendVisits, canonicalVisitId);
  if (!match) {
    throw new Error('Canonical demo visit could not be resolved.');
  }
  const resolvedId = match.id ?? match._id;
  if (!resolvedId) {
    throw new Error('Canonical demo visit is missing an API identifier.');
  }
  const proof = await callProtectedApi<BackendVisitProof>(role, `/visits/${resolvedId}/proof`);
  return {
    backendVisitId: resolvedId,
    visitPatch: mapBackendVisitToDemoVisit(previousVisit, mergeProofIntoVisit(proof)),
  };
}

async function loadVisitProofPatch(role: DemoRole, backendVisitId: string, previousVisit: Visit) {
  const proof = await callProtectedApi<BackendVisitProof>(role, `/visits/${backendVisitId}/proof`);
  return mapBackendVisitToDemoVisit(previousVisit, mergeProofIntoVisit(proof));
}

export async function checkInCanonicalDemoVisitApi(backendVisitId: string, previousVisit: Visit) {
  const visit = await callProtectedApi<BackendVisit>('caregiver', `/visits/${backendVisitId}/check-in`, {
    method: 'POST',
    body: JSON.stringify({ ...CANONICAL_DEMO_LOCATION, deviceId: 'careproof-demo-ios' }),
  });
  void visit;
  return loadVisitProofPatch('caregiver', backendVisitId, previousVisit);
}

export async function completeCanonicalDemoTaskApi(backendVisitId: string, previousVisit: Visit, taskId: string, note?: string) {
  const visit = await callProtectedApi<BackendVisit>('caregiver', `/visits/${backendVisitId}/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  void visit;
  return loadVisitProofPatch('caregiver', backendVisitId, previousVisit);
}

export async function skipCanonicalDemoTaskApi(backendVisitId: string, previousVisit: Visit, taskId: string, reason: string) {
  const visit = await callProtectedApi<BackendVisit>('caregiver', `/visits/${backendVisitId}/tasks/${taskId}/skip`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  void visit;
  return loadVisitProofPatch('caregiver', backendVisitId, previousVisit);
}

export async function saveCanonicalDemoVisitNoteApi(backendVisitId: string, previousVisit: Visit, rawText: string, cleanText?: string) {
  const visit = await callProtectedApi<BackendVisit>('caregiver', `/visits/${backendVisitId}/note`, {
    method: 'POST',
    body: JSON.stringify({ rawText, cleanText }),
  });
  void visit;
  return loadVisitProofPatch('caregiver', backendVisitId, previousVisit);
}

export async function checkOutCanonicalDemoVisitApi(backendVisitId: string, previousVisit: Visit) {
  const visit = await callProtectedApi<BackendVisit>('caregiver', `/visits/${backendVisitId}/check-out`, {
    method: 'POST',
    body: JSON.stringify({ ...CANONICAL_DEMO_LOCATION, approvedForFamily: true }),
  });
  void visit;
  return loadVisitProofPatch('caregiver', backendVisitId, previousVisit);
}

export async function submitDemoRequestApi(payload: DemoRequestPayload) {
  const response = await fetch(`${API_BASE_URL}/demo-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agencyName: payload.agencyName,
      contactName: payload.contactName,
      email: payload.email,
      phone: payload.phone,
      caregiverCount: payload.caregiverCount,
      mainChallenge: payload.challenge,
      message: payload.message,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    errors?: Record<string, string>;
  };

  if (!response.ok) {
    return {
      ok: false,
      message: body.message ?? 'Demo request could not be submitted.',
      errors: body.errors ?? {},
    };
  }

  return {
    ok: true,
    message: body.message ?? 'Demo request received. We will contact you with a CareProof walkthrough.',
  };
}

export async function generateVisitSummaryApi(payload: VisitSummaryPayload) {
  return callAiEndpoint('owner', '/ai/visit-summary', {
    ...payload,
    checklist: payload.checklist.map((item) => ({
      label: item.label,
      required: item.required,
      status: item.status ?? (item.completed ? 'done' : 'pending'),
    })),
  }, () => fallbackVisitSummary(payload));
}

export async function generateFamilyUpdateDraftApi(payload: VisitSummaryPayload) {
  return callAiEndpoint('owner', '/ai/family-update-draft', {
    ...payload,
    checklist: payload.checklist.map((item) => ({
      label: item.label,
      required: item.required,
      status: item.status ?? (item.completed ? 'done' : 'pending'),
    })),
  }, () => fallbackFamilyUpdate(payload));
}

export async function cleanupCaregiverNoteApi(payload: VisitSummaryPayload) {
  return callAiEndpoint('caregiver', '/ai/note-cleanup', {
    ...payload,
    checklist: payload.checklist.map((item) => ({
      label: item.label,
      required: item.required,
      status: item.status ?? (item.completed ? 'done' : 'pending'),
    })),
  }, () => {
    const summary = fallbackVisitSummary(payload);
    return {
      polishedNote: summary.internalSummary,
      familySummaryPreview: summary.familySafeSummary,
      reviewRequired: summary.requiresReview,
      warnings: summary.riskFlags,
      label: 'Demo AI draft generated',
    };
  });
}

export async function generateIncidentTriageApi(payload: IncidentTriagePayload) {
  return callAiEndpoint('owner', '/ai/incident-triage', payload, () => fallbackIncidentTriage(payload));
}

export async function generateWeeklyReportDraftApi(payload: WeeklyReportDraftPayload) {
  return callAiEndpoint('owner', '/ai/weekly-report-draft', {
    ...payload,
    visits: payload.visits.map((visit) => ({
      ...visit,
      tasks: visit.tasks.map((item) => ({
        label: item.label,
        required: item.required,
        status: item.status ?? (item.completed ? 'done' : 'pending'),
      })),
    })),
  }, () => fallbackWeeklyReport(payload));
}

export async function generateRiskSignalsApi(payload: RiskSignalsPayload) {
  return callAiEndpoint('owner', '/ai/risk-signals', payload, () => fallbackRiskSignals(payload));
}

export async function generateNextActionsApi(payload: NextActionsPayload) {
  return callAiEndpoint('owner', '/ai/next-actions', payload, () => fallbackNextActions(payload));
}

export async function getSystemStatusApi() {
  return callProtectedApi<SystemStatusPayload>('owner', '/system/status', { cache: 'no-store' });
}

export async function getGoLiveChecklistApi() {
  return callProtectedApi<GoLiveChecklistPayload>('owner', '/system/go-live-checklist', { cache: 'no-store' });
}

export async function getIntegrationsApi() {
  return callProtectedApi<IntegrationCardPayload[]>('owner', '/system/integrations', { cache: 'no-store' });
}

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

export async function fetchMedicationRecordsApi(): Promise<MedicationRecord[]> {
  const raw = await callProtectedApi<BackendMedicationRecord[]>('owner', '/medications');
  return raw.map(mapMedicationRecord);
}

export async function updateMedicationStatusApi(
  id: string,
  status: MedicationStatus,
  notes?: string,
): Promise<MedicationRecord> {
  const raw = await callProtectedApi<BackendMedicationRecord>('owner', `/medications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
  return mapMedicationRecord(raw);
}

export async function reconcileMedicationApi(
  id: string,
  nextReconciliationDue: string,
  notes?: string,
): Promise<MedicationRecord> {
  const raw = await callProtectedApi<BackendMedicationRecord>('owner', `/medications/${id}/reconcile`, {
    method: 'PATCH',
    body: JSON.stringify({ nextReconciliationDue, notes }),
  });
  return mapMedicationRecord(raw);
}

export async function updateMedicationQuantityApi(
  id: string,
  quantityAvailable: number,
  notes?: string,
): Promise<MedicationRecord> {
  const raw = await callProtectedApi<BackendMedicationRecord>('owner', `/medications/${id}/quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ quantityAvailable, notes }),
  });
  return mapMedicationRecord(raw);
}

export async function requestMedicationNurseReviewApi(id: string, notes?: string): Promise<MedicationRecord> {
  const raw = await callProtectedApi<BackendMedicationRecord>('owner', `/medications/${id}/nurse-review`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
  return mapMedicationRecord(raw);
}
