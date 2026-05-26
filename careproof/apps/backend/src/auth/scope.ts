import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthUser } from './types';
import { UserRole } from '../users/user.schema';

function asString(id: string | Types.ObjectId | null | undefined) {
  return id ? id.toString() : '';
}

export function requireAgencyScope(resourceAgencyId: string | Types.ObjectId, actor: AuthUser) {
  if (asString(resourceAgencyId) !== actor.agencyId) {
    throw new ForbiddenException('Cross-agency access is not allowed.');
  }
}

export function requireBranchScope(
  resourceBranchId: string | Types.ObjectId | null | undefined,
  actor: AuthUser,
) {
  if (!actor.branchId || !resourceBranchId) {
    return; // if either side has no branch, skip check (agency-wide roles or unassigned records)
  }
  if (asString(resourceBranchId) !== actor.branchId) {
    throw new ForbiddenException('Cross-branch access is not allowed.');
  }
}

export function canAccessNurseApproval(
  actor: AuthUser,
  caregiverId: string | Types.ObjectId | null | undefined,
  reviewedBy: string | Types.ObjectId | null | undefined,
): boolean {
  if (
    [UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR].includes(actor.role)
  ) {
    return true;
  }
  if (actor.role === UserRole.NURSE) {
    // Nurse sees pending records (no reviewer yet) or records they reviewed
    return !reviewedBy || asString(reviewedBy) === actor.sub;
  }
  if (actor.role === UserRole.CAREGIVER) {
    return asString(caregiverId) === actor.sub;
  }
  return false;
}

export function canAccessClient(
  actor: AuthUser,
  resourceAgencyId: string | Types.ObjectId,
  familyMemberIds: Array<string | Types.ObjectId> = [],
) {
  requireAgencyScope(resourceAgencyId, actor);
  if (actor.role !== UserRole.FAMILY_MEMBER) {
    return true;
  }
  return familyMemberIds.some((id) => asString(id) === actor.sub);
}

export function canAccessVisit(
  actor: AuthUser,
  resourceAgencyId: string | Types.ObjectId,
  caregiverId: string | Types.ObjectId,
  familyMemberIds: Array<string | Types.ObjectId> = [],
) {
  requireAgencyScope(resourceAgencyId, actor);
  if ([UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR].includes(actor.role)) {
    return true;
  }
  if (actor.role === UserRole.CAREGIVER) {
    return asString(caregiverId) === actor.sub;
  }
  if (actor.role === UserRole.FAMILY_MEMBER) {
    return familyMemberIds.some((id) => asString(id) === actor.sub);
  }
  return false;
}

export function canAccessIncident(
  actor: AuthUser,
  resourceAgencyId: string | Types.ObjectId,
  caregiverId: string | Types.ObjectId,
  familyVisible = false,
  familyMemberIds: Array<string | Types.ObjectId> = [],
) {
  if (!canAccessVisit(actor, resourceAgencyId, caregiverId, familyMemberIds)) {
    return false;
  }
  return actor.role !== UserRole.FAMILY_MEMBER || familyVisible;
}

export function canAccessFamilyConcern(
  actor: AuthUser,
  resourceAgencyId: string | Types.ObjectId,
  familyMemberId: string | Types.ObjectId,
) {
  requireAgencyScope(resourceAgencyId, actor);
  if ([UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR].includes(actor.role)) {
    return true;
  }
  return actor.role === UserRole.FAMILY_MEMBER && asString(familyMemberId) === actor.sub;
}
