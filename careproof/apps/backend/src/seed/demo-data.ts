import * as argon2 from 'argon2';
import { Connection, Types } from 'mongoose';
import { UserRole } from '../users/user.schema';
import { VisitStatus } from '../visits/visit.schema';

type SeedUser = {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  language: string;
  permissions: string[];
  auth: { passwordHash: string; refreshTokenHash: null; mfaEnabled: boolean };
  seedKey: string;
};

type SeedClient = {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  status: string;
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
  };
  emergencyContacts: Array<{ name: string; relationship: string; phone: string }>;
  familyMemberIds: Types.ObjectId[];
  caregiverIds: Types.ObjectId[];
  riskLevel: 'normal' | 'watch' | 'high';
};

const CARE_TASKS = [
  { taskId: 'meal_assistance', label: 'Meal assistance', required: true, instructions: 'Prepare a light meal and offer water.' },
  { taskId: 'medication_reminder', label: 'Medication reminder', required: true, instructions: 'Reminder only. Do not administer medication.' },
  { taskId: 'mobility_support', label: 'Mobility support', required: true, instructions: 'Assist with walker and supervise transfer.' },
];

const CARE_NOTES = [
  'Client was calm and cooperative today. No major concerns were reported.',
  'Client ate well and stayed engaged during the visit.',
  'Client seemed tired but accepted support and hydration.',
  'Client reported mild discomfort when standing. Family follow-up recommended.',
  'Client refused meal assistance but accepted medication reminder.',
  'Client needed extra help with mobility and preferred a shorter walk.',
];

const ADDRESS_POOL = [
  ['123 Main St', 'Arlington', 'VA', '22201'],
  ['45 Oak Ave', 'Fairfax', 'VA', '22030'],
  ['812 Maple Ct', 'Bethesda', 'MD', '20814'],
  ['19 River Rd', 'Silver Spring', 'MD', '20901'],
  ['304 Park Pl', 'Washington', 'DC', '20008'],
  ['77 Cedar Ln', 'Alexandria', 'VA', '22314'],
  ['221 Elm St', 'Rockville', 'MD', '20850'],
  ['65 Linden Way', 'Hyattsville', 'MD', '20782'],
  ['490 Pine St', 'Washington', 'DC', '20016'],
  ['108 Birch Dr', 'Falls Church', 'VA', '22046'],
  ['72 Walnut St', 'Gaithersburg', 'MD', '20877'],
  ['17 Aspen Rd', 'Takoma Park', 'MD', '20912'],
  ['341 Valley Dr', 'Reston', 'VA', '20190'],
  ['58 Garden Pl', 'Vienna', 'VA', '22180'],
  ['209 Willow Ct', 'Chevy Chase', 'MD', '20815'],
  ['511 Forest Ave', 'Washington', 'DC', '20011'],
  ['74 Harbor Rd', 'Annapolis', 'MD', '21401'],
  ['120 Meadow St', 'McLean', 'VA', '22101'],
] as const;

