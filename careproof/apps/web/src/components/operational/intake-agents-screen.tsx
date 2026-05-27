'use client';

import { useEffect, useState } from 'react';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatusBadge,
  StatCard,
  consoleLinks,
} from '../careproof-ui';
import { branches, intakeRecords, users } from '../../data/demoCareProofData';
import { fetchIntakeRecordsApi, updateIntakeStageApi } from '../../lib/api-client';

const NEXT_BACKEND_STAGE: Record<string, string> = {
  'New Referral': 'assessment',
  'Assessment Scheduled': 'authorization',
  'Nurse Approval Required': 'onboarding',
  'Ready for Scheduling': 'active',
};

export function IntakeAgentsScreen() {
  const [records, setRecords] = useState(intakeRecords);
  const [backendConnected, setBackendConnected] = useState(false);
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
  const visibleStage = (item: typeof records[number]) => stageOverrides[item.id] ?? item.stage;
  const stageCounts = records.reduce<Record<string, number>>((acc, item) => {
    const stage = visibleStage(item);
    acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});
  const activeStages = Object.entries(stageCounts);

  useEffect(() => {
    fetchIntakeRecordsApi().then((data) => {
      if (data.length > 0) {
        setRecords(data);
        setBackendConnected(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <AppShell title="Intake / agents" subtitle="Track referrals from first contact through documents, assessment, nurse approval, and ready-for-scheduling handoff." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {records.length} records</div>
      )}
      <div className="statsGrid">
        <StatCard label="New referrals" value={stageCounts['New Referral'] ?? 0} tone="info" />
        <StatCard label="Waiting documents" value={stageCounts['Documents Pending'] ?? 0} tone="warning" />
        <StatCard label="Needs nurse approval" value={stageCounts['Nurse Approval Required'] ?? 0} tone="danger" />
        <StatCard label="Ready for scheduling" value={stageCounts['Ready for Scheduling'] ?? 0} tone="positive" />
        <StatCard label="Conversion rate" value="68%" tone="info" />
      </div>
      <DashboardCard title="Pipeline board">
        <div className="kanbanGrid">
          {activeStages.map(([stage]) => (
            <div key={stage} className="kanbanColumn kanbanColumn-neutral">
              <div className="kanbanHeader"><strong>{stage}</strong><span className="kanbanBadge">{stageCounts[stage]}</span></div>
              {records.filter((item) => visibleStage(item) === stage).map((item) => {
                const nextStage = NEXT_BACKEND_STAGE[stage];
                return (
                  <div key={item.id} className="visitCard">
                    <div className="visitCardTop"><strong>{item.prospectName}</strong><StatusBadge status={item.priority} /></div>
                    <p>{item.requiredServices.join(', ')}</p>
                    <p><strong>Next:</strong> {item.nextAction}</p>
                    {nextStage && (
                      <button
                        type="button"
                        className="textAction"
                        onClick={async () => {
                          const nextDisplay = Object.entries(NEXT_BACKEND_STAGE).find(([, value]) => value === nextStage)?.[0];
                          if (nextDisplay) setStageOverrides((current) => ({ ...current, [item.id]: nextDisplay }));
                          try {
                            const updated = await updateIntakeStageApi(item.id, nextStage);
                            setRecords((previous) => previous.map((record) => record.id === updated.id ? updated : record));
                            setStageOverrides((current) => {
                              const next = { ...current };
                              delete next[updated.id];
                              return next;
                            });
                          } catch {
                            setStageOverrides((current) => {
                              const next = { ...current };
                              delete next[item.id];
                              return next;
                            });
                          }
                        }}
                      >
                        Advance
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </DashboardCard>
      <DashboardCard title="Intake records">
        <DataTable
          columns={['Prospect', 'Referral source', 'Agent', 'Branch', 'Payer', 'Documents', 'Nurse approval', 'Next action']}
          rows={records.map((item) => [
            item.prospectName,
            item.referralSource,
            users.find((user) => user.id === item.assignedAgentId)?.name ?? item.assignedAgentId ?? 'Agent',
            item.branchName ?? branches.find((branch) => branch.id === item.branchId)?.name ?? '-',
            item.payerType,
            <StatusBadge key="docs" status={item.documentsStatus} />,
            <StatusBadge key="nurse" status={item.nurseApprovalStatus} />,
            item.nextAction,
          ])}
        />
      </DashboardCard>
    </AppShell>
  );
}
