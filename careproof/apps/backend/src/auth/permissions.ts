import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/user.schema';

export type PermissionAction =
  | 'dashboard.read'
  | 'client.read'
  | 'client.write'
  | 'visit.read'
  | 'visit.write'
  | 'incident.read'
  | 'incident.write'
  | 'family_concern.read'
  | 'family_concern.respond'
  | 'report.read'
  | 'report.send'
  | 'demo.manage'
  | 'nurse_approval.read'
  | 'nurse_approval.write'
  | 'inspection.read'
  | 'inspection.write'
  | 'social_work.read'
  | 'social_work.write'
  | 'intake.read'
  | 'intake.write'
  | 'medical_availability.read'
  | 'medical_availability.write'
  | 'expiration.read'
  | 'expiration.write';

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  [UserRole.PLATFORM_ADMIN]: [
    'dashboard.read',
    'client.read',
    'client.write',
    'visit.read',
    'visit.write',
    'incident.read',
    'incident.write',
    'family_concern.read',
    'family_concern.respond',
    'report.read',
    'report.send',
    'demo.manage',
    'nurse_approval.read',
    'nurse_approval.write',
    'inspection.read',
    'inspection.write',
    'social_work.read',
    'social_work.write',
    'intake.read',
    'intake.write',
    'medical_availability.read',
    'medical_availability.write',
    'expiration.read',
    'expiration.write',
  ],
  [UserRole.AGENCY_OWNER]: [
    'dashboard.read',
    'client.read',
    'client.write',
    'visit.read',
    'visit.write',
    'incident.read',
    'incident.write',
    'family_concern.read',
    'family_concern.respond',
    'report.read',
    'report.send',
    'demo.manage',
    'nurse_approval.read',
    'nurse_approval.write',
    'inspection.read',
    'inspection.write',
    'social_work.read',
    'social_work.write',
    'intake.read',
    'intake.write',
    'medical_availability.read',
    'medical_availability.write',
    'expiration.read',
    'expiration.write',
  ],
  [UserRole.AGENCY_ADMIN]: [
    'dashboard.read',
    'client.read',
    'client.write',
    'visit.read',
    'visit.write',
    'incident.read',
    'incident.write',
    'family_concern.read',
    'family_concern.respond',
    'report.read',
    'report.send',
    'nurse_approval.read',
    'nurse_approval.write',
    'inspection.read',
    'inspection.write',
    'social_work.read',
    'social_work.write',
    'intake.read',
    'intake.write',
    'medical_availability.read',
    'medical_availability.write',
    'expiration.read',
    'expiration.write',
  ],
  [UserRole.CARE_COORDINATOR]: [
    'dashboard.read',
    'client.read',
    'visit.read',
    'visit.write',
    'incident.read',
    'incident.write',
    'family_concern.read',
    'family_concern.respond',
    'report.read',
    'report.send',
    'nurse_approval.read',
    'nurse_approval.write',
    'inspection.read',
    'inspection.write',
    'social_work.read',
    'social_work.write',
    'intake.read',
    'intake.write',
    'medical_availability.read',
    'medical_availability.write',
    'expiration.read',
    'expiration.write',
  ],
  [UserRole.CAREGIVER]: [
    'visit.read',
    'visit.write',
    'incident.write',
    'nurse_approval.read',
    'inspection.read',
    'medical_availability.read',
    'expiration.read',
  ],
  [UserRole.FAMILY_MEMBER]: ['report.read'],
  [UserRole.CLIENT]: [],
};

export function hasPermission(role: UserRole, action: PermissionAction) {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export function requirePermission(role: UserRole, action: PermissionAction, message?: string) {
  if (!hasPermission(role, action)) {
    throw new ForbiddenException(message ?? 'You do not have permission to perform this action.');
  }
}
