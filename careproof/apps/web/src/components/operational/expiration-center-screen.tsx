'use client';

import { useEffect, useState } from 'react';
import { AiDisclaimer } from '../careproof-ai';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatusBadge,
  StatCard,
  consoleLinks,
} from '../careproof-ui';
import { expirationRecords } from '../../data/demoCareProofData';
import { fetchExpirationRecordsApi, updateRenewalStatusApi } from '../../lib/api-client';
import { useDemoStore } from '../../lib/demoStore';

export function ExpirationCenterScreen() {
  const { showToast } = useDemoStore();
  const [expRecords, setExpRecords] = useState(expirationRecords);
  const [backendConnected, setBackendConnected] = useState(false);
  const expiring30 = expRecords.filter((item) => item.state === 'Expiring in 30 days').length;
  const expiring7 = expRecords.filter((item) => item.state === 'Expiring in 7 days').length;
  const blockers = expRecords.filter((item) => item.blocksVisits || ['Expired', 'Missing', 'Blocker'].includes(item.state)).length;

  useEffect(() => {
    fetchExpirationRecordsApi().then((data) => {
      if (data.length > 0) {
        setExpRecords(data);
        setBackendConnected(true);
      }
    }).catch(() => {});
  }, []);

  return (
    <AppShell title="Expiration center" subtitle="Track licenses, checks, certifications, care plans, authorizations, consents, agency reviews, and blockers before they disrupt care." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {expRecords.length} records</div>
      )}
      <div className="statsGrid">
        <StatCard label="Expiring in 30 days" value={expiring30} tone={expiring30 ? 'warning' : 'neutral'} />
        <StatCard label="Expiring in 7 days" value={expiring7} tone={expiring7 ? 'danger' : 'neutral'} />
        <StatCard label="Expired / missing blockers" value={blockers} tone={blockers ? 'danger' : 'positive'} />
        <StatCard label="Visits blocked" value={expRecords.filter((item) => item.blocksVisits).length} tone="danger" />
      </div>
      <DataTable
        columns={['Owner', 'Category', 'Item', 'Expiration', 'State', 'Responsible owner', 'Renewal status', 'Actions']}
        rows={expRecords.map((item) => [
          item.ownerName,
          item.category,
          item.item,
          item.expirationDate ?? 'Missing',
          <StatusBadge key="state" status={item.state} />,
          item.responsibleOwner,
          item.renewalStatus,
          <div key="actions" className="inlineActions">
            <button type="button" className="textAction" onClick={async () => { showToast('Renewal action recorded.'); try { const updated = await updateRenewalStatusApi(item.id, 'renewed'); setExpRecords((previous) => previous.map((record) => record.id === updated.id ? updated : record)); } catch {} }}>Renewal action</button>
            <button type="button" className="textAction" onClick={() => showToast('Notification draft generated. Human confirmation required before sending.')}>Notify staff</button>
          </div>,
        ])}
      />
      <DashboardCard title="Notification drafts">
        <div className="stackGrid">
          {expRecords.filter((item) => item.state !== 'Valid').map((item) => (
            <div key={item.id} className="miniSummaryCard">
              <div className="aiRiskSignalTop"><strong>{item.item}</strong><StatusBadge status={item.state} /></div>
              <p>{item.notificationDraft}</p>
              <AiDisclaimer>Notification draft generated. Human confirmation required before external send.</AiDisclaimer>
            </div>
          ))}
        </div>
      </DashboardCard>
    </AppShell>
  );
}
