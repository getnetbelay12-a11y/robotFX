process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/careproof_test_operational_data';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { connect, connection } from 'mongoose';
import { AppModule } from '../src/app.module';
import { InspectionFindingsService } from '../src/inspection-findings/inspection-findings.service';
import { IntakeRecordsService } from '../src/intake-records/intake-records.service';
import { seedDemoData } from '../src/seed/demo-data';
import { SocialWorkCasesService } from '../src/social-work-cases/social-work-cases.service';
import { UserRole } from '../src/users/user.schema';

describe('operational module data contracts', () => {
  let moduleRef: TestingModule;
  let inspectionFindingsService: InspectionFindingsService;
  let intakeRecordsService: IntakeRecordsService;
  let socialWorkCasesService: SocialWorkCasesService;
  let agencyId: string;
  let ownerId: string;
  let ownerBranchId: string;

  beforeAll(async () => {
    await connect(process.env.MONGODB_URI!);
    await connection.dropDatabase();
    const seed = await seedDemoData(connection);
    agencyId = seed.agencyId;
    const owner = await connection.collection('users').findOne({ email: 'owner@careproof.demo' });
    ownerId = owner!._id.toString();
    ownerBranchId = owner!.branchId.toString();
    await connection.close();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    inspectionFindingsService = moduleRef.get(InspectionFindingsService);
    intakeRecordsService = moduleRef.get(IntakeRecordsService);
    socialWorkCasesService = moduleRef.get(SocialWorkCasesService);
  });

  afterAll(async () => {
    await moduleRef.close();
    await connect(process.env.MONGODB_URI!);
    await connection.dropDatabase();
    await connection.close();
  });

  const ownerActor = () => ({
    sub: ownerId,
    agencyId,
    role: UserRole.AGENCY_OWNER,
    email: 'owner@careproof.demo',
    branchId: ownerBranchId,
  });

  it('returns intake branch display metadata with branchId', async () => {
    const records = await intakeRecordsService.list(ownerActor());
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.branchId)).toBe(true);
    expect(records.some((record) => record.branchName === 'Northside Care Team')).toBe(true);
  });

  it('links Maria social work case to Emily family concern and permits null links', async () => {
    const cases = await socialWorkCasesService.list(ownerActor());
    const mariaCase = cases.find((item) => item.clientName === 'Maria Johnson');
    expect(mariaCase?.linkedConcernId).toBeTruthy();
    const linkedConcernId = mariaCase!.linkedConcernId!;

    await connect(process.env.MONGODB_URI!);
    const concern = await connection.collection('familyConcerns').findOne({ _id: linkedConcernId });
    const family = await connection.collection('users').findOne({ _id: concern!.familyMemberId });
    await connection.close();

    expect(family?.email).toBe('family1@careproof.demo');
  });

  it('returns inspection finding names from linked client and caregiver records', async () => {
    await connect(process.env.MONGODB_URI!);
    const rawFinding = await connection.collection('inspectionFindings').findOne({ clientName: 'Maria Johnson' });
    await connection.collection('inspectionFindings').updateOne(
      { _id: rawFinding!._id },
      { $set: { clientName: 'Stale Client Name', caregiverName: 'Stale Caregiver Name' } },
    );
    await connection.close();

    const findings = await inspectionFindingsService.listFindings(ownerActor());
    const finding = findings.find((item) => item._id.toString() === rawFinding!._id.toString());
    expect(finding?.clientName).toBe('Maria Johnson');
    expect(finding?.caregiverName).toBe('Ana Smith');
  });
});
