process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/careproof_test_e2e';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { connect, connection, Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { seedDemoData } from '../src/seed/demo-data';
import { UserRole } from '../src/users/user.schema';

describe('CareProof backend e2e', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let ownerToken: string;
  let caregiver1Token: string;
  let caregiver2Token: string;
  let family1Token: string;
  let createdClientId: string;
  let createdVisitId: string;
  let reviewVisitId: string;
  let secondAgencyOwnerToken: string;
  let family1Id: string;
  let caregiver1Id: string;
  let secondAgencyOwnerId: string;
  let secondAgencyClientId: string;
  let secondAgencyReportId: string;
  let secondAgencyImportJobId: string;
  let secondAgencyNotificationId: string;

  async function login(email: string, password = 'Password123!') {
    const response = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
    expect(response.status).toBe(201);
    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    await connect(process.env.MONGODB_URI!);
    await connection.dropDatabase();
    await seedDemoData(connection);

    const family1 = await connection.collection('users').findOne({ email: 'family1@careproof.demo' });
    const caregiver1 = await connection.collection('users').findOne({ email: 'caregiver1@careproof.demo' });
    family1Id = family1!._id.toString();
    caregiver1Id = caregiver1!._id.toString();

    const secondAgencyId = new Types.ObjectId();
    const secondOwnerId = new Types.ObjectId();
    secondAgencyOwnerId = secondOwnerId.toString();
    const secondClientId = new Types.ObjectId();
    const secondVisitId = new Types.ObjectId();
    const secondReportId = new Types.ObjectId();
    const secondImportJobId = new Types.ObjectId();
    const secondNotificationId = new Types.ObjectId();
    secondAgencyClientId = secondClientId.toString();
    secondAgencyReportId = secondReportId.toString();
    secondAgencyImportJobId = secondImportJobId.toString();
    secondAgencyNotificationId = secondNotificationId.toString();
    await connection.collection('agencies').insertOne({
      _id: secondAgencyId,
      name: 'SafeHands Senior Care',
      status: 'active',
      timezone: 'America/New_York',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connection.collection('users').insertOne({
      _id: secondOwnerId,
      agencyId: secondAgencyId,
      role: UserRole.AGENCY_OWNER,
      firstName: 'Second',
      lastName: 'Owner',
      email: 'owner2@careproof.demo',
      phone: '+15550000001',
      status: 'active',
      language: 'en',
      permissions: [],
      auth: { passwordHash: await argon2.hash('Password123!'), refreshTokenHash: null, mfaEnabled: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connection.collection('clients').insertOne({
      _id: secondClientId,
      agencyId: secondAgencyId,
      firstName: 'SafeHands',
      lastName: 'Client',
      dateOfBirth: '1942-05-10',
      status: 'active',
      deletedAt: null,
      deletedBy: null,
      address: { line1: '1 Hidden Ln', city: 'Bethesda', state: 'MD', zip: '20814' },
      emergencyContacts: [],
      familyMemberIds: [],
      caregiverIds: [],
      riskLevel: 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connection.collection('visits').insertOne({
      _id: secondVisitId,
      agencyId: secondAgencyId,
      clientId: secondClientId,
      caregiverId: secondOwnerId,
      scheduledStart: new Date(Date.now() + 86_400_000),
      scheduledEnd: new Date(Date.now() + 90_000_000),
      actualStart: null,
      actualEnd: null,
      status: 'scheduled',
      location: {},
      tasks: [],
      caregiverNote: { rawText: '', cleanText: '', language: 'en' },
      familySummary: { text: '', sentAt: null, sentTo: [] },
      incidentIds: [],
      locked: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connection.collection('generatedReports').insertOne({
      _id: secondReportId,
      agencyId: secondAgencyId,
      kind: 'weekly_family',
      clientId: secondClientId.toString(),
      caregiverId: '',
      fileName: 'safehands-report.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from('safehands report', 'utf8').toString('base64'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connection.collection('importJobs').insertOne({
      _id: secondImportJobId,
      agencyId: secondAgencyId,
      type: 'caregivers',
      status: 'completed',
      fileName: 'safehands-caregivers.csv',
      totalRows: 1,
      successRows: 1,
      failedRows: 0,
      createdRows: 1,
      updatedRows: 0,
      duplicateRows: 0,
      rowErrors: [],
      createdBy: secondOwnerId,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });
    await connection.collection('notifications').insertOne({
      _id: secondNotificationId,
      agencyId: secondAgencyId,
      userId: secondOwnerId,
      type: 'visit_completed',
      channel: 'email',
      audience: 'agency',
      subject: 'SafeHands notification',
      message: 'SafeHands private notification.',
      status: 'queued',
      recipient: 'owner2@careproof.demo',
      metadata: { private: true },
      sentAt: null,
      failureReason: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await connection.close();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    ownerToken = await login('owner@careproof.demo');
    caregiver1Token = await login('caregiver1@careproof.demo');
    caregiver2Token = await login('caregiver2@careproof.demo');
    family1Token = await login('family1@careproof.demo');
    secondAgencyOwnerToken = await login('owner2@careproof.demo');
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
    await connect(process.env.MONGODB_URI!);
    await connection.dropDatabase();
    await connection.close();
  });

  it('enforces jwt guard and role guard', async () => {
    const unauthorized = await request(app.getHttpServer()).get('/api/dashboard/today');
    expect(unauthorized.status).toBe(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/dashboard/today')
      .set('Authorization', `Bearer ${family1Token}`);
    expect(forbidden.status).toBe(403);
  });

  it('rate limits repeated failed login attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ email: 'owner@careproof.demo', password: 'WrongPassword123!' });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ email: 'owner@careproof.demo', password: 'WrongPassword123!' });
    expect(blocked.status).toBe(429);
  });

  it('returns current auth user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.email).toBe('owner@careproof.demo');
  });

  it('exposes health and readiness endpoints', async () => {
    let response = await request(app.getHttpServer()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('careproof-backend');
    expect(response.body.timestamp).toBeDefined();

    response = await request(app.getHttpServer()).get('/api/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.database.status).toBe('connected');

    response = await request(app.getHttpServer()).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.database.status).toBe('connected');
  });

  it('exposes system status, go-live checklist, and integrations for agency owners only', async () => {
    let response = await request(app.getHttpServer())
      .get('/api/system/status')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.environment).toBeDefined();
    expect(response.body.database.status).toBe('connected');

    response = await request(app.getHttpServer())
      .get('/api/system/go-live-checklist')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);

    response = await request(app.getHttpServer())
      .get('/api/system/integrations')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    response = await request(app.getHttpServer())
      .get('/api/system/status')
      .set('Authorization', `Bearer ${caregiver1Token}`);
    expect(response.status).toBe(403);
  });

  it('exports agency-scoped csv for owners and admins only', async () => {
    let response = await request(app.getHttpServer())
      .post('/api/system/export/clients')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Maria');
    expect(response.text).not.toContain('SafeHands');

    response = await request(app.getHttpServer())
      .post('/api/system/export/clients')
      .set('Authorization', `Bearer ${secondAgencyOwnerToken}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain('SafeHands');
    expect(response.text).not.toContain('Maria');
  });

  it('returns meaningful dashboard data from the demo seed', async () => {
    let response = await request(app.getHttpServer())
      .get('/api/dashboard/today')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.cards.todaysVisits).toBeGreaterThan(0);
    expect(response.body.cards.openIncidents).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(response.body.urgentVisits)).toBe(true);

    response = await request(app.getHttpServer())
      .get('/api/dashboard/ai-digest/today')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.urgent)).toBe(true);

    response = await request(app.getHttpServer())
      .get('/api/dashboard/risk-flags')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    response = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.cards.todaysVisits).toBeGreaterThan(0);

    response = await request(app.getHttpServer())
      .get('/api/dashboard/attention-queue')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('creates a client with family and caregiver assignments', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Workflow',
        lastName: 'Client',
        dateOfBirth: '1948-05-12',
        address: { line1: '1 Care Ln', city: 'Boston', state: 'MA', zip: '02118' },
        familyMemberIds: [family1Id],
        caregiverIds: [caregiver1Id],
        emergencyContacts: [{ name: 'Family One', relationship: 'Daughter', phone: '+15551230000' }],
      });
    expect(response.status).toBe(201);
    createdClientId = response.body._id;
  });

  it('creates a visit and blocks cross-agency access', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: createdClientId,
        caregiverId: caregiver1Id,
        scheduledStart: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        location: { expected: { lat: 42.3601, lng: -71.0589 } },
        tasks: [
          { taskId: 'meal_assistance', label: 'Meal assistance', required: true },
          { taskId: 'bathing', label: 'Bathing', required: true },
        ],
      });
    expect(response.status).toBe(201);
    createdVisitId = response.body._id;

    const crossAgency = await request(app.getHttpServer())
      .get(`/api/visits/${createdVisitId}`)
      .set('Authorization', `Bearer ${secondAgencyOwnerToken}`);
    expect(crossAgency.status).toBe(404);
  });

  it('blocks cross-agency access to users, clients, reports, imports, and notifications', async () => {
    let response = await request(app.getHttpServer())
      .get(`/api/users/${secondAgencyOwnerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(404);

    response = await request(app.getHttpServer())
      .get(`/api/clients/${secondAgencyClientId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(404);

    response = await request(app.getHttpServer())
      .get(`/api/reports/${secondAgencyReportId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(403);

    response = await request(app.getHttpServer())
      .get(`/api/imports/${secondAgencyImportJobId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(404);

    response = await request(app.getHttpServer())
      .patch(`/api/notifications/${secondAgencyNotificationId}/retry`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(403);

    response = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.some((item: { _id: string }) => item._id === secondAgencyNotificationId)).toBe(false);
  });

  it('prevents caregiver access to unassigned visits', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/visits/${createdVisitId}`)
      .set('Authorization', `Bearer ${caregiver2Token}`);
    expect(response.status).toBe(403);
  });

  it('restricts caregiver and family access to admin-only resources', async () => {
    let response = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', `Bearer ${caregiver1Token}`);
    expect(response.status).toBe(403);

    response = await request(app.getHttpServer())
      .post(`/api/reports/weekly/${createdClientId}/export`)
      .set('Authorization', `Bearer ${caregiver1Token}`);
    expect(response.status).toBe(403);

    response = await request(app.getHttpServer())
      .get('/api/imports')
      .set('Authorization', `Bearer ${caregiver1Token}`);
    expect(response.status).toBe(403);

    response = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${family1Token}`);
    expect(response.status).toBe(403);

    response = await request(app.getHttpServer())
      .get('/api/dashboard/ai-digest/today')
      .set('Authorization', `Bearer ${caregiver1Token}`);
    expect(response.status).toBe(403);
  });

  it('runs the caregiver visit workflow and generates events and audit logs', async () => {
    let response = await request(app.getHttpServer())
      .post(`/api/visits/${createdVisitId}/check-in`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ lat: 42.3601, lng: -71.0589, deviceId: 'phone-1' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('in_progress');

    response = await request(app.getHttpServer())
      .post(`/api/visits/${createdVisitId}/tasks/meal_assistance/complete`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ note: 'Lunch prepared.' });
    expect(response.status).toBe(201);

    response = await request(app.getHttpServer())
      .post(`/api/visits/${createdVisitId}/tasks/bathing/skip`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ note: 'the client refused', reason: 'Client refused' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('requires_review');
    expect(response.body.tasks.find((task: { taskId: string }) => task.taskId === 'bathing').skipReason).toBe('Client refused');

    response = await request(app.getHttpServer())
      .post(`/api/visits/${createdVisitId}/note`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ rawText: 'Client was calm but dizzy today and did not eat much.' });
    expect(response.status).toBe(201);
    expect(response.body.caregiverNote.rawText).toBe('Client was calm but dizzy today and did not eat much.');
    expect(response.body.caregiverNote.cleanText).toContain('dizzy');
    expect(response.body.caregiverNote.familySafeText).toContain('dizziness');
    expect(response.body.caregiverNote.riskFlags).toContain('dizziness');

    response = await request(app.getHttpServer())
      .post(`/api/visits/${createdVisitId}/note-assist`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ rawText: 'client was calm but dizzy today and did not eat much' });
    expect(response.status).toBe(201);
    expect(response.body.polishedNote).toBe('Client was calm but dizzy today and did not eat much.');
    expect(response.body.reviewRequired).toBe(true);
    expect(response.body.familySummaryPreview).toContain('reviewed by the agency');
    expect(response.body.warnings.length).toBeGreaterThan(0);

    response = await request(app.getHttpServer())
      .post(`/api/visits/${createdVisitId}/check-out`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ lat: 42.3601, lng: -71.0589 });
    expect(response.status).toBe(201);
    expect(response.body.familySummary.text).toContain('Bathing was not completed');

    response = await request(app.getHttpServer())
      .get(`/api/visits/${createdVisitId}/proof`)
      .set('Authorization', `Bearer ${caregiver1Token}`);
    expect(response.status).toBe(200);
    expect(response.body.events.some((event: { type: string }) => event.type === 'CHECK_IN')).toBe(true);
    expect(response.body.events.some((event: { type: string }) => event.type === 'FAMILY_UPDATE_GENERATED')).toBe(true);
    expect(response.body.auditLogs.some((audit: { action: string }) => audit.action === 'CHECK_OUT')).toBe(true);

    await connect(process.env.MONGODB_URI!);
    const events = await connection.collection('visitEvents').find({ visitId: new Types.ObjectId(createdVisitId) }).toArray();
    const audits = await connection.collection('auditLogs').find({ entityId: createdVisitId }).toArray();
    const notifications = await connection.collection('notifications').find({ 'metadata.visitId': createdVisitId }).toArray();
    const aiOperations = await connection.collection('aiOperations').find({ entityId: createdVisitId }).toArray();
    expect(events.some((event) => event.type === 'CHECK_IN')).toBe(true);
    expect(events.some((event) => event.type === 'TASK_SKIPPED')).toBe(true);
    expect(events.some((event) => event.type === 'FAMILY_UPDATE_GENERATED')).toBe(true);
    expect(audits.some((audit) => audit.action === 'CHECK_OUT')).toBe(true);
    expect(audits.some((audit) => audit.action === 'TASK_SKIPPED')).toBe(true);
    expect(notifications.some((notification) => notification.type === 'visit_completed')).toBe(true);
    expect(aiOperations.some((operation) => operation.operationType === 'NOTE_CLEANUP')).toBe(true);
    expect(aiOperations.some((operation) => operation.operationType === 'FAMILY_SUMMARY')).toBe(true);
    expect(aiOperations.every((operation) => !('prompt' in operation) && !('response' in operation))).toBe(true);
    await connection.close();
  });

  it('creates a review visit with a high severity incident and keeps family details sanitized', async () => {
    let response = await request(app.getHttpServer())
      .post('/api/visits')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: createdClientId,
        caregiverId: caregiver1Id,
        scheduledStart: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        scheduledEnd: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        location: { expected: { lat: 42.3601, lng: -71.0589 } },
        tasks: [
          { taskId: 'medication_reminder', label: 'Medication reminder', required: true },
          { taskId: 'mobility', label: 'Mobility support', required: true },
        ],
      });
    expect(response.status).toBe(201);
    reviewVisitId = response.body._id;

    await request(app.getHttpServer())
      .post(`/api/visits/${reviewVisitId}/check-in`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ lat: 42.3601, lng: -71.0589 });

    await request(app.getHttpServer())
      .post(`/api/visits/${reviewVisitId}/tasks/medication_reminder/complete`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({});

    await request(app.getHttpServer())
      .post(`/api/visits/${reviewVisitId}/tasks/mobility/complete`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({});

    await request(app.getHttpServer())
      .post(`/api/visits/${reviewVisitId}/note`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ rawText: 'Client seemed stable.' });

    response = await request(app.getHttpServer())
      .post(`/api/visits/${reviewVisitId}/incidents`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({
        type: 'fall',
        severity: 'high',
        description: 'Client slipped while standing.',
        actionsTaken: 'Agency notified.',
      });
    expect(response.status).toBe(201);

    response = await request(app.getHttpServer())
      .post(`/api/visits/${reviewVisitId}/check-out`)
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({ lat: 42.3601, lng: -71.0589 });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('requires_review');
    expect(response.body.familySummary.text).toContain('reviewed by the agency');

    response = await request(app.getHttpServer())
      .get(`/api/family/clients/${createdClientId}/feed`)
      .set('Authorization', `Bearer ${family1Token}`);
    expect(response.status).toBe(200);
    const reviewVisit = response.body.find((item: { id: string }) => item.id === reviewVisitId);
    expect(reviewVisit).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('reviewed by the agency');
    expect(JSON.stringify(response.body)).not.toContain('slipped while standing');

    await connect(process.env.MONGODB_URI!);
    const notifications = await connection.collection('notifications').find({ 'metadata.incidentId': { $exists: true } }).toArray();
    expect(notifications.some((notification) => notification.type === 'high_severity_incident')).toBe(true);
    await connection.close();
  });

  it('limits family access to assigned clients and excludes unapproved review visits from feed', async () => {
    let response = await request(app.getHttpServer())
      .get(`/api/family/clients/${createdClientId}/feed`)
      .set('Authorization', `Bearer ${family1Token}`);
    expect(response.status).toBe(200);
    expect(response.body.some((item: { id: string }) => item.id === createdVisitId)).toBe(false);

    await connect(process.env.MONGODB_URI!);
    const unrelatedClient = await connection.collection('clients').findOne({
      familyMemberIds: { $ne: new Types.ObjectId(family1Id) },
    });
    await connection.close();

    response = await request(app.getHttpServer())
      .get(`/api/family/clients/${unrelatedClient!._id.toString()}/feed`)
      .set('Authorization', `Bearer ${family1Token}`);
    expect(response.status).toBe(403);
  });

  it('creates family concern notifications and weekly report exports', async () => {
    let response = await request(app.getHttpServer())
      .post(`/api/family/clients/${createdClientId}/concerns`)
      .set('Authorization', `Bearer ${family1Token}`)
      .send({
        category: 'care_quality',
        message: 'Please confirm lunch support happened today.',
        preferredContactMethod: 'email',
        urgency: 'important',
      });
    expect(response.status).toBe(201);
    expect(response.body.urgency).toBe('important');
    expect(response.body.preferredContactMethod).toBe('email');

    response = await request(app.getHttpServer())
      .get('/api/family-concerns')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.some((item: { clientId: string }) => item.clientId.toString() === createdClientId)).toBe(true);

    response = await request(app.getHttpServer())
      .post(`/api/reports/weekly/${createdClientId}/generate`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(201);
    expect(response.body.aiSummary).toBeDefined();

    response = await request(app.getHttpServer())
      .post(`/api/reports/weekly/${createdClientId}/export`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(201);
    expect(response.body.fileName).toContain('weekly-family');
    expect(response.body.mimeType).toBe('application/pdf');

    response = await request(app.getHttpServer())
      .get('/api/reports/agency/operations')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.cards.todaysVisits).toBeGreaterThan(0);

    const crossAgency = await request(app.getHttpServer())
      .post(`/api/reports/weekly/${createdClientId}/export`)
      .set('Authorization', `Bearer ${secondAgencyOwnerToken}`);
    expect(crossAgency.status).toBe(404);

    const familyReport = await request(app.getHttpServer())
      .get(`/api/reports/weekly/${createdClientId}`)
      .set('Authorization', `Bearer ${family1Token}`);
    expect(familyReport.status).toBe(200);
    expect(JSON.stringify(familyReport.body)).not.toContain('slipped while standing');

    const familyReportsList = await request(app.getHttpServer())
      .get(`/api/family/clients/${createdClientId}/reports`)
      .set('Authorization', `Bearer ${family1Token}`);
    expect(familyReportsList.status).toBe(200);
    expect(JSON.stringify(familyReportsList.body)).not.toContain('slipped while standing');

    const unrelatedReport = await request(app.getHttpServer())
      .get(`/api/reports/${secondAgencyReportId}`)
      .set('Authorization', `Bearer ${family1Token}`);
    expect(unrelatedReport.status).toBe(403);

    await connect(process.env.MONGODB_URI!);
    const notifications = await connection.collection('notifications').find({ type: 'family_concern_submitted' }).toArray();
    const reports = await connection.collection('generatedReports').find({ kind: 'weekly_family' }).toArray();
    const audits = await connection.collection('auditLogs').find({ action: 'REPORT_GENERATED' }).toArray();
    expect(notifications.length).toBeGreaterThan(0);
    expect(reports.length).toBeGreaterThan(0);
    expect(audits.length).toBeGreaterThan(0);
    await connection.close();
  });

  it('supports report lifecycle, demo requests, and alias endpoints', async () => {
    let response = await request(app.getHttpServer())
      .get('/api/agencies/current')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.name).toBeDefined();

    response = await request(app.getHttpServer())
      .get('/api/caregivers')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    response = await request(app.getHttpServer())
      .get('/api/care-plans')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    response = await request(app.getHttpServer())
      .get('/api/reports/weekly')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    const weeklyReportId = response.body[0]?.id;
    expect(weeklyReportId).toBeDefined();

    response = await request(app.getHttpServer())
      .post(`/api/reports/weekly/${weeklyReportId}/mark-ready`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('ready');

    response = await request(app.getHttpServer())
      .post(`/api/reports/weekly/${weeklyReportId}/send`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('sent');

    response = await request(app.getHttpServer())
      .post('/api/demo-requests')
      .send({
        agencyName: 'North Star Home Care',
        contactName: 'Jordan Blake',
        email: 'jordan@example.com',
        mainChallenge: 'Missed visits',
        phone: '(555) 111-1000',
        caregiverCount: '25',
        message: 'We want a pilot walkthrough.',
      });
    expect(response.status).toBe(201);
    expect(response.body.message).toContain('Demo request received');

    response = await request(app.getHttpServer())
      .get('/api/family-concerns')
      .set('Authorization', `Bearer ${ownerToken}`);
    const concernId = response.body[0]?._id;
    expect(concernId).toBeDefined();

    response = await request(app.getHttpServer())
      .patch(`/api/family-concerns/${concernId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'responded' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('responded');
  });

  it('supports AI-assisted drafts with human-review boundaries', async () => {
    let response = await request(app.getHttpServer())
      .post('/api/ai/visit-summary')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        visitId: 'visit-maria-am',
        careNote: 'Client ate breakfast, walked slowly, and did not fall.',
        checklist: [
          { label: 'Breakfast support', required: true, status: 'done' },
          { label: 'Mobility check', required: true, status: 'done' },
        ],
        incidentSeverities: [],
        visitStatus: 'completed',
      });
    expect(response.status).toBe(201);
    expect(response.body.internalSummary).toContain('Client ate breakfast');
    expect(response.body.familySafeSummary).toBeDefined();
    expect(Array.isArray(response.body.riskFlags)).toBe(true);

    response = await request(app.getHttpServer())
      .post('/api/ai/family-update-draft')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        visitId: 'visit-maria-am',
        careNote: 'Breakfast support completed. Medication reminder completed. No urgent concern.',
        checklist: [
          { label: 'Breakfast support', required: true, status: 'done' },
          { label: 'Medication reminder', required: true, status: 'done' },
        ],
        incidentSeverities: [],
        visitStatus: 'completed',
      });
    expect(response.status).toBe(201);
    expect(response.body.requiresApproval).toBe(true);
    expect(response.body.familyUpdateDraft).toBeDefined();

    response = await request(app.getHttpServer())
      .post('/api/ai/incident-triage')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'medication_concern',
        severity: 'moderate',
        description: 'Client hesitated to take medication and asked for later follow-up.',
        clientName: 'Samuel Brooks',
      });
    expect(response.status).toBe(201);
    expect(response.body.suggestedPriority).toBeDefined();
    expect(response.body.safetyDisclaimer).toContain('Human review required');

    response = await request(app.getHttpServer())
      .post('/api/ai/weekly-report-draft')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        clientId: 'client-maria',
        clientName: 'Maria Johnson',
        weekPeriod: 'Apr 28 - May 4',
        visits: [
          {
            id: 'visit-1',
            status: 'completed',
            tasks: [{ label: 'Breakfast support', required: true, status: 'done' }],
            caregiverNote: 'Breakfast support completed and client appeared comfortable.',
            familySummary: 'Breakfast support completed.',
          },
        ],
        incidents: ['low'],
        concerns: ['schedule_update'],
      });
    expect(response.status).toBe(201);
    expect(response.body.requiresApproval).toBe(true);
    expect(Array.isArray(response.body.openFollowUps)).toBe(true);

    response = await request(app.getHttpServer())
      .post('/api/ai/risk-signals')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        records: [
          {
            clientId: 'client-david',
            clientName: 'David Miller',
            caregiverId: 'cg-joseph',
            caregiverName: 'Joseph Lee',
            lateVisits: 2,
            incompleteTasks: 1,
            concerns: 2,
            incidents: 0,
            missingNotes: 0,
            checkoutMissing: 0,
          },
        ],
      });
    expect(response.status).toBe(201);
    expect(response.body.riskSignals.length).toBeGreaterThan(0);

    response = await request(app.getHttpServer())
      .post('/api/ai/next-actions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        attentionQueue: [
          {
            id: 'late:visit-david-am',
            type: 'late_visit',
            trigger: 'Caregiver has not checked in after the grace period.',
            recommendedAction: 'Coordinator follow-up',
            clientName: 'David Miller',
            caregiverName: 'Joseph Lee',
          },
        ],
      });
    expect(response.status).toBe(201);
    expect(response.body.prioritizedActions.length).toBeGreaterThan(0);

    const caregiverForbidden = await request(app.getHttpServer())
      .post('/api/ai/visit-summary')
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({
        visitId: 'visit-maria-am',
        careNote: 'rough note',
        checklist: [{ label: 'Breakfast support', required: true, status: 'done' }],
      });
    expect(caregiverForbidden.status).toBe(403);
  });

  it('validates CSV imports and keeps them agency-scoped', async () => {
    const importedSecondAgencyEmail = `imported.second.agency.${process.pid}.${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    let response = await request(app.getHttpServer())
      .post('/api/imports/caregivers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        csv: 'firstName,lastName,email,phone,language,status\nMissing,Language,not-an-email,+15550000000,en,active',
      });
    expect(response.status).toBe(201);
    expect(response.body.failedRows).toBe(1);
    expect(response.body.errors[0].field).toBe('email');
    expect(response.body.errors[0].suggestion).toBeDefined();

    response = await request(app.getHttpServer())
      .post('/api/imports/caregivers')
      .set('Authorization', `Bearer ${secondAgencyOwnerToken}`)
      .send({
        csv: `firstName,lastName,email,phone,status,language\nSecond,Agency,${importedSecondAgencyEmail},+15553334444,active,en`,
      });
    expect(response.status).toBe(201);
    expect(response.body.successRows).toBe(1);
    expect(response.body.failedRows).toBe(0);

    await connect(process.env.MONGODB_URI!);
    const importedUser = await connection.collection('users').findOne({
      email: importedSecondAgencyEmail,
    });
    const firstAgencyUser = await connection.collection('users').findOne({
      email: importedSecondAgencyEmail,
      agencyId: { $ne: importedUser!.agencyId },
    });
    expect(importedUser).not.toBeNull();
    expect(firstAgencyUser).toBeNull();
    await connection.close();
  });

  it('exposes import templates and import history to admins only', async () => {
    let response = await request(app.getHttpServer())
      .get('/api/imports/templates/caregivers')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.fileName).toBe('caregivers.csv');
    expect(response.body.content).toContain('firstName,lastName,email,phone,language,status');

    response = await request(app.getHttpServer())
      .get('/api/imports')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    const firstJobId = response.body[0]._id;
    response = await request(app.getHttpServer())
      .get(`/api/imports/${firstJobId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(firstJobId);

    const forbidden = await request(app.getHttpServer())
      .post('/api/imports/caregivers')
      .set('Authorization', `Bearer ${caregiver1Token}`)
      .send({
        csv: 'firstName,lastName,email,phone,language,status\nNo,Access,no.access@example.com,+15550000000,en,active',
      });
    expect(forbidden.status).toBe(403);
  });
});
