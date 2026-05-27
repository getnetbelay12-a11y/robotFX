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
  priority: 'low' | 'medium' | 'high' | 'critical';
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
  severity: 'critical' | 'high' | 'medium' | 'low' | 'compliance';
  status: 'open' | 'in_progress' | 'resolved' | 'waived';
  clientId?: string;
  visitId?: string;
  caregiverId?: string;
  clientName?: string;
  caregiverName?: string;
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
  severity: 'critical' | 'high' | 'medium' | 'low' | 'compliance';
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
  linkedConcernId?: string | null;
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
  branchId?: string;
  branchName?: string;
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
