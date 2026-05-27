'use client';

import { useEffect, useState } from 'react';
import { AppShell, DataTable, StatusBadge, StatCard, consoleLinks } from '../../careproof-ui';
import { clients, medicalAvailabilityRecords } from '../../../data/demoCareProofData';
import { fetchMedicalAvailabilityApi, updateMedicalAvailabilityStatusApi } from '../../../lib/api-client';

export function MedicalAvailabilityScreen() {
  const [medRecords, setMedRecords] = useState(medicalAvailabilityRecords);
  const [backendConnected, setBackendConnected] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const visibleStatus = (item: typeof medRecords[number]) => statusOverrides[item.id] ?? item.status;
  const blocked = medRecords.filter((item) => item.blocksVisit).length;
  const missing = medRecords.filter((item) => ['Missing', 'Expired'].includes(visibleStatus(item))).length;
  const needsConfirmation = medRecords.filter((item) => visibleStatus(item) === 'Needs Confirmation').length;

  useEffect(() => {
    fetchMedicalAvailabilityApi().then((data) => {
      if (data.length > 0) {
        setMedRecords(data);
        setBackendConnected(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <AppShell title="Medical availability" subtitle="Confirm staff, supplies, medication, equipment, transportation, backup coverage, and emergency contacts before visits are treated as ready." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {medRecords.length} records</div>
      )}
      <div className="statsGrid">
        <StatCard label="Visits blocked" value={blocked} tone={blocked ? 'danger' : 'positive'} />
        <StatCard label="Missing availability" value={missing} tone={missing ? 'danger' : 'neutral'} />
        <StatCard label="Needs confirmation" value={needsConfirmation} tone={needsConfirmation ? 'warning' : 'neutral'} />
        <StatCard label="Staff coverage gaps" value={medRecords.filter((item) => item.type.includes('availability') || item.type === 'Backup caregiver').length} tone="info" />
      </div>
      <DataTable
        columns={['Client / Visit', 'Availability type', 'Status', 'Owner', 'Detail', 'Next action', 'Blocks visit', 'Actions']}
        rows={medRecords.map((item) => [
          item.clientName ?? (item.clientId ? clients.find((client) => client.id === item.clientId)?.name : null) ?? 'Agency',
          item.type,
          <StatusBadge key="status" status={visibleStatus(item)} />,
          item.owner,
          item.detail,
          item.nextAction,
          item.blocksVisit ? <StatusBadge key="blocker" status="Blocker" /> : <StatusBadge key="available" status="Available" />,
          <div key="actions" className="inlineActions">
            <button
              type="button"
              className="textAction"
              onClick={async () => {
                setStatusOverrides((current) => ({ ...current, [item.id]: 'Available' }));
                try {
                  const updated = await updateMedicalAvailabilityStatusApi(item.id, 'confirmed');
                  setMedRecords((previous) => previous.map((record) => record.id === updated.id ? updated : record));
                  setStatusOverrides((current) => {
                    const next = { ...current };
                    delete next[updated.id];
                    return next;
                  });
                } catch {
                  setStatusOverrides((current) => {
                    const next = { ...current };
                    delete next[item.id];
                    return next;
                  });
                }
              }}
            >
              Confirm
            </button>
          </div>,
        ])}
      />
    </AppShell>
  );
}
