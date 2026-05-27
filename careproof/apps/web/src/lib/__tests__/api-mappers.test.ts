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
    priority: 'high',
    status: 'pending_review',
    nurseNotes: 'Mobility observation needs review.',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps status pending_review to Nurse Review Required', () => {
    expect(mapNurseApproval(raw).status).toBe('Nurse Review Required');
  });

  it('maps status approved to Approved', () => {
    expect(mapNurseApproval({ ...raw, status: 'approved' }).status).toBe('Approved');
  });

  it('maps status rejected to Rejected', () => {
    expect(mapNurseApproval({ ...raw, status: 'rejected' }).status).toBe('Rejected');
  });

  it('maps status needs_clarification to Changes Requested', () => {
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

  it('maps priority from backend priority', () => {
    expect(mapNurseApproval(raw).priority).toBe('High');
    expect(mapNurseApproval({ ...raw, priority: 'critical' }).priority).toBe('Critical');
    expect(mapNurseApproval({ ...raw, priority: 'low' }).priority).toBe('Low');
  });

  it('sets nurseComments from nurseNotes when status is approved', () => {
    expect(mapNurseApproval({ ...raw, status: 'approved', nurseNotes: 'Looks good.' }).nurseComments).toBe('Looks good.');
  });

  it('sets nurseComments from nurseNotes when status is rejected', () => {
    expect(mapNurseApproval({ ...raw, status: 'rejected', nurseNotes: 'Missing data.' }).nurseComments).toBe('Missing data.');
  });

  it('sets nurseComments from nurseNotes when status is needs_clarification', () => {
    expect(mapNurseApproval({ ...raw, status: 'needs_clarification', nurseNotes: 'Please clarify.' }).nurseComments).toBe('Please clarify.');
  });

  it('leaves nurseComments undefined when status is pending_review', () => {
    expect(mapNurseApproval(raw).nurseComments).toBeUndefined();
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
    clientId: 'client-1',
    visitId: 'visit-1',
    caregiverId: 'caregiver-1',
    clientName: 'Maria Johnson',
    caregiverName: 'Ana Smith',
    description: 'One task not done.',
    assignedTo: 'Leah Morris',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps severity critical to Critical', () => {
    expect(mapInspectionFinding(raw).severity).toBe('Critical');
  });

  it('maps severity high to Warning', () => {
    expect(mapInspectionFinding({ ...raw, severity: 'high' }).severity).toBe('Warning');
  });

  it('maps severity medium to Info', () => {
    expect(mapInspectionFinding({ ...raw, severity: 'medium' }).severity).toBe('Info');
  });

  it('maps severity low to Info', () => {
    expect(mapInspectionFinding({ ...raw, severity: 'low' }).severity).toBe('Info');
  });

  it('maps severity compliance to Compliance', () => {
    expect(mapInspectionFinding({ ...raw, severity: 'compliance' }).severity).toBe('Compliance');
  });

  it('maps linked record ids and names', () => {
    const result = mapInspectionFinding(raw);
    expect(result.clientId).toBe('client-1');
    expect(result.visitId).toBe('visit-1');
    expect(result.caregiverId).toBe('caregiver-1');
    expect(result.clientName).toBe('Maria Johnson');
    expect(result.caregiverName).toBe('Ana Smith');
    expect(result.relatedType).toBe('Visit');
  });

  it('maps status open to Open', () => {
    expect(mapInspectionFinding(raw).status).toBe('Open');
  });

  it('maps status in_progress to In Progress', () => {
    expect(mapInspectionFinding({ ...raw, status: 'in_progress' }).status).toBe('In Progress');
  });

  it('maps status resolved to Resolved', () => {
    expect(mapInspectionFinding({ ...raw, status: 'resolved' }).status).toBe('Resolved');
  });

  it('maps status waived to Dismissed', () => {
    expect(mapInspectionFinding({ ...raw, status: 'waived' }).status).toBe('Dismissed');
  });

  it('maps description to recommendedAction', () => {
    expect(mapInspectionFinding(raw).recommendedAction).toBe('One task not done.');
  });

  it('uses _id as id', () => {
    expect(mapInspectionFinding(raw).id).toBe('if-1');
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

  it('maps active=true to enabled=true', () => {
    expect(mapInspectionRule(raw).enabled).toBe(true);
  });

  it('maps active=false to enabled=false', () => {
    expect(mapInspectionRule({ ...raw, active: false }).enabled).toBe(false);
  });

  it('maps severity critical to Critical', () => {
    expect(mapInspectionRule(raw).severity).toBe('Critical');
  });

  it('maps severity high to Warning', () => {
    expect(mapInspectionRule({ ...raw, severity: 'high' }).severity).toBe('Warning');
  });

  it('maps severity compliance to Compliance', () => {
    expect(mapInspectionRule({ ...raw, severity: 'compliance' }).severity).toBe('Compliance');
  });
});

describe('mapSocialWorkCase', () => {
  const raw: BackendSocialWorkCase = {
    _id: 'sw-1',
    agencyId: 'ag-1',
    clientName: 'Maria Johnson',
    clientId: 'c-1',
    linkedConcernId: 'concern-1',
    assignedWorker: 'user-social-worker',
    category: 'family',
    status: 'active',
    priority: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps status active to Assigned', () => {
    expect(mapSocialWorkCase(raw).status).toBe('Assigned');
  });

  it('maps status pending_review to In Review', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'pending_review' }).status).toBe('In Review');
  });

  it('maps status closed to Closed', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'closed' }).status).toBe('Closed');
  });

  it('maps status escalated to Escalated', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'escalated' }).status).toBe('Escalated');
  });

  it('maps category family to Family concern follow-up', () => {
    expect(mapSocialWorkCase(raw).caseType).toBe('Family concern follow-up');
  });

  it('maps category housing to Housing/food insecurity note', () => {
    expect(mapSocialWorkCase({ ...raw, category: 'housing' }).caseType).toBe('Housing/food insecurity note');
  });

  it('maps priority high to High riskLevel', () => {
    expect(mapSocialWorkCase(raw).riskLevel).toBe('High');
  });

  it('maps priority urgent to Critical riskLevel', () => {
    expect(mapSocialWorkCase({ ...raw, priority: 'urgent' }).riskLevel).toBe('Critical');
  });

  it('sets escalationFlag=true when status=escalated', () => {
    expect(mapSocialWorkCase({ ...raw, status: 'escalated' }).escalationFlag).toBe(true);
  });

  it('sets escalationFlag=false when status=active', () => {
    expect(mapSocialWorkCase(raw).escalationFlag).toBe(false);
  });

  it('sets clientId to empty string when raw.clientId is undefined', () => {
    const { clientId: _id, ...noClientId } = raw;
    void _id;
    expect(mapSocialWorkCase({ ...noClientId, clientId: undefined }).clientId).toBe('');
  });

  it('does not use _id as clientId fallback', () => {
    const { clientId: _cid, ...noClientId } = raw;
    void _cid;
    expect(mapSocialWorkCase({ ...noClientId, clientId: undefined }).clientId).not.toBe('sw-1');
  });

  it('maps linkedConcernId from raw.linkedConcernId', () => {
    expect(mapSocialWorkCase(raw).linkedConcernId).toBe('concern-1');
  });
});

