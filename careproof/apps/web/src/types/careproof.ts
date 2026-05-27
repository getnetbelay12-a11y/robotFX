export type VisitStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Late' | 'Missed' | 'Needs Review';
export type LiveVisitDisplayStatus = 'Upcoming' | 'Due Soon' | 'In Progress' | 'Completed' | 'Late' | 'Missed' | 'Checkout Missing' | 'Needs Review';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'New' | 'Reviewing' | 'Follow-up Assigned' | 'Family Updated' | 'Resolved' | 'Closed';
export type ConcernStatus = 'New' | 'Reviewing' | 'Follow-up Assigned' | 'Responded' | 'Resolved' | 'Closed';

export interface Agency {
  id: string;
  name: string;
  branchCount: number;
  caregiverCount: number;
  clientCount: number;
  mainOfficePhone?: string;
  email?: string;
  addressLine?: string;
  timezone?: string;
  operatingDays?: string[];
  defaultVisitGracePeriodMinutes?: number;
}

export interface Branch {
  id: string;
  agencyId: string;
  name: string;
  address: string;
  phone: string;
  managerId: string;
  timezone: string;
  active: boolean;
}

export interface User {
  id: string;
  name: string;
  role: 'Owner' | 'Admin' | 'Coordinator' | 'Nurse' | 'Social Worker' | 'Intake Agent' | 'Caregiver' | 'Family';
  email: string;
  phone?: string;
  status?: 'Active' | 'Inactive' | 'Invited';
  lastActive?: string;
  linkedClientIds?: string[];
}

export interface FamilyMember {
  id: string;
  clientId?: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  portalAccessEnabled?: boolean;
  notificationPreference?: 'Email' | 'SMS' | 'Both';
  weeklyReportsEnabled?: boolean;
  canSubmitConcerns?: boolean;
}

export interface Caregiver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  branchId?: string;
  assignedVisits: number;
  completedVisits: number;
  onTimeRate: number;
  openIssues: number;
  availability?: string;
  skills?: string[];
  assignedClientIds?: string[];
  status?: 'Active' | 'Inactive' | 'Invited';
}

export interface CarePlanTaskDefinition {
  id: string;
  taskName: string;
  required: boolean;
  familyVisible: boolean;
  noteRequired: boolean;
  order: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  status?: 'Pending' | 'Completed' | 'Unable';
  unableReason?: 'Client declined' | 'Safety concern' | 'Not enough time' | 'Supplies unavailable' | 'Other';
  note?: string;
}

export interface CareNote {
  id: string;
  text: string;
  createdAt: string;
  approvedSummary: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  audience: 'Agency' | 'Caregiver' | 'Family';
  type?: 'late_visit' | 'missed_visit' | 'incident_reported' | 'family_concern_submitted' | 'weekly_report_ready' | 'visit_completed' | 'caregiver_checked_in' | 'checkout_missing' | 'nurse_approval_needed' | 'inspection_finding_opened' | 'expiring_document' | 'medical_availability_missing' | 'social_work_follow_up_due' | 'billing_documentation_incomplete';
  status?: 'Unread' | 'Read' | 'Action Required' | 'Sent' | 'Failed' | 'Demo Only';
  entityId?: string;
  entityRoute?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  deliveryChannel?: 'In-app' | 'Email draft' | 'SMS draft' | 'Telegram draft';
  recommendedAction?: string;
}

export interface VisitEvent {
  id: string;
  label: string;
  time: string;
  actor: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  time: string;
}

export interface Incident {
  id: string;
  branchId?: string;
  type: string;
  clientId: string;
  caregiverId: string;
  visitId?: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  createdAt: string;
  assignedTo: string;
  dueAt?: string;
  description: string;
  immediateActionTaken?: string;
  familyCommunicationStatus: string;
  followUpAction: string;
  internalNotes?: string[];
  familyUpdateDraft?: string;
  resolutionNotes?: string;
  auditTimeline?: Array<{ label: string; time: string; actor?: string }>;
}

