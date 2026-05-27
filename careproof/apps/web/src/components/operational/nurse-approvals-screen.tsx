'use client';

import { useEffect, useState } from 'react';
import { AiDisclaimer } from '../careproof-ai';
import {
  AppShell,
  DashboardCard,
  DataTable,
  EmptyState,
  StatusBadge,
  StatCard,
  Timeline,
  consoleLinks,
} from '../careproof-ui';
import { MetricCard } from '../ui';
import { caregivers, clients, nurseApprovals, users } from '../../data/demoCareProofData';
import { decideNurseApprovalApi, fetchNurseApprovalsApi } from '../../lib/api-client';

export function NurseApprovalsScreen() {
  const [approvals, setApprovals] = useState(nurseApprovals);
  const [selectedId, setSelectedId] = useState(nurseApprovals[0]?.id ?? '');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [backendConnected, setBackendConnected] = useState(false);
  const selected = approvals.find((item) => item.id === selectedId) ?? approvals[0];
  const visibleStatus = (item: typeof approvals[number]) => statusOverrides[item.id] ?? item.status;
  const pending = approvals.filter((item) => !['Approved', 'Rejected'].includes(visibleStatus(item))).length;
  const blocked = approvals.filter((item) => item.blocksFamilyVisibility && !['Approved', 'Rejected'].includes(visibleStatus(item))).length;
  const highPriority = approvals.filter((item) => ['High', 'Critical'].includes(item.priority)).length;

  useEffect(() => {
    fetchNurseApprovalsApi().then((data) => {
      if (data.length > 0) {
        setApprovals(data);
        setBackendConnected(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <AppShell
      title="Nurse approvals"
      subtitle="Review notes, incidents, medication tasks, care plan changes, and family updates before they become final or family-visible."
      navItems={consoleLinks}
    >
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {approvals.length} records</div>
      )}
      <div className="statsGrid">
        <StatCard label="Pending approval" value={pending} tone={pending ? 'warning' : 'positive'} />
        <StatCard label="High-priority reviews" value={highPriority} tone={highPriority ? 'danger' : 'neutral'} />
        <StatCard label="Family updates blocked" value={blocked} tone={blocked ? 'danger' : 'neutral'} />
        <StatCard label="Average approval time" value="42 min" tone="info" />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Approval queue">
          <DataTable
            columns={['Client', 'Type', 'Priority', 'Status', 'Assigned nurse', 'Submitted', 'Action']}
            rows={approvals.map((approval) => [
              clients.find((client) => client.id === approval.clientId)?.name ?? approval.clientId ?? 'Client',
              approval.approvalType,
              <StatusBadge key="priority" status={approval.priority} />,
              <StatusBadge key="status" status={visibleStatus(approval)} />,
              (users.find((user) => user.id === approval.assignedNurseId)?.name ?? approval.assignedNurseId) || 'Nurse',
              approval.submittedTime,
              <button key="action" type="button" className="textAction" onClick={() => setSelectedId(approval.id)}>Review</button>,
            ])}
          />
        </DashboardCard>
        <DashboardCard title="Approval detail">
          {selected ? (
            <div className="longformStack">
              <div className="detailFactGrid">
                <div><span>Client</span><strong>{clients.find((client) => client.id === selected.clientId)?.name}</strong></div>
                <div><span>Visit</span><strong>{selected.visitId ?? 'Not linked'}</strong></div>
                <div><span>Caregiver</span><strong>{selected.caregiverId ? caregivers.find((caregiver) => caregiver.id === selected.caregiverId)?.name : '—'}</strong></div>
                <div><span>Status</span><strong><StatusBadge status={visibleStatus(selected)} /></strong></div>
              </div>
              <AiDisclaimer>AI Draft · Needs Human Review · Not Sent · Not Final</AiDisclaimer>
              <MetricCard title="Notes submitted">
                <p>{selected.notesSubmitted}</p>
              </MetricCard>
              <MetricCard title="Nurse comments">
                <p>{selected.nurseComments ?? 'No decision comments yet.'}</p>
              </MetricCard>
              <div className="inlineActions">
                <button type="button" className="button primaryButton" onClick={async () => { setStatusOverrides((current) => ({ ...current, [selected.id]: 'Approved' })); try { const updated = await decideNurseApprovalApi(selected.id, 'approved'); setApprovals((previous) => previous.map((approval) => approval.id === updated.id ? updated : approval)); setStatusOverrides((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Approve</button>
                <button type="button" className="button secondaryButton" onClick={async () => { setStatusOverrides((current) => ({ ...current, [selected.id]: 'Changes Requested' })); try { const updated = await decideNurseApprovalApi(selected.id, 'needs_clarification'); setApprovals((previous) => previous.map((approval) => approval.id === updated.id ? updated : approval)); setStatusOverrides((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Request changes</button>
                <button type="button" className="button ghostButton" onClick={async () => { setStatusOverrides((current) => ({ ...current, [selected.id]: 'Rejected' })); try { const updated = await decideNurseApprovalApi(selected.id, 'rejected'); setApprovals((previous) => previous.map((approval) => approval.id === updated.id ? updated : approval)); setStatusOverrides((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Reject</button>
                <button type="button" className="button ghostButton" onClick={() => setStatusOverrides((current) => ({ ...current, [selected.id]: 'Escalated' }))}>Escalate</button>
              </div>
              <Timeline items={selected.auditTrail} />
            </div>
          ) : <EmptyState title="No approval selected" text="Choose an item from the queue." />}
        </DashboardCard>
      </div>
    </AppShell>
  );
}
