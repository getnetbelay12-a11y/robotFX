'use client';

import { useEffect, useState } from 'react';
import { AppShell, DataTable, StatusBadge, StatCard, consoleLinks } from '../../careproof-ui';
import { clients, socialWorkCases, users } from '../../../data/demoCareProofData';
import { fetchSocialWorkCasesApi, updateSocialWorkCaseStatusApi } from '../../../lib/api-client';
import { isDateStringToday } from '../../../lib/date-utils';

export function SocialWorkScreen() {
  const [cases, setCases] = useState(socialWorkCases);
  const [caseStatuses, setCaseStatuses] = useState<Record<string, string>>({});
  const [backendConnected, setBackendConnected] = useState(false);
  const visibleStatus = (item: typeof cases[number]) => caseStatuses[item.id] ?? item.status;
  const open = cases.filter((item) => visibleStatus(item) !== 'Closed').length;
  const highRisk = cases.filter((item) => ['High', 'Critical'].includes(item.riskLevel)).length;
  const followUps = cases.filter((item) => isDateStringToday(item.nextFollowUpDate)).length;

  useEffect(() => {
    fetchSocialWorkCasesApi().then((data) => {
      if (data.length > 0) {
        setCases(data);
        setBackendConnected(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <AppShell title="Social work" subtitle="Track family concerns, well-being signals, support needs, and family-safe responses without exposing internal notes." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {cases.length} records</div>
      )}
      <div className="statsGrid">
        <StatCard label="Open cases" value={open} tone={open ? 'warning' : 'positive'} />
        <StatCard label="High-risk cases" value={highRisk} tone={highRisk ? 'danger' : 'neutral'} />
        <StatCard label="Follow-ups due today" value={followUps} tone={followUps ? 'warning' : 'neutral'} />
        <StatCard label="Linked family concerns" value={cases.filter((item) => item.linkedConcernId).length} tone="info" />
      </div>
      <DataTable
        columns={['Client', 'Case type', 'Risk', 'Status', 'Social worker', 'Next follow-up', 'Family-safe response', 'Actions']}
        rows={cases.map((item) => [
          clients.find((client) => client.id === item.clientId)?.name,
          item.caseType,
          <StatusBadge key="risk" status={item.riskLevel} />,
          <StatusBadge key="status" status={visibleStatus(item)} />,
          users.find((user) => user.id === item.assignedSocialWorkerId)?.name ?? 'Social worker',
          item.nextFollowUpDate,
          item.familySafeResponse ?? 'Draft response required',
          <div key="actions" className="inlineActions">
            <button type="button" className="textAction" onClick={async () => { setCaseStatuses((current) => ({ ...current, [item.id]: 'Escalated' })); try { const updated = await updateSocialWorkCaseStatusApi(item.id, 'escalated'); setCases((previous) => previous.map((caseItem) => caseItem.id === updated.id ? updated : caseItem)); setCaseStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Escalate</button>
            <button type="button" className="textAction" onClick={async () => { setCaseStatuses((current) => ({ ...current, [item.id]: 'Closed' })); try { const updated = await updateSocialWorkCaseStatusApi(item.id, 'closed'); setCases((previous) => previous.map((caseItem) => caseItem.id === updated.id ? updated : caseItem)); setCaseStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Close case</button>
          </div>,
        ])}
      />
    </AppShell>
  );
}