export interface FamilyConcern {
  id: string;
  branchId?: string;
  familyMemberId: string;
  clientId: string;
  type: string;
  message: string;
  priority: 'Low' | 'Medium' | 'High';
  status: ConcernStatus;
  assignedOwner: string;
  responseDue: string;
  responseNote?: string;
  responseSent?: boolean;
  internalNotes?: string[];
  familyResponseDraft?: string;
}

export interface WeeklyReport {
  id: string;
  branchId?: string;
  clientId: string;
  period: string;
  completedVisits: number;
  notesIncluded: number;
  lateOrMissedVisits: number;
  checklistCompletionRate: string;
  incidentsSummary: string;
  followUpActions: string;
  status: 'Draft' | 'Ready' | 'Sent';
  summary: string;
}

export interface CarePlan {
  id: string;
  clientId: string;
  name?: string;
  visitFrequency: string;
  visitDuration?: string;
  careGoals?: string[];
  tasks: string[];
  taskDefinitions?: CarePlanTaskDefinition[];
  specialInstructions: string[];
  familyFacingInstructions?: string[];
  riskNotes: string[];
  familyCommunicationPreferences: string[];
  status: 'Active' | 'Review Needed';
}

export interface Client {
  id: string;
  name: string;
  branchId?: string;
  dateOfBirth?: string;
  address: string;
  phone?: string;
  emergencyContact?: string;
  assignedCaregiverId: string;
  carePlanId: string;
  upcomingVisitId: string;
  familyContactIds: string[];
  riskFlags: string[];
  notesSummary: string;
  familyPortalAccessEnabled?: boolean;
  carePreferences?: string[];
  communicationPreference?: string;
}

export interface Visit {
  id: string;
  branchId?: string;
  clientId: string;
  caregiverId: string;
  scheduledTime: string;
  scheduledDay: 'Today' | 'Yesterday' | 'This Week';
  startLabel: string;
  endLabel: string;
  timingState: 'upcoming' | 'current' | 'late' | 'missed' | 'ended';
  checkInTime?: string;
  checkOutTime?: string;
  status: VisitStatus;
  checklist: ChecklistItem[];
  careNote?: CareNote;
  incidentId?: string;
  familyUpdateStatus: 'Pending' | 'Ready' | 'Sent';
  familyUpdateEnabled?: boolean;
  caregiverInstructions?: string;
  overrideReason?: string;
  events: VisitEvent[];
  auditLogs: AuditLog[];
}

export interface DemoRequest {
  id: string;
  agencyName: string;
  contactName: string;
  email: string;
  phone: string;
  caregiverCount: string;
  challenge: string;
  message: string;
  createdAt: string;
}

export interface VisitRules {
  lateVisitGracePeriodMinutes: number;
  missedVisitThresholdMinutes: number;
  checkoutMissingThresholdMinutes: number;
  highUrgencyConcernResponseSlaHours?: number;
  criticalIncidentResponseSlaMinutes?: number;
  requireNoteBeforeCheckout: boolean;
  requireChecklistCompletionBeforeCheckout: boolean;
  allowCaregiverOverrideWithReason?: boolean;
  familyUpdateAfterCheckout?: boolean;
}

export interface NotificationPreferences {
  notifyCoordinatorForLateVisits: boolean;
  notifyCoordinatorForIncidents: boolean;
  notifyFamilyWhenVisitCompleted: boolean;
  notifyFamilyWhenWeeklyReportReady: boolean;
}

export interface FamilyVisibilitySettings {
  showVisitStartCompletion: boolean;
  showCompletedTaskSummary: boolean;
  showCareNotesOnlyAfterApproval: boolean;
  showIncidentsOnlyIfApproved: boolean;
}

export interface AgencySettings {
  profile: Agency;
  visitRules: VisitRules;
  notificationPreferences: NotificationPreferences;
  familyVisibility: FamilyVisibilitySettings;
  demoModeRoleSwitcherEnabled: boolean;
  weeklyReportTemplateReady: boolean;
  qualityRules?: QualityRules;
}

