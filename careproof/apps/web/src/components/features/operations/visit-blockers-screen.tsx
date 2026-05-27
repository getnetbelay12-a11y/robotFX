'use client';

import Link from 'next/link';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatCard,
  StatusBadge,
  consoleLinks,
  displayVisitCode,
  useVisitMetrics,
  useReferenceData,
} from '../../careproof-ui';
import {
  medicalAvailabilityRecords,
  medicationSupplyRecords,
} from '../../../data/demoCareProofData';
import { getVisitStatus, getVisitAlert } from '../../../lib/careproof-status';
import type { Visit } from '../../../types/careproof';

export function VisitBlockersScreen() {
  const { todayVisits } = useVisitMetrics();
  const { getClient, getCaregiver } = useReferenceData();

  const visitBlockers = todayVisits
    .filter((visit) => ['Late', 'Missed', 'Needs Review'].includes(getVisitStatus(visit)))
    .map((visit) => ({
      id: `visit-${visit.id}`,
      client: getClient(visit.clientId)?.name ?? visit.clientId,
      visitLabel: displayVisitCode(visit),
      type: 'Visit blocker',
      blocker: getVisitAlert(visit) ?? 'Visit requires coordinator review',
      risk: getVisitStatus(visit),
      owner: getCaregiver(visit.caregiverId)?.name ?? 'Caregiver',
      due: visit.endLabel,
      nextAction: 'Review visit',
      href: `/console/visits/${visit.id}`,
    }));

  const medicalBlockers = medicalAvailabilityRecords
    .filter((item) => item.blocksVisit || ['Missing', 'Expired'].includes(item.status))
    .map((item) => ({
      id: `medical-${item.id}`,
      client: item.clientName ?? 'Client',
      visitLabel: item.visitId
        ? displayVisitCode(todayVisits.find((v) => v.id === item.visitId) ?? ({ id: item.visitId } as Visit))
        : 'Client profile',
      type: 'Medical blocker',
      blocker: item.detail,
      risk: item.status,
      owner: item.owner,
      due: 'Today',
      nextAction: item.nextAction,
      href: '/console/medical-availability',
    }));

  const medicationBlockers = medicationSupplyRecords
    .filter((item) => item.blocksCare === true)
    .map((item) => ({
      id: `supply-${item.id}`,
      client: item.clientName,
      visitLabel: item.visitId
        ? displayVisitCode(todayVisits.find((v) => v.id === item.visitId) ?? ({ id: item.visitId } as Visit))
        : 'Client profile',
      type: 'Medication blocker',
      blocker: item.itemName,
      risk: 'Blocked',
      owner: item.assignedOwner,
      due: item.expirationDate,
      nextAction: item.notes ?? 'Resolve medication supply issue before care proceeds.',
      href: '/console/medications',
    }));

  const allBlockers = [...visitBlockers, ...medicalBlockers, ...medicationBlockers];

  return (
    <AppShell
      title="Visit Blockers"
      subtitle="Active blockers preventing visit readiness or care delivery."
      navItems={consoleLinks}
    >
      <div className="statsGrid">
        <StatCard
          label="Visit Blockers"
          value={visitBlockers.length}
          tone={visitBlockers.length ? 'danger' : 'positive'}
          href="/console/visits?status=Late"
        />
        <StatCard
          label="Medical Blockers"
          value={medicalBlockers.length}
          tone={medicalBlockers.length ? 'danger' : 'positive'}
          href="/console/medical-availability"
        />
        <StatCard
          label="Medication Blockers"
          value={medicationBlockers.length}
          tone={medicationBlockers.length ? 'danger' : 'positive'}
          href="/console/medications"
        />
        <StatCard
          label="Total Blocked"
          value={allBlockers.length}
          tone={allBlockers.length ? 'danger' : 'positive'}
        />
      </div>

      <DashboardCard title="Active Visit Blockers">
        {allBlockers.length === 0 ? (
          <p className="muted">No active blockers found. All visits are on track.</p>
        ) : (
          <DataTable
            columns={['Client', 'Visit / Type', 'Blocker', 'Risk', 'Owner', 'Due', 'Next Action']}
            rows={allBlockers.map((item) => [
              <div key="client" className="tablePrimaryCell">
                <strong>{item.client}</strong>
                <span>{item.type}</span>
              </div>,
              item.visitLabel,
              item.blocker,
              <StatusBadge key="risk" status={item.risk} />,
              item.owner,
              item.due,
              <Link key="action" className="button secondaryButton" href={item.href}>
                {item.nextAction}
              </Link>,
            ])}
          />
        )}
      </DashboardCard>
    </AppShell>
  );
}