describe('mapIntakeRecord', () => {
  const raw: BackendIntakeRecord = {
    _id: 'ir-1',
    agencyId: 'ag-1',
    branchId: 'branch-1',
    clientName: 'Louise Grant',
    agentName: 'agent-1',
    stage: 'authorization',
    referralSource: 'Hospital',
    priority: 'high',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('maps stage authorization to Nurse Approval Required', () => {
    expect(mapIntakeRecord(raw).stage).toBe('Nurse Approval Required');
  });

  it('maps stage inquiry to New Referral', () => {
    expect(mapIntakeRecord({ ...raw, stage: 'inquiry' }).stage).toBe('New Referral');
  });

  it('maps stage assessment to Assessment Scheduled', () => {
    expect(mapIntakeRecord({ ...raw, stage: 'assessment' }).stage).toBe('Assessment Scheduled');
  });

  it('maps stage onboarding to Ready for Scheduling', () => {
    expect(mapIntakeRecord({ ...raw, stage: 'onboarding' }).stage).toBe('Ready for Scheduling');
  });

  it('maps stage active to Active Client', () => {
    expect(mapIntakeRecord({ ...raw, stage: 'active' }).stage).toBe('Active Client');
  });

  it('maps clientName to prospectName', () => {
    expect(mapIntakeRecord(raw).prospectName).toBe('Louise Grant');
  });

  it('maps agentName to assignedAgentId', () => {
    expect(mapIntakeRecord(raw).assignedAgentId).toBe('agent-1');
  });

  it('maps priority urgent to High', () => {
    expect(mapIntakeRecord({ ...raw, priority: 'urgent' }).priority).toBe('High');
  });

  it('maps branchId from raw.branchId instead of agencyId', () => {
    expect(mapIntakeRecord(raw).branchId).toBe('branch-1');
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

  it('maps status confirmed to Available', () => {
    expect(mapMedicalAvailability(raw).status).toBe('Available');
  });

  it('maps status pending to Needs Confirmation', () => {
    expect(mapMedicalAvailability({ ...raw, status: 'pending' }).status).toBe('Needs Confirmation');
  });

  it('maps status unavailable to Missing and blocksVisit=true', () => {
    const result = mapMedicalAvailability({ ...raw, status: 'unavailable' });
    expect(result.status).toBe('Missing');
    expect(result.blocksVisit).toBe(true);
  });

  it('maps status on_hold to Limited', () => {
    expect(mapMedicalAvailability({ ...raw, status: 'on_hold' }).status).toBe('Limited');
  });

  it('sets blocksVisit=false when confirmed', () => {
    expect(mapMedicalAvailability(raw).blocksVisit).toBe(false);
  });

  it('maps serviceType to type', () => {
    expect(mapMedicalAvailability(raw).type).toBe('Medication availability');
  });

  it('maps clientName from raw.clientName', () => {
    expect(mapMedicalAvailability(raw).clientName).toBe('Maria Johnson');
  });

  it('maps clientName when present', () => {
    expect(mapMedicalAvailability({ ...raw, clientName: 'Helen Park' }).clientName).toBe('Helen Park');
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

  it('maps status expiring_soon to Expiring in 30 days', () => {
    expect(mapExpirationRecord(raw).state).toBe('Expiring in 30 days');
  });

  it('maps status current to Valid', () => {
    expect(mapExpirationRecord({ ...raw, status: 'current' }).state).toBe('Valid');
  });

  it('maps status expired to Expired and blocksVisits=true', () => {
    const result = mapExpirationRecord({ ...raw, status: 'expired' });
    expect(result.state).toBe('Expired');
    expect(result.blocksVisits).toBe(true);
  });

  it('maps status renewed to Valid', () => {
    expect(mapExpirationRecord({ ...raw, status: 'renewed' }).state).toBe('Valid');
  });

  it('sets blocksVisits=false when not expired', () => {
    expect(mapExpirationRecord(raw).blocksVisits).toBe(false);
  });

  it('maps caregiverName to ownerName', () => {
    expect(mapExpirationRecord(raw).ownerName).toBe('Ana Smith');
  });

  it('maps documentType to item', () => {
    expect(mapExpirationRecord(raw).item).toBe('CPR / First Aid');
  });

  it('maps expiryDate to expirationDate', () => {
    expect(mapExpirationRecord(raw).expirationDate).toBe('Jun 2, 2026');
  });

  it('sets renewalStatus=Submitted when renewalSubmittedAt is present', () => {
    expect(mapExpirationRecord({ ...raw, renewalSubmittedAt: NOW }).renewalStatus).toBe('Submitted');
  });

  it('sets renewalStatus=Not started when renewalSubmittedAt absent', () => {
    expect(mapExpirationRecord(raw).renewalStatus).toBe('Not started');
  });
});