export interface OnboardingTeamInvite {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: User['role'];
}

export interface OnboardingClientDraft {
  id: string;
  clientName: string;
  dateOfBirth?: string;
  primaryAddress: string;
  primaryFamilyContact: string;
  phone: string;
  email: string;
  careRiskNotes?: string;
}

export interface OnboardingCaregiverDraft {
  id: string;
  caregiverName: string;
  phone: string;
  email: string;
  availability: string;
  skillsTags: string;
  assignedClients?: string[];
}

export interface CarePlanTemplateDraft {
  id: string;
  carePlanName: string;
  clientId?: string;
  visitFrequency: string;
  defaultChecklistTasks: string[];
  specialInstructions: string;
  familyVisibilityPreference: string;
}

export interface ScheduledVisitDraft {
  id: string;
  clientId: string;
  caregiverId: string;
  dateTime: string;
  carePlanId: string;
  repeatSchedule?: 'None' | 'Daily' | 'Weekly' | 'Weekdays';
}

export interface OnboardingDraft {
  agencyProfile: Agency;
  team: OnboardingTeamInvite[];
  clients: OnboardingClientDraft[];
  caregivers: OnboardingCaregiverDraft[];
  carePlanTemplates: CarePlanTemplateDraft[];
  scheduledVisits: ScheduledVisitDraft[];
  completedAt?: string | null;
}

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface PilotReadiness {
  score: number;
  status: 'Not Ready' | 'Almost Ready' | 'Pilot Ready';
  recommendations: string[];
}

export interface ScheduleConflict {
  type: 'caregiver_overlap' | 'client_overlap' | 'invalid_time' | 'caregiver_unavailable' | 'outside_operating_days' | 'missing_care_plan' | 'missing_family_contact';
  message: string;
  conflictingVisitId?: string;
}

export interface ImportRowPreview {
  rowNumber: number;
  values: Record<string, string>;
  valid: boolean;
  errors: string[];
}

export interface ImportJob {
  id: string;
  agencyId: string;
  type: 'clients' | 'caregivers' | 'family-members' | 'visits';
  totalRows: number;
  successRows: number;
  failedRows: number;
  status: 'Preview' | 'Completed' | 'Completed With Errors';
  createdAt: string;
}

export interface DailyOperationsReport {
  id: string;
  date: string;
  scheduledVisits: number;
  completedVisits: number;
  lateVisits: number;
  missedVisits: number;
  checkoutMissing: number;
  incidentsOpened: number;
  incidentsClosed: number;
  familyConcernsOpened: number;
  familyConcernsResolved: number;
  visitsMissingNotes: number;
  checklistCompletionRate: string;
  status: 'Draft' | 'Reviewed';
}

export interface ExceptionItem {
  id: string;
  type: string;
  severity: RiskLevel;
  trigger: string;
  recommendedAction: string;
  owner: string;
  dueTime: string;
  entityId: string;
  entityRoute: string;
}

export interface AgencyHealthScore {
  score: number;
  status: 'Healthy' | 'Watch' | 'Needs Attention';
  drivers: string[];
}

export interface TrendValue {
  label: string;
  value: number | string;
  direction: 'up' | 'down' | 'flat';
  changeLabel: string;
}

export interface ClientRiskRecord {
  clientId: string;
  branchId?: string;
  assignedCaregiverId?: string;
  riskLevel: RiskLevel;
  score: number;
  reason: string;
  lastConcern?: string;
  lastIncident?: string;
  recommendedAction: string;
  reviewed?: boolean;
}

export interface BillingReadinessRecord {
  visitId: string;
  clientId: string;
  caregiverId: string;
  branchId?: string;
  billingStatus: 'Not Ready' | 'Needs Review' | 'Ready for Billing' | 'Approved' | 'Exported';
  reasonBlocked?: string;
  reviewed?: boolean;
}

