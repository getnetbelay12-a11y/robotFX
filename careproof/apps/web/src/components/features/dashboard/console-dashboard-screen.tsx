'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AppShell,
  DashboardCard,
  DataTable,
  EmptyState,
  StatCard,
  StatusBadge,
  Timeline,
  VisitCard,
  attentionActionLabel,
  attentionSummary,
  consoleLinks,
  displayVisitCode,
  useReferenceData,
  useVisitMetrics,
} from '../../careproof-ui';
import { AiActionButton, AiDisclaimer, AiReviewBadge, AiRiskSignalCard } from '../../careproof-ai';
import {
  expirationRecords,
  inspectionFindings,
  medicalAvailabilityRecords,
  nurseApprovals,
  socialWorkCases,
} from '../../../data/demoCareProofData';
import {
  getChecklistProgress,
  getVisitAlert,
  getVisitStatus,
  isCheckoutMissing,
} from '../../../lib/careproof-status';
import {
  generateNextActionsApi,
  generateRiskSignalsApi,
} from '../../../lib/api-client';
import { useDemoStore } from '../../../lib/demoStore';
import type { Visit } from '../../../types/careproof';

export function ConsoleDashboardScreen() {
  const { todayVisits, scheduled, inProgress, completed, late, missed, needsReview, incidents, familyConcerns, weeklyReports } = useVisitMetrics();
  const { showToast, onboardingChecklist, onboardingProgress, pilotReadiness } = useDemoStore();
  const { caregivers, getClient, getCaregiver } = useReferenceData();
  const attention = attentionSummary(todayVisits, incidents, familyConcerns);
  const [aiActions, setAiActions] = useState<Array<{ priority: string; reason: string; suggestedOwner: string; suggestedDueTime: string; action: string }> | null>(null);
  const [riskSignals, setRiskSignals] = useState<Array<{ signalTitle: string; whyItMatters: string; affectedClient: string; affectedCaregiver: string; recommendedCoordinatorAction: string; confidence: string }> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const boardColumns: Array<{ label: string; items: Visit[] }> = [
    { label: 'Scheduled', items: todayVisits.filter((visit) => getVisitStatus(visit) === 'Scheduled') },
    { label: 'In Progress', items: todayVisits.filter((visit) => getVisitStatus(visit) === 'In Progress') },
    { label: 'Completed', items: todayVisits.filter((visit) => getVisitStatus(visit) === 'Completed') },
    { label: 'Late / Needs Attention', items: todayVisits.filter((visit) => ['Late', 'Needs Review', 'Missed'].includes(getVisitStatus(visit))) },
  ];
  const openIncidents = incidents.filter((item) => !['Resolved', 'Closed'].includes(item.status)).length;
  const openConcerns = familyConcerns.filter((item) => !['Resolved', 'Closed'].includes(item.status)).length;
  const reportsReady = weeklyReports.filter((item) => item.status === 'Ready').length;
  const pendingNurseApprovals = nurseApprovals.filter((item) => !['Approved', 'Rejected'].includes(item.status)).length;
  const highPriorityNurseReviews = nurseApprovals.filter((item) => ['High', 'Critical'].includes(item.priority) && !['Approved', 'Rejected'].includes(item.status)).length;
  const openInspectionFindings = inspectionFindings.filter((item) => !['Resolved', 'Dismissed'].includes(item.status)).length;
  const openSocialWorkCases = socialWorkCases.filter((item) => item.status !== 'Closed').length;
  const medicalBlockers = medicalAvailabilityRecords.filter((item) => item.blocksVisit || ['Missing', 'Expired'].includes(item.status)).length;
  const expiringBlockers = expirationRecords.filter((item) => item.blocksVisits || ['Expired', 'Missing', 'Blocker', 'Expiring in 7 days'].includes(item.state)).length;
  const lateTone = (late === 0 ? 'neutral' : 'danger') as 'neutral' | 'danger';
  const missedTone = (missed === 0 ? 'neutral' : 'danger') as 'neutral' | 'danger';
  const reviewTone = (needsReview === 0 ? 'neutral' : 'warning') as 'neutral' | 'warning';
  const incidentTone = (openIncidents === 0 ? 'neutral' : 'warning') as 'neutral' | 'warning';
  const concernTone = (openConcerns === 0 ? 'neutral' : 'warning') as 'neutral' | 'warning';
  const activeAttention = attention.filter(([, count]) => count > 0);
  const defaultNextActions = attention
    .filter(([, count]) => Number(count) > 0)
    .slice(0, 4);

  return (
    <AppShell
      title="Agency dashboard"
      subtitle="What needs attention today? Review visit proof, open issues, family concerns, and report-ready records from one operating screen."
      navItems={consoleLinks}
    >
      {onboardingProgress < 100 ? (
        <div className="dashboardSplit">
          <DashboardCard title="Onboarding readiness">
            <div className="readinessHeader">
              <div>
                <p className="sectionEyebrow">Setup progress</p>
                <h3>{onboardingProgress}% complete</h3>
              </div>
              <Link className="button primaryButton" href="/console/onboarding">
                {onboardingProgress >= 60 ? 'Open Setup Checklist' : 'Finish Agency Setup'}
              </Link>
            </div>
            <div className="progressBar"><span style={{ width: `${onboardingProgress}%` }} /></div>
            <div className="stackGrid compactStack">
              {onboardingChecklist.map((item) => (
                <div key={item.id} className="miniSummaryCard miniSummaryTight">
                  <strong>{item.label}</strong>
                  <StatusBadge status={item.completed ? 'Completed' : 'Scheduled'} />
                </div>
              ))}
            </div>
          </DashboardCard>
          <DashboardCard title="Pilot readiness score">
            <div className="readinessScoreCard">
              <strong>{pilotReadiness.score}</strong>
              <span>{pilotReadiness.status}</span>
            </div>
            <ul className="featureList">
              {pilotReadiness.recommendations.slice(0, 4).map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      ) : null}

      <div className="statsGrid">
        <StatCard label="Today's Visits" value={todayVisits.length} href="/console/visits?range=Today" />
        <StatCard label="Scheduled" value={scheduled} href="/console/visits?status=Scheduled" />
        <StatCard label="In Progress" value={inProgress} tone="info" href="/console/visits?status=In+Progress" />
        <StatCard label="Completed" value={completed} tone="positive" href="/console/visits?status=Completed" />
        <StatCard label="Late" value={late} tone={lateTone} href="/console/visits?status=Late" />
        <StatCard label="Missed" value={missed} tone={missedTone} href="/console/visits?status=Missed" />
        <StatCard label="Needs Review" value={needsReview} tone={reviewTone} href="/console/visits?status=Needs+Review" />
        <StatCard label="Open Incidents" value={openIncidents} tone={incidentTone} href="/console/incidents" />
        <StatCard label="Family Concerns" value={openConcerns} tone={concernTone} href="/console/family-concerns" />
        <StatCard label="Reports Ready" value={reportsReady} tone="positive" href="/console/reports" />
        <StatCard label="Nurse Approvals" value={pendingNurseApprovals} tone={highPriorityNurseReviews ? 'danger' : 'warning'} href="/console/nurse-approvals" />
        <StatCard label="Inspection Findings" value={openInspectionFindings} tone={openInspectionFindings ? 'warning' : 'neutral'} href="/console/inspection-center" />
        <StatCard label="Social Work Cases" value={openSocialWorkCases} tone={openSocialWorkCases ? 'warning' : 'neutral'} href="/console/social-work" />
        <StatCard label="Medical Blockers" value={medicalBlockers} tone={medicalBlockers ? 'danger' : 'neutral'} href="/console/medical-availability" />
        <StatCard label="Compliance Expiring" value={expiringBlockers} tone={expiringBlockers ? 'danger' : 'neutral'} href="/console/expiration-center" />
      </div>

      <DashboardCard title="Today’s Risk Board">
        <div className="riskBoardGrid">
          {[
            ['Critical', `${openIncidents + medicalBlockers} critical operational items`, '/console/operations'],
            ['Needs approval', `${pendingNurseApprovals} nurse or agency approvals pending`, '/console/nurse-approvals'],
            ['Missing proof', `${todayVisits.filter((visit) => !visit.careNote && visit.checkOutTime).length} visits missing notes after checkout`, '/console/inspection-center'],
            ['Family waiting', `${openConcerns} family concerns need response`, '/console/family-concerns'],
            ['Compliance blocker', `${expiringBlockers} expiring or missing compliance items`, '/console/expiration-center'],
          ].map(([label, body, href]) => (
            <Link key={label} className="riskBoardCard" href={href}>
              <StatusBadge status={label} />
              <strong>{body}</strong>
              <span>Open next action</span>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <div className="dashboardSplit">
        <DashboardCard title="Today's visit board">
          <div className="kanbanGrid">
            {boardColumns.map(({ label, items }) => {
              const columnTone =
                label === 'Completed'
                  ? 'kanbanColumn-positive'
                  : label === 'In Progress'
                    ? 'kanbanColumn-info'
                    : label === 'Late / Needs Attention'
                      ? 'kanbanColumn-danger'
                      : 'kanbanColumn-neutral';
              const isAttentionColumn = label === 'Late / Needs Attention';
              const badgeClass = isAttentionColumn && items.length > 0 ? 'kanbanBadge kanbanBadge-danger' : 'kanbanBadge';
              return (
                <div key={label} className={`kanbanColumn ${columnTone}`}>
                  <div className="kanbanHeader">
                    <strong>{label}</strong>
                    <span className={badgeClass}>{items.length}</span>
                  </div>
                  {items.length ? (
                    items.map((visit) => <VisitCard key={visit.id} visit={visit} href={`/console/visits/${visit.id}`} />)
                  ) : (
                    <EmptyState title="No visits here" text="No visit proof records are in this stage right now." />
                  )}
                </div>
              );
            })}
          </div>
        </DashboardCard>
        <div className="dashboardAsideStack">
          <DashboardCard title="Suggested Next Actions">
            <div className="actionStack">
              <AiActionButton
                label="Refresh Suggestions"
                onClick={async () => {
                  setAiLoading(true);
                  const queue = todayVisits
                    .filter((visit) => ['Late', 'Missed', 'Needs Review'].includes(getVisitStatus(visit)))
                    .map((visit) => ({
                      id: visit.id,
                      type: getVisitStatus(visit).toLowerCase().replace(/\s+/g, '_'),
                      trigger: getVisitAlert(visit) ?? 'Visit needs coordinator review.',
                      recommendedAction: 'Review visit',
                      clientName: getClient(visit.clientId)?.name,
                      caregiverName: getCaregiver(visit.caregiverId)?.name,
                    }));
                  const result = await generateNextActionsApi({ attentionQueue: queue });
                  setAiActions((result as { prioritizedActions?: Array<{ priority: string; reason: string; suggestedOwner: string; suggestedDueTime: string; action: string }> }).prioritizedActions ?? []);
                  setAiLoading(false);
                  showToast('AI next actions refreshed.');
                }}
                disabled={aiLoading}
              />
              <AiDisclaimer>AI-assisted draft. Human review required before acting on escalations.</AiDisclaimer>
            </div>
            {aiActions?.length ? (
              <div className="stackGrid">
                {aiActions.map((item) => (
                  <div key={`${item.action}-${item.reason}`} className="miniSummaryCard">
                    <div className="aiRiskSignalTop">
                      <strong>{item.action}</strong>
                      <AiReviewBadge label={item.priority} />
                    </div>
                    <p>{item.reason}</p>
                    <p><strong>Owner:</strong> {item.suggestedOwner} · <strong>Due:</strong> {item.suggestedDueTime}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stackGrid">
                {defaultNextActions.length ? (
                  defaultNextActions.map(([label, count, action]) => (
                    <div key={label} className="miniSummaryCard">
                      <div className="aiRiskSignalTop">
                        <strong>{attentionActionLabel(label)}</strong>
                        <StatusBadge status={Number(count) > 1 ? 'High' : 'Medium'} />
                      </div>
                      <p>{count} item{Number(count) === 1 ? '' : 's'} need action. {action}.</p>
                      <p><strong>Owner:</strong> Coordinator · <strong>Due:</strong> Today</p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No urgent actions right now" text="Refresh suggestions if you want an AI-assisted draft of coordinator follow-up actions." />
                )}
              </div>
            )}
          </DashboardCard>
          <DashboardCard title="Attention Queue">
            {activeAttention.length ? (
              <div className="alertList">
                {activeAttention.map(([label, count, action]) => {
                const href =
                  label === 'Open Incidents' ? '/console/incidents' :
                  label === 'Open family concerns' ? '/console/family-concerns' :
                  label === 'Late visit' ? '/console/visits?status=Late' :
                  label === 'Missed visit' ? '/console/visits?status=Missed' :
                  label === 'Checkout missing' ? '/console/visits?status=Needs+Review' :
                  label === 'Incomplete checklists' ? '/console/visits?status=Needs+Review' :
                  label === 'Missing notes' ? '/console/visits?status=Needs+Review' :
                  '/console/visits';
                const isUrgent = typeof count === 'number' && count > 0;
                return (
                  <div key={label} className={`alertRow${isUrgent ? ' alertRow-urgent' : ''}`}>
                    <div>
                      <strong>{label}</strong>
                      <p>{count} items · {action}</p>
                    </div>
                    <Link className="textAction" href={href}>
                      {attentionActionLabel(label)}
                    </Link>
                  </div>
                );
                })}
              </div>
            ) : (
              <EmptyState title="No open attention items" text="Late visits, incidents, family concerns, missing notes, and checklist gaps will appear here." />
            )}
          </DashboardCard>
          <DashboardCard title="Caregiver Performance Snapshot">
            <DataTable
              columns={['Caregiver', 'Assigned', 'Completed', 'On-time rate', 'Open issues']}
              rows={caregivers.map((caregiver) => [
                caregiver.name,
                caregiver.assignedVisits,
                caregiver.completedVisits,
                `${caregiver.onTimeRate}%`,
                caregiver.openIssues,
              ])}
            />
          </DashboardCard>
          <DashboardCard title="Recent Activity Timeline">
            <Timeline
              items={[
                ...todayVisits
                  .filter((v) => v.checkInTime)
                  .map((v) => ({
                    label: `${getCaregiver(v.caregiverId)?.name ?? 'Caregiver'} checked in — ${getClient(v.clientId)?.name ?? 'client'}`,
                    time: v.checkInTime ?? '',
                    actor: 'Caregiver',
                  })),
                ...todayVisits
                  .filter((v) => v.checkOutTime)
                  .map((v) => ({
                    label: `${displayVisitCode(v)} completed — ${getClient(v.clientId)?.name ?? 'client'}`,
                    time: v.checkOutTime ?? '',
                    actor: 'Caregiver',
                  })),
                ...incidents
                  .slice(0, 2)
                  .map((inc) => ({
                    label: `Incident: ${inc.type}`,
                    time: inc.createdAt,
                    actor: 'Staff',
                  })),
                ...familyConcerns
                  .filter((c) => c.status === 'Closed' || c.status === 'Resolved')
                  .slice(0, 1)
                  .map((c) => ({
                    label: `Concern resolved — ${c.type}`,
                    time: c.responseDue ?? 'Recently',
                    actor: 'Coordinator',
                  })),
              ]
                .filter((item) => item.time)
                .slice(0, 6)}
            />
          </DashboardCard>
          <DashboardCard title="Risk Signals">
            <div className="actionStack">
              <AiActionButton
                label="Refresh Risk Signals"
                onClick={async () => {
                  const records = caregivers.map((caregiver) => {
                    const caregiverVisits = todayVisits.filter((visit) => visit.caregiverId === caregiver.id);
                    return {
                      clientId: caregiverVisits[0]?.clientId ?? caregiver.id,
                      clientName: caregiverVisits[0] ? getClient(caregiverVisits[0].clientId)?.name : undefined,
                      caregiverId: caregiver.id,
                      caregiverName: caregiver.name,
                      lateVisits: caregiverVisits.filter((visit) => getVisitStatus(visit) === 'Late').length,
                      incompleteTasks: caregiverVisits.filter((visit) => !getChecklistProgress(visit).complete).length,
                      concerns: familyConcerns.filter((concern) => caregiverVisits.some((visit) => visit.clientId === concern.clientId)).length,
                      incidents: incidents.filter((incident) => caregiverVisits.some((visit) => visit.clientId === incident.clientId)).length,
                      missingNotes: caregiverVisits.filter((visit) => !visit.careNote).length,
                      checkoutMissing: caregiverVisits.filter(isCheckoutMissing).length,
                    };
                  });
                  const result = await generateRiskSignalsApi({ records });
                  setRiskSignals((result as { riskSignals?: Array<{ signalTitle: string; whyItMatters: string; affectedClient: string; affectedCaregiver: string; recommendedCoordinatorAction: string; confidence: string }> }).riskSignals ?? []);
                  showToast('Risk signals refreshed.');
                }}
              />
              <AiDisclaimer>Operational signals only. Not medical advice.</AiDisclaimer>
            </div>
            {riskSignals?.length ? (
              <div className="stackGrid">
                {riskSignals.map((signal) => (
                  <AiRiskSignalCard
                    key={`${signal.signalTitle}-${signal.affectedClient}`}
                    title={`${signal.signalTitle} · ${signal.affectedClient}`}
                    body={signal.whyItMatters}
                    confidence={signal.confidence}
                    action={signal.recommendedCoordinatorAction}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="No risk signals yet" text="Refresh risk signals to review operational patterns across visits." />
            )}
          </DashboardCard>
        </div>
      </div>
    </AppShell>
  );
}
