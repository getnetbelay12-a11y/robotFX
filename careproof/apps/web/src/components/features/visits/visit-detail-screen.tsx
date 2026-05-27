'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AppShell,
  DashboardCard,
  EmptyState,
  StatCard,
  StatusBadge,
  Timeline,
  consoleLinks,
  displayVisitCode,
} from '../../careproof-ui';
import {
  AiActionButton,
  AiDisclaimer,
  AiDraftCard,
  AiPanel,
  AiReviewBadge,
  AiSuggestionList,
  EditableAiDraft,
} from '../../careproof-ai';
import {
  getCaregiver,
  getClient,
  inspectionFindings,
  medicalAvailabilityRecords,
  nurseApprovals,
} from '../../../data/demoCareProofData';
import {
  getChecklistProgress,
  getFamilyUpdateStatus,
  getVisitStatus,
} from '../../../lib/careproof-status';
import {
  generateFamilyUpdateDraftApi,
  generateVisitSummaryApi,
  loadCanonicalDemoVisitApi,
} from '../../../lib/api-client';
import { useDemoStore } from '../../../lib/demoStore';
import type { Visit } from '../../../types/careproof';

export function VisitDetailScreen({ visitId }: { visitId: string }) {
  const { visits, incidents, showToast, approveFamilyUpdate, syncVisitSnapshot } = useDemoStore();
  const visit = visits.find((item) => item.id === visitId);
  const [backendVisitId, setBackendVisitId] = useState<string | null>(null);
  const [visitSummaryDraft, setVisitSummaryDraft] = useState<{ internalSummary: string; familySafeSummary: string; riskFlags: string[]; requiresReview: boolean; label: string } | null>(null);
  const [familyDraft, setFamilyDraft] = useState<{ familyUpdateDraft: string; requiresApproval: boolean; label: string } | null>(null);
  const [familyDraftText, setFamilyDraftText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const visitRef = useRef<Visit | undefined>(visit);
  const showToastRef = useRef(showToast);
  const syncVisitSnapshotRef = useRef(syncVisitSnapshot);

  useEffect(() => {
    visitRef.current = visit;
    showToastRef.current = showToast;
    syncVisitSnapshotRef.current = syncVisitSnapshot;
  }, [showToast, syncVisitSnapshot, visit]);

  useEffect(() => {
    const currentVisit = visitRef.current;
    if (!currentVisit || visitId !== 'visit-maria-am') return;
    let active = true;
    void loadCanonicalDemoVisitApi(visitId, currentVisit)
      .then(({ backendVisitId: resolvedId, visitPatch }) => {
        if (!active) return;
        setBackendVisitId(resolvedId);
        syncVisitSnapshotRef.current(visitId, visitPatch);
      })
      .catch(() => {
        if (!active) return;
        showToastRef.current('Using local demo visit state.');
      });
    return () => {
      active = false;
    };
  }, [visitId]);

  if (!visit) {
    return (
      <AppShell title="Visit not found" subtitle="The requested visit record is not available." navItems={consoleLinks}>
        <EmptyState title="Visit not found" text="Open a valid visit from the visits board." />
      </AppShell>
    );
  }

  const client = getClient(visit.clientId);
  const caregiver = getCaregiver(visit.caregiverId);
  const incident = visit.incidentId ? incidents.find((item) => item.id === visit.incidentId) : null;
  const checklistProgress = getChecklistProgress(visit);
  const noteStatus = visit.careNote?.text ? 'Entered' : 'Missing';
  const incidentStatus = incident ? incident.status : 'None';
  const linkedApprovals = nurseApprovals.filter((item) => item.visitId === visit.id || item.clientId === visit.clientId);
  const linkedFindings = inspectionFindings.filter((item) => item.visitId === visit.id || item.clientId === visit.clientId);
  const linkedAvailability = medicalAvailabilityRecords.filter((item) => item.visitId === visit.id || item.clientId === visit.clientId);
  const nurseApprovalStatus: string = linkedApprovals.find((item) => item.blocksFamilyVisibility)?.status ?? linkedApprovals[0]?.status ?? 'Not Required';
  const medicalAvailabilityStatus: string = linkedAvailability.find((item) => item.blocksVisit)?.status ?? linkedAvailability[0]?.status ?? 'Available';

  return (
    <AppShell
      title={`${client?.name} · ${displayVisitCode(visit)}`}
      subtitle="Schedule, check-in, checklist, note, incident, family update, and audit history in one record."
      navItems={consoleLinks}
    >
      <div className="detailHero">
        <div className="detailHeroInfo">
          <p className="sectionEyebrow">Visit detail</p>
          <h2>{client?.name}</h2>
          <p>{caregiver?.name} · {visit.scheduledTime}</p>
          <p className="mutedMeta">One operating record for schedule, caregiver proof, checklist, care note, family-safe update, and audit history.</p>
        </div>
        <div className="detailHeroActions">
          <StatusBadge status={getVisitStatus(visit)} />
          <Link className="button secondaryButton" href={`/caregiver/visit/${visit.id}`}>Open Caregiver Workflow</Link>
          <Link className="button ghostButton" href="/family/updates">View Family Update</Link>
        </div>
      </div>

      <div className="statsGrid proofStatsGrid">
        <StatCard label="Visit status" value={getVisitStatus(visit)} tone={getVisitStatus(visit) === 'Completed' ? 'positive' : 'info'} />
        <StatCard label="Checklist" value={checklistProgress.label} tone={checklistProgress.completed === checklistProgress.total ? 'positive' : 'warning'} />
        <StatCard label="Care note" value={noteStatus} tone={noteStatus === 'Entered' ? 'positive' : 'warning'} />
        <StatCard label="Family update" value={getFamilyUpdateStatus(visit)} tone={getFamilyUpdateStatus(visit) === 'Sent' ? 'positive' : 'neutral'} />
        <StatCard label="Incident" value={incidentStatus} tone={incident ? 'warning' : 'neutral'} />
        <StatCard label="Nurse approval" value={nurseApprovalStatus} tone={nurseApprovalStatus === 'Approved' ? 'positive' : nurseApprovalStatus === 'Not Required' ? 'neutral' : 'warning'} href="/console/nurse-approvals" />
        <StatCard label="Medical readiness" value={medicalAvailabilityStatus} tone={medicalAvailabilityStatus === 'Available' ? 'positive' : 'warning'} href="/console/medical-availability" />
      </div>

      <div className="detailMetaGrid">
        <DashboardCard title="Visit proof summary">
          <div className="detailFactGrid">
            <div><span>Client name</span><strong>{client?.name}</strong></div>
            <div><span>Caregiver name</span><strong>{caregiver?.name}</strong></div>
            <div><span>Scheduled</span><strong>{visit.scheduledTime}</strong></div>
            <div><span>Check-in / check-out</span><strong>{visit.checkInTime ?? '—'} / {visit.checkOutTime ?? '—'}</strong></div>
            <div><span>Checklist proof</span><strong>{checklistProgress.label} completed</strong></div>
            <div><span>Audit events</span><strong>{visit.auditLogs.length} recorded</strong></div>
          </div>
        </DashboardCard>
        <DashboardCard title="Operational trust links">
          <div className="stackGrid">
            <div className="miniSummaryCard">
              <div className="aiRiskSignalTop"><strong>Nurse approval</strong><StatusBadge status={nurseApprovalStatus} /></div>
              <p>{linkedApprovals[0]?.notesSubmitted ?? 'No nurse approval is currently required for this visit.'}</p>
              <Link className="textAction" href="/console/nurse-approvals">Open approval queue</Link>
            </div>
            <div className="miniSummaryCard">
              <div className="aiRiskSignalTop"><strong>Inspection findings</strong><StatusBadge status={linkedFindings.length ? linkedFindings[0].severity : 'Info'} /></div>
              <p>{linkedFindings[0]?.recommendedAction ?? 'No open inspection finding is linked to this visit.'}</p>
              <Link className="textAction" href="/console/inspection-center">Open inspection center</Link>
            </div>
            <div className="miniSummaryCard">
              <div className="aiRiskSignalTop"><strong>Medical availability</strong><StatusBadge status={medicalAvailabilityStatus} /></div>
              <p>{linkedAvailability[0]?.nextAction ?? 'Medical availability is currently clear for the visit.'}</p>
              <Link className="textAction" href="/console/medical-availability">Open readiness checklist</Link>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard title="Family update status">
          <div className="detailFactGrid">
            <div><span>Status</span><strong>{getFamilyUpdateStatus(visit)}</strong></div>
            <div><span>Family-safe summary</span><strong>{visit.careNote?.approvedSummary ?? 'Pending coordinator approval'}</strong></div>
            <div><span>Time sent</span><strong>{getFamilyUpdateStatus(visit) === 'Sent' ? '10:06 AM' : 'Pending'}</strong></div>
          </div>
          <p className="fieldHint">Internal notes stay separate. Families only see approved summaries and sent reports.</p>
        </DashboardCard>
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Visit timeline">
          <Timeline items={visit.events} />
        </DashboardCard>
        <DashboardCard title="Audit trail">
          <Timeline items={visit.auditLogs.map((item) => ({ label: item.action, time: item.time, actor: item.actor }))} />
        </DashboardCard>
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Checklist">
          <div className="checklistGrid">
            {visit.checklist.map((item) => (
              <div key={item.id} className="checklistRow">
                <strong>{item.label}</strong>
                <StatusBadge status={item.completed ? 'Completed' : 'Scheduled'} />
              </div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="Care note">
          <p className="longformBlock">
            {visit.careNote?.text ?? 'No care note entered yet. This should be reviewed before finalizing the visit.'}
          </p>
        </DashboardCard>
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Incident follow-up">
          {incident ? (
            <div className="longformStack">
              <StatusBadge status={incident.status} />
              <strong>{incident.type}</strong>
              <p>{incident.description}</p>
              <p><strong>Follow-up:</strong> {incident.followUpAction}</p>
              <p><strong>Family communication:</strong> {incident.familyCommunicationStatus}</p>
            </div>
          ) : (
            <EmptyState title="None reported" text="No incident has been reported for this visit." />
          )}
        </DashboardCard>
        <DashboardCard title="Visit actions">
          <div className="actionStack">
            <button
              type="button"
              className="button secondaryButton"
              onClick={() => showToast(backendVisitId ? 'Maria Johnson visit is connected to the backend pilot flow.' : 'Visit proof reviewed in demo mode.')}
            >
              Review Visit Proof
            </button>
            <button type="button" className="button ghostButton" onClick={() => showToast('Follow-up marker saved in demo mode.')}>
              Mark Follow-up Needed
            </button>
          </div>
        </DashboardCard>
      </div>

      <AiPanel title="AI Assistance">
        <div className="stackGrid">
          <AiDraftCard
            title="Visit Summary Draft"
            actions={
              <AiActionButton
                label="Generate Visit Summary"
                onClick={async () => {
                  setAiLoading(true);
                  const result = await generateVisitSummaryApi({
                    visitId: visit.id,
                    careNote: visit.careNote?.text ?? 'No care note entered.',
                    checklist: visit.checklist.map((item) => ({
                      label: item.label,
                      required: true,
                      completed: item.completed,
                    })),
                    incidentSeverities: incident ? [incident.severity.toLowerCase()] : [],
                    visitStatus: getVisitStatus(visit).toLowerCase().replace(/\s+/g, '_'),
                  });
                  const draft = result as { internalSummary: string; familySafeSummary: string; riskFlags: string[]; requiresReview: boolean; label: string };
                  setVisitSummaryDraft(draft);
                  setAiLoading(false);
                  showToast(draft.label);
                }}
                disabled={aiLoading}
              />
            }
          >
            {visitSummaryDraft ? (
              <div className="longformStack">
                <AiReviewBadge label={visitSummaryDraft.label} />
                <p><strong>Internal summary:</strong> {visitSummaryDraft.internalSummary}</p>
                <p><strong>Family-safe summary:</strong> {visitSummaryDraft.familySafeSummary}</p>
                <p><strong>Requires review:</strong> {visitSummaryDraft.requiresReview ? 'Yes' : 'No'}</p>
                <p><strong>Risk flags:</strong> {visitSummaryDraft.riskFlags.length ? visitSummaryDraft.riskFlags.join(', ') : 'None'}</p>
              </div>
            ) : (
              <EmptyState title="No draft yet" text="Generate an AI-assisted visit summary for internal review." />
            )}
          </AiDraftCard>

          <AiDraftCard
            title="Family Update Draft"
            actions={
              <AiActionButton
                label="Draft Family Update"
                onClick={async () => {
                  const result = await generateFamilyUpdateDraftApi({
                    visitId: visit.id,
                    careNote: visit.careNote?.text ?? 'Visit completed and documented.',
                    checklist: visit.checklist.map((item) => ({
                      label: item.label,
                      required: true,
                      completed: item.completed,
                    })),
                    incidentSeverities: incident ? [incident.severity.toLowerCase()] : [],
                    visitStatus: getVisitStatus(visit).toLowerCase().replace(/\s+/g, '_'),
                  });
                  const draft = result as { familyUpdateDraft: string; requiresApproval: boolean; label: string };
                  setFamilyDraft(draft);
                  setFamilyDraftText(draft.familyUpdateDraft);
                  showToast(draft.label);
                }}
              />
            }
          >
            {familyDraft ? (
              <div className="longformStack">
                <AiReviewBadge label="Human review required" />
                <EditableAiDraft value={familyDraftText} onChange={setFamilyDraftText} rows={5} />
                <AiDisclaimer>Family-facing text stays separate from internal notes and must be approved before sharing.</AiDisclaimer>
                <div className="inlineActions">
                  <AiActionButton label="Copy Draft" onClick={() => {
                    void navigator.clipboard?.writeText(familyDraftText);
                    showToast('Family update draft copied.');
                  }} tone="ghost" />
                  <AiActionButton label="Save as Draft" onClick={() => showToast('Family update draft saved for coordinator review.')} />
                  <AiActionButton label="Approve for Family" tone="primary" onClick={() => approveFamilyUpdate(visit.id, familyDraftText)} />
                </div>
              </div>
            ) : (
              <EmptyState title="No family draft yet" text="Generate a family-safe summary before approving anything for the portal." />
            )}
          </AiDraftCard>

          <AiDraftCard title="Risk Flags" eyebrow="Internal only">
            {visitSummaryDraft?.riskFlags?.length ? (
              <AiSuggestionList items={visitSummaryDraft.riskFlags} />
            ) : (
              <p>No current AI risk flags. Incident review and checklist status still apply.</p>
            )}
          </AiDraftCard>
        </div>
      </AiPanel>
    </AppShell>
  );
}
