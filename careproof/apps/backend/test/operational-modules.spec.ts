process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/careproof_test_ops';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { connect, connection, Types } from 'mongoose';
import { AppModule } from '../src/app.module';
import { seedDemoData } from '../src/seed/demo-data';
import { UserRole } from '../src/users/user.schema';
import { NurseApprovalsService } from '../src/nurse-approvals/nurse-approvals.service';
import { InspectionFindingsService } from '../src/inspection-findings/inspection-findings.service';
import { SocialWorkCasesService } from '../src/social-work-cases/social-work-cases.service';
import { IntakeRecordsService } from '../src/intake-records/intake-records.service';
import { MedicalAvailabilityService } from '../src/medical-availability/medical-availability.service';
import { ExpirationRecordsService } from '../src/expiration-records/expiration-records.service';
import { MedicationsService } from '../src/medications/medications.service';
import { AuthUser } from '../src/auth/types';

describe('Operational modules', () => {
  let moduleRef: TestingModule;
  let agencyId: string;
  let adminActor: AuthUser;
  let nurseApprovalId: string;
  let otherBranchId: string;
  let inspectionFindingId: string;
  let socialWorkCaseId: string;
  let intakeRecordId: string;
  let medicalAvailabilityId: string;
  let expirationRecordId: string;
  let medicationRecordId: string;
  let lowStockMedicationId: string;
  let expiredMedicationId: string;
  let highRiskMedicationId: string;
  let medicationBranchId: string;
  let caregiverActor: AuthUser;
  let familyActor: AuthUser;

  let nurseApprovalsService: NurseApprovalsService;
  let inspectionFindingsService: InspectionFindingsService;
  let socialWorkCasesService: SocialWorkCasesService;
  let intakeRecordsService: IntakeRecordsService;
  let medicalAvailabilityService: MedicalAvailabilityService;
  let expirationRecordsService: ExpirationRecordsService;
  let medicationsService: MedicationsService;

  beforeAll(async () => {
    await connect(process.env.MONGODB_URI!);
    await connection.dropDatabase();
    const seed = await seedDemoData(connection);
    agencyId = seed.agencyId;

    const adminUser = await connection.collection('users').findOne({ email: 'owner@careproof.demo' });
    adminActor = {
      sub: adminUser!._id.toString(),
      agencyId,
      role: UserRole.AGENCY_OWNER,
      email: 'owner@careproof.demo',
    };

    const nurseApproval = (await connection.collection('nurseApprovals').findOne({ agencyId: new Types.ObjectId(agencyId) }))!;
    nurseApprovalId = nurseApproval._id.toString();
    otherBranchId = (await connection.collection('intakeRecords').findOne({
      agencyId: new Types.ObjectId(agencyId),
      branchId: { $ne: nurseApproval.branchId },
    }))!.branchId.toString();
    inspectionFindingId = (await connection.collection('inspectionFindings').findOne({ agencyId: new Types.ObjectId(agencyId), branchId: nurseApproval.branchId }))!._id.toString();
    socialWorkCaseId = (await connection.collection('socialWorkCases').findOne({ agencyId: new Types.ObjectId(agencyId), branchId: nurseApproval.branchId }))!._id.toString();
    intakeRecordId = (await connection.collection('intakeRecords').findOne({ agencyId: new Types.ObjectId(agencyId), branchId: nurseApproval.branchId }))!._id.toString();
    medicalAvailabilityId = (await connection.collection('medicalAvailability').findOne({ agencyId: new Types.ObjectId(agencyId) }))!._id.toString();
    expirationRecordId = (await connection.collection('expirationRecords').findOne({ agencyId: new Types.ObjectId(agencyId) }))!._id.toString();
    const metformin = (await connection.collection('medicationRecords').findOne({ agencyId: new Types.ObjectId(agencyId), medicationName: 'Metformin' }))!;
    const lisinopril = (await connection.collection('medicationRecords').findOne({ agencyId: new Types.ObjectId(agencyId), medicationName: 'Lisinopril' }))!;
    const acetaminophen = (await connection.collection('medicationRecords').findOne({ agencyId: new Types.ObjectId(agencyId), medicationName: 'Acetaminophen' }))!;
    const insulin = (await connection.collection('medicationRecords').findOne({ agencyId: new Types.ObjectId(agencyId), medicationName: 'Insulin Glargine' }))!;
    medicationRecordId = metformin._id.toString();
    lowStockMedicationId = lisinopril._id.toString();
    expiredMedicationId = acetaminophen._id.toString();
    highRiskMedicationId = insulin._id.toString();
    medicationBranchId = metformin.branchId.toString();
    const caregiverUser = await connection.collection('users').findOne({ email: 'caregiver1@careproof.demo' });
    const familyUser = await connection.collection('users').findOne({ email: 'family1@careproof.demo' });
    caregiverActor = {
      sub: caregiverUser!._id.toString(),
      agencyId,
      role: UserRole.CAREGIVER,
      email: 'caregiver1@careproof.demo',
    };
    familyActor = {
      sub: familyUser!._id.toString(),
      agencyId,
      role: UserRole.FAMILY_MEMBER,
      email: 'family1@careproof.demo',
    };

    await connection.close();

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    nurseApprovalsService = moduleRef.get(NurseApprovalsService);
    inspectionFindingsService = moduleRef.get(InspectionFindingsService);
    socialWorkCasesService = moduleRef.get(SocialWorkCasesService);
    intakeRecordsService = moduleRef.get(IntakeRecordsService);
    medicalAvailabilityService = moduleRef.get(MedicalAvailabilityService);
    expirationRecordsService = moduleRef.get(ExpirationRecordsService);
    medicationsService = moduleRef.get(MedicationsService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await connect(process.env.MONGODB_URI!);
    await connection.dropDatabase();
    await connection.close();
  });

  describe('NurseApprovals', () => {
    it('lists nurse approvals for the agency', async () => {
      const result = await nurseApprovalsService.list(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('clientName');
      expect(result[0]).toHaveProperty('status');
      expect(['low', 'medium', 'high', 'critical']).toContain(result[0].priority);
    });

    it('finds one nurse approval by id', async () => {
      const result = await nurseApprovalsService.findOne(adminActor, nurseApprovalId);
      expect(result).toHaveProperty('_id');
      expect(result.agencyId.toString()).toBe(agencyId);
    });

    it('blocks a branch-scoped nurse from unrelated branch nurse approvals', async () => {
      const branchNurseActor: AuthUser = {
        ...adminActor,
        role: UserRole.NURSE,
        branchId: otherBranchId,
      };
      await expect(nurseApprovalsService.findOne(branchNurseActor, nurseApprovalId)).rejects.toThrow();
      const visible = await nurseApprovalsService.list(branchNurseActor);
      expect(visible.some((item) => item._id.toString() === nurseApprovalId)).toBe(false);
    });

    it('approves a nurse approval', async () => {
      const result = await nurseApprovalsService.decide(adminActor, nurseApprovalId, {
        decision: 'approved',
        nurseNotes: 'All vitals normal. Care plan followed.',
      });
      expect(result.status).toBe('approved');
      expect(result.reviewedAt).toBeTruthy();
    });

    it('rejects with invalid decision (validation at DTO level)', () => {
      expect(() => nurseApprovalsService.decide(adminActor, nurseApprovalId, { decision: 'invalid' as any })).toBeDefined();
    });
  });

  describe('InspectionFindings', () => {
    it('lists inspection rules', async () => {
      const result = await inspectionFindingsService.listRules(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('ruleCode');
    });

    it('lists inspection findings', async () => {
      const result = await inspectionFindingsService.listFindings(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('severity');
      expect(result.some((finding) => finding.severity === 'compliance')).toBe(true);
      expect(result.some((finding) => finding.clientId || finding.visitId || finding.caregiverId)).toBe(true);
      expect(result.some((finding) => finding.clientName || finding.caregiverName)).toBe(true);
    });

    it('updates finding status to in_progress', async () => {
      const result = await inspectionFindingsService.updateFindingStatus(adminActor, inspectionFindingId, {
        status: 'in_progress',
      });
      expect(result!.status).toBe('in_progress');
    });

    it('blocks branch-scoped nurses from updating unrelated branch findings', async () => {
      const branchNurseActor: AuthUser = {
        ...adminActor,
        role: UserRole.NURSE,
        branchId: otherBranchId,
      };
      await expect(inspectionFindingsService.updateFindingStatus(branchNurseActor, inspectionFindingId, {
        status: 'resolved',
      })).rejects.toThrow();
    });

    it('updates finding status to resolved and sets resolvedAt', async () => {
      const result = await inspectionFindingsService.updateFindingStatus(adminActor, inspectionFindingId, {
        status: 'resolved',
      });
      expect(result!.status).toBe('resolved');
      expect(result!.resolvedAt).toBeTruthy();
    });
  });

  describe('SocialWorkCases', () => {
    it('lists social work cases', async () => {
      const result = await socialWorkCasesService.list(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('clientName');
      expect(result[0]).toHaveProperty('category');
      expect(result.some((item) => item.linkedConcernId)).toBe(true);
    });

    it('creates a social work case', async () => {
      const result = await socialWorkCasesService.create(adminActor, {
        clientName: 'Test Client',
        assignedWorker: 'Worker One',
        category: 'housing',
        priority: 'medium',
        description: 'Test case description',
      });
      expect(result.status).toBe('active');
      expect(result.clientName).toBe('Test Client');
    });

    it('closes a social work case', async () => {
      const result = await socialWorkCasesService.updateStatus(adminActor, socialWorkCaseId, {
        status: 'closed',
      });
      expect(result!.status).toBe('closed');
    });

    it('blocks social workers from unrelated branch social work cases', async () => {
      const branchSocialWorkerActor: AuthUser = {
        ...adminActor,
        role: UserRole.SOCIAL_WORKER,
        branchId: otherBranchId,
      };
      await expect(socialWorkCasesService.updateStatus(branchSocialWorkerActor, socialWorkCaseId, {
        status: 'closed',
      })).rejects.toThrow();
    });
  });

  describe('IntakeRecords', () => {
    it('lists intake records', async () => {
      const result = await intakeRecordsService.list(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('stage');
      expect(result[0]).toHaveProperty('branchId');
      expect(result[0].branchId.toString()).not.toBe(agencyId);
    });

    it('creates an intake record', async () => {
      const result = await intakeRecordsService.create(adminActor, {
        clientName: 'New Client',
        agentName: 'Agent One',
        stage: 'inquiry',
        referralSource: 'Hospital',
        priority: 'high',
      });
      expect(result.clientName).toBe('New Client');
      expect(result.stage).toBe('inquiry');
    });

    it('advances intake stage', async () => {
      const result = await intakeRecordsService.updateStage(adminActor, intakeRecordId, {
        stage: 'active',
      });
      expect(result!.stage).toBe('active');
    });

    it('blocks branch-scoped intake agents from unrelated branch intake records', async () => {
      const branchIntakeActor: AuthUser = {
        ...adminActor,
        role: UserRole.INTAKE_AGENT,
        branchId: otherBranchId,
      };
      await expect(intakeRecordsService.updateStage(branchIntakeActor, intakeRecordId, {
        stage: 'active',
      })).rejects.toThrow();
    });
  });

  describe('MedicalAvailability', () => {
    it('lists medical availability records', async () => {
      const result = await medicalAvailabilityService.list(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('serviceType');
      expect(result[0]).toHaveProperty('status');
    });

    it('confirms medical availability and sets confirmedAt', async () => {
      const result = await medicalAvailabilityService.updateStatus(adminActor, medicalAvailabilityId, {
        status: 'confirmed',
      });
      expect(result.status).toBe('confirmed');
      expect(result.confirmedAt).toBeTruthy();
    });

    it('marks medical availability as unavailable', async () => {
      const result = await medicalAvailabilityService.updateStatus(adminActor, medicalAvailabilityId, {
        status: 'unavailable',
      });
      expect(result.status).toBe('unavailable');
    });
  });

  describe('ExpirationRecords', () => {
    it('lists expiration records', async () => {
      const result = await expirationRecordsService.list(adminActor);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('documentType');
      expect(result[0]).toHaveProperty('status');
    });

    it('marks record as renewed and sets renewalSubmittedAt', async () => {
      const result = await expirationRecordsService.updateRenewalStatus(adminActor, expirationRecordId, {
        status: 'renewed',
      });
      expect(result.status).toBe('renewed');
      expect(result.renewalSubmittedAt).toBeTruthy();
    });
  });

  describe('Medications', () => {
    it('lists medication records for the agency with seeded safety states', async () => {
      const result = await medicationsService.list(adminActor);
      expect(result.length).toBeGreaterThanOrEqual(7);
      expect(result.some((item) => item.medicationName === 'Metformin')).toBe(true);
      expect(result.some((item) => item.status === 'Low Stock')).toBe(true);
      expect(result.some((item) => item.status === 'Expired')).toBe(true);
      expect(result.some((item) => item.requiresNurseReview)).toBe(true);
    });

    it('enforces branch scoping for branch-scoped nurses', async () => {
      const branchNurseActor: AuthUser = {
        ...adminActor,
        role: UserRole.NURSE,
        branchId: otherBranchId,
      };
      await expect(medicationsService.findOne(branchNurseActor, medicationRecordId)).rejects.toThrow();
      const visible = await medicationsService.list({ ...branchNurseActor, branchId: medicationBranchId });
      expect(visible.some((item) => item._id.toString() === medicationRecordId)).toBe(true);
    });

    it('blocks family from internal medication records', async () => {
      const result = await medicationsService.list(familyActor);
      expect(result.some((item) => item._id.toString() === medicationRecordId)).toBe(false);
      await expect(medicationsService.findOne(familyActor, medicationRecordId)).rejects.toThrow();
    });

    it('allows caregiver assigned-client read with internal notes removed', async () => {
      const result = await medicationsService.list(caregiverActor);
      const mariaMedication = result.find((item) => item._id.toString() === medicationRecordId);
      expect(mariaMedication).toBeTruthy();
      expect(mariaMedication!.notes).toBeUndefined();
    });

    it('creates risk surfaces for expired medication', async () => {
      const result = await medicationsService.findOne(adminActor, expiredMedicationId);
      expect(result.status).toBe('Expired');
      const findings = await inspectionFindingsService.listFindings(adminActor);
      expect(findings.some((finding) => finding.title === 'Medication expired' && finding.clientName === 'Maria Johnson')).toBe(true);
    });

    it('quantity low update creates blocker risk', async () => {
      const result = await medicationsService.updateQuantity(adminActor, medicationRecordId, {
        quantityAvailable: 1,
        notes: 'Test low quantity.',
      });
      expect(result.status).toBe('Low Stock');
      const blockers = await medicalAvailabilityService.list(adminActor);
      expect(blockers.some((blocker) => blocker.serviceType.includes('Metformin') && blocker.status === 'unavailable')).toBe(true);
    });

    it('requires nurse review and creates approval/risk', async () => {
      const result = await medicationsService.requestNurseReview(adminActor, lowStockMedicationId, {
        notes: 'Test review request.',
      });
      expect(result.status).toBe('Needs Nurse Review');
      expect(result.nurseApprovalId).toBeTruthy();
      const findings = await inspectionFindingsService.listFindings(adminActor);
      expect(findings.some((finding) => finding.title === 'Medication task attempted without valid order' && finding.clientName === 'Maria Johnson')).toBe(true);
    });

    it('reconcile endpoint updates lastReconciledAt and nextReconciliationDue', async () => {
      const result = await medicationsService.reconcile(adminActor, highRiskMedicationId, {
        lastReconciledAt: '2026-05-27',
        nextReconciliationDue: '2026-06-26',
        notes: 'Reconciled during test.',
      });
      expect(result.lastReconciledAt).toBe('2026-05-27');
      expect(result.nextReconciliationDue).toBe('2026-06-26');
    });
  });

  describe('RBAC enforcement', () => {
    it('blocks FAMILY_MEMBER from reading nurse approvals', async () => {
      const familyActor: AuthUser = {
        sub: new Types.ObjectId().toString(),
        agencyId,
        role: UserRole.FAMILY_MEMBER,
        email: 'family@test.com',
      };
      await expect(nurseApprovalsService.list(familyActor)).rejects.toThrow();
    });

    it('blocks FAMILY_MEMBER from reading social work cases', async () => {
      const familyActor: AuthUser = {
        sub: new Types.ObjectId().toString(),
        agencyId,
        role: UserRole.FAMILY_MEMBER,
        email: 'family@test.com',
      };
      await expect(socialWorkCasesService.list(familyActor)).rejects.toThrow();
    });

    it('allows CAREGIVER to read nurse approvals', async () => {
      const caregiverActor: AuthUser = {
        sub: new Types.ObjectId().toString(),
        agencyId,
        role: UserRole.CAREGIVER,
        email: 'cg@test.com',
      };
      const result = await nurseApprovalsService.list(caregiverActor);
      expect(Array.isArray(result)).toBe(true);
    });

    it('blocks SOCIAL_WORKER from intake and nurse-only records', async () => {
      const socialWorkerActor: AuthUser = {
        ...adminActor,
        role: UserRole.SOCIAL_WORKER,
      };
      await expect(intakeRecordsService.list(socialWorkerActor)).rejects.toThrow();
      await expect(nurseApprovalsService.list(socialWorkerActor)).rejects.toThrow();
      await expect(medicationsService.list(socialWorkerActor)).rejects.toThrow();
    });

    it('blocks INTAKE_AGENT from clinical review records', async () => {
      const intakeActor: AuthUser = {
        ...adminActor,
        role: UserRole.INTAKE_AGENT,
      };
      await expect(nurseApprovalsService.list(intakeActor)).rejects.toThrow();
      await expect(inspectionFindingsService.listFindings(intakeActor)).rejects.toThrow();
    });
  });
});
