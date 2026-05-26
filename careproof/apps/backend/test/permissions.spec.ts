import { ForbiddenException } from '@nestjs/common';
import { hasPermission, requirePermission } from '../src/auth/permissions';
import { UserRole } from '../src/users/user.schema';

describe('permissions helper', () => {
  it('allows agency owners to send reports', () => {
    expect(hasPermission(UserRole.AGENCY_OWNER, 'report.send')).toBe(true);
  });

  it('blocks family members from incident write actions', () => {
    expect(hasPermission(UserRole.FAMILY_MEMBER, 'incident.write')).toBe(false);
    expect(() => requirePermission(UserRole.FAMILY_MEMBER, 'incident.write')).toThrow(ForbiddenException);
  });

  it('allows caregivers to update only visit workflow actions', () => {
    expect(hasPermission(UserRole.CAREGIVER, 'visit.write')).toBe(true);
    expect(hasPermission(UserRole.CAREGIVER, 'report.send')).toBe(false);
  });

  it('allows NURSE to read and write nurse approvals', () => {
    expect(hasPermission(UserRole.NURSE, 'nurse_approval.read')).toBe(true);
    expect(hasPermission(UserRole.NURSE, 'nurse_approval.write')).toBe(true);
  });

  it('blocks NURSE from social work and intake', () => {
    expect(hasPermission(UserRole.NURSE, 'social_work.read')).toBe(false);
    expect(hasPermission(UserRole.NURSE, 'intake.read')).toBe(false);
  });

  it('allows SOCIAL_WORKER to read and write social work cases', () => {
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'social_work.read')).toBe(true);
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'social_work.write')).toBe(true);
  });

  it('blocks SOCIAL_WORKER from nurse approvals and intake', () => {
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'nurse_approval.write')).toBe(false);
    expect(hasPermission(UserRole.SOCIAL_WORKER, 'intake.write')).toBe(false);
  });

  it('allows INTAKE_AGENT to read and write intake records', () => {
    expect(hasPermission(UserRole.INTAKE_AGENT, 'intake.read')).toBe(true);
    expect(hasPermission(UserRole.INTAKE_AGENT, 'intake.write')).toBe(true);
    expect(hasPermission(UserRole.INTAKE_AGENT, 'client.read')).toBe(true);
  });

  it('blocks INTAKE_AGENT from nurse approvals and social work', () => {
    expect(hasPermission(UserRole.INTAKE_AGENT, 'nurse_approval.read')).toBe(false);
    expect(hasPermission(UserRole.INTAKE_AGENT, 'social_work.read')).toBe(false);
  });

  it('blocks CARE_COORDINATOR from writing nurse approvals (clinical boundary)', () => {
    expect(hasPermission(UserRole.CARE_COORDINATOR, 'nurse_approval.write')).toBe(false);
  });

  it('blocks CAREGIVER from reading incidents (aligns with controller)', () => {
    expect(hasPermission(UserRole.CAREGIVER, 'incident.read')).toBe(false);
  });
});
