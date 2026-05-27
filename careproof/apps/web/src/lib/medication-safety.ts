import type {
  MedicationSupplyRecord,
  MedicationSupplyRiskLevel,
  MedicationSupplyStatus,
} from '../types/careproof';

export type MedicationSupplyFilter =
  | 'All'
  | 'Critical'
  | 'High Risk'
  | 'Expiring Soon'
  | 'Expired'
  | 'Low Stock'
  | 'Missing'
  | 'Needs Nurse Review';

export const MEDICATION_SUPPLY_FILTERS: MedicationSupplyFilter[] = [
  'All',
  'Critical',
  'High Risk',
  'Expiring Soon',
  'Expired',
  'Low Stock',
  'Missing',
  'Needs Nurse Review',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function daysUntilExpiry(expirationDate: string, now = new Date()): number {
  const expiry = new Date(`${expirationDate}T00:00:00.000Z`);
  if (Number.isNaN(expiry.getTime())) return 0;
  return Math.ceil((expiry.getTime() - todayDate(now).getTime()) / MS_PER_DAY);
}

export function calculateMedicationSupplyStatus(record: MedicationSupplyRecord, now = new Date()): MedicationSupplyStatus {
  const days = daysUntilExpiry(record.expirationDate, now);
  if (record.blocksCare) return 'Blocked';
  if (record.nurseReviewRequired) return 'Needs Nurse Review';
  if (record.quantityAvailable === 0) return 'Missing';
  if (days < 0) return 'Expired';
  if (record.quantityAvailable <= record.minimumRequired) return 'Low Stock';
  if (days <= 30) return 'Expiring Soon';
  return 'Available';
}

export function calculateMedicationSupplyRisk(record: MedicationSupplyRecord, now = new Date()): MedicationSupplyRiskLevel {
  const status = calculateMedicationSupplyStatus(record, now);
  const days = daysUntilExpiry(record.expirationDate, now);
  if (status === 'Expired' || status === 'Missing' || status === 'Blocked' || record.blocksCare) return 'Critical';
  if (status === 'Needs Nurse Review') return record.criticalForCare ? 'Critical' : 'High';
  if (days <= 7 || (status === 'Low Stock' && record.criticalForCare)) return 'High';
  if (days <= 30 || status === 'Low Stock') return 'Medium';
  return 'Low';
}

export function medicationSupplyNextAction(record: MedicationSupplyRecord, now = new Date()): string {
  const status = calculateMedicationSupplyStatus(record, now);
  const risk = calculateMedicationSupplyRisk(record, now);
  if (status === 'Expired') return record.category === 'Medication' ? 'Review medication' : 'Replace expired supply';
  if (status === 'Missing' || status === 'Blocked') return risk === 'Critical' ? 'Resolve visit blocker' : 'Replace expired supply';
  if (status === 'Needs Nurse Review') return 'Assign nurse';
  if (status === 'Low Stock') return record.category === 'Medication' ? 'Review medication' : 'Replace expired supply';
  if (status === 'Expiring Soon') return record.category === 'Medication' ? 'Review medication' : 'Schedule inspection';
  return 'Monitor supply';
}

export function isMedicationSupplyRisk(record: MedicationSupplyRecord, now = new Date()) {
  return calculateMedicationSupplyRisk(record, now) !== 'Low'
    || calculateMedicationSupplyStatus(record, now) !== 'Available';
}

export function filterMedicationSupplies(
  records: MedicationSupplyRecord[],
  filter: MedicationSupplyFilter,
  search = '',
  now = new Date(),
) {
  const normalized = search.trim().toLowerCase();
  return records.filter((record) => {
    const status = calculateMedicationSupplyStatus(record, now);
    const risk = calculateMedicationSupplyRisk(record, now);
    const matchesFilter =
      filter === 'All'
      || (filter === 'Critical' && risk === 'Critical')
      || (filter === 'High Risk' && (risk === 'High' || risk === 'Critical'))
      || (filter === 'Expiring Soon' && status === 'Expiring Soon')
      || (filter === 'Expired' && status === 'Expired')
      || (filter === 'Low Stock' && status === 'Low Stock')
      || (filter === 'Missing' && status === 'Missing')
      || (filter === 'Needs Nurse Review' && status === 'Needs Nurse Review');
    const matchesSearch = !normalized
      || record.clientName.toLowerCase().includes(normalized)
      || record.itemName.toLowerCase().includes(normalized)
      || record.assignedOwner.toLowerCase().includes(normalized);
    return matchesFilter && matchesSearch;
  });
}

export function medicationSupplySummary(records: MedicationSupplyRecord[], now = new Date()) {
  return {
    critical: records.filter((record) => calculateMedicationSupplyRisk(record, now) === 'Critical').length,
    expiringSoon: records.filter((record) => calculateMedicationSupplyStatus(record, now) === 'Expiring Soon').length,
    expired: records.filter((record) => calculateMedicationSupplyStatus(record, now) === 'Expired').length,
    lowStock: records.filter((record) => calculateMedicationSupplyStatus(record, now) === 'Low Stock').length,
    missing: records.filter((record) => calculateMedicationSupplyStatus(record, now) === 'Missing').length,
    needsNurseReview: records.filter((record) => calculateMedicationSupplyStatus(record, now) === 'Needs Nurse Review').length,
  };
}
