'use client';

import Link from 'next/link';
import {
  AppShell,
  DashboardCard,
  EmptyState,
  SectionHeader,
  StatCard,
  StatusBadge,
  consoleLinks,
  exceptionActionLabel,
  todayVisitsOnly,
  useReferenceData,
} from '../../careproof-ui';
import { medicalAvailabilityRecords, nurseApprovals } from '../../../data/demoCareProofData';
import {
  buildVisitExceptionItems,
  getFamilyUpdateStatus,
  getLiveVisitStatus,
  getVisitDisplayStatus,
  getVisitProgress,
  getVisitRiskLevel,
} from '../../../lib/careproof-status';
import { useDemoStore } from '../../../lib/demoStore';
import type { ExceptionItem, Visit } from '../../../types/careproof';

export function OperationsScreen() {
  const { filteredVisits, filteredIncidents, filteredFamilyConcerns, coordinatorChecklist, toggleCoordinatorChecklistItem, showToast } = useDemoStore();
  const { getClient, getCaregiver } = useReferenceData();
  const todayVisits = todayVisitsOnly(filteredVisits);
  const exceptionItems = buildVisitExceptionItems({
    visits: todayVisits,
    incidents: filteredIncidents,
    concerns: filteredFamilyConcerns,
  }).sort((a, b) => {
    const order: Record<ExceptionItem['severity'], number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return order[a.severity] - order[b.severity];
  });
  const overview = [
    ['Scheduled today', todayVisits.length, 'neutral'],
    ['In progress', todayVisits.filter((visit) => getLiveVisitStatus(visit) === 'In Progress').length, 'info'],
    ['Completed', todayVisits.filter((visit) => getLiveVisitStatus(visit) === 'Completed').length, 'positive'],
    ['Late', todayVisits.filter((visit) => getLiveVisitStatus(visit) === 'Late').length, 'warning'],
    ['Missed', todayVisits.filter((visit) => getLiveVisitStatus(visit) === 'Missed').length, 'danger'],
    ['Needs review', todayVisits.filter((visit) => getLiveVisitStatus(visit) === 'Needs Review').length, 'warning'],
    ['Open incidents', filteredIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length, 'warning'],
    ['Open family concerns', filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length, 'warning'],
  ] as const;
  const columns: Array<{ label: string; items: Visit[] }> = [
    { label: 'Upcoming', items: todayVisits.filter((visit) => ['Upcoming', 'Due Soon'].includes(getVisitDisplayStatus(visit))) },
    { label: 'In Progress', items: todayVisits.filter((visit) => getVisitDisplayStatus(visit) === 'In Progress') },
    { label: 'Completed', items: todayVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Completed') },
    { label: 'Needs Attention', items: todayVisits.filter((visit) => ['Late', 'Missed', 'Checkout Missing', 'Needs Review'].includes(getVisitDisplayStatus(visit))) },
  ];
  const topExceptions = exceptionItems.slice(0, 3);

  return (
    <AppShell title="Operations command center" subtitle="Open this view first each morning to see the day, the exceptions, and the next coordinator actions." navItems={consoleLinks}>
      <SectionHeader eyebrow="Daily operations" title="Today overview" text="Service reliability, live visit status, and exception ownership in one screen." />
      <div className="statsGrid">
        {overview.map(([label, value, tone]) => (
          <StatCard key={label} label={label} value={value} tone={tone as 'neutral' | 'positive' | 'warning' | 'danger' | 'info'} />
        ))}
      </div>

      <DashboardCard title="Start here">
        <div className="priorityStrip">
          {topExceptions.length ? (
            topExceptions.map((item) => (
              <div key={item.id} className="priorityItem">
                <div>
                  <span>{item.severity} priority</span>
                  <strong>{item.type}</strong>
                  <p>{item.recommendedAction}</p>
                </div>
                <Link className="button secondaryButton" href={item.entityRoute}>{exceptionActionLabel(item.type)}</Link>
              </div>
            ))
          ) : (
            <div className="priorityItem">
              <div>
                <span>No active exceptions</span>
                <strong>Morning queue is clear</strong>
                <p>Continue monitoring live visits and reports ready for family review.</p>
              </div>
              <Link className="button secondaryButton" href="/console/reports">Review reports</Link>
            </div>
          )}
        </div>
      </DashboardCard>

      <div className="dashboardSplit">
        <DashboardCard title="Live visit board">
          <div className="kanbanGrid">
            {columns.map((column) => (
              <div key={column.label} className="kanbanColumn">
                <div className="kanbanHeader">
                  <strong>{column.label}</strong>
                  <span>{column.items.length}</span>
                </div>
                {column.items.length ? (
                  column.items.map((visit) => {
                    const progress = getVisitProgress(visit);
                    const incidentFlag = visit.incidentId ? 'Incident reported' : 'No incident';
                    return (
                      <article key={visit.id} className="visitCard">
                        <div className="visitCardTop">
                          <div>
                            <strong>{getClient(visit.clientId)?.name}</strong>
                            <span>{getCaregiver(visit.caregiverId)?.name} · {visit.startLabel}</span>
                          </div>
                          <StatusBadge status={getVisitDisplayStatus(visit)} />
                        </div>
                        <div className="visitMetaGrid">
                          <div><span>Checklist</span><strong>{progress.checklist.label}</strong></div>
                          <div><span>Note</span><strong>{visit.careNote ? 'Entered' : 'Missing'}</strong></div>
                          <div><span>Risk</span><strong>{getVisitRiskLevel(visit)}</strong></div>
                          <div><span>Nurse</span><strong>{nurseApprovals.find((item) => item.visitId === visit.id)?.status ?? 'Not required'}</strong></div>
                          <div><span>Family update</span><strong>{nurseApprovals.some((item) => item.visitId === visit.id && item.blocksFamilyVisibility && item.status !== 'Approved') ? 'Approval blocked' : getFamilyUpdateStatus(visit)}</strong></div>
                          <div><span>Medical</span><strong>{medicalAvailabilityRecords.find((item) => item.visitId === visit.id)?.status ?? 'Available'}</strong></div>
                        </div>
                        <p className="mutedMeta">{incidentFlag}</p>
                        <div className="inlineActions">
                          <Link className="textAction" href={`/console/visits/${visit.id}`}>View visit</Link>
                          <button type="button" className="textAction" onClick={() => showToast('Caregiver contact note recorded in demo mode.')}>Contact Caregiver</button>
                          <button type="button" className="textAction" onClick={() => showToast('Demo reminder recorded for the assigned caregiver.')}>Send Reminder</button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <EmptyState title="No visits in this column" text="The board is clear for this live status." />
                )}
              </div>
            ))}
          </div>
        </DashboardCard>

        <div className="dashboardAsideStack">
          <DashboardCard title="Exceptions queue">
            {exceptionItems.length ? (
              <div className="stackGrid">
                {exceptionItems.map((item) => (
                  <div key={item.id} className="miniSummaryCard">
                    <div className="aiRiskSignalTop">
                      <strong>{item.type}</strong>
                      <StatusBadge status={item.severity} />
                    </div>
                    <p>{item.trigger}</p>
                    <p><strong>Action:</strong> {item.recommendedAction}</p>
                    <p><strong>Owner:</strong> {item.owner} · <strong>Due:</strong> {item.dueTime}</p>
                    <div className="inlineActions">
                      <Link className="textAction" href={item.entityRoute}>{exceptionActionLabel(item.type)}</Link>
                      <button type="button" className="textAction" onClick={() => showToast('Follow-up marker saved in demo mode.')}>Mark follow-up needed</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No exceptions right now" text="Late visits, incidents, and concern follow-up will appear here." />
            )}
          </DashboardCard>
          <DashboardCard title="Coordinator daily checklist">
            <div className="stackGrid">
              {[
                ['reviewLateVisits', 'Review late visits'],
                ['confirmMissedVisits', 'Confirm missed visits'],
                ['reviewOpenIncidents', 'Review open incidents'],
                ['respondToFamilyConcerns', 'Respond to family concerns'],
                ['sendReadyWeeklyReports', 'Send ready weekly reports'],
                ['checkVisitsWithoutNotes', 'Check visits without notes'],
              ].map(([id, label]) => (
                <label key={id} className="checklistRow checklistToggle">
                  <input
                    type="checkbox"
                    checked={Boolean(coordinatorChecklist[id])}
                    onChange={() => toggleCoordinatorChecklistItem(id)}
                  />
                  <strong>{label}</strong>
                </label>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>
    </AppShell>
  );
}
