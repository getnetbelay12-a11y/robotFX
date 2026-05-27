'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatCard,
  StatusBadge,
  consoleLinks,
  useReferenceData,
} from '../../careproof-ui';
import {
  familyConcerns,
  nurseApprovals,
} from '../../../data/demoCareProofData';

function getInitialFilter() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'waiting') return 'waiting';
  }
  return 'all';
}

export function ConsoleFamilyUpdatesScreen() {
  const [statusFilter, setStatusFilter] = useState<string>(getInitialFilter);
  const { getClient } = useReferenceData();

  const openConcerns = familyConcerns.filter(
    (item) => !['Resolved', 'Closed'].includes(item.status),
  );

  const blockedApprovals = nurseApprovals.filter(
    (item) => item.blocksFamilyVisibility === true && !['Approved', 'Rejected'].includes(item.status),
  );

  const concernRows = openConcerns.map((item) => ({
    id: `concern-${item.id}`,
    client: getClient(item.clientId)?.name ?? item.clientId,
    type: item.type,
    status: item.status,
    priority: item.priority,
    owner: item.assignedOwner,
    due: item.responseDue,
    nextAction: 'Draft family-safe response',
    href: '/console/family-concerns',
    source: 'concern' as const,
  }));

  const approvalRows = blockedApprovals.map((item) => ({
    id: `approval-${item.id}`,
    client: getClient(item.clientId)?.name ?? item.clientId,
    type: item.approvalType,
    status: item.status,
    priority: item.priority,
    owner: 'Nurse',
    due: item.submittedTime,
    nextAction: 'Complete nurse review',
    href: '/console/nurse-approvals',
    source: 'approval' as const,
  }));

  const allRows = [...concernRows, ...approvalRows];

  const visibleRows =
    statusFilter === 'waiting'
      ? allRows.filter((item) => !['Resolved', 'Closed', 'Approved'].includes(item.status))
      : allRows;

  const highPriority = allRows.filter((item) => item.priority === 'High' || item.priority === 'Critical').length;

  return (
    <AppShell
      title="Family Updates"
      subtitle="Family-facing updates and concerns waiting for response or approval."
      navItems={consoleLinks}
    >
      <div className="statsGrid">
        <StatCard
          label="Waiting for Response"
          value={allRows.length}
          tone={allRows.length ? 'warning' : 'positive'}
        />
        <StatCard
          label="Family Concerns"
          value={concernRows.length}
          tone={concernRows.length ? 'warning' : 'positive'}
          href="/console/family-concerns"
        />
        <StatCard
          label="Blocked by Nurse Approval"
          value={blockedApprovals.length}
          tone={blockedApprovals.length ? 'danger' : 'positive'}
          href="/console/nurse-approvals"
        />
        <StatCard
          label="High Priority"
          value={highPriority}
          tone={highPriority ? 'danger' : 'positive'}
        />
      </div>

      <DashboardCard title="Family Updates Queue">
        <div className="inlineActions">
          <button
            type="button"
            className={statusFilter === 'all' ? 'button primaryButton' : 'button secondaryButton'}
            onClick={() => {
              setStatusFilter('all');
              window.history.replaceState(null, '', '/console/family-updates');
            }}
          >
            All open
          </button>
          <button
            type="button"
            className={statusFilter === 'waiting' ? 'button primaryButton' : 'button secondaryButton'}
            onClick={() => {
              setStatusFilter('waiting');
              window.history.replaceState(null, '', '/console/family-updates?status=waiting');
            }}
          >
            Waiting only
          </button>
        </div>
        {visibleRows.length === 0 ? (
          <p className="muted">No family updates waiting for response.</p>
        ) : (
          <DataTable
            columns={['Client', 'Type', 'Status', 'Priority', 'Owner', 'Due', 'Next Action']}
            rows={visibleRows.map((item) => [
              <div key="client" className="tablePrimaryCell">
                <strong>{item.client}</strong>
              </div>,
              item.type,
              <StatusBadge key="status" status={item.status} />,
              <StatusBadge key="priority" status={item.priority} />,
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
