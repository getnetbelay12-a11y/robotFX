'use client';

import { useEffect, useState } from 'react';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatusBadge,
  StatCard,
  consoleLinks,
} from '../../careproof-ui';
import { caregivers, clients, inspectionFindings, inspectionRules } from '../../../data/demoCareProofData';
import { fetchInspectionFindingsApi, fetchInspectionRulesApi, updateFindingStatusApi } from '../../../lib/api-client';

export function InspectionCenterScreen() {
  const [findings, setFindings] = useState(inspectionFindings);
  const [rules, setRules] = useState(inspectionRules);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [backendConnected, setBackendConnected] = useState(false);
  const visibleStatus = (finding: typeof findings[number]) => statuses[finding.id] ?? finding.status;
  const open = findings.filter((item) => !['Resolved', 'Dismissed'].includes(visibleStatus(item))).length;
  const compliance = findings.filter((item) => item.severity === 'Compliance').length;
  const critical = findings.filter((item) => item.severity === 'Critical').length;

  useEffect(() => {
    Promise.all([fetchInspectionFindingsApi(), fetchInspectionRulesApi()])
      .then(([findingsData, rulesData]) => {
        if (findingsData.length > 0 || rulesData.length > 0) {
          if (findingsData.length > 0) setFindings(findingsData);
          if (rulesData.length > 0) setRules(rulesData);
          setBackendConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AppShell title="Inspection center" subtitle="Automated inspection rules catch missing proof, overdue communication, compliance risk, and unsafe readiness gaps." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {findings.length} findings</div>
      )}
      <div className="statsGrid">
        <StatCard label="Open findings" value={open} tone={open ? 'warning' : 'positive'} />
        <StatCard label="Critical findings" value={critical} tone={critical ? 'danger' : 'neutral'} />
        <StatCard label="Compliance findings" value={compliance} tone={compliance ? 'danger' : 'neutral'} />
        <StatCard label="Notification mode" value="Draft only" tone="info" />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Open findings">
          <DataTable
            columns={['Finding', 'Severity', 'Status', 'Linked record', 'Owner', 'Recommended action', 'Actions']}
            rows={findings.map((finding) => [
              <div key="finding" className="tablePrimaryCell"><strong>{finding.title}</strong><span>{rules.find((rule) => rule.id === finding.ruleId)?.name}</span></div>,
              <StatusBadge key="severity" status={finding.severity} />,
              <StatusBadge key="status" status={visibleStatus(finding)} />,
              finding.clientName ?? (finding.clientId ? clients.find((client) => client.id === finding.clientId)?.name : null) ?? finding.caregiverName ?? (finding.caregiverId ? caregivers.find((caregiver) => caregiver.id === finding.caregiverId)?.name : null) ?? finding.relatedType,
              finding.owner,
              finding.recommendedAction,
              <div key="actions" className="inlineActions">
                <button type="button" className="textAction" onClick={async () => { setStatuses((current) => ({ ...current, [finding.id]: 'Acknowledged' })); try { const updated = await updateFindingStatusApi(finding.id, 'in_progress'); setFindings((previous) => previous.map((item) => item.id === updated.id ? updated : item)); setStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Acknowledge</button>
                <button type="button" className="textAction" onClick={async () => { setStatuses((current) => ({ ...current, [finding.id]: 'Resolved' })); try { const updated = await updateFindingStatusApi(finding.id, 'resolved'); setFindings((previous) => previous.map((item) => item.id === updated.id ? updated : item)); setStatuses((current) => { const next = { ...current }; delete next[updated.id]; return next; }); } catch {} }}>Resolve</button>
              </div>,
            ])}
          />
        </DashboardCard>
        <DashboardCard title="Inspection rules">
          <div className="stackGrid">
            {rules.map((rule) => (
              <div key={rule.id} className="miniSummaryCard">
                <div className="aiRiskSignalTop">
                  <strong>{rule.name}</strong>
                  <StatusBadge status={rule.severity} />
                </div>
                <p>{rule.description}</p>
                <p><strong>Category:</strong> {rule.category} · <strong>Status:</strong> {rule.enabled ? 'Enabled' : 'Off'}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </AppShell>
  );
}