export interface CaregiverSupportRecord {
  caregiverId: string;
  branchId?: string;
  supportSignal: string;
  recommendedAction: string;
  reviewed?: boolean;
}

export interface QualityRules {
  familyConcernResponseSlaHours: number;
  incidentFollowUpSlaHours: number;
  weeklyReportDueDay: string;
  clientRiskThreshold: number;
  caregiverSupportThreshold: number;
  billingApprovalRequirement: 'Coordinator Review' | 'Owner Review';
  branchPerformanceThreshold: number;
}

export interface ImplementationMilestone {
  id: string;
  label: string;
  completedAt?: string | null;
}

export interface AdoptionGap {
  id: string;
  label: string;
  count: number;
  impact: string;
  recommendedAction: string;
  reviewed?: boolean;
}

export interface SupportTicketResponse {
  id: string;
  actor: string;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: 'Getting started' | 'Scheduling visits' | 'Caregiver check-in/out' | 'Family portal' | 'Incidents' | 'Reports' | 'Billing readiness' | 'User roles' | 'Settings';
  priority: 'Low' | 'Medium' | 'High';
  message: string;
  relatedClientId?: string;
  relatedVisitId?: string;
  status: 'New' | 'Reviewing' | 'Waiting on User' | 'Resolved' | 'Closed';
  createdAt: string;
  responses: SupportTicketResponse[];
}

export interface PilotFeedback {
  id: string;
  feedbackType: 'Bug' | 'Feature request' | 'Workflow confusion' | 'Training issue' | 'Family communication issue' | 'Caregiver app issue';
  role: 'Owner' | 'Coordinator' | 'Caregiver' | 'Family';
  message: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  relatedClientId?: string;
  relatedVisitId?: string;
  contact?: string;
  status: 'New' | 'Reviewing' | 'Planned' | 'Resolved' | 'Closed';
  createdAt: string;
}

export interface TrainingChecklistItem {
  id: string;
  label: string;
  href: string;
}

export interface TrainingChecklist {
  role: 'Coordinator' | 'Caregiver' | 'Family' | 'Owner/Admin';
  items: TrainingChecklistItem[];
}

export interface DataQualityIssue {
  id: string;
  type: string;
  count: number;
  severity: RiskLevel;
  affectedRecords: string[];
  recommendedFix: string;
  reviewed?: boolean;
}

export interface RolloutChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface RolloutRecommendation {
  id: string;
  label: string;
  detail: string;
}

export interface RolloutPlan {
  currentScope: {
    branchesIncluded: number;
    clientsIncluded: number;
    caregiversIncluded: number;
    familyUsersEnabled: number;
    visitVolume: number;
  };
  recommendations: RolloutRecommendation[];
  checklist: RolloutChecklistItem[];
  risks: string[];
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  category: string;
  roleTag: 'Owner' | 'Coordinator' | 'Caregiver' | 'Family';
  body: string;
}

export interface PilotReviewSummary {
  pilotStartDate: string;
  pilotEndDate: string;
  clientsIncluded: number;
  caregiversIncluded: number;
  visitsScheduled: number;
  visitsCompleted: number;
  familyUsersEnabled: number;
}

export type ApprovalStatus = 'Draft' | 'Submitted' | 'Nurse Review Required' | 'Approved' | 'Changes Requested' | 'Rejected' | 'Escalated';
export type ApprovalType = 'Care note approval' | 'Incident approval' | 'Medication task review' | 'Care plan change' | 'Family update approval' | 'Wound/condition observation' | 'Fall-risk escalation' | 'Missed task review';

export interface NurseApproval {
  id: string;
  clientId: string;
  visitId?: string;
  caregiverId?: string;
  assignedNurseId: string;
  approvalType: ApprovalType;
  submittedTime: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: ApprovalStatus;
  notesSubmitted: string;
  nurseComments?: string;
  decisionTime?: string;
  auditTrail: Array<{ label: string; time: string; actor: string }>;
  blocksFamilyVisibility?: boolean;
}

