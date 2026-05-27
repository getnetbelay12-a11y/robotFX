import { describe, expect, it } from 'vitest';
import { isDateStringToday } from '../date-utils';

describe('isDateStringToday', () => {
  const now = new Date('2026-05-27T12:00:00.000Z');

  it('returns true when an ISO date is today', () => {
    expect(isDateStringToday('2026-05-27', now)).toBe(true);
  });

  it('returns false when an ISO date is not today', () => {
    expect(isDateStringToday('2026-05-28', now)).toBe(false);
  });

  it('returns false for display text instead of parsing Today labels', () => {
    expect(isDateStringToday('Today · 4:30 PM', now)).toBe(false);
  });
});
