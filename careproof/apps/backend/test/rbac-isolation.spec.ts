import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { hasPermission, requirePermission } from '../src/auth/permissions';
import {
  requireAgencyScope,
  requireBranchScope,
  canAccessNurseApproval,
  canAccessClient,
  canAccessVisit,
  canAccessIncident,
  canAccessFamilyConcern,
} from '../src/auth/scope';
import { AuthUser } from '../src/auth/types';
import { UserRole } from '../src/users/user.schema';

function makeActor(role: UserRole, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: new Types.ObjectId().toString(),
    agencyId: new Types.ObjectId().toString(),
    role,
    email: `${role}@test.local`,
    branchId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cross-agency isolation
// ---------------------------------------------------------------------------
describe('requireAgencyScope', () => {
  it('allows access when agencyId matches', () => {
    const actor = makeActor(UserRole.AGENCY_ADMIN);
    expect(() => requireAgencyScope(actor.agencyId, actor)).not.toThrow();
  });

  it('blocks cross-agency access', () => {
    const actor = makeActor(UserRole.AGENCY_ADMIN);
    const foreignAgencyId = new Types.ObjectId().toString();
    expect(() => requireAgencyScope(foreignAgencyId, actor)).toThrow(ForbiddenException);
  });

  it('blocks cross-agency access for CARE_COORDINATOR', () => {
    const actor = makeActor(UserRole.CARE_COORDINATOR);
    const foreignAgencyId = new Types.ObjectId().toString();
    expect(() => requireAgencyScope(foreignAgencyId, actor)).toThrow(ForbiddenException);
  });

  it('blocks cross-agency access for CAREGIVER', () => {
    const actor = makeActor(UserRole.CAREGIVER);
    expect(() => requireAgencyScope(new Types.ObjectId().toString(), actor)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Branch scope
// ---------------------------------------------------------------------------
describe('requireBranchScope', () => {
  it('allows when actor has no branchId (agency-wide role)', () => {
    const actor = makeActor(UserRole.AGENCY_ADMIN, { branchId: null });
    const resourceBranch = new Types.ObjectId().toString();
    expect(() => requireBranchScope(resourceBranch, actor)).not.toThrow();
  });

  it('allows when resource has no branchId (unassigned)', () => {
    const actor = makeActor(UserRole.NURSE, { branchId: new Types.ObjectId().toString() });
    expect(() => requireBranchScope(null, actor)).not.toThrow();
  });

  it('allows when actor branchId matches resource branchId', () => {
    const branchId = new Types.ObjectId().toString();
    const actor = makeActor(UserRole.NURSE, { branchId });
    expect(() => requireBranchScope(branchId, actor)).not.toThrow();
  });

  it('blocks cross-branch access when both sides have a branchId', () => {
    const actor = makeActor(UserRole.NURSE, { branchId: new Types.ObjectId().toString() });
    const foreignBranch = new Types.ObjectId().toString();
    expect(() => requireBranchScope(foreignBranch, actor)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Nurse approval scope
// ---------------------------------------------------------------------------
describe('canAccessNurseApproval', () => {
  const pendingId = null; // not yet reviewed
  const otherNurseId = new Types.ObjectId().toString();

  it('allows AGENCY_OWNER regardless of caregiverId and reviewedBy', () => {
    const actor = makeActor(UserRole.AGENCY_OWNER);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), otherNurseId)).toBe(true);
  });

  it('allows AGENCY_ADMIN regardless of caregiverId and reviewedBy', () => {
    const actor = makeActor(UserRole.AGENCY_ADMIN);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), otherNurseId)).toBe(true);
  });

  it('allows CARE_COORDINATOR regardless of reviewedBy', () => {
    const actor = makeActor(UserRole.CARE_COORDINATOR);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), otherNurseId)).toBe(true);
  });

  it('allows NURSE to see pending records (no reviewer)', () => {
    const actor = makeActor(UserRole.NURSE);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), pendingId)).toBe(true);
  });

  it('allows NURSE to see records they reviewed', () => {
    const actor = makeActor(UserRole.NURSE);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), actor.sub)).toBe(true);
  });

  it('blocks NURSE from records reviewed by another nurse', () => {
    const actor = makeActor(UserRole.NURSE);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), otherNurseId)).toBe(false);
  });

  it('allows CAREGIVER to see their own approval records', () => {
    const actor = makeActor(UserRole.CAREGIVER);
    expect(canAccessNurseApproval(actor, actor.sub, pendingId)).toBe(true);
  });

  it('blocks CAREGIVER from another caregiver approval records', () => {
    const actor = makeActor(UserRole.CAREGIVER);
    const otherCaregiverId = new Types.ObjectId().toString();
    expect(canAccessNurseApproval(actor, otherCaregiverId, pendingId)).toBe(false);
  });

  it('blocks SOCIAL_WORKER (no nurse_approval.read permission covers scope)', () => {
    const actor = makeActor(UserRole.SOCIAL_WORKER);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), pendingId)).toBe(false);
  });

  it('blocks INTAKE_AGENT', () => {
    const actor = makeActor(UserRole.INTAKE_AGENT);
    expect(canAccessNurseApproval(actor, new Types.ObjectId(), pendingId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Client scope
// ---------------------------------------------------------------------------
describe('canAccessClient', () => {
  it('allows AGENCY_OWNER cross-agency only if agencyId matches', () => {
    const actor = makeActor(UserRole.AGENCY_OWNER);
    expect(canAccessClient(actor, actor.agencyId, [])).toBe(true);
  });

  it('blocks cross-agency for non-family roles', () => {
    const actor = makeActor(UserRole.CARE_COORDINATOR);
    const foreignAgency = new Types.ObjectId().toString();
    expect(() => canAccessClient(actor, foreignAgency, [])).toThrow(ForbiddenException);
  });

  it('allows FAMILY_MEMBER when listed in familyMemberIds', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    expect(canAccessClient(actor, actor.agencyId, [actor.sub])).toBe(true);
  });

  it('blocks FAMILY_MEMBER when not listed in familyMemberIds', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    expect(canAccessClient(actor, actor.agencyId, [new Types.ObjectId().toString()])).toBe(false);
  });

  it('allows NURSE same-agency client access', () => {
    const actor = makeActor(UserRole.NURSE);
    expect(canAccessClient(actor, actor.agencyId, [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Visit scope
// ---------------------------------------------------------------------------
describe('canAccessVisit', () => {
  it('allows CARE_COORDINATOR any same-agency visit', () => {
    const actor = makeActor(UserRole.CARE_COORDINATOR);
    expect(canAccessVisit(actor, actor.agencyId, new Types.ObjectId().toString(), [])).toBe(true);
  });

  it('allows CAREGIVER their own visits', () => {
    const actor = makeActor(UserRole.CAREGIVER);
    expect(canAccessVisit(actor, actor.agencyId, actor.sub, [])).toBe(true);
  });

  it('blocks CAREGIVER from another caregiver visits', () => {
    const actor = makeActor(UserRole.CAREGIVER);
    const otherCaregiverId = new Types.ObjectId().toString();
    expect(canAccessVisit(actor, actor.agencyId, otherCaregiverId, [])).toBe(false);
  });

  it('allows FAMILY_MEMBER when in familyMemberIds', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    const caregiverId = new Types.ObjectId().toString();
    expect(canAccessVisit(actor, actor.agencyId, caregiverId, [actor.sub])).toBe(true);
  });

  it('blocks FAMILY_MEMBER when not in familyMemberIds', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    const caregiverId = new Types.ObjectId().toString();
    expect(canAccessVisit(actor, actor.agencyId, caregiverId, [])).toBe(false);
  });

  it('blocks any role from cross-agency visits', () => {
    const actor = makeActor(UserRole.AGENCY_OWNER);
    const foreignAgency = new Types.ObjectId().toString();
    expect(() => canAccessVisit(actor, foreignAgency, new Types.ObjectId().toString(), [])).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Incident scope
// ---------------------------------------------------------------------------
describe('canAccessIncident', () => {
  it('allows CARE_COORDINATOR same-agency incidents', () => {
    const actor = makeActor(UserRole.CARE_COORDINATOR);
    expect(canAccessIncident(actor, actor.agencyId, new Types.ObjectId().toString())).toBe(true);
  });

  it('blocks FAMILY_MEMBER from non-family-visible incidents', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    const caregiverId = new Types.ObjectId().toString();
    expect(canAccessIncident(actor, actor.agencyId, caregiverId, false, [actor.sub])).toBe(false);
  });

  it('allows FAMILY_MEMBER when familyVisible=true and in familyMemberIds', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    const caregiverId = new Types.ObjectId().toString();
    expect(canAccessIncident(actor, actor.agencyId, caregiverId, true, [actor.sub])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Family concern scope
// ---------------------------------------------------------------------------
describe('canAccessFamilyConcern', () => {
  it('allows AGENCY_ADMIN same-agency concerns', () => {
    const actor = makeActor(UserRole.AGENCY_ADMIN);
    const familyMemberId = new Types.ObjectId().toString();
    expect(canAccessFamilyConcern(actor, actor.agencyId, familyMemberId)).toBe(true);
  });

  it('allows FAMILY_MEMBER their own concerns', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    expect(canAccessFamilyConcern(actor, actor.agencyId, actor.sub)).toBe(true);
  });

  it('blocks FAMILY_MEMBER from another member concerns', () => {
    const actor = makeActor(UserRole.FAMILY_MEMBER);
    const otherMemberId = new Types.ObjectId().toString();
    expect(canAccessFamilyConcern(actor, actor.agencyId, otherMemberId)).toBe(false);
  });

  it('blocks CAREGIVER from any family concern', () => {
    const actor = makeActor(UserRole.CAREGIVER);
    const familyMemberId = new Types.ObjectId().toString();
    expect(canAccessFamilyConcern(actor, actor.agencyId, familyMemberId)).toBe(false);
  });

  it('blocks cross-agency access for AGENCY_ADMIN', () => {
    const actor = makeActor(UserRole.AGENCY_ADMIN);
    const foreignAgency = new Types.ObjectId().toString();
    expect(() => canAccessFamilyConcern(actor, foreignAgency, new Types.ObjectId().toString())).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Permission boundaries — role-action cross-check
// ---------------------------------------------------------------------------
describe('RBAC permission boundaries', () => {
  // FAMILY_MEMBER
  it('FAMILY_MEMBER cannot write incidents', () => {
    expect(hasPermission(UserRole.FAMILY_MEMBER, 'incident.write')).toBe(false);
  });
  it('FAMILY_MEMBER cannot read clients', () => {
    expect(hasPermission(UserRole.FAMILY_MEMBER, 'client.read')).toBe(false);
  });
  it('FAMILY_MEMBER cannot access nurse approvals', () => {
    expect(hasPermission(UserRole.FAMILY_MEMBER, 'nurse_approval.read')).toBe(false);
  });

  // CAREGIVER restrictions
  it('CAREGIVER cannot read incidents', () => {
    expect(hasPermission(UserRole.CAREGIVER, 'incident.read')).toBe(false);
  });
  it('CAREGIVER cannot respond to family concerns', () => {
    expect(hasPermission(UserRole.CAREGIVER, 'family_concern.respond')).toBe(false);
  });
  it('CAREGIVER cannot write nurse approvals', () => {
    expect(hasPermission(UserRole.CAREGIVER, 'nurse_approval.write')).toBe(false);
  });
  it('CAREGIVER cannot access intake or social work', () => {
    expect(hasPermission(UserRole.CAREGIVER, 'intake.read')).toBe(false);
    expect(hasPermission(UserRole.CAREGIVER, 'social_work.read')).toBe(false);
  });

  // NURSE restrictions
  it('NURSE cannot write visits or clients', () => {
    expect(hasPermission(UserRole.NURSE, 'visit.write')).toBe(false);
    expect(hasPermission(UserRole.NURSE, 'client.write')).toBe(false);
  });
  it('NURSE cannot access social work or intake', () => {
    expect(hasPermission(UserRole.NURSE, 'social_work.read')).toBe(false);
    expect(hasPermission(UserRole.NURSE, 'intake.read')).toBe(false);
  });
  it('NURSE cannot respond to family concerns', () => {
    expect(hasPermission(UserRole.NURSE, 'family_concern.respond')).toBe(false);
  });

  // SOCIAL_WORKER restrictions
  it('SOCIAL_WORKER cannot write nurse approvals', () => {
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'nurse_approval.write')).toBe(false);
  });
  it('SOCIAL_WORKER cannot access intake', () => {
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'intake.read')).toBe(false);
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'intake.write')).toBe(false);
  });
  it('SOCIAL_WORKER cannot write visits', () => {
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'visit.write')).toBe(false);
  });

  // INTAKE_AGENT restrictions
  it('INTAKE_AGENT cannot access nurse approvals', () => {
    expect(hasPermission(UserRole.INTAKE_AGENT, 'nurse_approval.read')).toBe(false);
  });
  it('INTAKE_AGENT cannot access social work', () => {
    expect(hasPermission(UserRole.INTAKE_AGENT, 'social_work.read')).toBe(false);
  });
  it('INTAKE_AGENT cannot write visits', () => {
    expect(hasPermission(UserRole.INTAKE_AGENT, 'visit.write')).toBe(false);
  });
  it('INTAKE_AGENT cannot respond to family concerns', () => {
    expect(hasPermission(UserRole.INTAKE_AGENT, 'family_concern.respond')).toBe(false);
  });

  // CARE_COORDINATOR clinical boundary
  it('CARE_COORDINATOR cannot write nurse approvals (clinical boundary)', () => {
    expect(hasPermission(UserRole.CARE_COORDINATOR, 'nurse_approval.write')).toBe(false);
  });

  // requirePermission throws
  it('requirePermission throws ForbiddenException for blocked actions', () => {
    expect(() => requirePermission(UserRole.FAMILY_MEMBER, 'incident.write')).toThrow(ForbiddenException);
    expect(() => requirePermission(UserRole.CAREGIVER, 'incident.read')).toThrow(ForbiddenException);
    expect(() => requirePermission(UserRole.NURSE, 'social_work.read')).toThrow(ForbiddenException);
    expect(() => requirePermission(UserRole.SOCIAL_WORKER, 'nurse_approval.write')).toThrow(ForbiddenException);
    expect(() => requirePermission(UserRole.INTAKE_AGENT, 'nurse_approval.read')).toThrow(ForbiddenException);
  });
});