export type InspectionSeverity = 'Info' | 'Warning' | 'Critical' | 'Compliance';
export type InspectionStatus = 'Open' | 'Acknowledged' | 'In Progress' | 'Resolved' | 'Dismissed';

export interface InspectionRule {
  id: string;
  category: string;
  name: string;
  severity: InspectionSeverity;
  description: string;
  enabled: boolean;
}

export interface InspectionFinding {
  id: string;
  ruleId: string;
  title: string;
  severity: InspectionSeverity;
  status: InspectionStatus;
  relatedType: 'Visit' | 'Client' | 'Caregiver' | 'Nurse' | 'Family Concern' | 'Billing' | 'Agency';
  clientId?: string;
  clientName?: string;
  visitId?: string;
  caregiverId?: string;
  caregiverName?: string;
  owner: string;
  openedAt: string;
  recommendedAction: string;
  notificationDraft: string;
}

export type SocialWorkCaseStatus = 'New' | 'Assigned' | 'In Review' | 'Follow-up Needed' | 'Escalated' | 'Closed';
export type SocialWorkCaseType = 'Family concern follow-up' | 'Client isolation risk' | 'Housing/food insecurity note' | 'Behavioral concern' | 'Discharge planning' | 'Caregiver-family conflict' | 'Abuse/neglect concern escalation' | 'Transportation/support need';

export interface SocialWorkCase {
  id: string;
  clientId: string;
  familyMemberId?: string;
  assignedSocialWorkerId: string;
  source: string;
  caseType: SocialWorkCaseType;
  riskLevel: RiskLevel;
  status: SocialWorkCaseStatus;
  lastContactDate?: string;
  nextFollowUpDate: string;
  internalNotes: string[];
  familySafeResponse?: string;
  escalationFlag: boolean;
  linkedConcernId?: string;
}

export type IntakeStage = 'New Referral' | 'Contacted' | 'Assessment Scheduled' | 'Assessment Completed' | 'Care Plan Drafted' | 'Documents Pending' | 'Nurse Approval Required' | 'Ready for Scheduling' | 'Active Client' | 'Lost / Not Eligible';

export interface IntakeRecord {
  id: string;
  prospectName: string;
  referralSource: string;
  assignedAgentId: string;
  branchId: string;
  stage: IntakeStage;
  priority: 'Low' | 'Medium' | 'High';
  requiredServices: string[];
  payerType: string;
  documentsStatus: 'Complete' | 'Pending' | 'Missing';
  assessmentDate?: string;
  nurseApprovalStatus: ApprovalStatus;
  nextAction: string;
  lastContactDate: string;
}

export type AvailabilityStatus = 'Available' | 'Limited' | 'Missing' | 'Expiring Soon' | 'Expired' | 'Needs Confirmation';
export type AvailabilityType = 'Nurse availability' | 'Caregiver availability' | 'Social worker availability' | 'Medical supplies' | 'Medication availability' | 'Medical equipment' | 'Transportation' | 'Backup caregiver' | 'Emergency contact confirmed';

export interface MedicalAvailabilityRecord {
  id: string;
  clientId?: string;
  clientName?: string;
  visitId?: string;
  type: AvailabilityType;
  status: AvailabilityStatus;
  owner: string;
  detail: string;
  nextAction: string;
  blocksVisit: boolean;
}

export type ExpiryState = 'Valid' | 'Expiring in 30 days' | 'Expiring in 7 days' | 'Expired' | 'Missing' | 'Blocker';

export interface ExpirationRecord {
  id: string;
  category: 'Caregiver' | 'Nurse' | 'Client' | 'Agency';
  ownerId?: string;
  ownerName: string;
  item: string;
  expirationDate?: string;
  state: ExpiryState;
  responsibleOwner: string;
  renewalStatus: 'Not started' | 'Requested' | 'In progress' | 'Submitted' | 'Verified';
  blocksVisits: boolean;
  notificationDraft: string;
}
