'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AppShell,
  MobileMockup,
  StatusBadge,
  caregiverTabs,
} from '../../careproof-ui';
import {
  AiActionButton,
  AiDisclaimer,
  AiReviewBadge,
  AiSuggestionList,
  EditableAiDraft,
} from '../../careproof-ai';
import { getClient } from '../../../data/demoCareProofData';
import {
  getFamilyUpdateStatus,
  getVisitStatus,
  validateCheckoutReadiness,
} from '../../../lib/careproof-status';
import {
  checkInCanonicalDemoVisitApi,
  checkOutCanonicalDemoVisitApi,
  cleanupCaregiverNoteApi,
  completeCanonicalDemoTaskApi,
  loadCanonicalDemoVisitApi,
  saveCanonicalDemoVisitNoteApi,
  skipCanonicalDemoTaskApi,
} from '../../../lib/api-client';
import { useDemoStore } from '../../../lib/demoStore';
import type { Incident } from '../../../types/careproof';

export function CaregiverVisitScreen({ visitId }: { visitId: string }) {
  const { visits, incidents, settings, checkInVisit, toggleChecklistItem, markTaskUnable, saveVisitNote, reportIncident, checkOutVisit, showToast, syncVisitSnapshot } = useDemoStore();
  const visit = visits.find((item) => item.id === visitId) ?? visits[0];
  const client = getClient(visit.clientId);
  const incident = visit.incidentId ? incidents.find((item) => item.id === visit.incidentId) : null;
  const [backendVisitId, setBackendVisitId] = useState<string | null>(null);
  const [backendModeUnavailable, setBackendModeUnavailable] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState(visit.careNote?.text ?? '');
  const [cleanedNote, setCleanedNote] = useState('');
  const [incidentType, setIncidentType] = useState('Medication concern');
  const [incidentSeverity, setIncidentSeverity] = useState<Incident['severity']>('Medium');
  const [incidentText, setIncidentText] = useState('');
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [noteWarnings, setNoteWarnings] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const readiness = validateCheckoutReadiness(visit, undefined, settings.visitRules);
  const completedTasks = visit.checklist.filter((item) => item.completed).length;
  const hasCheckedIn = Boolean(visit.checkInTime);
  const isBackendBackedVisit = visit.id === 'visit-maria-am';
  const backendActionReady = !isBackendBackedVisit || Boolean(backendVisitId) || backendModeUnavailable;
  const noteValue = note || visit.careNote?.text || '';
  const caregiverVisitRef = useRef(visit);
  const caregiverShowToastRef = useRef(showToast);
  const caregiverSyncVisitSnapshotRef = useRef(syncVisitSnapshot);

  useEffect(() => {
    caregiverVisitRef.current = visit;
    caregiverShowToastRef.current = showToast;
    caregiverSyncVisitSnapshotRef.current = syncVisitSnapshot;
  }, [showToast, syncVisitSnapshot, visit]);

  useEffect(() => {
    const currentVisit = caregiverVisitRef.current;
    if (currentVisit.id !== 'visit-maria-am') return;
    let active = true;
    void loadCanonicalDemoVisitApi(currentVisit.id, currentVisit, 'caregiver')
      .then(({ backendVisitId: resolvedId, visitPatch }) => {
        if (!active) return;
        setBackendVisitId(resolvedId);
        setBackendModeUnavailable(false);
        caregiverSyncVisitSnapshotRef.current(currentVisit.id, visitPatch);
      })
      .catch(() => {
        if (!active) return;
        setBackendModeUnavailable(true);
        caregiverShowToastRef.current('Using local demo visit state.');
      });
    return () => {
      active = false;
    };
  }, [visit.id]);

  return (
    <AppShell title="Visit workflow" subtitle="Check in, complete required tasks, add a note, report an issue if needed, and check out with a clean visit record." navItems={caregiverTabs} variant="mobile">
      <MobileMockup title="Visit workflow" subtitle={client?.name ?? 'Client'} tabs={caregiverTabs}>
        <div className="mobileVisitHeader">
          <strong>{visit.scheduledTime}</strong>
          <span>{client?.address}</span>
        </div>
        <p className="safeActionMessage">
          {hasCheckedIn
            ? 'Complete required tasks and add a note before checkout.'
            : 'Check in before completing tasks, adding notes, or checking out.'}
        </p>

        {!hasCheckedIn ? (
          <button
            type="button"
            className="button primaryButton"
            disabled={actionLoading || !backendActionReady}
            onClick={async () => {
              if (!isBackendBackedVisit || !backendVisitId) {
                checkInVisit(visit.id);
                return;
              }
              try {
                setActionLoading(true);
                const patch = await checkInCanonicalDemoVisitApi(backendVisitId, visit);
                checkInVisit(visit.id);
                syncVisitSnapshot(visit.id, patch);
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Check-in could not be completed.');
              } finally {
                setActionLoading(false);
              }
            }}
          >
            Check In
          </button>
        ) : null}

        <article className="mobileFeatureCard">
          <p className="moduleLabel">Care checklist</p>
          <div className="checklistGrid">
            {visit.checklist.map((item) => (
              <div key={item.id} className="taskActionRow">
                <button
                  type="button"
                  className="checklistRow checklistButton"
                  disabled={!hasCheckedIn || actionLoading || !backendActionReady}
                  onClick={async () => {
                    if (item.completed || item.status === 'Completed') {
                      showToast('Task already recorded.');
                      return;
                    }
                    if (!isBackendBackedVisit || !backendVisitId) {
                      toggleChecklistItem(visit.id, item.id);
                      return;
                    }
                    try {
                      setActionLoading(true);
                      const patch = await completeCanonicalDemoTaskApi(backendVisitId, visit, item.id);
                      toggleChecklistItem(visit.id, item.id);
                      syncVisitSnapshot(visit.id, patch);
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : 'Task update could not be saved.');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                >
                  <strong>{item.label}</strong>
                  <StatusBadge status={item.status === 'Unable' ? 'Needs Review' : item.completed ? 'Completed' : 'Scheduled'} />
                </button>
                <select disabled={!hasCheckedIn || actionLoading || !backendActionReady} value={item.unableReason ?? ''} onChange={async (event) => {
                  if (!event.target.value) return;
                  if (!isBackendBackedVisit || !backendVisitId) {
                    markTaskUnable(visit.id, item.id, event.target.value as NonNullable<typeof item.unableReason>);
                    return;
                  }
                  try {
                    setActionLoading(true);
                    const patch = await skipCanonicalDemoTaskApi(backendVisitId, visit, item.id, event.target.value);
                    markTaskUnable(visit.id, item.id, event.target.value as NonNullable<typeof item.unableReason>);
                    syncVisitSnapshot(visit.id, patch);
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Task exception could not be saved.');
                  } finally {
                    setActionLoading(false);
                  }
                }}>
                  <option value="">Mark unable</option>
                  {['Client declined', 'Safety concern', 'Not enough time', 'Supplies unavailable', 'Other'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            ))}
          </div>
          {!hasCheckedIn ? <p className="fieldHint">Checklist actions unlock after check-in.</p> : null}
        </article>

        <article className="mobileFeatureCard">
          <p className="moduleLabel">Care note</p>
          <textarea disabled={!hasCheckedIn} value={noteValue} onChange={(event) => setNote(event.target.value)} rows={5} placeholder={hasCheckedIn ? 'Write what you observed during the visit.' : 'Check in before adding the visit note.'} />
          <div className="inlineActions">
            <AiActionButton
              label="Clean Up Note"
              disabled={!hasCheckedIn || actionLoading || !backendActionReady}
              onClick={async () => {
                const result = await cleanupCaregiverNoteApi({
                  visitId: visit.id,
                  careNote: note,
                  checklist: visit.checklist.map((item) => ({
                    label: item.label,
                    required: true,
                    completed: item.completed,
                  })),
                  incidentSeverities: incident ? [incident.severity.toLowerCase()] : [],
                  visitStatus: getVisitStatus(visit).toLowerCase().replace(/\s+/g, '_'),
                });
                const draft = result as { polishedNote: string; warnings?: string[]; label?: string };
                setCleanedNote(draft.polishedNote);
                setNoteWarnings(draft.warnings ?? []);
              }}
            />
            <button
              type="button"
              className="button secondaryButton"
              disabled={!hasCheckedIn || actionLoading || !backendActionReady}
              onClick={async () => {
                    if (!isBackendBackedVisit || !backendVisitId) {
                  saveVisitNote(visit.id, noteValue);
                  return;
                }
                try {
                  setActionLoading(true);
                  const patch = await saveCanonicalDemoVisitNoteApi(backendVisitId, visit, noteValue, cleanedNote || undefined);
                  saveVisitNote(visit.id, patch.careNote?.text ?? noteValue);
                  syncVisitSnapshot(visit.id, patch);
                  setNote(patch.careNote?.text ?? noteValue);
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Care note could not be saved.');
                } finally {
                  setActionLoading(false);
                }
              }}
            >
            Save note
            </button>
          </div>
          <AiDisclaimer>Review before saving. Do not include anything you did not observe.</AiDisclaimer>
          {cleanedNote ? (
            <div className="longformStack">
              <AiReviewBadge label="AI-assisted draft" />
              <EditableAiDraft value={cleanedNote} onChange={setCleanedNote} rows={4} />
              {noteWarnings.length ? <AiSuggestionList items={noteWarnings} /> : null}
              <AiActionButton label="Use Cleaned Note" tone="primary" onClick={() => setNote(cleanedNote)} />
            </div>
          ) : null}
        </article>

        <article className="mobileFeatureCard">
          <p className="moduleLabel">Incident</p>
          {incident ? (
            <div className="longformStack">
              <StatusBadge status={incident.status} />
              <strong>{incident.type}</strong>
              <p>{incident.description}</p>
            </div>
          ) : (
            <p>No incident reported.</p>
          )}
          <button type="button" className="button ghostButton" disabled={!hasCheckedIn} onClick={() => setShowIncidentForm((current) => !current)}>
            {showIncidentForm ? 'Hide incident form' : 'Report incident'}
          </button>
          {!hasCheckedIn ? <p className="fieldHint">Incident reporting unlocks after check-in.</p> : null}
          {showIncidentForm ? (
            <div className="formStack">
              <label className="demoField">
                <span>Incident type</span>
                <select value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>
                  <option>Fall risk observed</option>
                  <option>No access at door</option>
                  <option>Medication concern</option>
                  <option>Behavior change</option>
                </select>
              </label>
              <label className="demoField">
                <span>Severity</span>
                <select value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value as Incident['severity'])}>
                  {['Low', 'Medium', 'High', 'Critical'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="demoField">
                <span>Description</span>
                <textarea value={incidentText} onChange={(event) => setIncidentText(event.target.value)} rows={4} />
              </label>
              <button
                type="button"
                className="button secondaryButton"
                onClick={() => reportIncident(visit.id, { type: incidentType, severity: incidentSeverity, description: incidentText || 'Issue noted during visit.', shareWithFamily: true })}
              >
                Report Incident
              </button>
            </div>
          ) : null}
        </article>

        {hasCheckedIn ? (
          <article className="mobileFeatureCard caregiverCheckoutCard">
            <p className="moduleLabel">Checkout readiness</p>
            <div className="caregiverCheckoutStatus">
              <strong>{readiness.blockers.length ? `${readiness.blockers.length} item${readiness.blockers.length === 1 ? '' : 's'} before checkout` : 'Ready to check out'}</strong>
              <StatusBadge status={readiness.blockers.length ? 'Needs Review' : 'Completed'} />
            </div>
            {readiness.blockers.length ? (
              <ul className="featureList">
                {readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            ) : (
              <p>Required tasks and visit note are complete.</p>
            )}
            <label className="demoField">
              <span>Override reason (optional)</span>
              <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Explain why checkout is being overridden" />
            </label>
            <button
              type="button"
              className="button primaryButton"
              disabled={actionLoading || !backendActionReady}
              onClick={async () => {
                if (!isBackendBackedVisit || !backendVisitId) {
                  const result = checkOutVisit(visit.id, overrideReason || undefined);
                  if (!result.ok && result.blockers?.length) {
                    showToast(result.blockers.join(' '));
                  }
                  return;
                }
                try {
                  setActionLoading(true);
                  const patch = await checkOutCanonicalDemoVisitApi(backendVisitId, visit);
                  const result = checkOutVisit(visit.id);
                  if (!result.ok && result.blockers?.length) {
                    showToast(result.blockers.join(' '));
                  }
                  syncVisitSnapshot(visit.id, {
                    ...patch,
                    familyUpdateStatus: 'Sent',
                  });
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Checkout could not be completed.');
                } finally {
                  setActionLoading(false);
                }
              }}
            >
              Check Out
            </button>
          </article>
        ) : null}

        <article className="mobileFeatureCard">
          <p className="moduleLabel">Completion summary</p>
          {visit.checkOutTime ? (
            <ul className="featureList">
              <li>Check-in: {visit.checkInTime ?? 'Not recorded'}</li>
              <li>Check-out: {visit.checkOutTime}</li>
              <li>Tasks completed: {completedTasks} of {visit.checklist.length}</li>
              <li>Visit note: {visit.careNote ? 'Added' : 'Missing'}</li>
              <li>Family update draft: {visit.checkOutTime ? 'Sent' : getFamilyUpdateStatus(visit)}</li>
            </ul>
          ) : (
            <p>Completion details appear here after checkout.</p>
          )}
          <Link className="button secondaryButton" href="/caregiver/visits">
            View Next Visit
          </Link>
        </article>
      </MobileMockup>
    </AppShell>
  );
}
