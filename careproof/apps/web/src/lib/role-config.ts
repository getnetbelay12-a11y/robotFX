import type { User } from '../types/careproof';

export type UserRole = User['role'];

// ---------------------------------------------------------------------------
// Route access
// Each entry maps a URL prefix to the roles that may navigate to it.
// Checks are prefix-based: '/console/clients' covers '/console/clients/123'.
// ---------------------------------------------------------------------------
export const CONSOLE_ROUTE_ACCESS: Array<{ prefix: string; roles: UserRole[] }> = [
  // Visible to all authenticated console users
  { prefix: '/console/dashboard',          roles: ['Owner', 'Admin', 'Coordinator', 'Nurse', 'Social Worker', 'Intake Agent'] },
  { prefix: '/console/notifications',      roles: ['Owner', 'Admin', 'Coordinator', 'Nurse', 'Social Worker', 'Intake Agent'] },
  { prefix: '/console/support',            roles: ['Owner', 'Admin', 'Coordinator', 'Nurse', 'Social Worker', 'Intake Agent'] },

  // Client management
  { prefix: '/console/clients',            roles: ['Owner', 'Admin', 'Coordinator', 'Nurse', 'Social Worker', 'Intake Agent'] },

  // Visit management
  { prefix: '/console/visits',             roles: ['Owner', 'Admin', 'Coordinator', 'Nurse'] },
  { prefix: '/console/schedule',           roles: ['Owner', 'Admin', 'Coordinator'] },

  // Incident management
  { prefix: '/console/incidents',          roles: ['Owner', 'Admin', 'Coordinator', 'Nurse'] },

  // Caregiver management
  { prefix: '/console/caregivers',         roles: ['Owner', 'Admin', 'Coordinator'] },
  { prefix: '/console/caregiver-support',  roles: ['Owner', 'Admin', 'Coordinator'] },

  // Reports
  { prefix: '/console/reports',            roles: ['Owner', 'Admin', 'Coordinator', 'Social Worker'] },
  { prefix: '/console/executive',          roles: ['Owner', 'Admin'] },

  // Clinical operations (nurse-led)
  { prefix: '/console/nurse-approvals',    roles: ['Owner', 'Admin', 'Coordinator', 'Nurse', 'Caregiver'] },
  { prefix: '/console/inspection-center',  roles: ['Owner', 'Admin', 'Coordinator', 'Nurse'] },
  { prefix: '/console/medical-availability', roles: ['Owner', 'Admin', 'Coordinator', 'Nurse'] },
  { prefix: '/console/expiration-center',  roles: ['Owner', 'Admin', 'Coordinator', 'Nurse'] },

  // Social work
  { prefix: '/console/social-work',        roles: ['Owner', 'Admin', 'Coordinator', 'Social Worker'] },
  { prefix: '/console/family-concerns',    roles: ['Owner', 'Admin', 'Coordinator', 'Social Worker'] },
  { prefix: '/console/family-health',      roles: ['Owner', 'Admin', 'Coordinator', 'Social Worker'] },

  // Intake
  { prefix: '/console/intake-agents',      roles: ['Owner', 'Admin', 'Coordinator', 'Intake Agent'] },

  // Care plans
  { prefix: '/console/care-plans',         roles: ['Owner', 'Admin', 'Coordinator'] },

  // Client risk
  { prefix: '/console/client-risk',        roles: ['Owner', 'Admin', 'Coordinator', 'Nurse'] },

  // Branch & settings — owner/admin only
  { prefix: '/console/branches',           roles: ['Owner', 'Admin'] },
  { prefix: '/console/settings',           roles: ['Owner', 'Admin'] },
  { prefix: '/console/billing',            roles: ['Owner', 'Admin'] },
  { prefix: '/console/data-quality',       roles: ['Owner', 'Admin'] },
  { prefix: '/console/import',             roles: ['Owner', 'Admin'] },
  { prefix: '/console/system',             roles: ['Owner', 'Admin'] },
  { prefix: '/console/system-readiness',   roles: ['Owner', 'Admin'] },
  { prefix: '/console/onboarding',         roles: ['Owner', 'Admin'] },
  { prefix: '/console/rollout',            roles: ['Owner', 'Admin'] },
  { prefix: '/console/training',           roles: ['Owner', 'Admin'] },
  { prefix: '/console/knowledge-base',     roles: ['Owner', 'Admin', 'Coordinator'] },
  { prefix: '/console/operations',         roles: ['Owner', 'Admin', 'Coordinator'] },
  { prefix: '/console/customer-success',   roles: ['Owner', 'Admin'] },
  { prefix: '/console/pilot-review',       roles: ['Owner', 'Admin'] },
  { prefix: '/console/pilot-feedback',     roles: ['Owner', 'Admin'] },
];

// ---------------------------------------------------------------------------
// Action access
// Fine-grained UI actions (button visibility, form fields, etc.).
// ---------------------------------------------------------------------------
export const ACTION_ACCESS: Record<string, UserRole[]> = {
  // Nurse approval decisions (approve/reject)
  'nurse_approval.decide':            ['Owner', 'Admin', 'Nurse'],
  // Creating a new nurse approval record
  'nurse_approval.create':            ['Owner', 'Admin', 'Coordinator', 'Nurse'],

  // Incident write actions
  'incident.create':                  ['Owner', 'Admin', 'Coordinator'],
  'incident.resolve':                 ['Owner', 'Admin', 'Coordinator'],

  // Client write actions
  'client.create':                    ['Owner', 'Admin', 'Coordinator', 'Intake Agent'],
  'client.edit':                      ['Owner', 'Admin', 'Coordinator', 'Intake Agent'],

  // Visit management
  'visit.schedule':                   ['Owner', 'Admin', 'Coordinator'],
  'visit.cancel':                     ['Owner', 'Admin', 'Coordinator'],

  // Report sending
  'report.send':                      ['Owner', 'Admin', 'Coordinator'],

  // Family concern response (responding to a concern, not submitting)
  'family_concern.respond':           ['Owner', 'Admin', 'Coordinator'],

  // Social work case management
  'social_work.create':               ['Owner', 'Admin', 'Coordinator', 'Social Worker'],
  'social_work.update':               ['Owner', 'Admin', 'Coordinator', 'Social Worker'],

  // Intake
  'intake.create':                    ['Owner', 'Admin', 'Coordinator', 'Intake Agent'],
  'intake.update':                    ['Owner', 'Admin', 'Coordinator', 'Intake Agent'],

  // Inspection findings
  'inspection.update_status':         ['Owner', 'Admin', 'Coordinator', 'Nurse'],

  // Medical availability / expirations
  'medical_availability.update':      ['Owner', 'Admin', 'Coordinator', 'Nurse'],
  'expiration.update_renewal':        ['Owner', 'Admin', 'Coordinator', 'Nurse'],

  // Settings & admin
  'settings.manage_users':            ['Owner', 'Admin'],
  'settings.manage_agency':           ['Owner', 'Admin'],
  'settings.manage_billing':          ['Owner'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  // Caregiver and Family use their own app shells, not the console.
  if (role === 'Caregiver' || role === 'Family') return false;

  const match = CONSOLE_ROUTE_ACCESS.find((entry) => pathname.startsWith(entry.prefix));
  if (!match) return false;
  return match.roles.includes(role);
}

export function canPerformAction(role: UserRole, action: string): boolean {
  const allowed = ACTION_ACCESS[action];
  if (!allowed) return false;
  return allowed.includes(role);
}
