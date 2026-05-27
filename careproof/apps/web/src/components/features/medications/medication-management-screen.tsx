'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatusBadge,
  StatCard,
  consoleLinks,
} from '../../careproof-ui';
import { medicationSupplyRecords } from '../../../data/demoCareProofData';
import {
  MEDICATION_SUPPLY_FILTERS,
  calculateMedicationSupplyRisk,
  calculateMedicationSupplyStatus,
  daysUntilExpiry,
  filterMedicationSupplies,
  medicationSupplyNextAction,
  medicationSupplySummary,
  type MedicationSupplyFilter,
} from '../../../lib/medication-safety';

function filterFromQuery(value: string | null): MedicationSupplyFilter {
  switch (value) {
    case 'critical':
      return 'Critical';
    case 'risk':
      return 'High Risk';
    case 'expiring':
      return 'Expiring Soon';
    case 'expired':
      return 'Expired';
    case 'low-stock':
      return 'Low Stock';
    case 'missing':
      return 'Missing';
    case 'nurse-review':
      return 'Needs Nurse Review';
    default:
      return 'All';
  }
}

function filterToQuery(filter: MedicationSupplyFilter) {
  const map: Record<MedicationSupplyFilter, string> = {
    All: 'all',
    Critical: 'critical',
    'High Risk': 'risk',
    'Expiring Soon': 'expiring',
    Expired: 'expired',
    'Low Stock': 'low-stock',
    Missing: 'missing',
    'Needs Nurse Review': 'nurse-review',
  };
  return map[filter];
}

export function MedicationManagementScreen({ initialFilter }: { initialFilter?: string | null }) {
  const [selectedFilter, setSelectedFilter] = useState<MedicationSupplyFilter>(() => filterFromQuery(initialFilter ?? null));
  const [search, setSearch] = useState('');
  const activeFilter = selectedFilter;

  const summary = useMemo(() => medicationSupplySummary(medicationSupplyRecords), []);
  const visibleRecords = useMemo(
    () => filterMedicationSupplies(medicationSupplyRecords, activeFilter, search),
    [activeFilter, search],
  );

  const setFilter = (filter: MedicationSupplyFilter) => {
    setSelectedFilter(filter);
    const query = filterToQuery(filter);
    window.history.replaceState(null, '', query === 'all' ? '/console/medications' : `/console/medications?filter=${query}`);
  };

  return (
    <AppShell
      title="Medication & supplies"
      subtitle="Operational safety view for medication availability, supply quantity, expiration risk, nurse review, and visit-blocking items."
      navItems={consoleLinks}
    >
      <div className="statsGrid">
        <StatCard label="Critical Items" value={summary.critical} tone={summary.critical ? 'danger' : 'positive'} />
        <StatCard label="Expiring Soon" value={summary.expiringSoon} tone={summary.expiringSoon ? 'warning' : 'positive'} />
        <StatCard label="Expired" value={summary.expired} tone={summary.expired ? 'danger' : 'positive'} />
        <StatCard label="Low Stock" value={summary.lowStock} tone={summary.lowStock ? 'warning' : 'positive'} />
        <StatCard label="Missing" value={summary.missing} tone={summary.missing ? 'danger' : 'positive'} />
        <StatCard label="Needs Nurse Review" value={summary.needsNurseReview} tone={summary.needsNurseReview ? 'danger' : 'positive'} href="/console/nurse-approvals" />
      </div>

      <DashboardCard title="Medication and supply controls">
        <div className="formGrid">
          <label className="demoField">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client, item, or owner"
            />
          </label>
          <div className="demoField">
            <span>Filter</span>
            <div className="inlineActions">
              {MEDICATION_SUPPLY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={filter === activeFilter ? 'button secondaryButton' : 'button ghostButton'}
                  onClick={() => setFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="Medication and supply safety table">
        <DataTable
          columns={[
            'Medication / Supply',
            'Client',
            'Category',
            'Quantity Available',
            'Unit',
            'Expiration Date',
            'Days Until Expiry',
            'Status',
            'Risk Level',
            'Assigned Owner',
            'Last Checked',
            'Next Action',
          ]}
          rows={visibleRecords.map((record) => {
            const status = calculateMedicationSupplyStatus(record);
            const risk = calculateMedicationSupplyRisk(record);
            const nextAction = medicationSupplyNextAction(record);
            return [
              <div key="item" className="tablePrimaryCell"><strong>{record.itemName}</strong><span>{record.notes ?? 'Operational supply record'}</span></div>,
              record.clientName,
              record.category,
              record.quantityAvailable,
              record.unit,
              record.expirationDate,
              daysUntilExpiry(record.expirationDate),
              <StatusBadge key="status" status={status} />,
              <StatusBadge key="risk" status={risk} />,
              record.assignedOwner,
              record.lastChecked,
              <Link key="action" className="button secondaryButton" href={nextAction === 'Assign nurse' ? '/console/nurse-approvals' : nextAction === 'Schedule inspection' ? '/console/inspections' : '/console/visit-blockers'}>
                {nextAction}
              </Link>,
            ];
          })}
        />
      </DashboardCard>
    </AppShell>
  );
}
