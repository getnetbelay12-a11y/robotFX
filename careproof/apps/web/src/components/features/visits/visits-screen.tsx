'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AppShell,
  DataTable,
  EmptyState,
  SectionHeader,
  StatCard,
  StatusBadge,
  consoleLinks,
  displayVisitCode,
} from '../../careproof-ui';
import { caregivers, clients, getCaregiver, getClient } from '../../../data/demoCareProofData';
import {
  getChecklistProgress,
  getFamilyUpdateStatus,
  getVisitStatus,
} from '../../../lib/careproof-status';
import { useDemoStore } from '../../../lib/demoStore';

export function VisitsScreen() {
  const { visits, incidents, showToast } = useDemoStore();
  const [statusFilter, setStatusFilter] = useState(
    () => (typeof window === 'undefined' ? 'All' : new URLSearchParams(window.location.search).get('status') ?? 'All'),
  );
  const [caregiverFilter, setCaregiverFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState(
    () => (typeof window === 'undefined' ? 'All' : new URLSearchParams(window.location.search).get('client') ?? 'All'),
  );
  const [rangeFilter, setRangeFilter] = useState<'Today' | 'Week'>('Today');
  const [search, setSearch] = useState('');

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const client = getClient(visit.clientId);
      const caregiver = getCaregiver(visit.caregiverId);
      const status = getVisitStatus(visit);
      const inRange = rangeFilter === 'Week' ? true : visit.scheduledDay === 'Today';
      const statusMatch = statusFilter === 'All' ? true : status === statusFilter;
      const caregiverMatch = caregiverFilter === 'All' ? true : caregiver?.id === caregiverFilter;
      const clientMatch = clientFilter === 'All' ? true : client?.id === clientFilter;
      const text = `${client?.name ?? ''} ${caregiver?.name ?? ''} ${displayVisitCode(visit)}`.toLowerCase();
      const searchMatch = !search.trim() ? true : text.includes(search.trim().toLowerCase());
      return inRange && statusMatch && caregiverMatch && clientMatch && searchMatch;
    });
  }, [visits, statusFilter, caregiverFilter, clientFilter, rangeFilter, search]);
  const todayVisits = visits.filter((visit) => visit.scheduledDay === 'Today');
  const inProgress = todayVisits.filter((visit) => getVisitStatus(visit) === 'In Progress').length;
  const needsReview = todayVisits.filter((visit) => getVisitStatus(visit) === 'Needs Review' || Boolean(visit.incidentId) || (!visit.careNote && getVisitStatus(visit) === 'Completed')).length;
  const missingNotes = todayVisits.filter((visit) => !visit.careNote?.text).length;

  return (
    <AppShell
      title="Visits"
      subtitle="Filter by status, caregiver, client, and time range. Open a visit record and act on it."
      navItems={consoleLinks}
    >
      <div className="statsGrid">
        <StatCard label="Today’s visits" value={todayVisits.length} />
        <StatCard label="In progress" value={inProgress} tone="info" />
        <StatCard label="Needs review" value={needsReview} tone="warning" />
        <StatCard label="Missing notes" value={missingNotes} tone="warning" />
      </div>
      <SectionHeader
        eyebrow="Visit operations"
        title="Visit board"
        actions={
          <div className="filterControlRow">
            <Link className="button secondaryButton" href="/console/schedule">Create Visit</Link>
            <select value={rangeFilter} onChange={(event) => setRangeFilter(event.target.value as 'Today' | 'Week')}>
              <option value="Today">Today</option>
              <option value="Week">This week</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              <option>Scheduled</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Late</option>
              <option>Missed</option>
              <option>Needs Review</option>
            </select>
            <select value={caregiverFilter} onChange={(event) => setCaregiverFilter(event.target.value)}>
              <option value="All">All caregivers</option>
              {caregivers.map((caregiver) => (
                <option key={caregiver.id} value={caregiver.id}>{caregiver.name}</option>
              ))}
            </select>
            <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="All">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visit, client, or caregiver" />
          </div>
        }
      />
      {filteredVisits.length ? (
        <DataTable
          columns={['Visit', 'Client', 'Caregiver', 'Scheduled time', 'Status', 'Check-in', 'Check-out', 'Checklist', 'Incident', 'Family update', 'Action']}
          rows={filteredVisits.map((visit) => {
            const client = getClient(visit.clientId);
            const caregiver = getCaregiver(visit.caregiverId);
            const incident = visit.incidentId ? incidents.find((item) => item.id === visit.incidentId) : null;
            return [
              displayVisitCode(visit),
              <div key="client" className="tablePrimaryCell"><strong>{client?.name}</strong><span>{client?.address}</span></div>,
              caregiver?.name ?? '—',
              visit.scheduledTime,
              <StatusBadge key="status" status={getVisitStatus(visit)} />,
              visit.checkInTime ?? '—',
              visit.checkOutTime ?? '—',
              getChecklistProgress(visit).label,
              incident ? incident.type : 'None',
              getFamilyUpdateStatus(visit),
              <div key="actions" className="inlineActions">
                <Link className="textAction" href={`/console/visits/${visit.id}`}>View visit</Link>
                <button type="button" className="textAction" onClick={() => showToast('Demo reminder recorded for the assigned caregiver.')}>Send Reminder</button>
              </div>,
            ];
          })}
        />
      ) : (
        <EmptyState title="No visits match this filter." text="Try a broader status, client, caregiver, or date selection." />
      )}
    </AppShell>
  );
}