function atTime(base: Date, hour: number, minute: number) {
  const value = new Date(base);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function daysAgo(base: Date, days: number, hour: number, minute: number) {
  const value = atTime(base, hour, minute);
  value.setDate(value.getDate() - days);
  return value;
}

function taskSet(
  mode: 'scheduled' | 'late' | 'missed' | 'in_progress' | 'completed' | 'requires_review',
  completedAt?: Date,
) {
  return CARE_TASKS.map((task, index) => {
    if (mode === 'scheduled' || mode === 'late' || mode === 'missed') {
      return { ...task, status: 'pending', note: '', completedAt: null };
    }
    if (mode === 'in_progress') {
      return {
        ...task,
        status: index === 0 ? 'done' : 'pending',
        note: index === 0 ? 'Initial support completed.' : '',
        completedAt: index === 0 ? completedAt ?? new Date() : null,
      };
    }
    if (mode === 'requires_review') {
      return {
        ...task,
        status: index === 0 ? 'done' : index === 1 ? 'done' : 'skipped',
        note: index === 2 ? 'client refused and reported dizziness' : '',
        completedAt: completedAt ?? new Date(),
      };
    }
    return {
      ...task,
      status: 'done',
      note: '',
      completedAt: completedAt ?? new Date(),
    };
  });
}

function buildVisitRecord({
  agencyId,
  client,
  caregiverId,
  scheduledStart,
  durationMinutes = 120,
  status,
  note,
  familySummary,
}: {
  agencyId: Types.ObjectId;
  client: SeedClient;
  caregiverId: Types.ObjectId;
  scheduledStart: Date;
  durationMinutes?: number;
  status: VisitStatus;
  note: string;
  familySummary: string;
}) {
  const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
  const actualStart =
    status === VisitStatus.COMPLETED || status === VisitStatus.IN_PROGRESS || status === VisitStatus.REQUIRES_REVIEW
      ? new Date(scheduledStart.getTime() + 3 * 60_000)
      : null;
  const actualEnd =
    status === VisitStatus.COMPLETED || status === VisitStatus.REQUIRES_REVIEW
      ? new Date(scheduledEnd.getTime() - 4 * 60_000)
      : null;
  const requiresReview = status === VisitStatus.REQUIRES_REVIEW;
  return {
    _id: new Types.ObjectId(),
    agencyId,
    clientId: client._id,
    caregiverId,
    scheduledStart,
    scheduledEnd,
    actualStart,
    actualEnd,
    status,
    location: {
      expected: { lat: 38.9072, lng: -77.0369 },
      checkIn: actualStart ? { lat: 38.9074, lng: -77.0371 } : null,
      checkOut: actualEnd ? { lat: 38.9074, lng: -77.0371 } : null,
    },
    tasks: taskSet(
      requiresReview
        ? 'requires_review'
        : status === VisitStatus.COMPLETED
          ? 'completed'
          : status === VisitStatus.IN_PROGRESS
            ? 'in_progress'
            : status === VisitStatus.LATE
              ? 'late'
              : status === VisitStatus.MISSED
                ? 'missed'
                : 'scheduled',
      actualEnd ?? actualStart ?? scheduledStart,
    ),
    caregiverNote: {
      rawText: status === VisitStatus.SCHEDULED || status === VisitStatus.LATE || status === VisitStatus.MISSED ? '' : note,
      cleanText:
        status === VisitStatus.SCHEDULED || status === VisitStatus.LATE || status === VisitStatus.MISSED ? '' : note,
      language: 'en',
    },
    familySummary: {
      text:
        status === VisitStatus.COMPLETED || status === VisitStatus.REQUIRES_REVIEW
          ? familySummary
          : '',
      sentAt: status === VisitStatus.COMPLETED || status === VisitStatus.REQUIRES_REVIEW ? new Date() : null,
      sentTo: client.familyMemberIds,
    },
    incidentIds: [] as Types.ObjectId[],
    locked:
      status === VisitStatus.COMPLETED ||
      status === VisitStatus.REQUIRES_REVIEW ||
      status === VisitStatus.CANCELLED,
    deletedAt: null,
    deletedBy: null,
  };
}

export async function seedDemoData(connection: Connection) {
  const agencyId = new Types.ObjectId();
  const passwordHash = await argon2.hash('Password123!');
  const now = new Date();
  const weekStart = daysAgo(now, 6, 0, 0);

  const agency = {
    _id: agencyId,
    name: 'BrightPath Home Care',
    status: 'active',
    timezone: 'America/New_York',
    region: 'Maryland / Virginia / Washington DC',
    serviceType: 'Private-pay non-medical home care agency',
    settings: {
      familyUpdatesEnabled: true,
      gpsRequired: true,
      voiceNotesEnabled: true,
      weeklyReportsEnabled: true,
    },
  };

  await connection.collection('agencies').insertOne(agency);

  const baseUsers: Array<[string, string, string, string, UserRole]> = [
    ['owner', 'BrightPath', 'Owner', 'owner@careproof.demo', UserRole.AGENCY_OWNER],
    ['coordinator', 'Leah', 'Morgan', 'coordinator@careproof.demo', UserRole.CARE_COORDINATOR],
    ['coordinator2', 'Marcus', 'Hall', 'coordinator2@careproof.demo', UserRole.CARE_COORDINATOR],
    ['caregiver1', 'Ana', 'Smith', 'caregiver1@careproof.demo', UserRole.CAREGIVER],
    ['caregiver2', 'Joseph', 'Lee', 'caregiver2@careproof.demo', UserRole.CAREGIVER],
    ['caregiver3', 'Grace', 'Adams', 'caregiver3@careproof.demo', UserRole.CAREGIVER],
    ['caregiver4', 'Fatima', 'Ali', 'caregiver4@careproof.demo', UserRole.CAREGIVER],
    ['caregiver5', 'Michael', 'Chen', 'caregiver5@careproof.demo', UserRole.CAREGIVER],
    ['caregiver6', 'Oscar', 'James', 'caregiver6@careproof.demo', UserRole.CAREGIVER],
    ['caregiver7', 'Nadia', 'White', 'caregiver7@careproof.demo', UserRole.CAREGIVER],
    ['caregiver8', 'Peter', 'Long', 'caregiver8@careproof.demo', UserRole.CAREGIVER],
    ['caregiver9', 'Claire', 'Young', 'caregiver9@careproof.demo', UserRole.CAREGIVER],
    ['caregiver10', 'Samuel', 'Green', 'caregiver10@careproof.demo', UserRole.CAREGIVER],
    ['caregiver11', 'Priya', 'Ross', 'caregiver11@careproof.demo', UserRole.CAREGIVER],
    ['caregiver12', 'Leo', 'Gray', 'caregiver12@careproof.demo', UserRole.CAREGIVER],
    ['nurse', 'Clara', 'Nurse', 'nurse@careproof.demo', UserRole.NURSE],
    ['socialworker', 'Marcus', 'Social', 'social@careproof.demo', UserRole.SOCIAL_WORKER],
    ['intake', 'Aisha', 'Intake', 'intake@careproof.demo', UserRole.INTAKE_AGENT],
    ['family1', 'Emily', 'Johnson', 'family1@careproof.demo', UserRole.FAMILY_MEMBER],
  ];

  const users: SeedUser[] = baseUsers.map(([seedKey, firstName, lastName, email, role]) => ({
    _id: new Types.ObjectId(),
    agencyId,
    role,
    firstName,
    lastName,
    email,
    phone: '+15550000000',
    status: 'active',
    language: 'en',
    permissions: [],
    auth: { passwordHash, refreshTokenHash: null, mfaEnabled: false },
    seedKey,
  }));

  for (let index = 2; index <= 22; index += 1) {
    users.push({
      _id: new Types.ObjectId(),
      agencyId,
      role: UserRole.FAMILY_MEMBER,
      firstName: `Family${index}`,
      lastName: 'Contact',
      email: `family${index}@careproof.demo`,
      phone: `+15550000${String(index).padStart(3, '0')}`,
      status: 'active',
      language: index % 4 === 0 ? 'es' : 'en',
      permissions: [],
      auth: { passwordHash, refreshTokenHash: null, mfaEnabled: false },
      seedKey: `family${index}`,
    });
  }

  await connection.collection('users').insertMany(users);

  const userBySeedKey = new Map(users.map((user) => [user.seedKey, user]));
  const caregivers = users.filter((user) => user.role === UserRole.CAREGIVER);
  const familyMembers = users.filter((user) => user.role === UserRole.FAMILY_MEMBER);
  const coordinators = users.filter((user) => user.role === UserRole.CARE_COORDINATOR);

  const clientNames: Array<[string, string]> = [
    ['Maria', 'Johnson'],
    ['David', 'Miller'],
    ['Helen', 'Carter'],
    ['Samuel', 'Brooks'],
    ['Ruth', 'Williams'],
    ['George', 'Brown'],
    ['Irene', 'Davis'],
    ['Lisa', 'Taylor'],
    ['Nina', 'Jackson'],
    ['Paul', 'Martin'],
    ['Rosa', 'Hall'],
    ['Henry', 'Stone'],
    ['Marcus', 'King'],
    ['Evelyn', 'Perry'],
    ['Walter', 'Ross'],
    ['Doris', 'Clark'],
    ['Theo', 'Diaz'],
    ['Grace', 'Young'],
  ];

  const clients: SeedClient[] = clientNames.map(([firstName, lastName], index) => {
    const [line1, city, state, zip] = ADDRESS_POOL[index];
    const riskLevel = index < 2 ? 'high' : index < 5 ? 'watch' : 'normal';
    const familyIds = [familyMembers[index]._id];
    if (index < 4) {
      familyIds.push(familyMembers[index + 18]._id);
    }
    return {
      _id: new Types.ObjectId(),
      agencyId,
      firstName,
      lastName,
      dateOfBirth: new Date(1940 + index, (index % 11) + 1, (index % 26) + 1),
      status: 'active',
      address: { line1, city, state, zip },
      emergencyContacts: [
        {
          name: `${lastName} Family Contact`,
          relationship: index % 2 === 0 ? 'Son' : 'Daughter',
          phone: `+1555111${String(index).padStart(4, '0')}`,
        },
      ],
      familyMemberIds: familyIds,
      caregiverIds: [caregivers[index % caregivers.length]._id],
      riskLevel,
    };
  });

  await connection.collection('clients').insertMany(clients);

  await connection.collection('carePlans').insertMany(
    clients.map((client, index) => ({
      _id: new Types.ObjectId(),
      agencyId,
      clientId: client._id,
      status: 'active',
      templateKey: index % 2 === 0 ? 'standard_morning' : 'standard_afternoon',
      tasks: CARE_TASKS,
      specialInstructions:
        index === 0
          ? 'Use walker for mobility. Offer water every hour. Reminder only for medication.'
          : index % 3 === 0
            ? 'Encourage hydration and supervise transfers.'
            : 'Check meal intake and support light mobility.',
    })),
  );

  const todayVisits = [
    buildVisitRecord({
      agencyId,
      client: clients[0],
      caregiverId: userBySeedKey.get('caregiver1')!._id,
      scheduledStart: atTime(now, 9, 0),
      status: VisitStatus.SCHEDULED,
      note: '',
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[5],
      caregiverId: userBySeedKey.get('caregiver2')!._id,
      scheduledStart: atTime(now, 8, 0),
      status: VisitStatus.COMPLETED,
      note: CARE_NOTES[1],
      familySummary:
        'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed. The caregiver noted: Client ate well and stayed engaged during the visit.',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[6],
      caregiverId: userBySeedKey.get('caregiver3')!._id,
      scheduledStart: atTime(now, 8, 30),
      status: VisitStatus.COMPLETED,
      note: CARE_NOTES[2],
      familySummary:
        'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed. The caregiver noted: Client seemed tired but accepted support and hydration.',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[7],
      caregiverId: userBySeedKey.get('caregiver4')!._id,
      scheduledStart: atTime(now, 10, 0),
      status: VisitStatus.COMPLETED,
      note: CARE_NOTES[0],
      familySummary:
        'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed. The caregiver noted: Client was calm and cooperative today. No major concerns were reported.',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[8],
      caregiverId: userBySeedKey.get('caregiver5')!._id,
      scheduledStart: atTime(now, 10, 30),
      status: VisitStatus.COMPLETED,
      note: CARE_NOTES[1],
      familySummary:
        'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed. The caregiver noted: Client ate well and stayed engaged during the visit.',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[9],
      caregiverId: userBySeedKey.get('caregiver6')!._id,
      scheduledStart: atTime(now, 11, 0),
      status: VisitStatus.COMPLETED,
      note: CARE_NOTES[2],
      familySummary:
        'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed. The caregiver noted: Client seemed tired but accepted support and hydration.',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[10],
      caregiverId: userBySeedKey.get('caregiver7')!._id,
      scheduledStart: atTime(now, 12, 0),
      status: VisitStatus.COMPLETED,
      note: CARE_NOTES[0],
      familySummary:
        'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed. The caregiver noted: Client was calm and cooperative today. No major concerns were reported.',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[1],
      caregiverId: userBySeedKey.get('caregiver8')!._id,
      scheduledStart: new Date(now.getTime() - 50 * 60_000),
      durationMinutes: 120,
      status: VisitStatus.IN_PROGRESS,
      note: CARE_NOTES[3],
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[11],
      caregiverId: userBySeedKey.get('caregiver9')!._id,
      scheduledStart: new Date(now.getTime() - 35 * 60_000),
      durationMinutes: 90,
      status: VisitStatus.IN_PROGRESS,
      note: CARE_NOTES[1],
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[12],
      caregiverId: userBySeedKey.get('caregiver10')!._id,
      scheduledStart: new Date(now.getTime() - 20 * 60_000),
      durationMinutes: 90,
      status: VisitStatus.IN_PROGRESS,
      note: CARE_NOTES[2],
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[2],
      caregiverId: userBySeedKey.get('caregiver11')!._id,
      scheduledStart: new Date(now.getTime() - 70 * 60_000),
      durationMinutes: 120,
      status: VisitStatus.LATE,
      note: '',
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[3],
      caregiverId: userBySeedKey.get('caregiver12')!._id,
      scheduledStart: new Date(now.getTime() - 45 * 60_000),
      durationMinutes: 120,
      status: VisitStatus.LATE,
      note: '',
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[4],
      caregiverId: userBySeedKey.get('caregiver1')!._id,
      scheduledStart: new Date(now.getTime() - 4 * 60 * 60_000),
      durationMinutes: 60,
      status: VisitStatus.MISSED,
      note: '',
      familySummary: '',
    }),
    buildVisitRecord({
      agencyId,
      client: clients[13],
      caregiverId: userBySeedKey.get('caregiver2')!._id,
      scheduledStart: new Date(now.getTime() - 2 * 60 * 60_000),
      durationMinutes: 90,
      status: VisitStatus.REQUIRES_REVIEW,
      note: 'Client reported dizziness when standing and refused mobility support. Family follow-up recommended.',
      familySummary:
        'Today’s visit was completed and is being reviewed by the agency. The agency will follow up if needed.',
    }),
  ];

  const historicalStatusPattern: VisitStatus[] = [
    ...Array.from({ length: 48 }, () => VisitStatus.COMPLETED),
    ...Array.from({ length: 10 }, () => VisitStatus.SCHEDULED),
    ...Array.from({ length: 6 }, () => VisitStatus.LATE),
    ...Array.from({ length: 4 }, () => VisitStatus.MISSED),
    ...Array.from({ length: 2 }, () => VisitStatus.REQUIRES_REVIEW),
    ...Array.from({ length: 2 }, () => VisitStatus.CANCELLED),
  ];

  const historicalVisits = historicalStatusPattern.map((status, index) =>
    buildVisitRecord({
      agencyId,
      client: clients[(index + 1) % clients.length],
      caregiverId: caregivers[(index + 2) % caregivers.length]._id,
      scheduledStart: daysAgo(now, (index % 6) + 1, 8 + (index % 9), index % 2 === 0 ? 0 : 30),
      durationMinutes: 120,
      status,
      note: CARE_NOTES[index % CARE_NOTES.length],
      familySummary:
        status === VisitStatus.REQUIRES_REVIEW
          ? 'Today’s visit was completed and is being reviewed by the agency. The agency will follow up if needed.'
          : 'Today’s visit was completed. Meal assistance, medication reminder, and mobility support were completed.',
    }),
  );

  const visits = [...todayVisits, ...historicalVisits].map((visit) => {
    if (visit.status === VisitStatus.CANCELLED) {
      return {
        ...visit,
        actualStart: null,
        actualEnd: null,
        caregiverNote: { rawText: '', cleanText: '', language: 'en' },
        familySummary: { text: '', sentAt: null, sentTo: [] },
        tasks: CARE_TASKS.map((task) => ({ ...task, status: 'not_required', note: 'visit cancelled', completedAt: null })),
      };
    }
    return visit;
  });

  const maryVisit = todayVisits[0];
  const reviewVisit = todayVisits[13];

  const incidents = [
    {
      _id: new Types.ObjectId(),
      agencyId,
      visitId: reviewVisit._id,
      clientId: reviewVisit.clientId,
      caregiverId: reviewVisit.caregiverId,
      type: 'fall',
      severity: 'high',
      description: 'Client became unsteady during transfer and nearly fell while standing.',
      actionsTaken: 'Caregiver stabilized client, seated client safely, and alerted coordinator.',
      status: 'reviewing',
      familyVisible: false,
      reviewedBy: coordinators[0]._id,
      reviewedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(now.getTime() - 95 * 60_000),
      updatedAt: new Date(now.getTime() - 95 * 60_000),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      visitId: historicalVisits[4]._id,
      clientId: historicalVisits[4].clientId,
      caregiverId: historicalVisits[4].caregiverId,
      type: 'pain_discomfort',
      severity: 'medium',
      description: 'Client reported hip pain during mobility support.',
      actionsTaken: 'Caregiver reduced walking time and logged note for coordinator follow-up.',
      status: 'new',
      familyVisible: false,
      reviewedBy: null,
      reviewedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 2, 11, 20),
      updatedAt: daysAgo(now, 2, 11, 20),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      visitId: historicalVisits[11]._id,
      clientId: historicalVisits[11].clientId,
      caregiverId: historicalVisits[11].caregiverId,
      type: 'refused_care',
      severity: 'medium',
      description: 'Client refused bathing support and requested follow-up from agency.',
      actionsTaken: 'Caregiver documented refusal and advised coordinator.',
      status: 'new',
      familyVisible: false,
      reviewedBy: null,
      reviewedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 1, 14, 10),
      updatedAt: daysAgo(now, 1, 14, 10),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      visitId: historicalVisits[16]._id,
      clientId: historicalVisits[16].clientId,
      caregiverId: historicalVisits[16].caregiverId,
      type: 'no_access',
      severity: 'medium',
      description: 'Caregiver could not access the home because the client did not answer the door.',
      actionsTaken: 'Coordinator attempted family contact and requested schedule confirmation.',
      status: 'new',
      familyVisible: true,
      reviewedBy: null,
      reviewedAt: null,
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 3, 9, 30),
      updatedAt: daysAgo(now, 3, 9, 30),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      visitId: historicalVisits[22]._id,
      clientId: historicalVisits[22].clientId,
      caregiverId: historicalVisits[22].caregiverId,
      type: 'behavior_change',
      severity: 'medium',
      description: 'Client showed an unusual behavior change and needed extra reassurance.',
      actionsTaken: 'Caregiver documented the change and requested agency follow-up.',
      status: 'resolved',
      familyVisible: false,
      reviewedBy: coordinators[0]._id,
      reviewedAt: daysAgo(now, 1, 18, 45),
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 1, 17, 20),
      updatedAt: daysAgo(now, 1, 18, 45),
    },
  ];

  reviewVisit.incidentIds = [incidents[0]._id];
  historicalVisits[4].incidentIds = [incidents[1]._id];
  historicalVisits[11].incidentIds = [incidents[2]._id];
  historicalVisits[16].incidentIds = [incidents[3]._id];
  historicalVisits[22].incidentIds = [incidents[4]._id];

  await connection.collection('visits').insertMany(visits);
  await connection.collection('incidentReports').insertMany(incidents);

  const familyConcerns = [
    {
      _id: new Types.ObjectId(),
      agencyId,
      clientId: clients[3]._id,
      familyMemberId: clients[3].familyMemberIds[0],
      category: 'care_quality',
      message: 'Please confirm whether lunch support was completed today.',
      status: 'new',
      assignedTo: coordinators[1]._id,
      resolutionNote: '',
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(now.getTime() - 3 * 60 * 60_000),
      updatedAt: new Date(now.getTime() - 3 * 60 * 60_000),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      clientId: clients[0]._id,
      familyMemberId: clients[0].familyMemberIds[0],
      category: 'health_concern',
      message: 'Maria sounded more tired than usual. Please let me know if anything changed.',
      status: 'reviewing',
      assignedTo: coordinators[0]._id,
      resolutionNote: '',
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(now.getTime() - 40 * 60_000),
      updatedAt: new Date(now.getTime() - 40 * 60_000),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      clientId: clients[13]._id,
      familyMemberId: clients[13].familyMemberIds[0],
      category: 'schedule',
      message: 'Can someone confirm why the caregiver arrived late this week?',
      status: 'reviewing',
      assignedTo: coordinators[0]._id,
      resolutionNote: '',
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 1, 16, 45),
      updatedAt: daysAgo(now, 1, 16, 45),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      clientId: clients[1]._id,
      familyMemberId: clients[1].familyMemberIds[0],
      category: 'caregiver',
      message: 'Please have the agency call me back about today’s visit review.',
      status: 'responded',
      assignedTo: coordinators[1]._id,
      resolutionNote: '',
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 2, 13, 5),
      updatedAt: daysAgo(now, 2, 13, 5),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      clientId: clients[4]._id,
      familyMemberId: clients[4].familyMemberIds[0],
      category: 'medication_reminder',
      message: 'Please confirm whether the medication reminder was completed yesterday.',
      status: 'new',
      assignedTo: coordinators[0]._id,
      resolutionNote: '',
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 1, 10, 20),
      updatedAt: daysAgo(now, 1, 10, 20),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      clientId: clients[5]._id,
      familyMemberId: clients[5].familyMemberIds[0],
      category: 'weekly_summary',
      message: 'Can the family receive the weekly summary before Friday afternoon?',
      status: 'resolved',
      assignedTo: coordinators[1]._id,
      resolutionNote: 'Confirmed family delivery preference and updated account note.',
      deletedAt: null,
      deletedBy: null,
      createdAt: daysAgo(now, 4, 15, 0),
      updatedAt: daysAgo(now, 3, 11, 0),
    },
  ];

  await connection.collection('familyConcerns').insertMany(familyConcerns);

  const weeklyReports = Array.from({ length: 6 }, (_, index) => ({
    _id: new Types.ObjectId(),
    agencyId,
    clientId: clients[index]._id,
    weekStart,
    weekEnd: now,
    summary: JSON.stringify({
      clientName: `${clients[index].firstName} ${clients[index].lastName}`,
      completedVisits: index === 0 ? 5 : 4,
      lateVisits: index < 2 ? 1 : 0,
      missedVisits: index === 4 ? 1 : 0,
      careTasksSummary: {
        'Meal assistance': 4 + (index % 2),
        'Medication reminder': 5,
        'Mobility support': 3 + (index % 2),
      },
      notableNotes: [CARE_NOTES[index % CARE_NOTES.length]],
      agencyFollowUp: index < 2 ? 'The agency will follow up if needed.' : 'No additional follow-up is planned.',
    }),
    status: index === 0 ? 'ready' : index === 1 ? 'sent' : 'draft',
    sentAt: index === 1 ? now : null,
    createdAt: now,
    updatedAt: now,
  }));

  await connection.collection('weeklyReports').insertMany(weeklyReports);

  const notifications = [
    {
      _id: new Types.ObjectId(),
      agencyId,
      userId: clients[0].familyMemberIds[0],
      type: 'visit_completed',
      channel: 'email',
      audience: 'family',
      subject: "Maria's visit was completed",
      message:
        'Maria’s visit was completed today. Meal assistance, medication reminder, and mobility support were completed.',
      status: 'sent',
      recipient: 'family1@careproof.demo',
      metadata: { clientId: clients[0]._id.toString(), visitId: maryVisit._id.toString() },
      sentAt: new Date(now.getTime() - 4 * 60_000),
      failureReason: '',
      createdAt: new Date(now.getTime() - 5 * 60_000),
      updatedAt: new Date(now.getTime() - 4 * 60_000),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      userId: userBySeedKey.get('owner')!._id,
      type: 'incident_submitted',
      channel: 'email',
      audience: 'agency',
      subject: 'High-severity incident reported for David Miller',
      message:
        'A high-severity incident was submitted for David Miller. Please review this incident in the CareProof dashboard before sending any family-facing update.',
      status: 'queued',
      recipient: 'owner@careproof.demo',
      metadata: { clientId: clients[1]._id.toString(), visitId: reviewVisit._id.toString() },
      sentAt: null,
      failureReason: '',
      createdAt: new Date(now.getTime() - 92 * 60_000),
      updatedAt: new Date(now.getTime() - 92 * 60_000),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      userId: userBySeedKey.get('coordinator')!._id,
      type: 'family_concern_submitted',
      channel: 'email',
      audience: 'agency',
      subject: 'New family concern for Samuel Brooks',
      message: 'A family member submitted a new concern. Please review and respond from the Family Concerns queue.',
      status: 'sent',
      recipient: 'coordinator@careproof.demo',
      metadata: { clientId: clients[3]._id.toString(), concernId: familyConcerns[0]._id.toString() },
      sentAt: new Date(now.getTime() - 2.5 * 60 * 60_000),
      failureReason: '',
      createdAt: new Date(now.getTime() - 3 * 60 * 60_000),
      updatedAt: new Date(now.getTime() - 2.5 * 60 * 60_000),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      userId: clients[0].familyMemberIds[0],
      type: 'weekly_report_ready',
      channel: 'email',
      audience: 'family',
      subject: "Maria's weekly care report is ready",
      message: 'Maria’s weekly care report is ready to review in CareProof.',
      status: 'queued',
      recipient: 'family1@careproof.demo',
      metadata: { clientId: clients[0]._id.toString(), reportId: weeklyReports[0]._id.toString() },
      sentAt: null,
      failureReason: '',
      createdAt: daysAgo(now, 1, 18, 0),
      updatedAt: daysAgo(now, 1, 18, 0),
    },
    {
      _id: new Types.ObjectId(),
      agencyId,
      userId: userBySeedKey.get('coordinator2')!._id,
      type: 'visit_requires_review',
      channel: 'email',
      audience: 'agency',
      subject: 'Visit requires review for Ruth Williams',
      message: 'A visit requires agency review because a required task was skipped.',
      status: 'queued',
      recipient: 'coordinator2@careproof.demo',
      metadata: { clientId: clients[4]._id.toString(), visitId: todayVisits[12]._id.toString() },
      sentAt: null,
      failureReason: '',
      createdAt: new Date(now.getTime() - 4 * 60 * 60_000),
      updatedAt: new Date(now.getTime() - 4 * 60 * 60_000),
    },
  ];

  await connection.collection('notifications').insertMany(notifications);

  const visitEvents = [
    { _id: new Types.ObjectId(), agencyId, visitId: maryVisit._id, actorUserId: userBySeedKey.get('owner')!._id, type: 'VISIT_CREATED', message: 'Visit scheduled', metadata: {}, createdAt: new Date(now.getTime() - 8 * 60 * 60_000) },
  ];

  const auditLogs = visitEvents.map((event) => ({
    _id: new Types.ObjectId(),
    agencyId,
    actorUserId: event.actorUserId,
    action: event.type,
    entityType: 'visit',
    entityId: event.visitId.toString(),
    before: {},
    after: { message: event.message, metadata: event.metadata },
    ipAddress: '127.0.0.1',
    deviceId: 'demo-seed',
    status: 'active',
    deletedAt: null,
    deletedBy: null,
    createdAt: event.createdAt,
  }));

  await connection.collection('visitEvents').insertMany(visitEvents);
  await connection.collection('auditLogs').insertMany(auditLogs);

  const coordinatorUser = userBySeedKey.get('coordinator')!;

  const caregiver1User = userBySeedKey.get('caregiver1')!;
  const caregiver2User = userBySeedKey.get('caregiver2')!;

  await connection.collection('nurseApprovals').insertMany([
    {
      agencyId,
      visitId: new Types.ObjectId(),
      caregiverId: caregiver1User._id,
      clientName: 'Maria Johnson',
      caregiverName: 'Ana Smith',
      visitDate: atTime(now, 9, 0).toISOString().split('T')[0],
      visitType: 'Personal Care',
      status: 'pending_review',
      nurseNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 1, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      visitId: new Types.ObjectId(),
      caregiverId: caregiver2User._id,
      clientName: 'Robert Chen',
      caregiverName: 'Joseph Lee',
      visitDate: daysAgo(now, 2, 0, 0).toISOString().split('T')[0],
      visitType: 'Skilled Nursing',
      status: 'approved',
      nurseNotes: 'All vitals within normal range. Care plan followed.',
      reviewedBy: coordinatorUser._id,
      reviewedAt: daysAgo(now, 1, 0, 0),
      deletedAt: null,
      createdAt: daysAgo(now, 3, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      visitId: new Types.ObjectId(),
      caregiverId: caregiver1User._id,
      clientName: 'Dorothy Williams',
      caregiverName: 'Ana Smith',
      visitDate: daysAgo(now, 3, 0, 0).toISOString().split('T')[0],
      visitType: 'Medication Management',
      status: 'needs_clarification',
      nurseNotes: 'Patient reported dizziness after medication. Follow-up required.',
      reviewedBy: coordinatorUser._id,
      reviewedAt: daysAgo(now, 2, 0, 0),
      deletedAt: null,
      createdAt: daysAgo(now, 4, 0, 0),
      updatedAt: daysAgo(now, 2, 0, 0),
    },
  ]);

  await connection.collection('inspectionRules').insertMany([
    { agencyId, ruleCode: 'CARE-001', description: 'Care plan must be signed within 24 hours of visit', severity: 'critical', category: 'Documentation', active: true, deletedAt: null, createdAt: daysAgo(now, 30, 0, 0), updatedAt: daysAgo(now, 30, 0, 0) },
    { agencyId, ruleCode: 'CARE-002', description: 'Caregiver must complete required training annually', severity: 'high', category: 'Training', active: true, deletedAt: null, createdAt: daysAgo(now, 30, 0, 0), updatedAt: daysAgo(now, 30, 0, 0) },
    { agencyId, ruleCode: 'CARE-003', description: 'Incident reports must be filed within 2 hours', severity: 'critical', category: 'Reporting', active: true, deletedAt: null, createdAt: daysAgo(now, 30, 0, 0), updatedAt: daysAgo(now, 30, 0, 0) },
    { agencyId, ruleCode: 'CARE-004', description: 'Medication logs must be completed at each visit', severity: 'high', category: 'Medication', active: true, deletedAt: null, createdAt: daysAgo(now, 30, 0, 0), updatedAt: daysAgo(now, 30, 0, 0) },
    { agencyId, ruleCode: 'CARE-005', description: 'Client rights must be reviewed quarterly', severity: 'medium', category: 'Compliance', active: true, deletedAt: null, createdAt: daysAgo(now, 30, 0, 0), updatedAt: daysAgo(now, 30, 0, 0) },
    { agencyId, ruleCode: 'CARE-006', description: 'Emergency contact info must be current', severity: 'medium', category: 'Safety', active: true, deletedAt: null, createdAt: daysAgo(now, 30, 0, 0), updatedAt: daysAgo(now, 30, 0, 0) },
  ]);

  const seededRules = await connection.collection('inspectionRules').find({ agencyId }).toArray();

  await connection.collection('inspectionFindings').insertMany([
    {
      agencyId,
      ruleId: seededRules[0]._id,
      title: 'Care plan signature missing for 3 visits',
      severity: 'critical',
      status: 'open',
      description: 'Three visits in the past week have unsigned care plans.',
      assignedTo: 'Care Coordinator',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      resolvedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 2, 0, 0),
      updatedAt: daysAgo(now, 2, 0, 0),
    },
    {
      agencyId,
      ruleId: seededRules[1]._id,
      title: '2 caregivers with expired CPR certification',
      severity: 'high',
      status: 'in_progress',
      description: 'Two caregivers CPR certifications expired last month.',
      assignedTo: 'HR Manager',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      resolvedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 5, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      ruleId: seededRules[2]._id,
      title: 'Incident report filed 4 hours late',
      severity: 'critical',
      status: 'resolved',
      description: 'Report for incident was filed 4 hours past the 2-hour deadline.',
      assignedTo: 'Quality Assurance',
      dueDate: daysAgo(now, 5, 0, 0).toISOString().split('T')[0],
      resolvedAt: daysAgo(now, 3, 0, 0),
      deletedAt: null,
      createdAt: daysAgo(now, 7, 0, 0),
      updatedAt: daysAgo(now, 3, 0, 0),
    },
  ]);

  await connection.collection('socialWorkCases').insertMany([
    {
      agencyId,
      clientName: 'Eleanor Martinez',
      clientId: new Types.ObjectId(),
      assignedWorker: 'Social Worker A',
      category: 'housing',
      status: 'active',
      description: 'Client at risk of losing housing due to non-payment.',
      nextFollowUp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'urgent',
      deletedAt: null,
      createdAt: daysAgo(now, 5, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      clientName: 'George Patterson',
      clientId: new Types.ObjectId(),
      assignedWorker: 'Social Worker B',
      category: 'benefits',
      status: 'pending_review',
      description: 'Medicaid renewal application submitted. Awaiting determination.',
      nextFollowUp: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'high',
      deletedAt: null,
      createdAt: daysAgo(now, 10, 0, 0),
      updatedAt: daysAgo(now, 2, 0, 0),
    },
    {
      agencyId,
      clientName: 'Frances Cooper',
      clientId: new Types.ObjectId(),
      assignedWorker: 'Social Worker A',
      category: 'family',
      status: 'active',
      description: 'Family caregiver burnout. Coordinating respite care and support resources.',
      nextFollowUp: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'medium',
      deletedAt: null,
      createdAt: daysAgo(now, 8, 0, 0),
      updatedAt: daysAgo(now, 3, 0, 0),
    },
  ]);

  await connection.collection('intakeRecords').insertMany([
    {
      agencyId,
      clientName: 'Harold Jenkins',
      agentName: 'Intake Agent A',
      stage: 'assessment',
      referralSource: 'Hospital Discharge',
      primaryDiagnosis: 'Post-surgical recovery',
      insuranceType: 'Medicare',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'high',
      notes: 'Patient discharged from St. Mary\'s. Needs 4 hrs/day personal care.',
      deletedAt: null,
      createdAt: daysAgo(now, 3, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      clientName: 'Sylvia Montgomery',
      agentName: 'Intake Agent B',
      stage: 'authorization',
      referralSource: 'Physician Referral',
      primaryDiagnosis: 'Alzheimer\'s Disease',
      insuranceType: 'Medicaid',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'medium',
      notes: 'Authorization submitted to Medicaid. Waiting approval.',
      deletedAt: null,
      createdAt: daysAgo(now, 7, 0, 0),
      updatedAt: daysAgo(now, 2, 0, 0),
    },
    {
      agencyId,
      clientName: 'Walter Hughes',
      agentName: 'Intake Agent A',
      stage: 'inquiry',
      referralSource: 'Self-Referral',
      primaryDiagnosis: 'COPD',
      insuranceType: 'Private Pay',
      startDate: null,
      priority: 'low',
      notes: 'Initial inquiry call completed. Sending intake packet.',
      deletedAt: null,
      createdAt: daysAgo(now, 1, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
  ]);

  await connection.collection('medicalAvailability').insertMany([
    {
      agencyId,
      clientName: 'Maria Johnson',
      clientId: new Types.ObjectId(),
      serviceType: 'Physical Therapy',
      status: 'confirmed',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      providerName: 'City Rehab Center',
      notes: 'Confirmed via phone. 3 sessions per week.',
      confirmedAt: daysAgo(now, 1, 0, 0),
      deletedAt: null,
      createdAt: daysAgo(now, 5, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      clientName: 'Robert Chen',
      clientId: new Types.ObjectId(),
      serviceType: 'Wound Care',
      status: 'pending',
      scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      providerName: 'Home Health Plus',
      notes: 'Awaiting insurance pre-auth.',
      confirmedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 3, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
    {
      agencyId,
      clientName: 'Dorothy Williams',
      clientId: new Types.ObjectId(),
      serviceType: 'Lab Work',
      status: 'unavailable',
      scheduledDate: daysAgo(now, 1, 0, 0).toISOString().split('T')[0],
      providerName: 'Quest Diagnostics',
      notes: 'Lab closed. Rescheduling required.',
      confirmedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 4, 0, 0),
      updatedAt: daysAgo(now, 1, 0, 0),
    },
  ]);

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fiveDaysAgo = daysAgo(now, 5, 0, 0).toISOString().split('T')[0];
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await connection.collection('expirationRecords').insertMany([
    {
      agencyId,
      caregiverName: 'Sandra Williams',
      caregiverId: new Types.ObjectId(),
      documentType: 'CPR Certification',
      expiryDate: sevenDaysFromNow,
      status: 'expiring_soon',
      renewalSubmittedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 30, 0, 0),
      updatedAt: daysAgo(now, 30, 0, 0),
    },
    {
      agencyId,
      caregiverName: 'James Thompson',
      caregiverId: new Types.ObjectId(),
      documentType: "Driver's License",
      expiryDate: fiveDaysAgo,
      status: 'expired',
      renewalSubmittedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 30, 0, 0),
      updatedAt: daysAgo(now, 30, 0, 0),
    },
    {
      agencyId,
      caregiverName: 'Maria Garcia',
      caregiverId: new Types.ObjectId(),
      documentType: 'First Aid Certification',
      expiryDate: thirtyDaysFromNow,
      status: 'expiring_soon',
      renewalSubmittedAt: daysAgo(now, 2, 0, 0),
      deletedAt: null,
      createdAt: daysAgo(now, 30, 0, 0),
      updatedAt: daysAgo(now, 2, 0, 0),
    },
    {
      agencyId,
      caregiverName: 'Robert Davis',
      caregiverId: new Types.ObjectId(),
      documentType: 'Background Check',
      expiryDate: ninetyDaysFromNow,
      status: 'current',
      renewalSubmittedAt: null,
      deletedAt: null,
      createdAt: daysAgo(now, 365, 0, 0),
      updatedAt: daysAgo(now, 365, 0, 0),
    },
  ]);

  return {
    agencyId: agencyId.toString(),
    counts: {
      users: users.length,
      caregivers: caregivers.length,
      clients: clients.length,
      familyMembers: familyMembers.length,
      visits: visits.length,
      todaysVisits: todayVisits.length,
      incidents: incidents.length,
      familyConcerns: familyConcerns.length,
      weeklyReports: weeklyReports.length,
      notifications: notifications.length,
      atRiskClients: clients.filter((client) => client.riskLevel !== 'normal').length,
      nurseApprovals: 3,
      inspectionRules: 6,
      inspectionFindings: 3,
      socialWorkCases: 3,
      intakeRecords: 3,
      medicalAvailability: 3,
      expirationRecords: 4,
    },
    dashboard: {
      todaysVisits: 14,
      completed: 7,
      inProgress: 3,
      late: 2,
      missed: 1,
      requiresReview: 1,
      openIncidents: 3,
      familyConcerns: 4,
      atRiskClients: 5,
    },
    credentials: [
      'owner@careproof.demo / Password123!',
      'coordinator@careproof.demo / Password123!',
      'caregiver1@careproof.demo / Password123!',
      'family1@careproof.demo / Password123!',
    ],
  };
}
