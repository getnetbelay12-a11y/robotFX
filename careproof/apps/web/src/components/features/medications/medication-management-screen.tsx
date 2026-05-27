'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AppShell,
  DashboardCard,
  DataTable,
  EmptyState,
  StatusBadge,
  StatCard,
  consoleLinks,
} from '../../careproof-ui';
import { AiDisclaimer } from '../../careproof-ai';
import { clients, medicationRecords } from '../../../data/demoCareProofData';
import {
  fetchMedicationRecordsApi,
  reconcileMedicationApi,
  requestMedicationNurseReviewApi,
  updateMedicationQuantityApi,
  updateMedicationStatusApi,
} from '../../../lib/api-client';
import type { MedicationRecord, MedicationStatus } from '../../../types/careproof';

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function isDueTodayOrOverdue(value: string) {
  return value <= new Date().toISOString().split('T')[0];
}

function isExpiringSoon(value: string) {
  return value <= addDaysIso(30);
}

function clientLabel(item: MedicationRecord) {
  return item.clientName ?? clients.find((client) => client.id === item.clientId)?.name ?? item.clientId;
}

export function MedicationManagementScreen() {
  const [records, setRecords] = useState<MedicationRecord[]>(medicationRecords);
  const [selectedId, setSelectedId] = useState(medicationRecords[0]?.id ?? '');
  const [backendConnected, setBackendConnected] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});
  const selected = records.find((item) => item.id === selectedId) ?? records[0];

  useEffect(() => {
    fetchMedicationRecordsApi().then((data) => {
      if (data.length > 0) {
        setRecords(data);
        setSelectedId(data[0].id);
        setBackendConnected(true);
      }
    }).catch(() => {});
  }, []);

  const riskSummary = useMemo(() => {
    const blockers = records.filter((item) => item.blocksVisit || ['Missing', 'Low Stock', 'Expired', 'Order Expired', 'Needs Nurse Review', 'Needs Refill'].includes(item.status)).length;
    return {
      blockers,
      lowStock: records.filter((item) => item.status === 'Low Stock' || item.quantityAvailable <= item.minimumRequiredQuantity).length,
      expiring: records.filter((item) => isExpiringSoon(item.medicationExpiryDate) || isExpiringSoon(item.orderExpiryDate)).length,
      reconciliationDue: records.filter((item) => isDueTodayOrOverdue(item.nextReconciliationDue)).length,
      highRisk: records.filter((item) => item.isHighRisk && (item.requiresNurseReview || item.status === 'Needs Nurse Review')).length,
    };
  }, [records]);

  const applyServerRecord = (updated: MedicationRecord) => {
    setRecords((previous) => previous.map((item) => item.id === updated.id ? updated : item));
    setSelectedId(updated.id);
  };

  const runAction = async (id: string, label: string, action: () => Promise<MedicationRecord>) => {
    setPendingActions((current) => ({ ...current, [id]: label }));
    try {
      applyServerRecord(await action());
    } finally {
      setPendingActions((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const medicationRows = records.map((item) => [
    <button key="med" type="button" className="textAction" onClick={() => setSelectedId(item.id)}>
      <strong>{item.medicationName}</strong> {item.strength}
    </button>,
    clientLabel(item),
    `${item.dose} · ${item.frequency}`,
    <StatusBadge key="status" status={item.status} />,
    `${item.quantityAvailable}/${item.minimumRequiredQuantity}`,
    item.medicationExpiryDate,
    item.orderExpiryDate,
    item.nextReconciliationDue,
    item.requiresNurseReview || item.isHighRisk ? <StatusBadge key="review" status="Nurse Review Required" /> : <StatusBadge key="clear" status="Available" />,
    item.nextAction,
  ]);

  const lowStock = records.filter((item) => item.status === 'Low Stock' || item.quantityAvailable <= item.minimumRequiredQuantity);
  const expiring = records.filter((item) => isExpiringSoon(item.medicationExpiryDate) || isExpiringSoon(item.orderExpiryDate));
  const due = records.filter((item) => isDueTodayOrOverdue(item.nextReconciliationDue));
  const highRisk = records.filter((item) => item.isHighRisk || item.requiresNurseReview || item.status === 'Needs Nurse Review');

  return (
    <AppShell title="Medication management" subtitle="Track medication availability, order validity, reconciliation, nurse review, and visit safety blockers." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {records.length} medication records</div>
      )}
      <div className="statsGrid">
        <StatCard label="Medication blockers" value={riskSummary.blockers} tone={riskSummary.blockers ? 'danger' : 'positive'} href="/console/medical-availability" />
        <StatCard label="Low stock" value={riskSummary.lowStock} tone={riskSummary.lowStock ? 'warning' : 'positive'} />
        <StatCard label="Expiring soon" value={riskSummary.expiring} tone={riskSummary.expiring ? 'warning' : 'positive'} href="/console/expiration-center" />
        <StatCard label="Reconciliation due" value={riskSummary.reconciliationDue} tone={riskSummary.reconciliationDue ? 'warning' : 'positive'} />
        <StatCard label="High-risk review" value={riskSummary.highRisk} tone={riskSummary.highRisk ? 'danger' : 'positive'} href="/console/nurse-approvals" />
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Client medication profile">
          <DataTable
            columns={['Medication', 'Client', 'Dose / frequency', 'Availability', 'Quantity', 'Medication expiry', 'Order expiry', 'Reconciliation due', 'Nurse review', 'Next action']}
            rows={medicationRows}
          />
        </DashboardCard>
        <DashboardCard title="Medication detail">
          {selected ? (
            <div className="longformStack">
              <div className="aiRiskSignalTop">
                <strong>{selected.medicationName} {selected.strength}</strong>
                <StatusBadge status={selected.status} />
              </div>
              <div className="detailFactGrid">
                <div><span>Client</span><strong>{clientLabel(selected)}</strong></div>
                <div><span>Dose</span><strong>{selected.dose}</strong></div>
                <div><span>Frequency</span><strong>{selected.frequency}</strong></div>
                <div><span>Route</span><strong>{selected.route}</strong></div>
                <div><span>Prescriber</span><strong>{selected.prescriberName}</strong></div>
                <div><span>Pharmacy</span><strong>{selected.pharmacyName ?? 'Not listed'}</strong></div>
                <div><span>Storage</span><strong>{selected.storageRequirement}</strong></div>
                <div><span>Family visible</span><strong>{selected.familyVisible ? 'Yes' : 'No'}</strong></div>
              </div>
              <AiDisclaimer>Medication AI drafts are not sent, final, approved, or closed without human review.</AiDisclaimer>
              <p>{selected.notes ?? selected.nextAction}</p>
              <div className="inlineActions">
                <button type="button" className="button secondaryButton" disabled={Boolean(pendingActions[selected.id])} onClick={() => runAction(selected.id, 'reconcile', () => reconcileMedicationApi(selected.id, addDaysIso(30), 'Medication list reconciled by reviewer.'))}>Mark reconciled</button>
                <button type="button" className="button secondaryButton" disabled={Boolean(pendingActions[selected.id])} onClick={() => runAction(selected.id, 'review', () => requestMedicationNurseReviewApi(selected.id, 'Medication nurse review requested from management screen.'))}>Request nurse review</button>
                <button type="button" className="button secondaryButton" disabled={Boolean(pendingActions[selected.id])} onClick={() => runAction(selected.id, 'quantity', () => updateMedicationQuantityApi(selected.id, selected.minimumRequiredQuantity + 7, 'Quantity updated after supply confirmation.'))}>Update quantity</button>
                <button type="button" className="button ghostButton" disabled={Boolean(pendingActions[selected.id])} onClick={() => runAction(selected.id, 'hold', () => updateMedicationStatusApi(selected.id, 'Held' as MedicationStatus, 'Medication held pending human review.'))}>Mark held</button>
                <button type="button" className="button ghostButton" disabled={Boolean(pendingActions[selected.id])} onClick={() => runAction(selected.id, 'discontinue', () => updateMedicationStatusApi(selected.id, 'Discontinued' as MedicationStatus, 'Medication discontinued after agency review.'))}>Mark discontinued</button>
                <button type="button" className="button ghostButton" disabled={Boolean(pendingActions[selected.id])} onClick={() => runAction(selected.id, 'notify', () => updateMedicationStatusApi(selected.id, selected.status, 'Notification draft requested. Human confirmation required before send.'))}>Create notification draft</button>
              </div>
              {pendingActions[selected.id] && <p className="fieldHint">Updating from server response...</p>}
              <div className="inlineActions">
                <Link className="textAction" href="/console/medical-availability">Medical availability</Link>
                <Link className="textAction" href="/console/expiration-center">Expiration center</Link>
                <Link className="textAction" href="/console/inspection-center">Inspection center</Link>
                <Link className="textAction" href="/console/reports">Reports</Link>
              </div>
            </div>
          ) : (
            <EmptyState title="No medication selected" text="Choose a medication record from the profile table." />
          )}
        </DashboardCard>
      </div>

      <div className="cardGridThree">
        <DashboardCard title="Expiring medications">
          <DataTable columns={['Client', 'Medication', 'Medication expiry', 'Order expiry', 'Status']} rows={expiring.map((item) => [clientLabel(item), item.medicationName, item.medicationExpiryDate, item.orderExpiryDate, <StatusBadge key="status" status={item.status} />])} />
        </DashboardCard>
        <DashboardCard title="Low stock">
          <DataTable columns={['Client', 'Medication', 'Quantity', 'Minimum', 'Next action']} rows={lowStock.map((item) => [clientLabel(item), item.medicationName, item.quantityAvailable, item.minimumRequiredQuantity, item.nextAction])} />
        </DashboardCard>
        <DashboardCard title="Reconciliation due">
          <DataTable columns={['Client', 'Medication', 'Last reconciled', 'Due', 'Status']} rows={due.map((item) => [clientLabel(item), item.medicationName, item.lastReconciledAt, item.nextReconciliationDue, <StatusBadge key="status" status={item.status} />])} />
        </DashboardCard>
      </div>

      <DashboardCard title="High-risk medication review queue">
        <DataTable
          columns={['Client', 'Medication', 'Storage', 'Nurse review', 'Approval link', 'Next action']}
          rows={highRisk.map((item) => [
            clientLabel(item),
            `${item.medicationName} ${item.strength}`,
            item.storageRequirement,
            item.requiresNurseReview ? <StatusBadge key="review" status="Nurse Review Required" /> : <StatusBadge key="clear" status="Available" />,
            item.nurseApprovalId ? <Link key="approval" className="textAction" href="/console/nurse-approvals">Open approval</Link> : 'Not created',
            item.nextAction,
          ])}
        />
      </DashboardCard>
    </AppShell>
  );
}
