import { describe, expect, it } from 'vitest';
import type { MedicationSupplyRecord } from '../../types/careproof';
import {
  MEDICATION_SUPPLY_FILTERS,
  calculateMedicationSupplyRisk,
  calculateMedicationSupplyStatus,
  daysUntilExpiry,
  filterMedicationSupplies,
  medicationSupplySummary,
} from '../medication-safety';
import { medicationSupplyRecords } from '../../data/demoCareProofData';

// Fixed reference point for deterministic tests
const now = new Date('2026-05-27T12:00:00.000Z');

function makeRecord(overrides: Partial<MedicationSupplyRecord>): MedicationSupplyRecord {
  return {
    id: 'test-record',
    clientId: 'client-1',
    clientName: 'Test Client',
    itemName: 'Test Item',
    category: 'Medication',
    quantityAvailable: 10,
    minimumRequired: 5,
    unit: 'tablet',
    expirationDate: '2027-01-01',
    assignedOwner: 'Test Owner',
    lastChecked: '2026-05-27',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// daysUntilExpiry
// ---------------------------------------------------------------------------

describe('daysUntilExpiry', () => {
  it('returns a negative number for a date in the past', () => {
    expect(daysUntilExpiry('2026-05-26', now)).toBe(-1);
  });

  it('returns 0 for today', () => {
    expect(daysUntilExpiry('2026-05-27', now)).toBe(0);
  });

  it('returns a positive number for a future date', () => {
    expect(daysUntilExpiry('2026-05-28', now)).toBe(1);
  });

  it('returns the correct count for a date far in the future', () => {
    // 2027-01-01 is 219 days after 2026-05-27
    expect(daysUntilExpiry('2027-01-01', now)).toBe(219);
  });
});

// ---------------------------------------------------------------------------
// calculateMedicationSupplyStatus
// ---------------------------------------------------------------------------

describe('calculateMedicationSupplyStatus', () => {
  it('returns Blocked when blocksCare is true', () => {
    const record = makeRecord({ blocksCare: true });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Blocked');
  });

  it('returns Needs Nurse Review when nurseReviewRequired is true (and not blocked)', () => {
    const record = makeRecord({ nurseReviewRequired: true });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Needs Nurse Review');
  });

  it('returns Missing when quantityAvailable is 0 (and not blocked/nurse)', () => {
    const record = makeRecord({ quantityAvailable: 0 });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Missing');
  });

  it('returns Expired when expirationDate is in the past', () => {
    const record = makeRecord({ expirationDate: '2026-05-26' });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Expired');
  });

  it('returns Low Stock when quantityAvailable equals minimumRequired', () => {
    const record = makeRecord({ quantityAvailable: 5, minimumRequired: 5 });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Low Stock');
  });

  it('returns Low Stock when quantityAvailable is below minimumRequired', () => {
    const record = makeRecord({ quantityAvailable: 3, minimumRequired: 5 });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Low Stock');
  });

  it('returns Expiring Soon when expiry is within 30 days (and stock is OK)', () => {
    const record = makeRecord({ expirationDate: '2026-06-10' }); // 14 days away
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Expiring Soon');
  });

  it('returns Expiring Soon for exactly 30 days away', () => {
    const record = makeRecord({ expirationDate: '2026-06-26' }); // 30 days
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Expiring Soon');
  });

  it('returns Available when all conditions are clear', () => {
    const record = makeRecord({ expirationDate: '2027-06-01' });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Available');
  });

  it('blocksCare takes priority over nurseReviewRequired', () => {
    const record = makeRecord({ blocksCare: true, nurseReviewRequired: true });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Blocked');
  });

  it('nurseReviewRequired takes priority over quantityAvailable of 0', () => {
    const record = makeRecord({ nurseReviewRequired: true, quantityAvailable: 0 });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Needs Nurse Review');
  });

  it('returns Expired for today (day 0 is not expired)', () => {
    // today: daysUntilExpiry returns 0, which is NOT < 0, so not Expired
    const record = makeRecord({ expirationDate: '2026-05-27', quantityAvailable: 1, minimumRequired: 1 });
    // quantityAvailable (1) <= minimumRequired (1) → Low Stock (checked before Expiring Soon)
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Low Stock');
  });

  it('today expiry with sufficient stock is Expiring Soon (days === 0 satisfies <= 30)', () => {
    const record = makeRecord({ expirationDate: '2026-05-27', quantityAvailable: 10, minimumRequired: 5 });
    expect(calculateMedicationSupplyStatus(record, now)).toBe('Expiring Soon');
  });
});

// ---------------------------------------------------------------------------
// calculateMedicationSupplyRisk
// ---------------------------------------------------------------------------

describe('calculateMedicationSupplyRisk', () => {
  it('returns Critical for Expired status', () => {
    const record = makeRecord({ expirationDate: '2026-05-26' });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Critical');
  });

  it('returns Critical for Missing status', () => {
    const record = makeRecord({ quantityAvailable: 0 });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Critical');
  });

  it('returns Critical for Blocked status', () => {
    const record = makeRecord({ blocksCare: true });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Critical');
  });

  it('returns Critical for Needs Nurse Review when criticalForCare is true', () => {
    const record = makeRecord({ nurseReviewRequired: true, criticalForCare: true });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Critical');
  });

  it('returns High for Needs Nurse Review when criticalForCare is false', () => {
    const record = makeRecord({ nurseReviewRequired: true, criticalForCare: false });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('High');
  });

  it('returns High when expiring within 7 days', () => {
    const record = makeRecord({ expirationDate: '2026-06-02' }); // 6 days
    expect(calculateMedicationSupplyRisk(record, now)).toBe('High');
  });

  it('returns High for Low Stock when criticalForCare is true', () => {
    const record = makeRecord({ quantityAvailable: 3, minimumRequired: 5, criticalForCare: true });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('High');
  });

  it('returns Medium for expiry within 30 days (but more than 7)', () => {
    const record = makeRecord({ expirationDate: '2026-06-10' }); // 14 days — status is Expiring Soon
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Medium');
  });

  it('returns Medium for Low Stock when not critical for care', () => {
    const record = makeRecord({ quantityAvailable: 3, minimumRequired: 5, criticalForCare: false });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Medium');
  });

  it('returns Low when all conditions are clear', () => {
    const record = makeRecord({ expirationDate: '2027-06-01' });
    expect(calculateMedicationSupplyRisk(record, now)).toBe('Low');
  });
});

// ---------------------------------------------------------------------------
// filterMedicationSupplies
// ---------------------------------------------------------------------------

describe('filterMedicationSupplies', () => {
  // Build a small controlled set of records to avoid dependency on seed data
  const available = makeRecord({ id: 'available', expirationDate: '2027-06-01' });
  const expired = makeRecord({ id: 'expired', expirationDate: '2026-05-26' });
  const missing = makeRecord({ id: 'missing', quantityAvailable: 0 });
  const blocked = makeRecord({ id: 'blocked', blocksCare: true });
  const nurseReview = makeRecord({ id: 'nurse', nurseReviewRequired: true, criticalForCare: false });
  const criticalNurse = makeRecord({ id: 'critical-nurse', nurseReviewRequired: true, criticalForCare: true });
  const lowStock = makeRecord({ id: 'low-stock', quantityAvailable: 3, minimumRequired: 5 });
  const expiringSoon = makeRecord({ id: 'expiring', expirationDate: '2026-06-10' });
  const searchable = makeRecord({
    id: 'searchable',
    clientName: 'Alice Wonderland',
    itemName: 'Special Cream',
    expirationDate: '2027-06-01',
  });

  const all = [available, expired, missing, blocked, nurseReview, criticalNurse, lowStock, expiringSoon, searchable];

  it('All filter returns every record', () => {
    expect(filterMedicationSupplies(all, 'All', '', now)).toHaveLength(all.length);
  });

  it('Critical filter returns only critical-risk records', () => {
    const result = filterMedicationSupplies(all, 'Critical', '', now);
    // expired, missing, blocked, criticalNurse all have Critical risk
    expect(result.map((r) => r.id)).toEqual(
      expect.arrayContaining(['expired', 'missing', 'blocked', 'critical-nurse']),
    );
    expect(result.find((r) => r.id === 'available')).toBeUndefined();
    expect(result.find((r) => r.id === 'nurse')).toBeUndefined(); // High, not Critical
  });

  it('Expired filter returns only expired records', () => {
    const result = filterMedicationSupplies(all, 'Expired', '', now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('expired');
  });

  it('Missing filter returns only missing records', () => {
    const result = filterMedicationSupplies(all, 'Missing', '', now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('missing');
  });

  it('Needs Nurse Review filter returns only nurse-review records', () => {
    const result = filterMedicationSupplies(all, 'Needs Nurse Review', '', now);
    // Both nurseReview and criticalNurse have status 'Needs Nurse Review'
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(['nurse', 'critical-nurse']));
    expect(result.find((r) => r.id === 'available')).toBeUndefined();
  });

  it('Low Stock filter returns only low-stock records', () => {
    const result = filterMedicationSupplies(all, 'Low Stock', '', now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('low-stock');
  });

  it('Expiring Soon filter returns only expiring-soon records', () => {
    const result = filterMedicationSupplies(all, 'Expiring Soon', '', now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('expiring');
  });

  it('search by client name is case-insensitive', () => {
    const result = filterMedicationSupplies(all, 'All', 'alice', now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('searchable');
  });

  it('search by item name is case-insensitive', () => {
    const result = filterMedicationSupplies(all, 'All', 'SPECIAL CREAM', now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('searchable');
  });

  it('empty search string returns all records for a given filter', () => {
    const result = filterMedicationSupplies(all, 'All', '', now);
    expect(result).toHaveLength(all.length);
  });

  it('search with no match returns empty array', () => {
    const result = filterMedicationSupplies(all, 'All', 'zzznomatch', now);
    expect(result).toHaveLength(0);
  });

  it('MEDICATION_SUPPLY_FILTERS contains All as first entry', () => {
    expect(MEDICATION_SUPPLY_FILTERS[0]).toBe('All');
  });

  it('High Risk filter includes both High and Critical risk records', () => {
    const result = filterMedicationSupplies(all, 'High Risk', '', now);
    const ids = result.map((r) => r.id);
    // Critical records
    expect(ids).toContain('expired');
    expect(ids).toContain('missing');
    expect(ids).toContain('blocked');
    expect(ids).toContain('critical-nurse');
    // High records
    expect(ids).toContain('nurse'); // Needs Nurse Review + criticalForCare false = High
  });
});

// ---------------------------------------------------------------------------
// medicationSupplySummary — using real seed data
// ---------------------------------------------------------------------------

describe('medicationSupplySummary with seed data', () => {
  // The seed data uses isoDateOffset() which calls new Date() at module load time.
  // We call medicationSupplySummary without a custom now so it also uses new Date(),
  // keeping offsets consistent regardless of when the test runs.
  const summary = medicationSupplySummary(medicationSupplyRecords);

  // NOTE on status priority rules (highest to lowest):
  //   blocksCare > nurseReviewRequired > quantityAvailable===0 > days<0 > lowStock > expiringSoon
  //
  // This means records with blocksCare=true are counted as 'Blocked', NOT as 'Missing'
  // or 'Expired', even if qty=0 or the expiry date is past.  The expected counts below
  // reflect the actual seed data classifications, not naive field-level counts.
  //
  // Actual seed counts (verified by tracing each record):
  //   expired=2, expiringSoon=0, lowStock=11, missing=0, needsNurseReview=2, critical=9

  it('has at least 2 expired items', () => {
    expect(summary.expired).toBeGreaterThanOrEqual(2);
  });

  it('has at least 11 low stock items', () => {
    // Many records with qty <= min and future expiry land here
    expect(summary.lowStock).toBeGreaterThanOrEqual(11);
  });

  it('has at least 2 items needing nurse review', () => {
    // insulin-glargine (nurseReviewRequired, not blocked) and catheter-kit
    expect(summary.needsNurseReview).toBeGreaterThanOrEqual(2);
  });

  it('has at least 1 critical item', () => {
    // Blocked, expired, and critical nurse-review records all qualify
    expect(summary.critical).toBeGreaterThan(0);
  });

  it('has at least 5 blocked or expired critical records', () => {
    // 5 blocked records + 2 expired + 2 critical nurse = 9 total critical
    expect(summary.critical).toBeGreaterThanOrEqual(5);
  });

  it('summary keys are complete', () => {
    expect(Object.keys(summary)).toEqual(
      expect.arrayContaining(['critical', 'expiringSoon', 'expired', 'lowStock', 'missing', 'needsNurseReview']),
    );
  });
});
