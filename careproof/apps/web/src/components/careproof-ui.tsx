'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DemoBookingRail } from '../app/demo-booking-rail';
import { DemoRequestPanel } from '../app/demo-request-panel';
import {
  AiActionButton,
  AiDisclaimer,
  AiDraftCard,
  AiPanel,
  AiReviewBadge,
  AiRiskSignalCard,
  AiSuggestionList,
  EditableAiDraft,
} from './careproof-ai';
import {
  branches,
  caregivers,
  clients,
  familyMembers,
  getBranch,
  getCaregiver,
  getClient,
  getFamilyMember,
  expirationRecords,
  inspectionFindings,
  inspectionRules,
  intakeRecords,
  medicalAvailabilityRecords,
  nurseApprovals,
  socialWorkCases,
  users,
} from '../data/demoCareProofData';
import {
  buildVisitExceptionItems,
  getConcernOverdue,
  getChecklistProgress,
  getFamilyUpdateStatus,
  getLiveVisitStatus,
  getVisitAlert,
  getVisitDisplayStatus,
  getVisitRiskLevel,
  getVisitProgress,
  getVisitStatus,
  isCheckoutMissing,
  isLateVisit,
  isMissedVisit,
  validateCheckoutReadiness,
} from '../lib/careproof-status';
import { useDemoStore } from '../lib/demoStore';
import {
  buildAgencyHealthScore,
  buildBillingReadiness,
  buildBranchPerformance,
  buildCaregiverSupportRecords,
  buildClientRiskRecords,
  buildExecutiveTrends,
  buildFamilyCommunicationHealth,
  getOperationalVisitMetrics,
} from '../lib/management-helpers';
import {
  buildAdoptionMetrics,
  buildDataQualityIssues,
  buildImplementationProgress,
  buildPilotReviewOutcomes,
  buildRolloutNextActions,
  getContextualHelp,
} from '../lib/customer-success-helpers';
import {
  checkInCanonicalDemoVisitApi,
  checkOutCanonicalDemoVisitApi,
  cleanupCaregiverNoteApi,
  completeCanonicalDemoTaskApi,
  decideNurseApprovalApi,
  fetchExpirationRecordsApi,
  fetchInspectionFindingsApi,
  fetchInspectionRulesApi,
  fetchIntakeRecordsApi,
  fetchMedicalAvailabilityApi,
  fetchNurseApprovalsApi,
  fetchSocialWorkCasesApi,
  generateFamilyUpdateDraftApi,
  generateIncidentTriageApi,
  generateNextActionsApi,
  generateRiskSignalsApi,
  getGoLiveChecklistApi,
  getIntegrationsApi,
  getSystemStatusApi,
  loadCanonicalDemoVisitApi,
  saveCanonicalDemoVisitNoteApi,
  skipCanonicalDemoTaskApi,
  updateFindingStatusApi,
  updateRenewalStatusApi,
  updateSocialWorkCaseStatusApi,
  generateVisitSummaryApi,
  generateWeeklyReportDraftApi,
  type GoLiveChecklistPayload,
  type IntegrationCardPayload,
  type SystemStatusPayload,
} from '../lib/api-client';
import {
  AuditTimeline,
  ApprovalBadge,
  DetailDrawer,
  MetricCard,
  ModuleDashboard,
  NextActionPanel,
  PageHeader,
  RiskBadge,
} from './ui';
import {
  buildDataExportCsv,
  buildFallbackGoLiveChecklist,
  buildFallbackIntegrations,
  buildFallbackSystemStatus,
} from '../lib/deployment-readiness';
import type {
  CarePlanTaskDefinition,
  ExceptionItem,
  FamilyConcern,
  Incident,
  ImportJob,
  Notification,
  PilotFeedback,
  QualityRules,
  SupportTicket,
  User,
  Visit,
  VisitStatus,
  WeeklyReport,
} from '../types/careproof';

const bookDemoUrl = '/demo#request-demo';

const publicLinks = [
  ['Home', '/'],
  ['Product', '/product'],
  ['Pricing', '/pricing'],
  ['Demo', '/demo'],
];

const consoleLinks = [
  ['Dashboard', '/console/dashboard'],
  ['--OPERATIONS', ''],
  ['Operations', '/console/operations'],
  ['Visits', '/console/visits'],
  ['Schedule', '/console/schedule'],
  ['--CLINICAL REVIEW', ''],
  ['Nurse Approvals', '/console/nurse-approvals'],
  ['Inspection Center', '/console/inspection-center'],
  ['Social Work', '/console/social-work'],
  ['Medical Availability', '/console/medical-availability'],
  ['--COMPLIANCE', ''],
  ['Expiration Center', '/console/expiration-center'],
  ['Billing', '/console/billing'],
  ['--COMMUNICATION', ''],
  ['Incidents', '/console/incidents'],
  ['Family Concerns', '/console/family-concerns'],
  ['Family Health', '/console/family-health'],
  ['Notifications', '/console/notifications'],
  ['Reports', '/console/reports'],
  ['--ADMINISTRATION', ''],
  ['Intake / Agents', '/console/intake-agents'],
  ['Clients', '/console/clients'],
  ['Client Risk', '/console/client-risk'],
  ['Care Plans', '/console/care-plans'],
  ['Caregivers', '/console/caregivers'],
  ['Caregiver Support', '/console/caregiver-support'],
  ['Branches', '/console/branches'],
  ['Users / Roles', '/console/settings/users'],
  ['Onboarding', '/console/onboarding'],
  ['Import', '/console/import'],
  ['Support', '/console/support'],
  ['Pilot Feedback', '/console/pilot-feedback'],
  ['Training', '/console/training'],
  ['Data Quality', '/console/data-quality'],
  ['Rollout', '/console/rollout'],
  ['Knowledge Base', '/console/knowledge-base'],
  ['--SYSTEM', ''],
  ['Executive', '/console/executive'],
  ['Pilot Review', '/console/pilot-review'],
  ['Customer Success', '/console/customer-success'],
  ['System Readiness', '/console/system-readiness'],
  ['System Status', '/console/system/status'],
  ['Go-Live', '/console/system/go-live'],
  ['Integrations', '/console/system/integrations'],
  ['Data Export', '/console/system/data-export'],
  ['Settings', '/console/settings'],
  ['Quality Rules', '/console/settings/quality-rules'],
];

const caregiverTabs = [
  ['Today', '/caregiver/today'],
  ['Visits', '/caregiver/visits'],
  ['Incidents', '/caregiver/incidents'],
  ['Profile', '/caregiver/profile'],
];

const familyTabs = [
  ['Updates', '/family/updates'],
  ['Reports', '/family/reports'],
  ['Concerns', '/family/concerns'],
  ['Profile', '/family/profile'],
];

const goldenPathLinks = [
  ['Dashboard', '/console/dashboard'],
  ['Operations', '/console/operations'],
  ['Maria Visit', '/console/visits/visit-maria-am'],
  ['Caregiver App', '/caregiver/today'],
  ['Family Portal', '/family/updates'],
  ['Reports', '/console/reports'],
  ['System Status', '/console/system/status'],
];

export function PublicProductShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="productRoutePage">
      <header className="productPublicHeader">
        <div className="siteContainer productPublicHeaderInner">
          <Link className="navLogo" href="/">
            CareProof
          </Link>
          <nav className="productPublicNav" aria-label="Public navigation">
            {publicLinks.map(([label, href]) => (
              <Link key={label} href={href} className={pathname === href ? 'is-active' : ''}>
                {label}
              </Link>
            ))}
          </nav>
          <Link className="button primaryButton" href={bookDemoUrl}>
            Book Demo
          </Link>
        </div>
      </header>
      <section className="productPublicHero">
        <div className="siteContainer">
          <p className="sectionEyebrow">Working product demo</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </section>
      <section className="contentSection">
        <div className="siteContainer">{children}</div>
      </section>
    </main>
  );
}

const navIconMap: Record<string, string> = {
  '/console/dashboard': 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  '/console/operations': 'M22 12h-4l-3 9L9 3l-3 9H2',
  '/console/nurse-approvals': 'M12 2v20M2 12h20',
  '/console/inspection-center': 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  '/console/social-work': 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  '/console/intake-agents': 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0m13 4v6m3-3h-6',
  '/console/medical-availability': 'M22 12h-4l-3 9L9 3l-3 9H2',
  '/console/expiration-center': 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm7 10v4',
  '/console/system-readiness': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  '/console/executive': 'M18 20V10m-6 10V4M6 20v-4',
  '/console/pilot-review': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  '/console/customer-success': 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  '/console/visits': 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  '/console/schedule': 'M12 2a10 10 0 100 20A10 10 0 0012 2zm0 5v7l3 3',
  '/console/clients': 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  '/console/client-risk': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
  '/console/care-plans': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  '/console/caregivers': 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  '/console/caregiver-support': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  '/console/incidents': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
  '/console/family-concerns': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  '/console/family-health': 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  '/console/reports': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8m8 4H8m2-8H8',
  '/console/billing': 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  '/console/notifications': 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9m-4.27 13a2 2 0 01-3.46 0',
  '/console/onboarding': 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  '/console/branches': 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zm0-6a9 9 0 0012-8.45',
  '/console/import': 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5M12 15V3',
  '/console/support': 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
  '/console/training': 'M12 14l9-5-9-5-9 5 9 5zm0 0v6',
  '/console/data-quality': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  '/console/rollout': 'M13 10V3L4 14h7v7l9-11h-7z',
  '/console/knowledge-base': 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  '/console/system/status': 'M12 2a10 10 0 100 20A10 10 0 0012 2zm0 6v4l3 3',
  '/console/system/go-live': 'M5 3l14 9-14 9V3z',
  '/console/system/integrations': 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  '/console/system/data-export': 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m14-7l-5 5-5-5m5 5V3',
  '/console/settings': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  '/console/settings/quality-rules': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  '/console/pilot-feedback': 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
};

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={path} />
    </svg>
  );
}

export function AppShell({
  title,
  subtitle,
  navItems,
  children,
  variant = 'console',
}: {
  title: string;
  subtitle: string;
  navItems: string[][];
  children: ReactNode;
  variant?: 'console' | 'mobile';
}) {
  const pathname = usePathname();
  const { agency: currentAgency, branches: storeBranches, selectedBranchId, setSelectedBranch, showToast } = useDemoStore();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpResetToken, setHelpResetToken] = useState(0);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [demoRole, setDemoRole] = useState('Owner');
  const helpKey = `careproof-help-dismissed-${pathname}`;
  const helpTips = getContextualHelp(pathname);
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE ? process.env.NEXT_PUBLIC_DEMO_MODE === 'true' : appEnv !== 'production';
  const canResetDemo = demoMode && appEnv !== 'production' && variant === 'console';
  const helpDismissed = useMemo(
    () => {
      void helpResetToken;
      return typeof window !== 'undefined' ? window.localStorage.getItem(helpKey) === 'true' : false;
    },
    [helpKey, helpResetToken],
  );

  return (
    <main className={`appShell appShell-${variant}`}>
      <aside className="appSidebar">
        <Link className="navLogo" href="/">
          CareProof
        </Link>
        <p className="appSidebarLabel">{variant === 'console' ? 'Agency Console' : 'Product Demo'}</p>
        <nav className="appSidebarNav" aria-label="Product navigation">
          {navItems.map(([label, href]) => {
            if (label.startsWith('--')) {
              return <p key={label} className="appSidebarSectionLabel">{label.slice(2)}</p>;
            }
            const iconPath = navIconMap[href];
            return (
              <Link key={label} href={href} className={pathname === href ? 'is-active' : ''}>
                {iconPath ? <NavIcon path={iconPath} /> : null}
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="appSidebarFooter">
          <span>{currentAgency.name}</span>
          <Link className="button ghostButton" href={bookDemoUrl}>
            Book Demo
          </Link>
        </div>
      </aside>
      <div className="appMain">
        <header className="appTopbar">
          <div>
            <p className="sectionEyebrow">{variant === 'console' ? 'Home care operations' : 'Mobile workflow'}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbarActions">
            {variant === 'console' ? (
              <>
                <label className="demoField compactField branchFilterControl">
                  <span>Branch</span>
                  <select value={selectedBranchId} onChange={(event) => setSelectedBranch(event.target.value as string | 'all')}>
                    <option value="all">All branches</option>
                    {storeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="demoField compactField branchFilterControl">
                  <span>Demo role</span>
                  <select value={demoRole} onChange={(event) => setDemoRole(event.target.value)}>
                    {['Owner', 'Admin', 'Coordinator', 'Nurse', 'Social Worker', 'Intake Agent', 'Caregiver', 'Family Member'].map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <div className="topbarAlertPill">
                  {nurseApprovals.filter((item) => !['Approved', 'Rejected'].includes(item.status)).length + inspectionFindings.filter((item) => !['Resolved', 'Dismissed'].includes(item.status)).length} alerts
                </div>
              </>
            ) : null}
            <button type="button" className="button ghostButton" onClick={() => setHelpOpen((current) => !current)}>
              Help
            </button>
            <Link className="button secondaryButton" href="/product">
              View Product Flow
            </Link>
          </div>
        </header>
        {demoMode ? (
          <div className="demoModeBanner" role="status" aria-live="polite">
            <div>
              <strong>Demo Mode:</strong> Sample data is being used for walkthroughs. External email/SMS may be disabled.
            </div>
            {canResetDemo ? (
              <button
                type="button"
                className="textAction"
                disabled={resettingDemo}
                onClick={async () => {
                  if (typeof window !== 'undefined' && !window.confirm('Reset demo data to the baseline walkthrough state?')) return;
                  setResettingDemo(true);
                  try {
                    const response = await fetch('/api/demo/reset', { method: 'POST' });
                    if (!response.ok) {
                      const payload = await response.json().catch(() => ({}));
                      throw new Error(payload.message || 'Reset failed.');
                    }
                    if (typeof window !== 'undefined') {
                      window.localStorage.removeItem('careproof-demo-store-v3');
                      window.location.reload();
                    }
                  } catch (error) {
                    showToast(error instanceof Error ? error.message : 'Demo reset failed.');
                  } finally {
                    setResettingDemo(false);
                  }
                }}
              >
                {resettingDemo ? 'Resetting…' : 'Reset demo data'}
              </button>
            ) : null}
          </div>
        ) : null}
        {variant === 'console' ? (
          <nav className="goldenPathRail" aria-label="Live demo path">
            <span>Demo path</span>
            {goldenPathLinks.map(([label, href]) => (
              <Link key={label} href={href} className={pathname === href ? 'is-active' : ''}>
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="appContent">{children}</div>
      </div>
      {helpOpen && !helpDismissed ? (
        <aside className="helpPanel">
          <div className="helpPanelHeader">
            <strong>Guided help</strong>
            <button type="button" className="textAction" onClick={() => setHelpOpen(false)}>
              Dismiss
            </button>
          </div>
          <ul className="featureList">
            {helpTips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
          <div className="inlineActions">
            <button
              type="button"
              className="button secondaryButton"
              onClick={() => {
                if (typeof window !== 'undefined') window.localStorage.setItem(helpKey, 'true');
                setHelpResetToken((current) => current + 1);
                setHelpOpen(false);
              }}
            >
              Mark guide complete
            </button>
            <button
              type="button"
              className="button ghostButton"
              onClick={() => {
                if (typeof window !== 'undefined') window.localStorage.removeItem(helpKey);
                setHelpResetToken((current) => current + 1);
              }}
            >
              Reset help tips
            </button>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

export function MobileMockup({
  title,
  subtitle,
  tabs,
  children,
}: {
  title: string;
  subtitle: string;
  tabs: string[][];
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mobileMockup">
      <div className="mobileMockupTop">
        <div className="mobileMockupNotch" />
      </div>
      <div className="mobileMockupBody">
        <p className="sectionEyebrow">{title}</p>
        <h2>{subtitle}</h2>
        {children}
      </div>
      <div className="mobileTabBar">
        {tabs.map(([label, href]) => (
          <Link key={label} href={href} className={pathname === href ? 'is-active' : ''}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="sectionHeader">
      <div>
        <p className="sectionEyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {actions ? <div className="sectionHeaderActions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'info';
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`statCard tone-${tone} statCard-link`}>
        {content}
      </Link>
    );
  }
  return <article className={`statCard tone-${tone}`}>{content}</article>;
}

export function StatusBadge({ status }: { status: VisitStatus | Incident['status'] | FamilyConcern['status'] | WeeklyReport['status'] | string }) {
  const toneMap: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'review' | 'neutral'> = {
    Scheduled: 'neutral',
    'Due Soon': 'info',
    'In Progress': 'info',
    Completed: 'success',
    Late: 'warning',
    Missed: 'danger',
    'Checkout Missing': 'danger',
    'Needs Review': 'review',
    New: 'warning',
    Reviewing: 'info',
    'Follow-up Assigned': 'review',
    'Family Updated': 'info',
    Resolved: 'success',
    Closed: 'success',
    Draft: 'warning',
    Submitted: 'info',
    'Nurse Review Required': 'review',
    'Changes Requested': 'warning',
    Rejected: 'danger',
    Escalated: 'danger',
    Ready: 'info',
    Sent: 'success',
    Reviewed: 'success',
    'Not Ready': 'neutral',
    'Ready for Billing': 'info',
    Approved: 'success',
    'Approved for family': 'success',
    'Requires approval': 'warning',
    'Not required': 'neutral',
    'No case': 'neutral',
    Exported: 'success',
    'Waiting on User': 'warning',
    Unread: 'warning',
    Read: 'neutral',
    'Action Required': 'danger',
    Failed: 'danger',
    'Demo Only': 'review',
    Configured: 'success',
    Demo: 'review',
    Future: 'neutral',
    'Not configured': 'warning',
    Healthy: 'success',
    Low: 'neutral',
    Medium: 'warning',
    High: 'danger',
    Critical: 'danger',
    Info: 'info',
    Warning: 'warning',
    Compliance: 'review',
    Open: 'warning',
    Acknowledged: 'info',
    Dismissed: 'neutral',
    Assigned: 'info',
    'In Review': 'review',
    'Follow-up Needed': 'warning',
    Available: 'success',
    Limited: 'warning',
    Missing: 'danger',
    'Expiring Soon': 'warning',
    Expired: 'danger',
    'Needs Confirmation': 'warning',
    Valid: 'success',
    'Expiring in 30 days': 'warning',
    'Expiring in 7 days': 'danger',
    Blocker: 'danger',
    Complete: 'success',
    Pending: 'warning',
  };
  const tone = toneMap[status] ?? 'neutral';
  return <span className={`statusBadge statusBadge-${tone}`}>{status}</span>;
}

export function DashboardCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="dashboardCard">
      <div className="dashboardCardHeader">
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

export function Timeline({
  items,
}: {
  items: { label: string; time: string; actor?: string }[];
}) {
  return (
    <div className="timeline">
      {items.map((item, index) => (
        <div key={`${item.label}-${item.time}-${index}`} className="timelineItem">
          <span className="timelineDot" />
          <div>
            <strong>{item.label}</strong>
            <p>
              {item.time}
              {item.actor ? ` · ${item.actor}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="dataTableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <article className="emptyState">
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="loadingSkeleton" aria-hidden="true">
      <div />
      <div />
      <div />
    </div>
  );
}

const _visitCodeCache: Record<string, string> = {
  'visit-maria-am': 'V-1001',
  'visit-david-am': 'V-1002',
  'visit-helen-pm': 'V-1003',
  'visit-samuel-pm': 'V-1004',
  'visit-david-pm': 'V-1005',
  'visit-helen-am': 'V-1006',
};
let _visitCodeCounter = 1007;

function displayVisitCode(visit: Visit) {
  if (_visitCodeCache[visit.id]) return _visitCodeCache[visit.id];
  const code = `V-${_visitCodeCounter++}`;
  _visitCodeCache[visit.id] = code;
  return code;
}

function todayVisitsOnly(visits: Visit[]) {
  return visits.filter((visit) => visit.scheduledDay === 'Today');
}

type AttentionItem = [label: string, count: number, action: string];

function attentionSummary(visits: Visit[], incidents: Incident[], concerns: FamilyConcern[]): AttentionItem[] {
  const incompleteChecklists = visits.filter((visit) => visit.checkOutTime && !getChecklistProgress(visit).complete);
  const missingNotes = visits.filter((visit) => visit.checkOutTime && !visit.careNote);
  return [
    ['Late visit', visits.filter(isLateVisit).length, 'Coordinator follow-up'],
    ['Missed visit', visits.filter(isMissedVisit).length, 'Confirm caregiver status'],
    ['Checkout missing', visits.filter(isCheckoutMissing).length, 'Close visit record'],
    ['Open incidents', incidents.filter((incident) => incident.status !== 'Closed' && incident.status !== 'Resolved').length, 'Review severity'],
    ['Open family concerns', concerns.filter((concern) => concern.status !== 'Closed' && concern.status !== 'Resolved').length, 'Respond today'],
    ['Incomplete checklists', incompleteChecklists.length, 'Review checklist gaps'],
    ['Missing notes', missingNotes.length, 'Request completion'],
  ];
}

function attentionActionLabel(label: string) {
  const labels: Record<string, string> = {
    'Late visit': 'Review late visits',
    'Missed visit': 'Confirm missed visits',
    'Checkout missing': 'Close checkout gaps',
    'Open incidents': 'Review incidents',
    'Open family concerns': 'Respond to concerns',
    'Incomplete checklists': 'Review checklist gaps',
    'Missing notes': 'Request visit notes',
  };
  return labels[label] ?? 'Open work queue';
}

function exceptionActionLabel(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('incident')) return 'Review incident';
  if (lower.includes('concern')) return 'Respond to concern';
  if (lower.includes('late')) return 'Review late visit';
  if (lower.includes('missed')) return 'Confirm missed visit';
  if (lower.includes('checkout')) return 'Fix checkout';
  if (lower.includes('note')) return 'Request note';
  return 'Open record';
}

function familySafeReportSummary(summary: string) {
  return summary
    .replace(/one fall-risk observation under review\./i, 'One follow-up item is being reviewed by the agency team.')
    .replace(/fall-risk observation/gi, 'follow-up item');
}

function downloadCsvFile(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function useVisitMetrics() {
  const { filteredVisits, filteredIncidents, filteredFamilyConcerns, weeklyReports } = useDemoStore();
  const todayVisits = todayVisitsOnly(filteredVisits);
  const statuses = todayVisits.map(getVisitStatus);

  return {
    visits: filteredVisits,
    incidents: filteredIncidents,
    familyConcerns: filteredFamilyConcerns,
    weeklyReports,
    todayVisits,
    scheduled: statuses.filter((item) => item === 'Scheduled').length,
    inProgress: statuses.filter((item) => item === 'In Progress').length,
    completed: statuses.filter((item) => item === 'Completed').length,
    late: statuses.filter((item) => item === 'Late').length,
    missed: statuses.filter((item) => item === 'Missed').length,
    needsReview: statuses.filter((item) => item === 'Needs Review').length,
  };
}

function useReferenceData() {
  const store = useDemoStore();
  return useMemo(
    () => ({
      agency: store.agency,
      users: store.users,
      branches: store.branches,
      clients:
        store.selectedBranchId === 'all'
          ? store.clients
          : store.clients.filter((client) => client.branchId === store.selectedBranchId),
      caregivers:
        store.selectedBranchId === 'all'
          ? store.caregivers
          : store.caregivers.filter((caregiver) => caregiver.branchId === store.selectedBranchId),
      familyMembers: store.familyMembers,
      carePlans: store.carePlans,
      settings: store.settings,
      selectedBranchId: store.selectedBranchId,
      getClient: (id: string) => store.clients.find((client) => client.id === id),
      getCaregiver: (id: string) => store.caregivers.find((caregiver) => caregiver.id === id),
      getFamilyMember: (id: string) => store.familyMembers.find((member) => member.id === id),
      getCarePlan: (id: string) => store.carePlans.find((plan) => plan.id === id),
      getUser: (id: string) => store.users.find((user) => user.id === id),
      getBranch: (id: string) => store.branches.find((branch) => branch.id === id),
    }),
    [store],
  );
}

function useSystemReadiness() {
  const { settings, notifications } = useDemoStore();
  const fallbackStatus = useMemo(
    () => buildFallbackSystemStatus({ settings, notifications }),
    [settings, notifications],
  );
  const fallbackChecklist = useMemo(
    () => buildFallbackGoLiveChecklist(fallbackStatus, settings),
    [fallbackStatus, settings],
  );
  const fallbackIntegrations = useMemo(
    () => buildFallbackIntegrations(fallbackStatus),
    [fallbackStatus],
  );
  const [systemStatus, setSystemStatus] = useState<SystemStatusPayload>(fallbackStatus);
  const [goLiveChecklist, setGoLiveChecklist] = useState<GoLiveChecklistPayload>(fallbackChecklist);
  const [integrations, setIntegrations] = useState<IntegrationCardPayload[]>(fallbackIntegrations);
  const [loading, setLoading] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      getSystemStatusApi(),
      getGoLiveChecklistApi(),
      getIntegrationsApi(),
    ]).then((results) => {
      if (!active) return;
      const [statusResult, checklistResult, integrationsResult] = results;
      if (statusResult.status === 'fulfilled') {
        setSystemStatus(statusResult.value);
        setApiConnected(true);
      } else {
        setSystemStatus(fallbackStatus);
      }
      if (checklistResult.status === 'fulfilled') {
        setGoLiveChecklist(checklistResult.value);
      } else {
        setGoLiveChecklist(fallbackChecklist);
      }
      if (integrationsResult.status === 'fulfilled') {
        setIntegrations(integrationsResult.value);
      } else {
        setIntegrations(fallbackIntegrations);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [fallbackChecklist, fallbackIntegrations, fallbackStatus]);

  return { systemStatus, goLiveChecklist, integrations, loading, apiConnected };
}

function VisitCard({ visit, href }: { visit: Visit; href: string }) {
  const { getClient, getCaregiver } = useReferenceData();
  const client = getClient(visit.clientId);
  const caregiver = getCaregiver(visit.caregiverId);
  const progress = getChecklistProgress(visit);
  const status = getVisitStatus(visit);
  return (
    <article className="visitCard">
      <div className="visitCardTop">
        <div>
          <strong>{client?.name}</strong>
          <span>{displayVisitCode(visit)} · {caregiver?.name}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="visitMetaGrid">
        <div>
          <span>Scheduled</span>
          <strong>{visit.startLabel}</strong>
        </div>
        <div>
          <span>Checklist</span>
          <strong>{progress.label}</strong>
        </div>
        <div>
          <span>Family update</span>
          <strong>{getFamilyUpdateStatus(visit)}</strong>
        </div>
      </div>
      <div className="cardActionRow">
        <Link className="button secondaryButton" href={href}>
          View visit
        </Link>
      </div>
    </article>
  );
}

export function ProductOverviewScreen() {
  return (
    <PublicProductShell
      title="See one visit move from schedule to family update."
      subtitle="Follow the agency, caregiver, and family journey from planned visit to documented proof, alerts, and reporting."
    >
      <div className="stackGrid">
        <DashboardCard title="1. Agency plans care">
          <p><strong>Who uses it:</strong> Coordinator or admin</p>
          <p><strong>What they do:</strong> Schedule the visit, assign Ana Smith, attach the care plan, and confirm the 9:00 AM window for Maria Johnson.</p>
          <p><strong>Record created:</strong> Scheduled visit with caregiver, client, checklist, and timing rules.</p>
          <p><strong>Value:</strong> The team starts the day with a clear visit plan instead of phone calls and guesswork.</p>
          <Link className="button primaryButton" href="/console/dashboard">Open Agency Console</Link>
        </DashboardCard>
        <DashboardCard title="2. Caregiver completes the visit">
          <p><strong>Who uses it:</strong> Caregiver in the field</p>
          <p><strong>What they do:</strong> Check in, complete the care checklist, add a note, report an issue if needed, and check out.</p>
          <p><strong>Record created:</strong> Visit proof with check-in, check-out, task completion, care note, and audit trail.</p>
          <p><strong>Value:</strong> The visit record is documented while care is happening, not reconstructed later.</p>
          <div className="inlineActions">
            <Link className="button primaryButton" href="/caregiver/today">Open Caregiver App</Link>
            <Link className="button secondaryButton" href="/caregiver/visit/visit-maria-am">Open Visit Workflow</Link>
          </div>
        </DashboardCard>
        <DashboardCard title="3. Family receives a safe update">
          <p><strong>Who uses it:</strong> Family member</p>
          <p><strong>What they do:</strong> Read the approved care summary, check weekly report status, and submit a concern if something feels off.</p>
          <p><strong>Record created:</strong> Family-facing update or concern thread, separate from internal notes.</p>
          <p><strong>Value:</strong> Families stay informed without exposing staff-only details or unresolved internal notes.</p>
          <Link className="button primaryButton" href="/family/updates">Open Family Portal</Link>
        </DashboardCard>
        <DashboardCard title="4. Agency reviews proof and alerts">
          <p><strong>Who uses it:</strong> Coordinator and leadership</p>
          <p><strong>What they do:</strong> Review the visit timeline, catch late or missed work, triage incidents, and respond to family concerns.</p>
          <p><strong>Record created:</strong> Follow-up history, concern response, incident action, and audit events.</p>
          <p><strong>Value:</strong> The agency can prove what happened and act before small issues become trust problems.</p>
          <Link className="button secondaryButton" href="/console/operations">Open Operations Command Center</Link>
        </DashboardCard>
        <DashboardCard title="5. Reports are generated">
          <p><strong>Who uses it:</strong> Agency and family</p>
          <p><strong>What they do:</strong> Review weekly reports, billing readiness, and operational summaries built from visit proof.</p>
          <p><strong>Record created:</strong> Weekly report, visit proof export, and audit-ready operational record.</p>
          <p><strong>Value:</strong> Reporting comes from documented care activity instead of manual chasing.</p>
          <Link className="button secondaryButton" href="/console/reports">View Reports</Link>
        </DashboardCard>
      </div>
    </PublicProductShell>
  );
}

export function DemoPageScreen() {
  return (
    <PublicProductShell
      title="Book a live CareProof walkthrough."
      subtitle="Use the form, pick your main challenge, and open the product routes to see how the demo behaves end-to-end."
    >
      <div className="cardGridTwo">
        <DemoRequestPanel />
        <DemoBookingRail
          bookDemoUrl="/demo"
          title="Choose a walkthrough date"
          caption="Pick a slot and use the demo routes to explore the product before the meeting."
        />
      </div>
    </PublicProductShell>
  );
}

export function PricingPageScreen() {
  return (
    <PublicProductShell
      title="Flexible pricing for pilots, growth, and multi-location operations."
      subtitle="Commercial packaging stays contact-based while the product demo shows the actual workflow depth."
    >
      <div className="cardGridThree">
        {[
          ['Starter Pilot', 'Visit proof, caregiver workflow, family updates, and basic reports.'],
          ['Growth', 'Alerts, incident workflow, weekly family reporting, and concern tracking.'],
          ['Enterprise', 'Multi-location support, advanced reporting, and integration readiness.'],
        ].map(([title, copy]) => (
          <DashboardCard key={title} title={title}>
            <p>{copy}</p>
            <Link className="button primaryButton" href={bookDemoUrl}>
              {title === 'Starter Pilot' ? 'Request Pilot' : title === 'Growth' ? 'Talk to Sales' : 'Discuss Enterprise'}
            </Link>
          </DashboardCard>
        ))}
      </div>
    </PublicProductShell>
  );
}

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

export function ClientsScreen() {
  const { visits } = useDemoStore();
  const { clients, getCaregiver, getCarePlan, getFamilyMember } = useReferenceData();
  const portalEnabled = clients.filter((client) => client.familyPortalAccessEnabled).length;
  const reviewNeeded = clients.filter((client) => getCarePlan(client.carePlanId)?.status === 'Review Needed').length;
  return (
    <AppShell title="Clients" subtitle="Profiles, family contacts, risk flags, care plans, and upcoming visits." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Active clients" value={clients.length} />
        <StatCard label="Family portal enabled" value={portalEnabled} tone="positive" />
        <StatCard label="Care plans needing review" value={reviewNeeded} tone={reviewNeeded ? 'warning' : 'positive'} />
        <StatCard label="Visits scheduled today" value={visits.filter((visit) => visit.scheduledDay === 'Today').length} tone="info" />
      </div>
      <SectionHeader
        eyebrow="Client onboarding"
        title="Clients and family setup"
        text="Track profile completeness, caregiver assignment, and family access before the pilot starts."
        actions={<Link className="button primaryButton" href="/console/onboarding">Add client in onboarding</Link>}
      />
      <DataTable
        columns={['Client', 'Assigned caregiver', 'Care plan status', 'Upcoming visit', 'Family contact', 'Risk flags', 'Action']}
        rows={clients.map((client) => {
          const caregiver = getCaregiver(client.assignedCaregiverId);
          const carePlan = getCarePlan(client.carePlanId);
          const family = client.familyContactIds.map((id) => getFamilyMember(id)?.name).filter(Boolean).join(', ');
          const upcomingVisit = visits.find((visit) => visit.id === client.upcomingVisitId);
          return [
            <div key="client" className="tablePrimaryCell"><strong>{client.name}</strong><span>{client.address}</span></div>,
            caregiver?.name ?? '—',
            carePlan?.status ?? '—',
            upcomingVisit?.scheduledTime ?? '—',
            family,
            client.riskFlags.join(', '),
            <Link key="action" className="textAction" href={`/console/clients/${client.id}`}>View client</Link>,
          ];
        })}
      />
    </AppShell>
  );
}

export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const { visits, incidents, familyConcerns, weeklyReports, addFamilyMember, showToast } = useDemoStore();
  const { getClient, getCaregiver, getCarePlan, familyMembers } = useReferenceData();
  const client = getClient(clientId);
  const [familyName, setFamilyName] = useState('');
  const [familyRelationship, setFamilyRelationship] = useState('Daughter');
  const [familyEmail, setFamilyEmail] = useState('');
  const [familyPhone, setFamilyPhone] = useState('');
  if (!client) {
    return (
      <AppShell title="Client not found" subtitle="The requested client profile is not available." navItems={consoleLinks}>
        <EmptyState title="Client not found" text="Open a valid client from the clients page." />
      </AppShell>
    );
  }

  const caregiver = getCaregiver(client.assignedCaregiverId);
  const carePlan = getCarePlan(client.carePlanId);
  const clientVisits = visits.filter((visit) => visit.clientId === client.id);
  const clientIncidents = incidents.filter((incident) => incident.clientId === client.id);
  const clientConcerns = familyConcerns.filter((concern) => concern.clientId === client.id);
  const clientReports = weeklyReports.filter((report) => report.clientId === client.id);
  const linkedFamily = familyMembers.filter((member) => member.clientId === client.id || client.familyContactIds.includes(member.id));
  const openIncidents = clientIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length;
  const openConcerns = clientConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length;
  const completedVisits = clientVisits.filter((visit) => getVisitStatus(visit) === 'Completed').length;
  const familyReport = clientReports.find((report) => ['Ready', 'Sent'].includes(report.status)) ?? clientReports[0];

  return (
    <AppShell title={client.name} subtitle="Profile, care plan, visit history, incidents, and weekly reporting in one screen." navItems={consoleLinks}>
      <DashboardCard title="Client operating snapshot">
        <div className="ownerBriefGrid">
          <Link href={`/console/visits?client=${client.id}`} className="ownerBriefCard">
            <span>Visit proof</span>
            <strong>{completedVisits}/{clientVisits.length}</strong>
            <p>recent visits are completed with proof in the current demo window</p>
          </Link>
          <Link href="/console/family-concerns" className="ownerBriefCard">
            <span>Family follow-up</span>
            <strong>{openConcerns}</strong>
            <p>open concern{openConcerns === 1 ? '' : 's'} for this client</p>
          </Link>
          <Link href="/console/incidents" className="ownerBriefCard">
            <span>Incident follow-up</span>
            <strong>{openIncidents}</strong>
            <p>open incident follow-up{openIncidents === 1 ? '' : 's'} tied to this client</p>
          </Link>
        </div>
      </DashboardCard>
      <div className="dashboardSplit">
        <DashboardCard title="Profile">
          <div className="detailFactGrid">
            <div><span>Assigned caregiver</span><strong>{caregiver?.name}</strong></div>
            <div><span>Family members</span><strong>{linkedFamily.map((member) => member.name).join(', ') || 'None linked yet'}</strong></div>
            <div><span>Address</span><strong>{client.address}</strong></div>
            <div><span>Risk flags</span><strong>{client.riskFlags.join(', ')}</strong></div>
            <div><span>Next visit</span><strong>{visits.find((visit) => visit.id === client.upcomingVisitId)?.scheduledTime ?? 'Not scheduled'}</strong></div>
            <div><span>Last completed visit</span><strong>{clientVisits.find((visit) => getVisitStatus(visit) === 'Completed')?.scheduledTime ?? '—'}</strong></div>
            <div><span>Open concerns</span><strong>{clientConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length}</strong></div>
            <div><span>Weekly report status</span><strong>{clientReports[0]?.status ?? 'Not generated'}</strong></div>
          </div>
        </DashboardCard>
        <DashboardCard title="Notes summary">
          <p className="longformBlock">{client.notesSummary}</p>
          <div className="inlineActions">
            <Link className="button secondaryButton" href="/console/schedule">Create visit</Link>
            <Link className="button secondaryButton" href="/console/care-plans/new">Assign caregiver or care plan</Link>
            {familyReport ? (
              <Link className="button ghostButton" href={`/console/reports/${familyReport.id}`}>Open weekly report</Link>
            ) : (
              <button type="button" className="button ghostButton" onClick={() => showToast('Weekly report draft queued for coordinator review in demo mode.')}>Generate Weekly Report</button>
            )}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard title="Care plan">
        <div className="cardGridThree">
          <div className="longformStack">
            <strong>Visit frequency</strong>
            <p>{carePlan?.visitFrequency}</p>
          </div>
          <div className="longformStack">
            <strong>Family-facing instructions</strong>
            <ul className="featureList">
              {(carePlan?.familyFacingInstructions?.length ? carePlan.familyFacingInstructions : ['Family updates require agency approval before sharing.']).map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="longformStack">
            <strong>Special instructions</strong>
            <ul className="featureList">
              {carePlan?.specialInstructions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="longformStack">
            <strong>Risk notes</strong>
            <ul className="featureList">
              {carePlan?.riskNotes.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </DashboardCard>

      <div className="dashboardSplit">
        <DashboardCard title="Visit history">
          <div className="stackGrid">
            {clientVisits.map((visit) => <VisitCard key={visit.id} visit={visit} href={`/console/visits/${visit.id}`} />)}
          </div>
        </DashboardCard>
        <DashboardCard title="Incidents and weekly reports">
          <div className="stackGrid">
            {clientIncidents.map((incident) => (
              <Link key={incident.id} className="miniSummaryCard" href={`/console/incidents/${incident.id}`}>
                <strong>{incident.type}</strong>
                <p>{incident.status} · {incident.severity}</p>
              </Link>
            ))}
            {clientReports.map((report) => (
              <Link key={report.id} className="miniSummaryCard" href={`/console/reports/${report.id}`}>
                <strong>{report.period}</strong>
                <p>{report.status} · {report.summary}</p>
              </Link>
            ))}
          </div>
        </DashboardCard>
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Family access">
          <div className="stackGrid">
            {linkedFamily.map((member) => (
              <div key={member.id} className="miniSummaryCard">
                <strong>{member.name}</strong>
                <p>{member.relationship} · {member.notificationPreference ?? 'Email'}</p>
                <p>Portal access: {member.portalAccessEnabled ? 'Enabled' : 'Disabled'} · Weekly reports: {member.weeklyReportsEnabled ? 'Yes' : 'No'}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="Add family member">
          <div className="formStack">
            <label className="demoField">
              <span>Name</span>
              <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
            </label>
            <label className="demoField">
              <span>Relationship</span>
              <input value={familyRelationship} onChange={(event) => setFamilyRelationship(event.target.value)} />
            </label>
            <label className="demoField">
              <span>Email</span>
              <input value={familyEmail} onChange={(event) => setFamilyEmail(event.target.value)} />
            </label>
            <label className="demoField">
              <span>Phone</span>
              <input value={familyPhone} onChange={(event) => setFamilyPhone(event.target.value)} />
            </label>
            <button
              type="button"
              className="button primaryButton"
              onClick={() => {
                const result = addFamilyMember(client.id, {
                  name: familyName,
                  relationship: familyRelationship,
                  email: familyEmail,
                  phone: familyPhone,
                  portalAccessEnabled: true,
                  notificationPreference: 'Email',
                  weeklyReportsEnabled: true,
                  canSubmitConcerns: true,
                });
                if (result.ok) {
                  setFamilyName('');
                  setFamilyRelationship('Daughter');
                  setFamilyEmail('');
                  setFamilyPhone('');
                }
              }}
            >
              Add family member
            </button>
          </div>
        </DashboardCard>
      </div>

      <DashboardCard title="Continuity">
        <div className="cardGridThree">
          <div className="miniSummaryCard">
            <strong>Recent visit pattern</strong>
            <p>{clientVisits.length} visits in the current demo window · {clientVisits.filter((visit) => ['Late', 'Missed'].includes(getVisitDisplayStatus(visit))).length} late or missed.</p>
          </div>
          <div className="miniSummaryCard">
            <strong>Recurring incomplete tasks</strong>
            <p>{clientVisits.reduce((count, visit) => count + visit.checklist.filter((item) => item.status === 'Unable').length, 0)} tasks marked unable to complete.</p>
          </div>
          <div className="miniSummaryCard">
            <strong>Repeated concerns</strong>
            <p>{linkedFamily.length} family contacts linked · {clientIncidents.length} incidents recorded.</p>
          </div>
          <div className="miniSummaryCard">
            <strong>Caregiver consistency</strong>
            <p>{new Set(clientVisits.map((visit) => visit.caregiverId)).size} caregiver assignments across recent visits.</p>
          </div>
          <div className="miniSummaryCard">
            <strong>Notes summary</strong>
            <p>{clientVisits.filter((visit) => Boolean(visit.careNote)).length} visits include notes; open follow-ups remain visible in incidents and reports.</p>
          </div>
          <div className="miniSummaryCard">
            <strong>Open follow-ups</strong>
            <p>{clientIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length} incident follow-ups and {clientReports.filter((report) => report.status !== 'Sent').length} unsent reports.</p>
          </div>
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function CarePlansScreen() {
  const { carePlans, getClient } = useReferenceData();
  return (
    <AppShell title="Care Plans" subtitle="Tasks, visit frequency, risk notes, and family communication preferences." navItems={consoleLinks}>
      <SectionHeader
        eyebrow="Care configuration"
        title="Care plan builder"
        text="Keep visit tasks, family visibility, and special instructions aligned before scheduling work."
        actions={<Link className="button primaryButton" href="/console/care-plans/new">Create Care Plan</Link>}
      />
      <div className="stackGrid">
        {carePlans.map((plan) => (
          <DashboardCard key={plan.id} title={`${getClient(plan.clientId)?.name} · ${plan.visitFrequency}`}>
            <div className="cardGridThree">
              <div className="longformStack">
                <strong>Care tasks</strong>
                <ul className="featureList">
                  {plan.taskDefinitions?.map((task) => <li key={task.id}>{task.taskName} · {task.required ? 'Required' : 'Optional'} · {task.familyVisible ? 'Family visible' : 'Internal only'}</li>) ?? plan.tasks.map((task) => <li key={task}>{task}</li>)}
                </ul>
              </div>
              <div className="longformStack">
                <strong>Special instructions</strong>
                <ul className="featureList">
                  {plan.specialInstructions.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="longformStack">
                <strong>Family communication preferences</strong>
                <ul className="featureList">
                  {plan.familyCommunicationPreferences.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </DashboardCard>
        ))}
      </div>
    </AppShell>
  );
}

export function CaregiversScreen() {
  const { filteredVisits, filteredFamilyConcerns } = useDemoStore();
  const { caregivers: branchCaregivers, getBranch } = useReferenceData();
  const support = buildCaregiverSupportRecords({
    caregivers: branchCaregivers,
    visits: filteredVisits,
    concerns: filteredFamilyConcerns,
  });
  const caregiversNeedingSupport = support.filter((record) => record.supportSignal !== 'No urgent support signal').length;
  return (
    <AppShell title="Caregivers" subtitle="Use this view to identify support needs, scheduling issues, and documentation gaps." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Active caregivers" value={branchCaregivers.length} />
        <StatCard label="Need support review" value={caregiversNeedingSupport} tone={caregiversNeedingSupport ? 'warning' : 'positive'} />
        <StatCard label="Assigned visits" value={filteredVisits.length} tone="info" />
        <StatCard label="Open documentation gaps" value={filteredVisits.filter((visit) => !visit.careNote?.text).length} tone="warning" />
      </div>
      <DataTable
        columns={['Caregiver', 'Branch', 'Visits', 'On-time', 'Open issues', 'Support signal', 'Action']}
        rows={branchCaregivers.map((caregiver) => {
          const supportRecord = support.find((item) => item.caregiverId === caregiver.id);
          const caregiverVisits = filteredVisits.filter((visit) => visit.caregiverId === caregiver.id);
          return [
            <Link key="caregiver" className="textAction" href={`/console/caregivers/${caregiver.id}`}>{caregiver.name}</Link>,
            getBranch(caregiver.branchId ?? '')?.name ?? '—',
            `${caregiverVisits.length} assigned · ${caregiver.completedVisits} completed`,
            `${caregiver.onTimeRate}%`,
            caregiver.openIssues,
            supportRecord?.supportSignal ?? 'No urgent support signal',
            <div key="action" className="inlineActions">
              <Link className="textAction" href={`/console/caregivers/${caregiver.id}`}>View caregiver</Link>
              <Link className="textAction" href={`/console/caregiver-support`}>Review support</Link>
            </div>,
          ];
        })}
      />
    </AppShell>
  );
}

export function CaregiverDetailScreen({ caregiverId }: { caregiverId: string }) {
  const { filteredVisits, filteredIncidents, filteredFamilyConcerns } = useDemoStore();
  const { getCaregiver, getClient } = useReferenceData();
  const caregiver = getCaregiver(caregiverId);
  if (!caregiver) {
    return <AppShell title="Caregiver not found" subtitle="The requested caregiver profile is not available." navItems={consoleLinks}><EmptyState title="Caregiver not found" text="Open a valid caregiver from the caregivers list." /></AppShell>;
  }
  const caregiverVisits = filteredVisits.filter((visit) => visit.caregiverId === caregiver.id);
  const caregiverIncidents = filteredIncidents.filter((incident) => incident.caregiverId === caregiver.id);
  const operationalMetrics = getOperationalVisitMetrics(caregiverVisits);
  const activityItems = caregiverVisits
    .flatMap((visit) => visit.auditLogs.map((log) => ({ label: log.action, time: log.time, actor: log.actor })))
    .slice(0, 5);
  const support = buildCaregiverSupportRecords({
    caregivers: [caregiver],
    visits: caregiverVisits,
    concerns: filteredFamilyConcerns.filter((concern) => caregiverVisits.some((visit) => visit.clientId === concern.clientId)),
  })[0];

  return (
    <AppShell title={caregiver.name} subtitle="Operational support view for schedule load, documentation gaps, and recent incidents." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Assigned visits" value={caregiverVisits.length} />
        <StatCard label="Completed visits" value={operationalMetrics.completedCount} tone="positive" />
        <StatCard label="On-time rate" value={`${caregiver.onTimeRate}%`} tone="info" />
        <StatCard label="Missed visits" value={caregiverVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Missed').length} tone="warning" />
        <StatCard label="Incidents" value={caregiverIncidents.length} tone="warning" />
        <StatCard label="Support signal" value={support.supportSignal} tone={support.supportSignal === 'No urgent support signal' ? 'positive' : 'warning'} />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Profile and support context">
          <div className="detailFactGrid">
            <div><span>Availability</span><strong>{caregiver.availability ?? '—'}</strong></div>
            <div><span>Skills</span><strong>{caregiver.skills?.join(', ') || '—'}</strong></div>
            <div><span>Support signal</span><strong>{support.supportSignal}</strong></div>
            <div><span>Recommended action</span><strong>{support.recommendedAction}</strong></div>
          </div>
        </DashboardCard>
        <DashboardCard title="Assigned clients">
          <ul className="featureList">
            {caregiverVisits.map((visit) => (
              <li key={visit.id}>{getClient(visit.clientId)?.name ?? 'Unknown client'} · {visit.scheduledTime}</li>
            ))}
          </ul>
        </DashboardCard>
      </div>
      <DashboardCard title="Recent visit activity">
        <Timeline
          items={activityItems.length ? activityItems : [{ label: 'No recent visit activity recorded', time: 'Current demo period', actor: 'System' }]}
        />
      </DashboardCard>
    </AppShell>
  );
}

export function IncidentsScreen() {
  const { filteredIncidents } = useDemoStore();
  const severityRank: Record<Incident['severity'], number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    const openDelta = Number(!['Resolved', 'Closed'].includes(b.status)) - Number(!['Resolved', 'Closed'].includes(a.status));
    if (openDelta) return openDelta;
    return severityRank[b.severity] - severityRank[a.severity];
  });
  const openIncidents = filteredIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status));
  const familyPending = openIncidents.filter((incident) => !['Family notified', 'Family updated'].includes(incident.familyCommunicationStatus));
  return (
    <AppShell title="Incidents" subtitle="What issue needs follow-up? Review severity, owner, family communication, and resolution status in one queue." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Open incidents" value={openIncidents.length} tone="warning" />
        <StatCard label="High / critical" value={openIncidents.filter((incident) => ['High', 'Critical'].includes(incident.severity)).length} tone="danger" />
        <StatCard label="Family update pending" value={familyPending.length} tone="warning" />
        <StatCard label="Resolved or closed" value={filteredIncidents.filter((incident) => ['Resolved', 'Closed'].includes(incident.status)).length} tone="positive" />
        <StatCard label="Need nurse review" value={filteredIncidents.filter((incident) => nurseApprovals.some((approval) => approval.visitId === incident.visitId || approval.clientId === incident.clientId)).length} tone="warning" />
        <StatCard label="Need social work" value={filteredIncidents.filter((incident) => socialWorkCases.some((item) => item.clientId === incident.clientId && item.status !== 'Closed')).length} tone="info" />
      </div>
      <DataTable
        columns={['Type', 'Client', 'Caregiver', 'Severity', 'Status', 'Nurse review', 'Social work', 'Inspection', 'Family communication', 'Action']}
        rows={sortedIncidents.map((incident) => [
          incident.type,
          getClient(incident.clientId)?.name ?? '—',
          getCaregiver(incident.caregiverId)?.name ?? '—',
          <StatusBadge key="severity" status={incident.severity} />,
          <StatusBadge key="status" status={incident.status} />,
          nurseApprovals.some((approval) => approval.visitId === incident.visitId || approval.clientId === incident.clientId)
            ? <Link key="nurse" className="textAction" href="/console/nurse-approvals">Review required</Link>
            : 'Not required',
          socialWorkCases.some((item) => item.clientId === incident.clientId && item.status !== 'Closed')
            ? <Link key="social" className="textAction" href="/console/social-work">Case linked</Link>
            : 'No case',
          inspectionFindings.some((finding) => finding.clientId === incident.clientId || finding.visitId === incident.visitId)
            ? <Link key="inspection" className="textAction" href="/console/inspection-center">Finding open</Link>
            : 'Clear',
          incident.familyCommunicationStatus,
          <Link key="action" className="textAction" href={`/console/incidents/${incident.id}`}>Review incident</Link>,
        ])}
      />
    </AppShell>
  );
}

export function IncidentDetailScreen({ incidentId }: { incidentId: string }) {
  const { incidents, updateIncident } = useDemoStore();
  const normalizedIncidentId = incidentId === 'incident-med-reminder' ? 'incident-medication' : incidentId;
  const incident = incidents.find((item) => item.id === normalizedIncidentId);
  const [note, setNote] = useState(incident?.followUpAction ?? '');
  const [status, setStatus] = useState<Incident['status']>(incident?.status ?? 'New');
  const [assignedTo, setAssignedTo] = useState(incident?.assignedTo ?? '');
  const [familyStatus, setFamilyStatus] = useState(incident?.familyCommunicationStatus ?? 'Internal review only');
  const [familyUpdateDraft, setFamilyUpdateDraft] = useState(incident?.familyUpdateDraft ?? '');
  const [resolutionNotes, setResolutionNotes] = useState(incident?.resolutionNotes ?? '');
  const [triage, setTriage] = useState<{
    suggestedPriority: string;
    suggestedNextActions: string[];
    familyCommunicationSuggestion: string;
    escalationRecommended: boolean;
    safetyDisclaimer: string;
    label: string;
  } | null>(null);

  if (!incident) {
    return (
      <AppShell title="Incident not found" subtitle="The requested incident is not available." navItems={consoleLinks}>
        <EmptyState title="Incident not found" text="Open a valid incident from the incidents page." />
      </AppShell>
    );
  }
  const linkedNurseApproval = nurseApprovals.find((approval) => approval.visitId === incident.visitId || approval.clientId === incident.clientId);
  const linkedSocialCase = socialWorkCases.find((item) => item.clientId === incident.clientId && item.status !== 'Closed');
  const linkedInspectionFinding = inspectionFindings.find((finding) => finding.clientId === incident.clientId || finding.visitId === incident.visitId);

  return (
    <AppShell title={incident.type} subtitle="What issue needs follow-up? Review the visit record, assign ownership, update family communication, and close the issue." navItems={consoleLinks}>
      <DashboardCard title="Follow-up summary">
        <div className="concernCardHeader">
          <div>
            <strong>{getClient(incident.clientId)?.name} · {incident.severity} severity</strong>
            <p>{incident.status === 'Closed' ? 'Incident is closed.' : incident.status === 'Resolved' ? 'Resolution is recorded. Close when agency review is complete.' : 'Human review required. Keep internal notes separate from any family-facing update.'}</p>
          </div>
          <div className="inlineActions">
            <StatusBadge status={incident.status} />
            <StatusBadge status={incident.severity} />
          </div>
        </div>
      </DashboardCard>
      <div className="dashboardSplit">
        <DashboardCard title="Incident detail">
          <div className="detailFactGrid">
            <div><span>Client</span><strong>{getClient(incident.clientId)?.name}</strong></div>
            <div><span>Caregiver</span><strong>{getCaregiver(incident.caregiverId)?.name}</strong></div>
            <div><span>Severity</span><strong>{incident.severity}</strong></div>
            <div><span>Status</span><strong>{incident.status}</strong></div>
            <div><span>Assigned owner</span><strong>{incident.assignedTo ?? 'Unassigned'}</strong></div>
            <div><span>Family communication</span><strong>{incident.familyCommunicationStatus}</strong></div>
            <div><span>Nurse review</span><strong>{linkedNurseApproval?.status ?? 'Not required'}</strong></div>
            <div><span>Social work</span><strong>{linkedSocialCase?.status ?? 'Not linked'}</strong></div>
            <div><span>Inspection</span><strong>{linkedInspectionFinding?.status ?? 'Clear'}</strong></div>
          </div>
          <p className="longformBlock">{incident.description}</p>
          {incident.immediateActionTaken ? (
            <div className="privacyPanel privacyPanelInternal">
              <strong>Immediate action taken</strong>
              <p>{incident.immediateActionTaken}</p>
            </div>
          ) : null}
        </DashboardCard>
        <DashboardCard title="Manage incident">
          <div className="formStack">
            <label className="demoField">
              <span>Assigned follow-up owner</span>
              <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} />
            </label>
            <label className="demoField">
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as Incident['status'])}>
                {['New', 'Reviewing', 'Follow-up Assigned', 'Family Updated', 'Resolved', 'Closed'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="demoField">
              <span>Follow-up note · Internal only</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
            </label>
            <p className="fieldHint">Staff-only follow-up notes are not shown in the family portal.</p>
            <label className="demoField privacyPanel privacyPanelFamily">
              <span>Family-facing update draft</span>
              <textarea value={familyUpdateDraft} onChange={(event) => setFamilyUpdateDraft(event.target.value)} rows={3} />
              <em>Reviewed agency language only. This is not medical advice.</em>
            </label>
            <label className="demoField">
              <span>Family communication status</span>
              <input value={familyStatus} onChange={(event) => setFamilyStatus(event.target.value)} />
            </label>
            <p className="fieldHint">Use neutral status language here. Family-facing messages still require review before sharing.</p>
            <label className="demoField">
              <span>Resolution notes · Internal only</span>
              <textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} rows={3} />
            </label>
            <button
              type="button"
              className="button primaryButton"
              onClick={() => updateIncident(incident.id, { status, assignedTo, followUpAction: note, familyCommunicationStatus: familyStatus, familyUpdateDraft, resolutionNotes })}
            >
              Save incident update
            </button>
            <div className="inlineActions">
              <button
                type="button"
                className="button secondaryButton"
                onClick={() => {
                  setStatus('Family Updated');
                  setFamilyStatus('Family updated');
                  updateIncident(incident.id, { status: 'Family Updated', assignedTo, followUpAction: note, familyCommunicationStatus: 'Family updated', familyUpdateDraft, resolutionNotes });
                }}
              >
                Mark Family Updated
              </button>
              <button
                type="button"
                className="button ghostButton"
                onClick={() => {
                  setStatus('Closed');
                  updateIncident(incident.id, { status: 'Closed', assignedTo, followUpAction: note, familyCommunicationStatus: familyStatus, familyUpdateDraft, resolutionNotes: resolutionNotes || 'Follow-up closed in demo mode.' });
                }}
              >
                Close Incident
              </button>
            </div>
          </div>
        </DashboardCard>
      </div>
      <DashboardCard title="Linked review records">
        <div className="cardGridThree">
          <div className="miniSummaryCard">
            <div className="aiRiskSignalTop"><strong>Nurse review</strong><StatusBadge status={linkedNurseApproval?.status ?? 'Not required'} /></div>
            <p>{linkedNurseApproval?.notesSubmitted ?? 'No nurse approval is attached to this incident.'}</p>
            <Link className="textAction" href="/console/nurse-approvals">Open nurse approvals</Link>
          </div>
          <div className="miniSummaryCard">
            <div className="aiRiskSignalTop"><strong>Social work</strong><StatusBadge status={linkedSocialCase?.status ?? 'No case'} /></div>
            <p>{linkedSocialCase?.familySafeResponse ?? 'No social work follow-up is linked yet.'}</p>
            <Link className="textAction" href="/console/social-work">Open social work</Link>
          </div>
          <div className="miniSummaryCard">
            <div className="aiRiskSignalTop"><strong>Inspection finding</strong><StatusBadge status={linkedInspectionFinding?.severity ?? 'Info'} /></div>
            <p>{linkedInspectionFinding?.recommendedAction ?? 'No open inspection finding is linked.'}</p>
            <Link className="textAction" href="/console/inspection-center">Open inspection center</Link>
          </div>
        </div>
      </DashboardCard>
      <DashboardCard title="Incident timeline">
        <Timeline
          items={[
            { label: 'Caregiver reported issue', time: incident.createdAt, actor: getCaregiver(incident.caregiverId)?.name },
            { label: 'Coordinator assigned', time: 'Today · 10:24 AM', actor: incident.assignedTo },
            { label: 'Family communication reviewed', time: 'Today · 11:10 AM', actor: 'Coordinator' },
            ...(incident.auditTimeline ?? []),
          ]}
        />
      </DashboardCard>
      <AiPanel title="Incident Triage Assistant">
        <AiDraftCard
          title="Suggested Follow-Up"
          actions={
            <AiActionButton
              label="Suggest Follow-Up"
              onClick={async () => {
                const result = await generateIncidentTriageApi({
                  type: incident.type.toLowerCase().replace(/\s+/g, '_'),
                  severity:
                    incident.severity === 'Critical'
                      ? 'emergency'
                      : incident.severity === 'High'
                        ? 'high'
                        : incident.severity === 'Medium'
                          ? 'moderate'
                          : 'low',
                  description: incident.description,
                  clientName: getClient(incident.clientId)?.name,
                });
                setTriage(result as {
                  suggestedPriority: string;
                  suggestedNextActions: string[];
                  familyCommunicationSuggestion: string;
                  escalationRecommended: boolean;
                  safetyDisclaimer: string;
                  label: string;
                });
              }}
            />
          }
        >
          {triage ? (
            <div className="longformStack">
              <AiReviewBadge label={triage.label} />
              <p><strong>Suggested priority:</strong> {triage.suggestedPriority}</p>
              <AiSuggestionList items={triage.suggestedNextActions} />
              <p><strong>Family communication:</strong> {triage.familyCommunicationSuggestion}</p>
              <p><strong>Supervisor review:</strong> {triage.escalationRecommended ? 'Recommended' : 'Not required'}</p>
              <AiDisclaimer>{triage.safetyDisclaimer}</AiDisclaimer>
              <div className="inlineActions">
                <AiActionButton label="Accept into Follow-Up Notes" tone="primary" onClick={() => setNote([...triage.suggestedNextActions, note].filter(Boolean).join(' '))} />
                <AiActionButton label="Ignore Suggestion" tone="ghost" onClick={() => setTriage(null)} />
              </div>
            </div>
          ) : (
            <EmptyState title="No AI triage yet" text="Generate a suggested follow-up draft for coordinator review." />
          )}
        </AiDraftCard>
      </AiPanel>
    </AppShell>
  );
}

export function FamilyConcernsScreen() {
  const { filteredFamilyConcerns, updateConcern } = useDemoStore();
  const openConcerns = filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status));
  const overdueConcerns = openConcerns.filter((concern) => getConcernOverdue(concern));
  const respondedConcerns = filteredFamilyConcerns.filter((concern) => concern.responseSent || concern.status === 'Responded');
  const sortedConcerns = [...filteredFamilyConcerns].sort((a, b) => {
    const overdueDelta = Number(getConcernOverdue(b)) - Number(getConcernOverdue(a));
    if (overdueDelta) return overdueDelta;
    const priorityRank = { High: 3, Medium: 2, Low: 1 };
    return priorityRank[b.priority] - priorityRank[a.priority];
  });
  return (
    <AppShell title="Family Concerns" subtitle="Which family needs a response? Review the concern, separate internal notes from family replies, and track closure." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Open concerns" value={openConcerns.length} tone="warning" />
        <StatCard label="Overdue response risk" value={overdueConcerns.length} tone={overdueConcerns.length ? 'danger' : 'positive'} />
        <StatCard label="Family responses sent" value={respondedConcerns.length} tone="positive" />
        <StatCard label="High priority" value={openConcerns.filter((concern) => concern.priority === 'High').length} tone="warning" />
      </div>

      <DashboardCard title="Response queue">
        <DataTable
          columns={['Family', 'Client', 'Priority', 'Status', 'Due', 'Recommended action']}
          rows={sortedConcerns.map((concern) => [
            getFamilyMember(concern.familyMemberId)?.name ?? '—',
            getClient(concern.clientId)?.name ?? '—',
            concern.priority,
            <StatusBadge key="status" status={concern.status} />,
            getConcernOverdue(concern) ? <strong key="due">Due now · {concern.responseDue}</strong> : concern.responseDue,
            <Link key="action" className="textAction" href={`#${concern.id}`}>{concern.responseSent ? 'Confirm resolution' : 'Draft family response'}</Link>,
          ])}
        />
      </DashboardCard>

      <div className="stackGrid">
        {sortedConcerns.map((concern) => (
          <ConcernResponseCard key={`${concern.id}-${concern.status}-${concern.assignedOwner}-${concern.responseSent ? 'sent' : 'draft'}`} concern={concern} onUpdate={updateConcern} />
        ))}
      </div>
    </AppShell>
  );
}

function ConcernResponseCard({
  concern,
  onUpdate,
}: {
  concern: FamilyConcern;
  onUpdate: (concernId: string, patch: Partial<FamilyConcern>) => void;
}) {
  const [assignedOwner, setAssignedOwner] = useState(concern.assignedOwner);
  const [status, setStatus] = useState<FamilyConcern['status']>(concern.status);
  const [internalNote, setInternalNote] = useState(concern.internalNotes?.join('\n') ?? '');
  const [familyResponse, setFamilyResponse] = useState(concern.familyResponseDraft ?? concern.responseNote ?? '');
  const linkedSocialCase = socialWorkCases.find((item) => item.linkedConcernId === concern.id || item.clientId === concern.clientId);

  const saveConcern = (patch: Partial<FamilyConcern>) => {
    onUpdate(concern.id, {
      assignedOwner,
      internalNotes: internalNote.trim() ? [internalNote.trim()] : [],
      familyResponseDraft: familyResponse.trim(),
      ...patch,
    });
  };

  return (
    <div id={concern.id} className="anchorTarget">
      <DashboardCard title={concern.type}>
      <div className="concernCardHeader">
        <div>
          <strong>{getFamilyMember(concern.familyMemberId)?.name} for {getClient(concern.clientId)?.name}</strong>
          <p>{concern.responseSent ? 'Family response has been sent. Confirm resolution before closing.' : 'Family-facing response is not shared until Respond to Concern is selected.'}</p>
        </div>
        <div className="inlineActions">
          <StatusBadge status={concern.status} />
          {getConcernOverdue(concern) ? <StatusBadge status="Action Required" /> : null}
        </div>
      </div>
      <div className="detailFactGrid">
        <div><span>Family member</span><strong>{getFamilyMember(concern.familyMemberId)?.name}</strong></div>
        <div><span>Client</span><strong>{getClient(concern.clientId)?.name}</strong></div>
        <div><span>Priority</span><strong>{concern.priority}</strong></div>
        <div><span>Status</span><strong>{concern.status}</strong></div>
        <div><span>Assigned owner</span><strong>{concern.assignedOwner}</strong></div>
        <div><span>Response due</span><strong>{concern.responseDue}</strong></div>
        <div><span>Social work case</span><strong>{linkedSocialCase?.status ?? 'Not linked'}</strong></div>
        <div><span>Family-safe response</span><strong>{concern.responseSent ? 'Sent' : 'Draft only'}</strong></div>
      </div>
      <p className="longformBlock">{concern.message}</p>
      <div className="cardGridThree">
        <div className="miniSummaryCard">
          <div className="aiRiskSignalTop"><strong>Client link</strong><StatusBadge status={concern.priority} /></div>
          <p>{getClient(concern.clientId)?.name} · {getFamilyMember(concern.familyMemberId)?.relationship ?? 'Family contact'}</p>
          <Link className="textAction" href={`/console/clients/${concern.clientId}`}>Open client record</Link>
        </div>
        <div className="miniSummaryCard">
          <div className="aiRiskSignalTop"><strong>Social work follow-up</strong><StatusBadge status={linkedSocialCase?.status ?? 'Not linked'} /></div>
          <p>{linkedSocialCase?.familySafeResponse ?? 'Create or review social work follow-up if family communication risk remains open.'}</p>
          <Link className="textAction" href="/console/social-work">Open social work cases</Link>
        </div>
        <div className="miniSummaryCard">
          <div className="aiRiskSignalTop"><strong>Audit trail</strong><StatusBadge status="Demo" /></div>
          <p>Concern received, assigned to {concern.assignedOwner}, and response state tracked separately from internal notes.</p>
        </div>
      </div>
      <div className="formStack">
        <label className="demoField">
          <span>Assigned owner</span>
          <input value={assignedOwner} onChange={(event) => setAssignedOwner(event.target.value)} />
        </label>
        <label className="demoField">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as FamilyConcern['status'])}>
            {['New', 'Reviewing', 'Follow-up Assigned', 'Responded', 'Resolved', 'Closed'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="privacySplit">
          <label className="demoField privacyPanel privacyPanelInternal">
            <span>Internal note · Agency only</span>
            <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={3} />
            <em>Not visible to family.</em>
          </label>
          <label className="demoField privacyPanel privacyPanelFamily">
            <span>Family-facing response</span>
            <textarea value={familyResponse} onChange={(event) => setFamilyResponse(event.target.value)} rows={3} />
            <em>Visible to family only after response is sent.</em>
          </label>
        </div>
        <div className="inlineActions">
          <button
            type="button"
            className="button ghostButton"
            onClick={() =>
              saveConcern({
                status,
              })
            }
          >
            Save Draft
          </button>
          <button
            type="button"
            className="button secondaryButton"
            onClick={() => {
              setStatus('Responded');
              saveConcern({
                status: 'Responded',
                responseNote: familyResponse.trim() || 'We received your concern and will follow up shortly.',
                responseSent: true,
              });
            }}
          >
            Respond to Concern
          </button>
          <button
            type="button"
            className="button primaryButton"
            onClick={() => {
              setStatus('Resolved');
              saveConcern({
                status: 'Resolved',
                responseNote: familyResponse.trim() || concern.responseNote,
                responseSent: true,
              });
            }}
          >
            Mark Resolved
          </button>
        </div>
      </div>
      </DashboardCard>
    </div>
  );
}

export function ReportsScreen() {
  const { weeklyReports, updateWeeklyReportStatus, showToast, filteredVisits, filteredIncidents, filteredFamilyConcerns, generateDailyOperationsReport, dailyOperationsReports, settings } = useDemoStore();
  const billingReadiness = buildBillingReadiness({ visits: filteredVisits, incidents: filteredIncidents, settings });
  const riskRecords = buildClientRiskRecords({ clients, visits: filteredVisits, incidents: filteredIncidents, concerns: filteredFamilyConcerns, reports: weeklyReports });
  const readyReports = weeklyReports.filter((report) => report.status === 'Ready').length;
  const sentReports = weeklyReports.filter((report) => report.status === 'Sent').length;
  const draftReports = weeklyReports.filter((report) => report.status === 'Draft').length;
  const visitsMissingNotes = filteredVisits.filter((visit) => !visit.careNote?.text).length;
  const approvalBlockedUpdates = nurseApprovals.filter((item) => item.blocksFamilyVisibility && !['Approved', 'Rejected'].includes(item.status)).length;
  const openInspectionCount = inspectionFindings.filter((item) => !['Resolved', 'Dismissed'].includes(item.status)).length;
  const expirationBlockerCount = expirationRecords.filter((item) => item.blocksVisits || ['Expired', 'Missing', 'Blocker', 'Expiring in 7 days'].includes(item.state)).length;
  const exportVisitProof = () => {
    downloadCsvFile('careproof-visit-proof.csv', [
      ['client', 'caregiver', 'scheduled', 'status', 'checkIn', 'checkOut', 'checklist', 'familyUpdate'],
      ...filteredVisits.map((visit) => [
        getClient(visit.clientId)?.name ?? visit.clientId,
        getCaregiver(visit.caregiverId)?.name ?? visit.caregiverId,
        visit.scheduledTime,
        getVisitStatus(visit),
        visit.checkInTime ?? '',
        visit.checkOutTime ?? '',
        getChecklistProgress(visit).label,
        getFamilyUpdateStatus(visit),
      ]),
    ]);
    showToast('Visit proof CSV exported in demo mode.');
  };
  const exportIncidentReport = () => {
    downloadCsvFile('careproof-incident-report.csv', [
      ['type', 'client', 'caregiver', 'severity', 'status', 'familyCommunication', 'assignedTo'],
      ...filteredIncidents.map((incident) => [
        incident.type,
        getClient(incident.clientId)?.name ?? incident.clientId,
        getCaregiver(incident.caregiverId)?.name ?? incident.caregiverId,
        incident.severity,
        incident.status,
        incident.familyCommunicationStatus,
        incident.assignedTo,
      ]),
    ]);
    showToast('Incident CSV exported in demo mode.');
  };
  const exportClientRiskReport = () => {
    downloadCsvFile('careproof-client-risk-report.csv', [
      ['client', 'riskLevel', 'reason', 'recommendedAction'],
      ...riskRecords.map((record) => [
        getClient(record.clientId)?.name ?? record.clientId,
        record.riskLevel,
        record.reason,
        record.recommendedAction,
      ]),
    ]);
    showToast('Client risk CSV exported in demo mode.');
  };
  const exportBillingReadinessReport = () => {
    downloadCsvFile('careproof-billing-readiness-report.csv', [
      ['client', 'caregiver', 'billingStatus', 'reasonBlocked'],
      ...billingReadiness.map((record) => [
        getClient(record.clientId)?.name ?? record.clientId,
        getCaregiver(record.caregiverId)?.name ?? record.caregiverId,
        record.billingStatus,
        record.reasonBlocked ?? '',
      ]),
    ]);
    showToast('Billing readiness CSV exported in demo mode.');
  };
  const exportAgencyOperationsReport = () => {
    const health = buildAgencyHealthScore({ visits: filteredVisits, incidents: filteredIncidents, concerns: filteredFamilyConcerns, reports: weeklyReports });
    downloadCsvFile('careproof-agency-operations-report.csv', [
      ['metric', 'value'],
      ['totalVisits', filteredVisits.length],
      ['completedVisits', filteredVisits.filter((visit) => getVisitStatus(visit) === 'Completed').length],
      ['lateVisits', filteredVisits.filter(isLateVisit).length],
      ['missedVisits', filteredVisits.filter(isMissedVisit).length],
      ['checkoutMissing', filteredVisits.filter(isCheckoutMissing).length],
      ['openIncidents', filteredIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length],
      ['openFamilyConcerns', filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length],
      ['readyReports', readyReports],
      ['sentReports', sentReports],
      ['agencyHealthScore', health.score],
      ['agencyHealthStatus', health.status],
    ]);
    showToast('Agency operations CSV exported in demo mode.');
  };
  const exportDailyOperationsReport = () => {
    const latest = dailyOperationsReports[0];
    downloadCsvFile('careproof-daily-operations-report.csv', [
      ['metric', 'value'],
      ['date', latest?.date ?? 'Today'],
      ['scheduledVisits', latest?.scheduledVisits ?? filteredVisits.length],
      ['completedVisits', latest?.completedVisits ?? filteredVisits.filter((visit) => getVisitStatus(visit) === 'Completed').length],
      ['lateVisits', latest?.lateVisits ?? filteredVisits.filter(isLateVisit).length],
      ['missedVisits', latest?.missedVisits ?? filteredVisits.filter(isMissedVisit).length],
      ['openIncidents', latest?.incidentsOpened ?? filteredIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length],
      ['openFamilyConcerns', latest?.familyConcernsOpened ?? filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length],
    ]);
    showToast('Daily operations CSV exported in demo mode.');
  };
  return (
    <AppShell title="Reports" subtitle="What records can be shared or reviewed? Open weekly reports, visit proof exports, and operational summaries from one page." navItems={consoleLinks}>
      <div className="stackGrid">
        <div className="statsGrid proofStatsGrid">
          <StatCard label="Ready reports" value={readyReports} tone="positive" />
          <StatCard label="Sent reports" value={sentReports} tone="info" />
          <StatCard label="Draft reports" value={draftReports} tone={draftReports ? 'warning' : 'neutral'} />
          <StatCard label="Visits missing notes" value={visitsMissingNotes} tone={visitsMissingNotes ? 'warning' : 'positive'} />
          <StatCard label="Billing records" value={billingReadiness.length} />
          <StatCard label="Approvals blocking family" value={approvalBlockedUpdates} tone={approvalBlockedUpdates ? 'danger' : 'positive'} />
          <StatCard label="Inspection findings" value={openInspectionCount} tone={openInspectionCount ? 'warning' : 'positive'} />
          <StatCard label="Compliance blockers" value={expirationBlockerCount} tone={expirationBlockerCount ? 'danger' : 'positive'} />
        </div>

        <DashboardCard title="Weekly Family Reports">
          <DataTable
            columns={['Period', 'Client', 'Visits completed', 'Notes included', 'Status', 'Actions']}
            rows={weeklyReports.map((report) => [
              report.period,
              <Link key="client" className="textAction" href={`/console/reports/${report.id}`}>{getClient(report.clientId)?.name ?? '—'}</Link>,
              report.completedVisits,
              report.notesIncluded,
              <StatusBadge key="status" status={report.status} />,
              <div key="actions" className="inlineActions">
                <Link className="textAction" href={`/console/reports/${report.id}`}>Preview report</Link>
                <button type="button" className="textAction" onClick={() => updateWeeklyReportStatus(report.id, 'Ready')}>Mark Ready</button>
                <button type="button" className="textAction" onClick={() => updateWeeklyReportStatus(report.id, 'Sent')}>Send Demo Notification</button>
              </div>,
            ])}
          />
        </DashboardCard>

        <div className="cardGridThree">
          <DashboardCard title="Nurse Approval Report">
            <ul className="featureList">
              <li>{nurseApprovals.filter((item) => !['Approved', 'Rejected'].includes(item.status)).length} approvals pending</li>
              <li>{approvalBlockedUpdates} family updates blocked</li>
              <li>{nurseApprovals.filter((item) => ['High', 'Critical'].includes(item.priority)).length} high-priority nurse reviews</li>
            </ul>
            <Link className="button secondaryButton" href="/console/nurse-approvals">Open Report</Link>
          </DashboardCard>
          <DashboardCard title="Inspection / Compliance Report">
            <ul className="featureList">
              <li>{openInspectionCount} open inspection findings</li>
              <li>{inspectionFindings.filter((item) => item.severity === 'Compliance').length} compliance findings</li>
              <li>{inspectionRules.length} active inspection rules</li>
            </ul>
            <Link className="button secondaryButton" href="/console/inspection-center">Open Report</Link>
          </DashboardCard>
          <DashboardCard title="Expiration Report">
            <ul className="featureList">
              <li>{expirationRecords.filter((item) => item.state === 'Expiring in 7 days').length} expiring within 7 days</li>
              <li>{expirationRecords.filter((item) => item.state === 'Expiring in 30 days').length} expiring within 30 days</li>
              <li>{expirationBlockerCount} blockers or missing items</li>
            </ul>
            <Link className="button secondaryButton" href="/console/expiration-center">Open Report</Link>
          </DashboardCard>
        </div>

        <div className="cardGridThree">
          <DashboardCard title="Visit Proof Report">
            <ul className="featureList">
              <li>{filteredVisits.filter((visit) => getVisitStatus(visit) === 'Completed').length} completed visits</li>
              <li>{filteredVisits.filter(isLateVisit).length} late visits</li>
              <li>{filteredVisits.filter(isMissedVisit).length} missed visits</li>
              <li>{filteredVisits.filter(isCheckoutMissing).length} checkout missing</li>
            </ul>
            <button type="button" className="button secondaryButton" onClick={exportVisitProof}>
              Export CSV
            </button>
          </DashboardCard>
          <DashboardCard title="Incident Report">
            <ul className="featureList">
              <li>{filteredIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length} open incidents</li>
              <li>{filteredIncidents.filter((incident) => ['Resolved', 'Closed'].includes(incident.status)).length} closed incidents</li>
              <li>Severity tracked by incident record</li>
            </ul>
            <button type="button" className="button secondaryButton" onClick={exportIncidentReport}>
              Export CSV
            </button>
          </DashboardCard>
          <DashboardCard title="Agency Operations Report">
            <ul className="featureList">
              <li>{filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length} open family concerns</li>
              <li>{caregivers.reduce((sum, caregiver) => sum + caregiver.completedVisits, 0)} completed caregiver visits</li>
              <li>On-time and completion trend summary</li>
            </ul>
            <button type="button" className="button secondaryButton" onClick={exportAgencyOperationsReport}>
              Export CSV
            </button>
          </DashboardCard>
        </div>

        <div className="cardGridThree">
          <DashboardCard title="Executive Weekly Summary">
            <ul className="featureList">
              <li>{filteredVisits.length} total visits</li>
              <li>{buildAgencyHealthScore({ visits: filteredVisits, incidents: filteredIncidents, concerns: filteredFamilyConcerns, reports: weeklyReports }).status} agency health</li>
              <li>{riskRecords.filter((record) => record.riskLevel === 'High').length} high-risk clients</li>
              <li>{buildCaregiverSupportRecords({ caregivers, visits: filteredVisits, concerns: filteredFamilyConcerns }).filter((record) => record.supportSignal !== 'No urgent support signal').length} caregivers need support</li>
            </ul>
            <button type="button" className="button secondaryButton" onClick={() => showToast('Executive weekly summary generated for review.')}>Generate Report</button>
          </DashboardCard>
          <DashboardCard title="Branch Performance Report">
            <ul className="featureList">
              {buildBranchPerformance({ branches, visits: filteredVisits, incidents: filteredIncidents, concerns: filteredFamilyConcerns }).map((branch) => (
                <li key={branch.branchId}>{branch.name}: {branch.score} score · {branch.lateOrMissed} late or missed visits</li>
              ))}
            </ul>
            <button type="button" className="button secondaryButton" onClick={() => showToast('Branch performance report generated for review.')}>Preview Report</button>
          </DashboardCard>
          <DashboardCard title="Client Risk Report">
            <ul className="featureList">
              {riskRecords.slice(0, 3).map((record) => (
                <li key={record.clientId}>{getClient(record.clientId)?.name ?? 'Client'}: {record.reason}</li>
              ))}
            </ul>
            <button type="button" className="button secondaryButton" onClick={exportClientRiskReport}>Export CSV</button>
          </DashboardCard>
          <DashboardCard title="Billing Readiness Report">
            <ul className="featureList">
              <li>{billingReadiness.filter((record) => record.billingStatus === 'Ready for Billing').length} ready visits</li>
              <li>{billingReadiness.filter((record) => record.billingStatus === 'Needs Review').length} blocked visits</li>
              <li>Reasons blocked are retained at the visit level.</li>
            </ul>
            <button type="button" className="button secondaryButton" onClick={exportBillingReadinessReport}>Export CSV</button>
          </DashboardCard>
          <DashboardCard title="Caregiver Support Report">
            <ul className="featureList">
              {buildCaregiverSupportRecords({ caregivers, visits: filteredVisits, concerns: filteredFamilyConcerns }).slice(0, 3).map((record) => (
                <li key={record.caregiverId}>{getCaregiver(record.caregiverId)?.name ?? 'Caregiver'}: {record.supportSignal}</li>
              ))}
            </ul>
            <button type="button" className="button secondaryButton" onClick={() => showToast('Caregiver support report generated for review.')}>Mark Reviewed</button>
          </DashboardCard>
          <DashboardCard title="Daily Operations Report">
            <p>{dailyOperationsReports[0]?.date ? `Latest saved report: ${dailyOperationsReports[0].date}` : 'No daily operations report saved yet.'}</p>
            <div className="inlineActions">
              <button type="button" className="button secondaryButton" onClick={() => generateDailyOperationsReport()}>Generate today report</button>
              <button type="button" className="button ghostButton" onClick={exportDailyOperationsReport}>Export CSV</button>
            </div>
          </DashboardCard>
        </div>
      </div>
    </AppShell>
  );
}

export function ReportDetailScreen({ reportId }: { reportId: string }) {
  const { weeklyReports, visits, saveWeeklyReportDraft, updateWeeklyReportStatus, showToast } = useDemoStore();
  const resolvedReportId = reportId === 'report-maria-weekly' ? 'wr-maria' : reportId;
  const report = weeklyReports.find((item) => item.id === resolvedReportId);
  const [draft, setDraft] = useState<{ familyReportDraft: string; agencyInternalSummary: string; openFollowUps: string[]; requiresApproval: boolean; label: string } | null>(null);
  if (!report) {
    return (
      <AppShell title="Report not found" subtitle="The requested weekly report is not available." navItems={consoleLinks}>
        <EmptyState title="Report not found" text="Open a valid report from the reports page." />
      </AppShell>
    );
  }
  const exportWeeklyReport = () => {
    downloadCsvFile(`careproof-weekly-report-${report.id}.csv`, [
      ['field', 'value'],
      ['client', getClient(report.clientId)?.name ?? report.clientId],
      ['period', report.period],
      ['completedVisits', report.completedVisits],
      ['lateOrMissedVisits', report.lateOrMissedVisits],
      ['checklistCompletionRate', report.checklistCompletionRate],
      ['status', report.status],
      ['familySafeSummary', familySafeReportSummary(report.summary)],
      ['followUpActions', report.followUpActions],
    ]);
    showToast('Weekly report CSV exported in demo mode.');
  };

  return (
    <AppShell title={`${getClient(report.clientId)?.name} · Weekly Report`} subtitle="Weekly report preview for family communication and agency review." navItems={consoleLinks}>
      <DashboardCard title="Approval and readiness context">
        <div className="detailFactGrid">
          <div><span>Nurse approvals</span><strong>{nurseApprovals.filter((item) => item.clientId === report.clientId).length} linked</strong></div>
          <div><span>Inspection findings</span><strong>{inspectionFindings.filter((item) => item.clientId === report.clientId).length} linked</strong></div>
          <div><span>Medical availability</span><strong>{medicalAvailabilityRecords.find((item) => item.clientId === report.clientId)?.status ?? 'Available'}</strong></div>
          <div><span>Expiration risk</span><strong>{expirationRecords.find((item) => item.ownerId === report.clientId)?.state ?? 'Valid'}</strong></div>
        </div>
        <AiDisclaimer>AI Draft · Needs Human Review · Not Sent · Not Final. Family-facing reports require agency approval.</AiDisclaimer>
      </DashboardCard>
      <DashboardCard title="Weekly report preview">
        <div className="detailFactGrid">
          <div><span>Week period</span><strong>{report.period}</strong></div>
          <div><span>Client</span><strong>{getClient(report.clientId)?.name}</strong></div>
          <div><span>Visits completed</span><strong>{report.completedVisits}</strong></div>
          <div><span>Late or missed visits</span><strong>{report.lateOrMissedVisits}</strong></div>
          <div><span>Checklist completion</span><strong>{report.checklistCompletionRate}</strong></div>
          <div><span>Status</span><strong>{report.status}</strong></div>
          <div><span>Family-safe summary</span><strong>{familySafeReportSummary(report.summary)}</strong></div>
          <div><span>Internal follow-up context</span><strong>{report.incidentsSummary}</strong></div>
          <div><span>Follow-up actions</span><strong>{report.followUpActions}</strong></div>
        </div>
        <div className="inlineActions">
          <button type="button" className="button secondaryButton" onClick={() => updateWeeklyReportStatus(report.id, 'Ready')}>Mark Ready</button>
          <button type="button" className="button primaryButton" onClick={() => updateWeeklyReportStatus(report.id, 'Sent')}>Send Demo Notification</button>
          <button type="button" className="button ghostButton" onClick={exportWeeklyReport}>Export CSV</button>
        </div>
      </DashboardCard>
      <AiPanel title="Weekly Report Drafting">
        <AiDraftCard
          title="Generate AI Draft"
          actions={
            <AiActionButton
              label="Generate AI Draft"
              onClick={async () => {
                const relatedVisits = visits.filter((visit) => visit.clientId === report.clientId);
                const result = await generateWeeklyReportDraftApi({
                  clientId: report.clientId,
                  clientName: getClient(report.clientId)?.name ?? 'Client',
                  weekPeriod: report.period,
                  visits: relatedVisits.map((visit) => ({
                    id: visit.id,
                    status: getVisitStatus(visit).toLowerCase().replace(/\s+/g, '_'),
                    tasks: visit.checklist.map((item) => ({
                      label: item.label,
                      required: true,
                      completed: item.completed,
                    })),
                    caregiverNote: visit.careNote?.text,
                    familySummary: visit.careNote?.approvedSummary,
                  })),
                  incidents: report.incidentsSummary ? [report.incidentsSummary] : [],
                  concerns: report.followUpActions ? [report.followUpActions] : [],
                });
                setDraft(result as { familyReportDraft: string; agencyInternalSummary: string; openFollowUps: string[]; requiresApproval: boolean; label: string });
                showToast((result as { label?: string }).label ?? 'Demo AI draft generated');
              }}
            />
          }
        >
          {draft ? (
            <div className="longformStack">
              <AiReviewBadge label="Human review required" />
              <EditableAiDraft value={draft.familyReportDraft} onChange={(value) => setDraft({ ...draft, familyReportDraft: value })} rows={5} />
              <p><strong>Agency internal summary:</strong> {draft.agencyInternalSummary}</p>
              <AiSuggestionList items={draft.openFollowUps} />
              <AiDisclaimer>Family-facing AI content stays in draft until agency staff marks the report ready and sends it.</AiDisclaimer>
              <div className="inlineActions">
                <AiActionButton label="Save Draft" onClick={() => saveWeeklyReportDraft(report.id, draft.familyReportDraft)} />
                <AiActionButton label="Mark Ready" tone="primary" onClick={() => updateWeeklyReportStatus(report.id, 'Ready')} />
                <AiActionButton label="Send to Family" tone="ghost" onClick={() => updateWeeklyReportStatus(report.id, 'Sent')} />
              </div>
            </div>
          ) : (
            <EmptyState title="No weekly draft yet" text="Generate an AI-assisted weekly summary before marking the report ready." />
          )}
        </AiDraftCard>
      </AiPanel>
    </AppShell>
  );
}

export function SettingsScreen() {
  const { settings, users, updateAgencySettings } = useDemoStore();
  const { agency } = useReferenceData();
  return (
    <AppShell title="Settings" subtitle="Agency profile, family visibility defaults, and export behavior." navItems={consoleLinks}>
      <div className="cardGridThree">
        <DashboardCard title="Agency profile">
          <div className="detailFactGrid">
            <div><span>Name</span><strong>{agency.name}</strong></div>
            <div><span>Main office phone</span><strong>{settings.profile.mainOfficePhone}</strong></div>
            <div><span>Email</span><strong>{settings.profile.email}</strong></div>
            <div><span>Timezone</span><strong>{settings.profile.timezone}</strong></div>
          </div>
        </DashboardCard>
        <DashboardCard title="Visit rules">
          <ul className="featureList">
            <li>Late visit grace period: {settings.visitRules.lateVisitGracePeriodMinutes} minutes</li>
            <li>Missed visit threshold: {settings.visitRules.missedVisitThresholdMinutes} minutes</li>
            <li>Require note before checkout: {settings.visitRules.requireNoteBeforeCheckout ? 'Yes' : 'No'}</li>
          </ul>
          <button type="button" className="button secondaryButton" onClick={() => updateAgencySettings({ visitRules: { ...settings.visitRules, lateVisitGracePeriodMinutes: settings.visitRules.lateVisitGracePeriodMinutes + 5 } })}>
            Increase grace period by 5 min
          </button>
        </DashboardCard>
        <DashboardCard title="Family visibility and notifications">
          <ul className="featureList">
            <li>Visit start/completion visible: {settings.familyVisibility.showVisitStartCompletion ? 'Yes' : 'No'}</li>
            <li>Care notes require approval: {settings.familyVisibility.showCareNotesOnlyAfterApproval ? 'Yes' : 'No'}</li>
            <li>Notify family on completed visit: {settings.notificationPreferences.notifyFamilyWhenVisitCompleted ? 'Yes' : 'No'}</li>
          </ul>
          <div className="inlineActions">
            <Link className="button secondaryButton" href="/console/settings/users">Manage users</Link>
            <Link className="button ghostButton" href="/console/system/data-export">Data Export</Link>
          </div>
        </DashboardCard>
      </div>
      <DashboardCard title="User and role management">
        <DataTable
          columns={['User', 'Role', 'Status', 'Last active']}
          rows={users.map((user) => [user.name, user.role, user.status ?? 'Active', user.lastActive ?? '—'])}
        />
      </DashboardCard>
    </AppShell>
  );
}

export function OnboardingScreen() {
  const {
    onboardingDraft,
    saveOnboardingDraft,
    completeOnboarding,
    onboardingProgress,
    onboardingChecklist,
  } = useDemoStore();
  const { clients, caregivers, carePlans } = useReferenceData();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(onboardingDraft.agencyProfile);
  const [team, setTeam] = useState(onboardingDraft.team);
  const [draftClients, setDraftClients] = useState(onboardingDraft.clients);
  const [draftCaregivers, setDraftCaregivers] = useState(onboardingDraft.caregivers);
  const [templates, setTemplates] = useState(onboardingDraft.carePlanTemplates);
  const [scheduledVisits, setScheduledVisits] = useState(onboardingDraft.scheduledVisits);

  const steps = [
    'Agency Profile',
    'Invite Team',
    'Add Clients',
    'Add Caregivers',
    'Create Care Plan Template',
    'Schedule First Visits',
    'Review & Launch',
  ];

  const persistStep = () => {
    saveOnboardingDraft({
      agencyProfile: profile,
      team,
      clients: draftClients,
      caregivers: draftCaregivers,
      carePlanTemplates: templates,
      scheduledVisits,
    });
  };

  return (
    <AppShell title="Agency onboarding" subtitle="Set up the agency, team, clients, caregivers, care plans, and first visits in one guided flow." navItems={consoleLinks}>
      <DashboardCard title="Onboarding progress">
        <div className="readinessHeader">
          <div>
            <p className="sectionEyebrow">Setup wizard</p>
            <h3>{onboardingProgress}% complete</h3>
          </div>
          <div className="wizardStepper">
            {steps.map((item, index) => (
              <button key={item} type="button" className={`wizardStep ${index === step ? 'is-active' : ''}`} onClick={() => setStep(index)}>
                <span>{index + 1}</span>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="progressBar"><span style={{ width: `${onboardingProgress}%` }} /></div>
      </DashboardCard>

      {step === 0 ? (
        <DashboardCard title="Step 1 · Agency profile">
          <div className="formGridTwo">
            <label className="demoField"><span>Agency name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
            <label className="demoField"><span>Main office phone</span><input value={profile.mainOfficePhone ?? ''} onChange={(event) => setProfile({ ...profile, mainOfficePhone: event.target.value })} /></label>
            <label className="demoField"><span>Email</span><input value={profile.email ?? ''} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
            <label className="demoField"><span>Address</span><input value={profile.addressLine ?? ''} onChange={(event) => setProfile({ ...profile, addressLine: event.target.value })} /></label>
            <label className="demoField"><span>Timezone</span><input value={profile.timezone ?? ''} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} /></label>
            <label className="demoField"><span>Default grace period in minutes</span><input type="number" value={profile.defaultVisitGracePeriodMinutes ?? 15} onChange={(event) => setProfile({ ...profile, defaultVisitGracePeriodMinutes: Number(event.target.value) })} /></label>
          </div>
        </DashboardCard>
      ) : null}

      {step === 1 ? (
        <DashboardCard title="Step 2 · Invite team">
          <div className="stackGrid">
            {team.map((member, index) => (
              <div key={member.id} className="formGridTwo onboardingRowCard">
                <label className="demoField"><span>Full name</span><input value={member.fullName} onChange={(event) => setTeam(team.map((item, itemIndex) => itemIndex === index ? { ...item, fullName: event.target.value } : item))} /></label>
                <label className="demoField"><span>Email</span><input value={member.email} onChange={(event) => setTeam(team.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item))} /></label>
                <label className="demoField"><span>Phone</span><input value={member.phone} onChange={(event) => setTeam(team.map((item, itemIndex) => itemIndex === index ? { ...item, phone: event.target.value } : item))} /></label>
                <label className="demoField"><span>Role</span><select value={member.role} onChange={(event) => setTeam(team.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value as User['role'] } : item))}><option>Owner</option><option>Admin</option><option>Coordinator</option><option>Caregiver</option></select></label>
              </div>
            ))}
            <button type="button" className="button secondaryButton" onClick={() => setTeam([...team, { id: `invite-${Date.now()}`, fullName: '', email: '', phone: '', role: 'Caregiver' }])}>Add teammate</button>
          </div>
        </DashboardCard>
      ) : null}

      {step === 2 ? (
        <DashboardCard title="Step 3 · Add clients">
          <div className="stackGrid">
            {draftClients.map((client, index) => (
              <div key={client.id} className="formGridTwo onboardingRowCard">
                <label className="demoField"><span>Client name</span><input value={client.clientName} onChange={(event) => setDraftClients(draftClients.map((item, itemIndex) => itemIndex === index ? { ...item, clientName: event.target.value } : item))} /></label>
                <label className="demoField"><span>Primary address</span><input value={client.primaryAddress} onChange={(event) => setDraftClients(draftClients.map((item, itemIndex) => itemIndex === index ? { ...item, primaryAddress: event.target.value } : item))} /></label>
                <label className="demoField"><span>Family contact</span><input value={client.primaryFamilyContact} onChange={(event) => setDraftClients(draftClients.map((item, itemIndex) => itemIndex === index ? { ...item, primaryFamilyContact: event.target.value } : item))} /></label>
                <label className="demoField"><span>Risk notes</span><input value={client.careRiskNotes ?? ''} onChange={(event) => setDraftClients(draftClients.map((item, itemIndex) => itemIndex === index ? { ...item, careRiskNotes: event.target.value } : item))} /></label>
              </div>
            ))}
            <button type="button" className="button secondaryButton" onClick={() => setDraftClients([...draftClients, { id: `draft-client-${Date.now()}`, clientName: '', primaryAddress: '', primaryFamilyContact: '', phone: '', email: '' }])}>Add client row</button>
          </div>
        </DashboardCard>
      ) : null}

      {step === 3 ? (
        <DashboardCard title="Step 4 · Add caregivers">
          <div className="stackGrid">
            {draftCaregivers.map((caregiver, index) => (
              <div key={caregiver.id} className="formGridTwo onboardingRowCard">
                <label className="demoField"><span>Caregiver name</span><input value={caregiver.caregiverName} onChange={(event) => setDraftCaregivers(draftCaregivers.map((item, itemIndex) => itemIndex === index ? { ...item, caregiverName: event.target.value } : item))} /></label>
                <label className="demoField"><span>Email</span><input value={caregiver.email} onChange={(event) => setDraftCaregivers(draftCaregivers.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item))} /></label>
                <label className="demoField"><span>Phone</span><input value={caregiver.phone} onChange={(event) => setDraftCaregivers(draftCaregivers.map((item, itemIndex) => itemIndex === index ? { ...item, phone: event.target.value } : item))} /></label>
                <label className="demoField"><span>Availability</span><input value={caregiver.availability} onChange={(event) => setDraftCaregivers(draftCaregivers.map((item, itemIndex) => itemIndex === index ? { ...item, availability: event.target.value } : item))} /></label>
              </div>
            ))}
            <button type="button" className="button secondaryButton" onClick={() => setDraftCaregivers([...draftCaregivers, { id: `draft-caregiver-${Date.now()}`, caregiverName: '', phone: '', email: '', availability: '', skillsTags: '' }])}>Add caregiver row</button>
          </div>
        </DashboardCard>
      ) : null}

      {step === 4 ? (
        <DashboardCard title="Step 5 · Create care plan template">
          <div className="stackGrid">
            {templates.map((template, index) => (
              <div key={template.id} className="formGridTwo onboardingRowCard">
                <label className="demoField"><span>Care plan name</span><input value={template.carePlanName} onChange={(event) => setTemplates(templates.map((item, itemIndex) => itemIndex === index ? { ...item, carePlanName: event.target.value } : item))} /></label>
                <label className="demoField"><span>Visit frequency</span><input value={template.visitFrequency} onChange={(event) => setTemplates(templates.map((item, itemIndex) => itemIndex === index ? { ...item, visitFrequency: event.target.value } : item))} /></label>
                <label className="demoField"><span>Default checklist tasks</span><input value={template.defaultChecklistTasks.join(', ')} onChange={(event) => setTemplates(templates.map((item, itemIndex) => itemIndex === index ? { ...item, defaultChecklistTasks: event.target.value.split(',').map((task) => task.trim()).filter(Boolean) } : item))} /></label>
                <label className="demoField"><span>Special instructions</span><input value={template.specialInstructions} onChange={(event) => setTemplates(templates.map((item, itemIndex) => itemIndex === index ? { ...item, specialInstructions: event.target.value } : item))} /></label>
              </div>
            ))}
          </div>
        </DashboardCard>
      ) : null}

      {step === 5 ? (
        <DashboardCard title="Step 6 · Schedule first visits">
          <div className="stackGrid">
            {scheduledVisits.map((visit, index) => (
              <div key={visit.id} className="formGridTwo onboardingRowCard">
                <label className="demoField"><span>Client</span><select value={visit.clientId} onChange={(event) => setScheduledVisits(scheduledVisits.map((item, itemIndex) => itemIndex === index ? { ...item, clientId: event.target.value } : item))}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
                <label className="demoField"><span>Caregiver</span><select value={visit.caregiverId} onChange={(event) => setScheduledVisits(scheduledVisits.map((item, itemIndex) => itemIndex === index ? { ...item, caregiverId: event.target.value } : item))}>{caregivers.map((caregiver) => <option key={caregiver.id} value={caregiver.id}>{caregiver.name}</option>)}</select></label>
                <label className="demoField"><span>Date/time</span><input type="datetime-local" value={visit.dateTime} onChange={(event) => setScheduledVisits(scheduledVisits.map((item, itemIndex) => itemIndex === index ? { ...item, dateTime: event.target.value } : item))} /></label>
                <label className="demoField"><span>Care plan</span><select value={visit.carePlanId} onChange={(event) => setScheduledVisits(scheduledVisits.map((item, itemIndex) => itemIndex === index ? { ...item, carePlanId: event.target.value } : item))}>{carePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name ?? plan.id}</option>)}</select></label>
              </div>
            ))}
          </div>
        </DashboardCard>
      ) : null}

      {step === 6 ? (
        <DashboardCard title="Step 7 · Review and launch">
          <div className="cardGridThree">
            <StatCard label="Team count" value={team.length} />
            <StatCard label="Clients count" value={draftClients.length} />
            <StatCard label="Caregivers count" value={draftCaregivers.length} />
            <StatCard label="Care plans count" value={templates.length} />
            <StatCard label="Scheduled visits count" value={scheduledVisits.length} />
          </div>
          <div className="stackGrid compactStack">
            {onboardingChecklist.map((item) => (
              <div key={item.id} className="miniSummaryCard miniSummaryTight">
                <strong>{item.label}</strong>
                <StatusBadge status={item.completed ? 'Completed' : 'Scheduled'} />
              </div>
            ))}
          </div>
        </DashboardCard>
      ) : null}

      <div className="inlineActions">
        <button type="button" className="button ghostButton" onClick={persistStep}>Save draft</button>
        {step > 0 ? <button type="button" className="button secondaryButton" onClick={() => setStep(step - 1)}>Back</button> : null}
        {step < steps.length - 1 ? <button type="button" className="button primaryButton" onClick={() => { persistStep(); setStep(step + 1); }}>Next step</button> : null}
        {step === steps.length - 1 ? <button type="button" className="button primaryButton" onClick={() => { persistStep(); completeOnboarding(); }}>Launch dashboard</button> : null}
      </div>
    </AppShell>
  );
}

export function UserManagementScreen() {
  const { users, inviteUser, updateUserRole, updateUserStatus } = useDemoStore();
  const [roleFilter, setRoleFilter] = useState<'All' | User['role']>('All');
  const [invite, setInvite] = useState({ fullName: '', email: '', phone: '', role: 'Coordinator' as User['role'] });
  const [inviteMessage, setInviteMessage] = useState('');
  const filtered = roleFilter === 'All' ? users : users.filter((user) => user.role === roleFilter);
  const activeUsers = users.filter((user) => (user.status ?? 'Active') === 'Active').length;
  const invitedUsers = users.filter((user) => user.status === 'Invited').length;
  const inactiveUsers = users.filter((user) => user.status === 'Inactive').length;
  const caregiverUsers = users.filter((user) => user.role === 'Caregiver').length;

  return (
    <AppShell title="Users and roles" subtitle="Invite staff, adjust roles, and control who can participate in the pilot." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Active users" value={activeUsers} tone="positive" />
        <StatCard label="Pending invites" value={invitedUsers} tone={invitedUsers ? 'warning' : 'neutral'} />
        <StatCard label="Inactive users" value={inactiveUsers} tone={inactiveUsers ? 'warning' : 'positive'} />
        <StatCard label="Caregiver users" value={caregiverUsers} tone="info" />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Team directory">
          <div className="inlineActions">
            <label className="demoField compactField">
              <span>Filter by role</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'All' | User['role'])}>
                {['All', 'Owner', 'Admin', 'Coordinator', 'Caregiver', 'Family'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <DataTable
            columns={['User', 'Role', 'Status', 'Last active', 'Actions']}
            rows={filtered.map((user) => [
              user.name,
              <select key="role" value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value as User['role'])}>{['Owner', 'Admin', 'Coordinator', 'Caregiver', 'Family'].map((option) => <option key={option}>{option}</option>)}</select>,
              <select key="status" value={user.status ?? 'Active'} onChange={(event) => updateUserStatus(user.id, event.target.value as NonNullable<User['status']>)}>{['Active', 'Inactive', 'Invited'].map((option) => <option key={option}>{option}</option>)}</select>,
              user.lastActive ?? '—',
              <button key="action" type="button" className="textAction" onClick={() => updateUserStatus(user.id, 'Invited')}>Resend invite</button>,
            ])}
          />
        </DashboardCard>
        <DashboardCard title="Invite user">
          <div className="formStack">
            {inviteMessage ? <p className="demoRequestMessage">{inviteMessage}</p> : null}
            <label className="demoField"><span>Full name</span><input value={invite.fullName} onChange={(event) => setInvite({ ...invite, fullName: event.target.value })} /></label>
            <label className="demoField"><span>Email</span><input value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></label>
            <label className="demoField"><span>Phone</span><input value={invite.phone} onChange={(event) => setInvite({ ...invite, phone: event.target.value })} /></label>
            <label className="demoField"><span>Role</span><select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as User['role'] })}>{['Owner', 'Admin', 'Coordinator', 'Caregiver', 'Family'].map((option) => <option key={option}>{option}</option>)}</select></label>
            <button type="button" className="button primaryButton" onClick={() => {
              const result = inviteUser(invite);
              setInviteMessage(result.ok ? 'Invite created in demo mode.' : Object.values(result.errors ?? {}).join(' '));
              if (result.ok) setInvite({ fullName: '', email: '', phone: '', role: 'Coordinator' });
            }}>
              Invite user
            </button>
          </div>
        </DashboardCard>
      </div>
    </AppShell>
  );
}

export function CarePlanBuilderScreen() {
  const { clients, upsertCarePlan } = useDemoStore();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [name, setName] = useState('New care plan');
  const [visitFrequency, setVisitFrequency] = useState('Weekdays');
  const [specialInstructions, setSpecialInstructions] = useState('Document any care issue that needs coordinator review.');
  const [tasks, setTasks] = useState<CarePlanTaskDefinition[]>([
    { id: 'task-1', taskName: 'Meal support', required: true, familyVisible: true, noteRequired: false, order: 1 },
    { id: 'task-2', taskName: 'Medication reminder', required: true, familyVisible: true, noteRequired: true, order: 2 },
  ]);

  return (
    <AppShell title="Care plan builder" subtitle="Configure visit frequency, checklist tasks, special instructions, and family-visible items." navItems={consoleLinks}>
      <DashboardCard title="Care plan setup">
        <div className="formGridTwo">
          <label className="demoField"><span>Care plan name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="demoField"><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label className="demoField"><span>Visit frequency</span><input value={visitFrequency} onChange={(event) => setVisitFrequency(event.target.value)} /></label>
          <label className="demoField"><span>Special instructions</span><input value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} /></label>
        </div>
        <div className="stackGrid">
          {tasks.map((task, index) => (
            <div key={task.id} className="carePlanTaskRow">
              <input value={task.taskName} onChange={(event) => setTasks(tasks.map((item, itemIndex) => itemIndex === index ? { ...item, taskName: event.target.value } : item))} />
              <label><input type="checkbox" checked={task.required} onChange={(event) => setTasks(tasks.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))} /> Required</label>
              <label><input type="checkbox" checked={task.familyVisible} onChange={(event) => setTasks(tasks.map((item, itemIndex) => itemIndex === index ? { ...item, familyVisible: event.target.checked } : item))} /> Family visible</label>
              <label><input type="checkbox" checked={task.noteRequired} onChange={(event) => setTasks(tasks.map((item, itemIndex) => itemIndex === index ? { ...item, noteRequired: event.target.checked } : item))} /> Note required</label>
            </div>
          ))}
        </div>
        <div className="inlineActions">
          <button type="button" className="button secondaryButton" onClick={() => setTasks([...tasks, { id: `task-${Date.now()}`, taskName: 'New task', required: false, familyVisible: true, noteRequired: false, order: tasks.length + 1 }])}>Add task</button>
          <button type="button" className="button primaryButton" onClick={() => upsertCarePlan({ clientId, name, visitFrequency, specialInstructions: [specialInstructions], taskDefinitions: tasks })}>Save care plan</button>
        </div>
      </DashboardCard>
    </AppShell>
  );
}

function defaultScheduleDateTime(hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleScreen() {
  const { clients, caregivers, carePlans, visits, checkScheduleConflicts, scheduleVisit, showToast } = useDemoStore();
  const [form, setForm] = useState<{
    clientId: string;
    caregiverId: string;
    carePlanId: string;
    scheduledStart: string;
    scheduledEnd: string;
    repeatRule: 'none' | 'daily' | 'weekly' | 'weekdays';
    notesForCaregiver: string;
    familyUpdateEnabled: boolean;
  }>({
    clientId: clients[0]?.id ?? '',
    caregiverId: caregivers[0]?.id ?? '',
    carePlanId: carePlans[0]?.id ?? '',
    scheduledStart: defaultScheduleDateTime(9),
    scheduledEnd: defaultScheduleDateTime(10),
    repeatRule: 'none' as const,
    notesForCaregiver: '',
    familyUpdateEnabled: true,
  });
  const conflicts = checkScheduleConflicts(form);
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const selectedCaregiver = caregivers.find((caregiver) => caregiver.id === form.caregiverId);
  const selectedCarePlan = carePlans.find((plan) => plan.id === form.carePlanId);

  return (
    <AppShell title="Schedule visits" subtitle="Create the first live visits, review conflicts, and override carefully when needed in demo mode." navItems={consoleLinks}>
      <DashboardCard title="Scheduling context">
        <div className="ownerBriefGrid">
          <div className="ownerBriefCard">
            <span>Selected client</span>
            <strong>{selectedClient?.name ?? '—'}</strong>
            <p>{selectedClient?.address ?? 'Choose a client before scheduling.'}</p>
          </div>
          <div className="ownerBriefCard">
            <span>Assigned caregiver</span>
            <strong>{selectedCaregiver?.name ?? '—'}</strong>
            <p>{selectedCaregiver?.availability ?? 'Review availability before saving.'}</p>
          </div>
          <div className="ownerBriefCard">
            <span>Existing visits</span>
            <strong>{visits.filter((visit) => visit.scheduledDay === 'Today').length}</strong>
            <p>visits already scheduled today; conflict checks run before save</p>
          </div>
        </div>
      </DashboardCard>
      <div className="dashboardSplit">
        <DashboardCard title="Create visit">
          <div className="formGridTwo">
            <label className="demoField"><span>Client</span><select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="demoField"><span>Caregiver</span><select value={form.caregiverId} onChange={(event) => setForm({ ...form, caregiverId: event.target.value })}>{caregivers.map((caregiver) => <option key={caregiver.id} value={caregiver.id}>{caregiver.name}</option>)}</select></label>
            <label className="demoField"><span>Care plan</span><select value={form.carePlanId} onChange={(event) => setForm({ ...form, carePlanId: event.target.value })}>{carePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name ?? plan.id}</option>)}</select></label>
            <label className="demoField"><span>Repeat rule</span><select value={form.repeatRule} onChange={(event) => setForm({ ...form, repeatRule: event.target.value as 'none' | 'daily' | 'weekly' | 'weekdays' })}><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="weekdays">Weekdays</option></select></label>
            <label className="demoField"><span>Scheduled start</span><input type="datetime-local" value={form.scheduledStart} onChange={(event) => setForm({ ...form, scheduledStart: event.target.value })} /></label>
            <label className="demoField"><span>Scheduled end</span><input type="datetime-local" value={form.scheduledEnd} onChange={(event) => setForm({ ...form, scheduledEnd: event.target.value })} /></label>
            <label className="demoField"><span>Family update</span><select value={form.familyUpdateEnabled ? 'enabled' : 'disabled'} onChange={(event) => setForm({ ...form, familyUpdateEnabled: event.target.value === 'enabled' })}><option value="enabled">Enabled after approval</option><option value="disabled">Disabled</option></select></label>
            <div className="miniSummaryCard">
              <strong>Checklist source</strong>
              <p>{selectedCarePlan?.taskDefinitions?.length ?? selectedCarePlan?.tasks.length ?? 0} tasks will be copied from the selected care plan.</p>
            </div>
            <label className="demoField fieldSpanTwo"><span>Notes for caregiver</span><textarea rows={3} value={form.notesForCaregiver} onChange={(event) => setForm({ ...form, notesForCaregiver: event.target.value })} /></label>
          </div>
          <div className="inlineActions">
            <button
              type="button"
              className="button secondaryButton"
              onClick={() => {
                const result = scheduleVisit(form);
                if (!result.ok) showToast(result.message);
              }}
            >
              Schedule visit
            </button>
            <button type="button" className="button primaryButton" onClick={() => scheduleVisit({ ...form, overrideConflicts: true })}>Override and schedule</button>
          </div>
        </DashboardCard>
        <DashboardCard title="Conflict check">
          {conflicts.length ? (
            <div className="stackGrid">
              {conflicts.map((conflict) => (
                <div key={`${conflict.type}-${conflict.conflictingVisitId ?? 'none'}`} className="alertRow">
                  <div>
                    <strong>{conflict.type.replace(/_/g, ' ')}</strong>
                    <p>{conflict.message}</p>
                  </div>
                  {conflict.conflictingVisitId ? <Link className="textAction" href={`/console/visits/${conflict.conflictingVisitId}`}>View visit</Link> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No conflicts detected" text="The selected schedule window is clear." />
          )}
        </DashboardCard>
      </div>
    </AppShell>
  );
}

export function ImportScreen() {
  const { importJobs, previewCsvImport, commitCsvImport } = useDemoStore();
  const sampleCsvByType: Record<ImportJob['type'], string> = {
    clients: 'name,address,phone,familyName,familyEmail,familyPhone,riskNotes\nRuth Williams,12 Oak Street,(555) 310-2001,Sarah Williams,sarah@example.com,(555) 410-1000,Fall risk',
    caregivers: 'name,email,phone,availability,skills\nNora Adams,nora@example.com,(555) 410-2211,Weekdays 8 AM-4 PM,meal support|mobility support',
    'family-members': 'clientName,name,relationship,email,phone,weeklyReportsEnabled\nMaria Johnson,Emily Johnson,Daughter,emily@example.com,(555) 410-1001,true',
    visits: 'clientName,caregiverName,scheduledStart,scheduledEnd,carePlanName\nMaria Johnson,Ana Smith,2026-05-13T09:00,2026-05-13T10:00,Morning care plan',
  };
  const requiredColumnsByType: Record<ImportJob['type'], string[]> = {
    clients: ['name', 'address', 'phone', 'familyName', 'familyEmail', 'familyPhone', 'riskNotes'],
    caregivers: ['name', 'email', 'phone', 'availability', 'skills'],
    'family-members': ['clientName', 'name', 'relationship', 'email', 'phone', 'weeklyReportsEnabled'],
    visits: ['clientName', 'caregiverName', 'scheduledStart', 'scheduledEnd', 'carePlanName'],
  };
  const [type, setType] = useState<ImportJob['type']>('clients');
  const [csv, setCsv] = useState(sampleCsvByType.clients);
  const [importMessage, setImportMessage] = useState('');
  const preview = previewCsvImport(type, csv);
  const validRows = preview.filter((row) => row.valid).length;
  const invalidRows = preview.length - validRows;

  return (
    <AppShell title="CSV import" subtitle="Preview rows, catch errors early, and bulk onboard clients, caregivers, family members, or visits." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Parsed rows" value={preview.length} tone="info" />
        <StatCard label="Valid rows" value={validRows} tone={validRows ? 'positive' : 'neutral'} />
        <StatCard label="Rows needing review" value={invalidRows} tone={invalidRows ? 'warning' : 'positive'} />
        <StatCard label="Import jobs" value={importJobs.length} />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Import preview">
          <div className="formStack">
            {importMessage ? <p className="demoRequestMessage">{importMessage}</p> : null}
            <label className="demoField">
              <span>Import type</span>
              <select
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value as ImportJob['type'];
                  setType(nextType);
                  setCsv(sampleCsvByType[nextType]);
                  setImportMessage('');
                }}
              >
                <option value="clients">Clients</option>
                <option value="caregivers">Caregivers</option>
                <option value="family-members">Family members</option>
                <option value="visits">Visits</option>
              </select>
            </label>
            <div className="miniSummaryCard">
              <strong>Required columns</strong>
              <p>{requiredColumnsByType[type].join(', ')}</p>
            </div>
            <label className="demoField"><span>Paste CSV</span><textarea rows={10} value={csv} onChange={(event) => setCsv(event.target.value)} /></label>
            <div className="inlineActions">
              <button type="button" className="button secondaryButton" onClick={() => void navigator.clipboard?.writeText(csv)}>Copy sample CSV</button>
              <button
                type="button"
                className="button primaryButton"
                disabled={!validRows}
                onClick={() => {
                  const result = commitCsvImport(type, preview);
                  setImportMessage(`${result.imported} row${result.imported === 1 ? '' : 's'} imported. ${result.failed} row${result.failed === 1 ? '' : 's'} skipped.`);
                }}
              >
                Import valid rows
              </button>
            </div>
          </div>
        </DashboardCard>
        <DashboardCard title="Parsed rows">
          {preview.length ? (
            <div className="stackGrid">
              {preview.map((row) => (
                <div key={row.rowNumber} className="miniSummaryCard">
                  <div className="aiRiskSignalTop">
                    <strong>Row {row.rowNumber}</strong>
                    <StatusBadge status={row.valid ? 'Completed' : 'Needs Review'} />
                  </div>
                  <p>{Object.values(row.values).join(' · ')}</p>
                  {row.errors.length ? <ul className="featureList">{row.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No rows parsed yet" text="Paste CSV content to validate and preview the import." />
          )}
        </DashboardCard>
      </div>
      <DashboardCard title="Import job history">
        <DataTable
          columns={['Type', 'Rows', 'Success', 'Failed', 'Status', 'Created']}
          rows={importJobs.map((job) => [job.type, job.totalRows, job.successRows, job.failedRows, job.status, job.createdAt])}
        />
      </DashboardCard>
    </AppShell>
  );
}

export function CaregiverTodayScreen() {
  const { visits } = useDemoStore();
  const { caregivers, getClient } = useReferenceData();
  const caregiver = caregivers[0];
  const assignedVisits = visits.filter((visit) => visit.caregiverId === caregiver.id);
  const nextVisit = assignedVisits[0];

  return (
    <AppShell title="Caregiver app" subtitle="Open today's visits, check in, complete care tasks, add a note, and check out with a clean visit record." navItems={caregiverTabs} variant="mobile">
      <MobileMockup title="Caregiver app" subtitle="Today's visits" tabs={caregiverTabs}>
        <div className="mobileStatRow">
          <StatCard label="Assigned today" value={assignedVisits.length} />
          <StatCard label="Completed" value={assignedVisits.filter((visit) => getVisitStatus(visit) === 'Completed').length} tone="positive" />
        </div>
        <article className="mobileFeatureCard">
          <p className="moduleLabel">Next visit</p>
          <strong>{nextVisit ? getClient(nextVisit.clientId)?.name : 'No visit assigned'}</strong>
          <p>{nextVisit?.scheduledTime ?? 'No visit scheduled yet'}</p>
          <p>Today&apos;s follow-up: {nextVisit ? getVisitAlert(nextVisit) ?? 'No urgent issue' : 'No assigned visit'}</p>
          <Link className="button primaryButton" href={nextVisit ? `/caregiver/visit/${nextVisit.id}` : '/caregiver/visits'}>
            Start Next Visit
          </Link>
        </article>
        <div className="stackGrid">
          {assignedVisits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} href={`/caregiver/visit/${visit.id}`} />
          ))}
        </div>
      </MobileMockup>
    </AppShell>
  );
}

export function CaregiverVisitsScreen() {
  const { visits } = useDemoStore();
  const assignedVisits = visits.filter((visit) => visit.caregiverId === caregivers[0].id);
  return (
    <AppShell title="Caregiver visits" subtitle="Assigned visits and proof status in one mobile-first list." navItems={caregiverTabs} variant="mobile">
      <MobileMockup title="Assigned visits" subtitle="Visits" tabs={caregiverTabs}>
        <div className="stackGrid">
          {assignedVisits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} href={`/caregiver/visit/${visit.id}`} />
          ))}
        </div>
      </MobileMockup>
    </AppShell>
  );
}

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

export function CaregiverIncidentsScreen() {
  const { incidents } = useDemoStore();
  const myIncidents = incidents.filter((incident) => incident.caregiverId === caregivers[0].id);
  return (
    <AppShell title="Reported incidents" subtitle="See issues raised from caregiver visits." navItems={caregiverTabs} variant="mobile">
      <MobileMockup title="Caregiver incidents" subtitle="Incidents" tabs={caregiverTabs}>
        <div className="stackGrid">
          {myIncidents.length ? myIncidents.map((incident) => (
            <article key={incident.id} className="mobileFeatureCard">
              <strong>{incident.type}</strong>
              <p>{incident.status} · {incident.severity}</p>
            </article>
          )) : <EmptyState title="No incidents" text="No incidents have been reported by this caregiver yet." />}
        </div>
      </MobileMockup>
    </AppShell>
  );
}

export function CaregiverProfileScreen() {
  return (
    <AppShell title="Caregiver profile" subtitle="Assigned work, support state, and demo account context." navItems={caregiverTabs} variant="mobile">
      <MobileMockup title="Caregiver profile" subtitle={caregivers[0].name} tabs={caregiverTabs}>
        <article className="mobileFeatureCard">
          <p>Assigned visits: {caregivers[0].assignedVisits}</p>
          <p>Completed visits: {caregivers[0].completedVisits}</p>
          <p>On-time rate: {caregivers[0].onTimeRate}%</p>
        </article>
      </MobileMockup>
    </AppShell>
  );
}

export function FamilyDashboardScreen() {
  const { visits, familyConcerns, weeklyReports } = useDemoStore();
  const latestVisit = visits[0];
  const client = getClient(latestVisit.clientId);
  const report = weeklyReports[0];
  const openConcern = familyConcerns.find((item) => item.clientId === latestVisit.clientId);
  const visitStatus = getVisitStatus(latestVisit);
  const familyUpdateStatus = getFamilyUpdateStatus(latestVisit);

  return (
    <AppShell title="Family portal" subtitle="Latest visit status, care summary, weekly reports, and concern follow-up in family-safe language." navItems={familyTabs} variant="mobile">
      <MobileMockup title="Family portal" subtitle={client?.name ?? 'Client'} tabs={familyTabs}>
        <article className="mobileFeatureCard familyHeroCard">
          <p className="moduleLabel">Latest visit status</p>
          <strong>{visitStatus === 'Completed' ? 'Visit completed' : `Visit ${visitStatus.toLowerCase()}`}</strong>
          <span className="familyTrustLine">Approved updates only. Internal staff notes are not shown here.</span>
          <p>{latestVisit.careNote?.approvedSummary ?? 'A care summary will appear here after staff review.'}</p>
          <div className="familyStatusGrid">
            <div><span>Scheduled</span><strong>{latestVisit.scheduledTime}</strong></div>
            <div><span>Family update</span><strong>{familyUpdateStatus}</strong></div>
          </div>
        </article>
        <article className="mobileFeatureCard">
          <p className="moduleLabel">Weekly report</p>
          <strong>{report.period}</strong>
          <p>{report.summary}</p>
          <Link className="button secondaryButton" href="/family/reports">View Weekly Report</Link>
        </article>
        <article className="mobileFeatureCard">
          <p className="moduleLabel">Concern status</p>
          <strong>{openConcern ? openConcern.status : 'No open concern'}</strong>
          <p>{openConcern ? openConcern.type : 'If something looks unclear, submit a concern and the agency can respond here.'}</p>
          <Link className="button secondaryButton" href="/family/concerns">Open Concern Center</Link>
        </article>
      </MobileMockup>
    </AppShell>
  );
}

export function FamilyUpdatesScreen() {
  const { visits, weeklyReports } = useDemoStore();
  const mariaVisit = visits.find((visit) => visit.clientId === 'client-maria') ?? visits[0];
  const mariaReport = weeklyReports.find((report) => report.clientId === 'client-maria');
  const visitStatus = getVisitStatus(mariaVisit);
  const approvedSummary = mariaVisit.careNote?.approvedSummary;
  const reportReady = mariaReport ? ['Ready', 'Sent'].includes(mariaReport.status) : false;
  const updateCards = [
    {
      label: 'Visit status',
      message: `${visitStatus === 'Completed' ? 'Visit completed' : `Visit ${visitStatus.toLowerCase()}`} at ${mariaVisit.checkOutTime ?? mariaVisit.startLabel}.`,
    },
    {
      label: approvedSummary ? 'Care summary' : 'Care summary status',
      message: approvedSummary ?? 'Care summary is pending staff review before it appears here.',
    },
    {
      label: 'Weekly report',
      message: reportReady ? `Weekly report ready for ${mariaReport?.period}.` : 'Weekly report is being prepared.',
    },
  ];
  return (
    <AppShell title="Family updates" subtitle="Approved visit updates only, with internal staff notes kept separate." navItems={familyTabs} variant="mobile">
      <MobileMockup title="Family updates" subtitle="Approved updates" tabs={familyTabs}>
        <article className="mobileFeatureCard familyHeroCard">
          <p className="moduleLabel">What family can see</p>
          <strong>Family-safe visit summaries</strong>
          <p>CareProof only shows approved updates, weekly reports marked ready or sent, and responses intended for family members.</p>
        </article>
        <div className="stackGrid">
          {updateCards.map((item) => (
            <article key={`${item.label}-${item.message}`} className="familyNoteCard">
              <span className="statusPill dark">{item.label}</span>
              <p>{item.message}</p>
            </article>
          ))}
        </div>
      </MobileMockup>
    </AppShell>
  );
}

export function FamilyReportsScreen() {
  const { weeklyReports } = useDemoStore();
  const report = weeklyReports[0];
  return (
    <AppShell title="Family reports" subtitle="Weekly summaries, completed visits, and follow-up items in plain language." navItems={familyTabs} variant="mobile">
      <MobileMockup title="Weekly report" subtitle={getClient(report.clientId)?.name ?? 'Client'} tabs={familyTabs}>
        <div className="mobileStatRow">
          <StatCard label="Completed visits" value={report.completedVisits} tone="positive" />
          <StatCard label="Checklist completion" value={report.checklistCompletionRate} tone="info" />
        </div>
        <article className="mobileFeatureCard">
          <strong>{report.period}</strong>
          <ul className="featureList">
            <li>{report.completedVisits} visits completed</li>
            <li>{report.lateOrMissedVisits} late or missed visit</li>
            <li>Checklist completion: {report.checklistCompletionRate}</li>
            <li>{familySafeReportSummary(report.summary)}</li>
          </ul>
        </article>
      </MobileMockup>
    </AppShell>
  );
}

export function FamilyConcernsPortalScreen() {
  const { familyConcerns, submitConcern } = useDemoStore();
  const [category, setCategory] = useState('Question about missed task');
  const [priority, setPriority] = useState<FamilyConcern['priority']>('Medium');
  const [message, setMessage] = useState('');
  const myConcern = familyConcerns.find((concern) => concern.clientId === 'client-maria');
  const familyStatusMessage = myConcern?.responseSent
    ? (myConcern.responseNote ?? 'A family response has been sent.')
    : 'Your concern is being reviewed by the agency team.';

  return (
    <AppShell title="Family concerns" subtitle="Share a concern, choose urgency, and follow the agency response." navItems={familyTabs} variant="mobile">
      <MobileMockup title="Concern form" subtitle="Share a concern" tabs={familyTabs}>
        <article className="mobileFeatureCard familyHeroCard">
          <p className="moduleLabel">Family concern center</p>
          <strong>Your message goes to the agency team</strong>
          <p>Use this for questions about visit updates, schedules, reports, or follow-up. Internal agency notes remain separate.</p>
        </article>
        <article className="mobileFeatureCard">
          <div className="formStack">
            <label className="demoField">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option>Question about missed task</option>
                <option>Request for schedule update</option>
                <option>Concern about late arrival</option>
              </select>
            </label>
            <label className="demoField">
              <span>Urgency</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as FamilyConcern['priority'])}>
                {['Low', 'Medium', 'High'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="demoField">
              <span>Message</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Share what you want the agency team to review." />
            </label>
            <button
              type="button"
              className="button primaryButton"
              onClick={() => submitConcern({ familyMemberId: 'fm-emily', clientId: 'client-maria', type: category, priority, message: message || 'Need clarification on the visit record.' })}
            >
              Submit Concern
            </button>
          </div>
        </article>
        <article className="mobileFeatureCard">
          <p className="moduleLabel">Status tracking</p>
          <strong>{myConcern ? myConcern.status : 'No concern shared yet'}</strong>
          <p>{myConcern ? `${myConcern.type} · ${myConcern.status}` : 'Submit a concern above to track the agency response.'}</p>
          {myConcern ? <p>{familyStatusMessage}</p> : null}
        </article>
      </MobileMockup>
    </AppShell>
  );
}

export function FamilyProfileScreen() {
  return (
    <AppShell title="Family profile" subtitle="Client relationship, communication settings, and current visibility." navItems={familyTabs} variant="mobile">
      <MobileMockup title="Family profile" subtitle={familyMembers[0].name} tabs={familyTabs}>
        <article className="mobileFeatureCard">
          <p>Relationship: {familyMembers[0].relationship}</p>
          <p>Email: {familyMembers[0].email}</p>
          <p>Current visibility: Approved visit summaries and weekly reports</p>
        </article>
      </MobileMockup>
    </AppShell>
  );
}

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

export function ExecutiveDashboardScreen() {
  const { filteredVisits, filteredIncidents, filteredFamilyConcerns, weeklyReports } = useDemoStore();
  const { branches: agencyBranches, getClient } = useReferenceData();
  const health = buildAgencyHealthScore({ visits: filteredVisits, incidents: filteredIncidents, concerns: filteredFamilyConcerns, reports: weeklyReports });
  const branchPerformance = buildBranchPerformance({
    branches: agencyBranches,
    visits: filteredVisits,
    incidents: filteredIncidents,
    concerns: filteredFamilyConcerns,
  });
  const risks = buildClientRiskRecords({
    clients,
    visits: filteredVisits,
    incidents: filteredIncidents,
    concerns: filteredFamilyConcerns,
    reports: weeklyReports,
  }).slice(0, 5);
  const familyHealth = buildFamilyCommunicationHealth({
    concerns: filteredFamilyConcerns,
    reports: weeklyReports,
    visits: filteredVisits,
  });
  const support = buildCaregiverSupportRecords({
    caregivers,
    visits: filteredVisits,
    concerns: filteredFamilyConcerns,
  });
  const operationalMetrics = getOperationalVisitMetrics(filteredVisits);
  const completionRate = `${operationalMetrics.completionRate}%`;
  const onTimeRate = filteredVisits.length ? `${Math.round((filteredVisits.filter((visit) => !['Late', 'Missed'].includes(getVisitDisplayStatus(visit))).length / filteredVisits.length) * 100)}%` : '0%';
  const concernResponseTime = familyHealth.averageResponseTime;
  const weeklyReportsSent = weeklyReports.filter((report) => report.status === 'Sent').length;
  const trends = buildExecutiveTrends({ completionRate, onTimeRate, concernResponseTime, weeklyReportsSent });
  const missedVisits = filteredVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Missed').length;
  const lateVisits = filteredVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Late').length;
  const openIncidents = filteredIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length;
  const openConcerns = filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length;
  const highRiskClients = risks.filter((item) => item.riskLevel === 'High').length;
  const caregiversNeedingSupport = support.filter((item) => item.supportSignal !== 'No urgent support signal').length;
  const readyReports = weeklyReports.filter((report) => report.status === 'Ready').length;
  const ownerBrief = [
    {
      label: 'Reliability',
      value: `${operationalMetrics.completedCount}/${operationalMetrics.closedCount || 0}`,
      detail: 'closed visits have complete proof',
      href: '/console/operations',
    },
    {
      label: 'Family trust',
      value: openConcerns,
      detail: 'open family concerns need response',
      href: '/console/family-concerns',
    },
    {
      label: 'Records ready',
      value: `${weeklyReportsSent} sent · ${readyReports} ready`,
      detail: 'weekly reports are available for review',
      href: '/console/reports',
    },
  ];
  const ownerActions = [
    {
      title: 'Respond to open family concerns',
      detail: `${openConcerns} concern${openConcerns === 1 ? '' : 's'} still need a family-facing response or resolution.`,
      href: '/console/family-concerns',
      status: openConcerns ? 'Needs Review' : 'Completed',
    },
    {
      title: 'Review incident follow-up',
      detail: `${openIncidents} incident${openIncidents === 1 ? '' : 's'} remain open across the current demo period.`,
      href: '/console/incidents',
      status: openIncidents ? 'Needs Review' : 'Completed',
    },
    {
      title: 'Send ready weekly reports',
      detail: `${readyReports} report${readyReports === 1 ? '' : 's'} are ready but not yet sent.`,
      href: '/console/reports',
      status: readyReports ? 'Ready' : 'Completed',
    },
    {
      title: 'Check caregiver support signals',
      detail: `${caregiversNeedingSupport} caregiver${caregiversNeedingSupport === 1 ? '' : 's'} show documentation or schedule support needs.`,
      href: '/console/caregiver-support',
      status: caregiversNeedingSupport ? 'Needs Review' : 'Completed',
    },
  ];

  return (
    <AppShell title="Executive dashboard" subtitle="Is the agency operating reliably? Review service reliability, family communication health, branch performance, and owner follow-up from one view." navItems={consoleLinks}>
      <DashboardCard title="Owner brief">
        <div className="ownerBriefGrid">
          {ownerBrief.map((item) => (
            <Link key={item.label} href={item.href} className="ownerBriefCard">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </Link>
          ))}
        </div>
      </DashboardCard>

      <div className="statsGrid">
        <StatCard label="Total visits this week" value={filteredVisits.length} />
        <StatCard label="Visit completion rate" value={completionRate} tone="positive" />
        <StatCard label="On-time check-in rate" value={onTimeRate} tone="info" />
        <StatCard label="Missed visits" value={missedVisits} tone="danger" />
        <StatCard label="Late visits" value={lateVisits} tone="warning" />
        <StatCard label="Open incidents" value={openIncidents} tone="warning" />
        <StatCard label="Open family concerns" value={openConcerns} tone="warning" />
        <StatCard label="Avg concern response time" value={concernResponseTime} tone="info" />
        <StatCard label="Weekly reports sent" value={weeklyReportsSent} tone="positive" />
        <StatCard label="Clients at risk" value={highRiskClients} tone="warning" />
        <StatCard label="Caregivers needing support" value={caregiversNeedingSupport} tone="warning" />
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Agency health score">
          <div className="executiveHealthLayout">
            <div className="readinessScoreCard">
              <strong>{health.score}</strong>
              <span>{health.status}</span>
            </div>
            <div className="miniSummaryCard">
              <strong>What drives the score</strong>
              <p>Visit proof, late or missed visits, open incidents, family concerns, and weekly report readiness.</p>
            </div>
          </div>
          <ul className="featureList">
            {health.drivers.map((driver) => <li key={driver}>{driver}</li>)}
          </ul>
        </DashboardCard>
        <DashboardCard title="Trend indicators">
          <div className="stackGrid">
            {trends.map((trend) => (
              <div key={trend.label} className="miniSummaryCard">
                <div className="aiRiskSignalTop">
                  <strong>{trend.label}</strong>
                  <StatusBadge status={trend.direction === 'up' ? 'Completed' : 'Needs Review'} />
                </div>
                <p><strong>{trend.value}</strong> · {trend.changeLabel}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <div className="dashboardSplit">
        <DashboardCard title="Top risks this week">
          <div className="stackGrid">
            {risks.map((risk) => (
              <div key={risk.clientId} className="miniSummaryCard">
                <div className="aiRiskSignalTop">
                  <strong>{getClient(risk.clientId)?.name}</strong>
                  <StatusBadge status={risk.riskLevel} />
                </div>
                <p>{risk.reason}</p>
                <p><strong>Recommended:</strong> {risk.recommendedAction}</p>
                <Link className="textAction" href={`/console/clients/${risk.clientId}`}>Open client record</Link>
              </div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="Owner next actions">
          <div className="stackGrid">
            {ownerActions.map((item) => (
              <div key={item.title} className="miniSummaryCard">
                <div className="aiRiskSignalTop">
                  <strong>{item.title}</strong>
                  <StatusBadge status={item.status} />
                </div>
                <p>{item.detail}</p>
                <Link className="textAction" href={item.href}>Open workflow</Link>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      <DashboardCard title="Branch and team performance">
        <DataTable
          columns={['Branch', 'Visits completed', 'Late / missed', 'Open incidents', 'Open concerns', 'Score', 'Action']}
          rows={branchPerformance.map((branch) => [
            branch.name,
            branch.visitsCompleted,
            branch.lateOrMissed,
            branch.openIncidents,
            branch.openConcerns,
            `${branch.score} · ${branch.status}`,
            <Link key="action" className="textAction" href={`/console/branches/${branch.branchId}`}>View branch</Link>,
          ])}
        />
      </DashboardCard>

      <DashboardCard title="Management report actions">
        <div className="inlineActions">
          <Link className="button secondaryButton" href="/console/reports">Generate executive weekly summary</Link>
          <Link className="button secondaryButton" href="/console/client-risk">Review client risk</Link>
          <Link className="button secondaryButton" href="/console/billing">Open billing readiness</Link>
          <Link className="button secondaryButton" href="/console/caregiver-support">Review caregiver support</Link>
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function BranchesScreen() {
  const { branches: agencyBranches, users } = useReferenceData();
  const { visits, incidents, familyConcerns, clients, caregivers } = useDemoStore();
  const performance = buildBranchPerformance({ branches: agencyBranches, visits, incidents, concerns: familyConcerns });
  return (
    <AppShell title="Branches" subtitle="Multi-location performance, open risks, and branch-level operating health." navItems={consoleLinks}>
      <DataTable
        columns={['Branch', 'Manager', 'Active clients', 'Caregivers', 'Visits this week', 'Open incidents', 'Open concerns', 'Health', 'Action']}
        rows={agencyBranches.map((branch) => {
          const branchPerformance = performance.find((item) => item.branchId === branch.id);
          return [
            branch.name,
            users.find((user) => user.id === branch.managerId)?.name ?? '—',
            clients.filter((client) => client.branchId === branch.id).length,
            caregivers.filter((caregiver) => caregiver.branchId === branch.id).length,
            visits.filter((visit) => visit.branchId === branch.id).length,
            incidents.filter((incident) => incident.branchId === branch.id && !['Resolved', 'Closed'].includes(incident.status)).length,
            familyConcerns.filter((concern) => concern.branchId === branch.id && !['Resolved', 'Closed'].includes(concern.status)).length,
            `${branchPerformance?.score ?? 0} · ${branchPerformance?.status ?? 'Watch'}`,
            <Link key="action" className="textAction" href={`/console/branches/${branch.id}`}>View branch</Link>,
          ];
        })}
      />
    </AppShell>
  );
}

export function BranchDetailScreen({ branchId }: { branchId: string }) {
  const { visits, incidents, familyConcerns, clients, caregivers, weeklyReports, users } = useDemoStore();
  const branch = getBranch(branchId);
  if (!branch) {
    return <AppShell title="Branch not found" subtitle="The requested branch does not exist." navItems={consoleLinks}><EmptyState title="Branch not found" text="Open a valid branch from the branches list." /></AppShell>;
  }
  const branchVisits = visits.filter((visit) => visit.branchId === branch.id);
  const branchClients = clients.filter((client) => client.branchId === branch.id);
  const branchCaregivers = caregivers.filter((caregiver) => caregiver.branchId === branch.id);
  const branchIncidents = incidents.filter((incident) => incident.branchId === branch.id);
  const branchConcerns = familyConcerns.filter((concern) => concern.branchId === branch.id);
  const branchReports = weeklyReports.filter((report) => report.branchId === branch.id);
  const health = buildAgencyHealthScore({ visits: branchVisits, incidents: branchIncidents, concerns: branchConcerns, reports: branchReports });
  return (
    <AppShell title={branch.name} subtitle="Branch performance, visit reliability, incidents, concerns, and report completion." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Clients" value={branchClients.length} />
        <StatCard label="Caregivers" value={branchCaregivers.length} />
        <StatCard label="Visits this week" value={branchVisits.length} />
        <StatCard label="Open incidents" value={branchIncidents.filter((incident) => !['Resolved', 'Closed'].includes(incident.status)).length} tone="warning" />
        <StatCard label="Open concerns" value={branchConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status)).length} tone="warning" />
        <StatCard label="Health score" value={`${health.score} · ${health.status}`} tone={health.status === 'Healthy' ? 'positive' : health.status === 'Watch' ? 'warning' : 'danger'} />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Overview">
          <div className="detailFactGrid">
            <div><span>Manager</span><strong>{users.find((user) => user.id === branch.managerId)?.name ?? '—'}</strong></div>
            <div><span>Phone</span><strong>{branch.phone}</strong></div>
            <div><span>Timezone</span><strong>{branch.timezone}</strong></div>
            <div><span>Status</span><strong>{branch.active ? 'Active' : 'Inactive'}</strong></div>
          </div>
        </DashboardCard>
        <DashboardCard title="Reports and exceptions">
          <ul className="featureList">
            <li>{branchReports.filter((report) => report.status === 'Sent').length} weekly reports sent</li>
            <li>{branchVisits.filter((visit) => ['Late', 'Missed'].includes(getVisitDisplayStatus(visit))).length} late or missed visits</li>
            <li>{branchConcerns.filter((concern) => concern.status === 'Follow-up Assigned').length} concerns still assigned for follow-up</li>
          </ul>
        </DashboardCard>
      </div>
      <DashboardCard title="Branch detail tabs">
        <div className="cardGridThree">
          <div className="miniSummaryCard"><strong>Clients</strong><p>{branchClients.map((client) => client.name).join(', ')}</p></div>
          <div className="miniSummaryCard"><strong>Caregivers</strong><p>{branchCaregivers.map((caregiver) => caregiver.name).join(', ')}</p></div>
          <div className="miniSummaryCard"><strong>Visits</strong><p>{branchVisits.length} visit records in the current demo period.</p></div>
          <div className="miniSummaryCard"><strong>Incidents</strong><p>{branchIncidents.length} incident records.</p></div>
          <div className="miniSummaryCard"><strong>Reports</strong><p>{branchReports.length} weekly reports.</p></div>
          <div className="miniSummaryCard"><strong>Settings</strong><p>Branch-level rules can follow agency defaults in demo mode.</p></div>
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function ClientRiskScreen() {
  const { visits, incidents, familyConcerns, weeklyReports, markClientRiskReviewed, clientRiskReviews } = useDemoStore();
  const { clients: branchClients, getClient, getCaregiver, getBranch } = useReferenceData();
  const records = buildClientRiskRecords({
    clients: branchClients,
    visits,
    incidents,
    concerns: familyConcerns,
    reports: weeklyReports,
  });
  return (
    <AppShell title="Client risk" subtitle="Spot repeated service breakdowns early and assign operational follow-up before dissatisfaction grows." navItems={consoleLinks}>
      <DataTable
        columns={['Client', 'Branch', 'Assigned caregiver', 'Risk', 'Reason', 'Last concern', 'Last incident', 'Recommended action', 'Review']}
        rows={records.map((record) => [
          getClient(record.clientId)?.name ?? '—',
          getBranch(record.branchId ?? '')?.name ?? '—',
          getCaregiver(record.assignedCaregiverId ?? '')?.name ?? 'Unassigned',
          <StatusBadge key="risk" status={record.riskLevel} />,
          record.reason,
          record.lastConcern ?? '—',
          record.lastIncident ?? '—',
          record.recommendedAction,
          <button key="review" type="button" className="textAction" onClick={() => markClientRiskReviewed(record.clientId)}>
            {clientRiskReviews[record.clientId] ? 'Reviewed' : 'Mark reviewed'}
          </button>,
        ])}
      />
    </AppShell>
  );
}

export function FamilyHealthScreen() {
  const { filteredFamilyConcerns, weeklyReports, filteredVisits, updateConcern } = useDemoStore();
  const health = buildFamilyCommunicationHealth({ concerns: filteredFamilyConcerns, reports: weeklyReports, visits: filteredVisits });
  const familiesNeedingAttention = filteredFamilyConcerns.filter((concern) => !['Resolved', 'Closed'].includes(concern.status));
  return (
    <AppShell title="Family communication health" subtitle="Track update coverage, concern response times, and families who still need follow-up." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Family updates sent" value={filteredVisits.filter((visit) => getFamilyUpdateStatus(visit) === 'Sent').length} tone="positive" />
        <StatCard label="Approval required" value={nurseApprovals.filter((item) => item.blocksFamilyVisibility && item.status !== 'Approved').length} tone="warning" />
        <StatCard label="Weekly reports sent" value={health.sentReports} tone="positive" />
        <StatCard label="Open family concerns" value={health.open} tone="warning" />
        <StatCard label="Overdue concerns" value={health.overdue} tone="danger" />
        <StatCard label="Average response time" value={health.averageResponseTime} tone="info" />
        <StatCard label="No recent update" value={health.noRecentUpdate} tone="warning" />
      </div>
      <DashboardCard title="Families needing attention">
        <DataTable
          columns={['Family member', 'Client', 'Approved update', 'Approval state', 'Open concern', 'Response due', 'Recommended action', 'Action']}
          rows={familiesNeedingAttention.map((concern) => [
            getFamilyMember(concern.familyMemberId)?.name ?? '—',
            getClient(concern.clientId)?.name ?? '—',
            filteredVisits.find((visit) => visit.clientId === concern.clientId)?.careNote?.approvedSummary ?? 'No approved update',
            nurseApprovals.some((item) => item.clientId === concern.clientId && item.blocksFamilyVisibility && item.status !== 'Approved')
              ? <StatusBadge key="approval" status="Requires approval" />
              : <StatusBadge key="approval" status="Approved for family" />,
            concern.type,
            concern.responseDue,
            getConcernOverdue(concern) ? 'Respond now' : 'Review before due time',
            <div key="action" className="inlineActions">
              <button type="button" className="textAction" onClick={() => updateConcern(concern.id, { familyResponseDraft: 'We received your concern and are reviewing the visit record now.' })}>Draft response</button>
              <button
                type="button"
                className="textAction"
                onClick={() =>
                  updateConcern(concern.id, {
                    status: 'Responded',
                    responseNote: concern.familyResponseDraft ?? 'We received your concern and are reviewing the visit record now.',
                    responseSent: true,
                  })
                }
              >
                Send Update
              </button>
            </div>,
          ])}
        />
      </DashboardCard>
    </AppShell>
  );
}

export function BillingReadinessScreen() {
  const { filteredVisits, filteredIncidents, settings, billingApprovals, approveBillingVisit, exportBillingCsv, showToast } = useDemoStore();
  const { getClient, getCaregiver } = useReferenceData();
  const records = buildBillingReadiness({ visits: filteredVisits, incidents: filteredIncidents, settings })
    .map((record) => ({
      ...record,
      billingStatus: billingApprovals[record.visitId] ?? record.billingStatus,
    }));
  const readyForBilling = records.filter((record) => record.billingStatus === 'Ready for Billing').length;
  const approvedForBilling = records.filter((record) => record.billingStatus === 'Approved').length;
  const needsReview = records.filter((record) => record.billingStatus === 'Needs Review').length;
  const blockedFromBilling = records.filter((record) => ['Not Ready', 'Needs Review'].includes(record.billingStatus)).length;
  const exportCsv = () => {
    const csv = exportBillingCsv();
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `careproof-billing-readiness-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Billing CSV exported in demo mode.');
  };
  return (
    <AppShell title="Billing readiness" subtitle="Use visit proof to confirm which completed visits are ready, blocked, or still need review before export." navItems={consoleLinks}>
      <DashboardCard title="Billing readiness summary">
        <div className="ownerBriefGrid">
          <Link href="/console/visits" className="ownerBriefCard">
            <span>Ready queue</span>
            <strong>{readyForBilling}</strong>
            <p>completed visits have proof and can be approved for billing export</p>
          </Link>
          <Link href="/console/visits" className="ownerBriefCard">
            <span>Blocked records</span>
            <strong>{blockedFromBilling}</strong>
            <p>visits need checkout, notes, checklist completion, or review first</p>
          </Link>
          <Link href="/console/system/data-export" className="ownerBriefCard">
            <span>Export mode</span>
            <strong>CSV</strong>
            <p>demo export creates a file from visit proof; no payment integration is claimed</p>
          </Link>
        </div>
      </DashboardCard>

      <div className="statsGrid">
        <StatCard label="Billable completed visits" value={readyForBilling + approvedForBilling} tone="positive" />
        <StatCard label="Visits missing checkout" value={filteredVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Checkout Missing').length} tone="warning" />
        <StatCard label="Visits missing note" value={filteredVisits.filter((visit) => !visit.careNote).length} tone="warning" />
        <StatCard label="Visits needing review" value={needsReview} tone="warning" />
        <StatCard label="Approved for billing" value={approvedForBilling} tone="positive" />
        <StatCard label="Blocked from billing" value={blockedFromBilling} tone="danger" />
      </div>
      <DashboardCard title="Readiness rules">
        <ul className="featureList">
          <li>Visit must be completed with check-in and checkout proof.</li>
          <li>Required checklist tasks must be complete or include an override reason.</li>
          <li>Required care note must be present before approval.</li>
          <li>Open critical incidents keep the visit in review until resolved.</li>
        </ul>
      </DashboardCard>
      <SectionHeader
        eyebrow="Billing readiness"
        title="Visit proof and readiness"
        actions={<button type="button" className="button secondaryButton" onClick={exportCsv}>Export CSV</button>}
      />
      <DataTable
        columns={['Client', 'Caregiver', 'Date', 'Actual proof', 'Checklist', 'Note', 'Incident', 'Billing status', 'Next action']}
        rows={records.map((record) => {
          const visit = filteredVisits.find((item) => item.id === record.visitId);
          if (!visit) return ['—', '—', '—', '—', '—', '—', '—', '—', '—'];
          const incident = filteredIncidents.find((item) => item.id === visit.incidentId);
          return [
            getClient(visit.clientId)?.name ?? '—',
            getCaregiver(visit.caregiverId)?.name ?? '—',
            visit.scheduledDay,
            `${visit.checkInTime ?? visit.startLabel} – ${visit.checkOutTime ?? 'Pending'}`,
            getChecklistProgress(visit).label,
            visit.careNote ? 'Ready' : 'Missing',
            incident ? `${incident.type} · ${incident.status}` : 'None',
            <StatusBadge key="billing" status={record.billingStatus} />,
            <div key="actions" className="inlineActions">
              {record.reasonBlocked ? <span className="mutedSmall">{record.reasonBlocked}</span> : <span className="mutedSmall">Ready for approval.</span>}
              <Link className="textAction" href={`/console/visits/${visit.id}`}>Review visit</Link>
              {record.billingStatus === 'Ready for Billing' ? (
                <button type="button" className="textAction" onClick={() => approveBillingVisit(visit.id)}>Approve</button>
              ) : record.billingStatus === 'Approved' ? (
                <span className="mutedSmall">Approved</span>
              ) : (
                <button type="button" className="textAction" onClick={() => showToast('Resolve readiness blockers before approving this visit.')}>Resolve blockers first</button>
              )}
            </div>,
          ];
        })}
      />
    </AppShell>
  );
}

export function CaregiverSupportScreen() {
  const { filteredVisits, filteredIncidents, filteredFamilyConcerns, caregiverSupportReviews, markCaregiverSupportReviewed, showToast } = useDemoStore();
  const { caregivers: branchCaregivers, getBranch } = useReferenceData();
  const records = buildCaregiverSupportRecords({
    caregivers: branchCaregivers,
    visits: filteredVisits,
    concerns: filteredFamilyConcerns,
  });
  const caregiversWithSignals = records.filter((record) => record.supportSignal !== 'No urgent support signal');
  const missedVisits = filteredVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Missed').length;
  const noteGaps = filteredVisits.filter((visit) => ['Completed', 'Needs Review'].includes(getVisitDisplayStatus(visit)) && !visit.careNote?.text).length;
  return (
    <AppShell title="Caregiver support" subtitle="Use this view to identify support needs, scheduling issues, and documentation gaps without turning it into a punishment board." navItems={consoleLinks}>
      <DashboardCard title="Support review summary">
        <div className="ownerBriefGrid">
          <div className="ownerBriefCard">
            <span>Caregivers to review</span>
            <strong>{caregiversWithSignals.length}</strong>
            <p>support signals are based on missed visits, lateness, task barriers, notes, and schedule load</p>
          </div>
          <Link href="/console/visits?status=Missed" className="ownerBriefCard">
            <span>Missed visit signal</span>
            <strong>{missedVisits}</strong>
            <p>missed visits should be reviewed with scheduling context before action</p>
          </Link>
          <Link href="/console/data-quality" className="ownerBriefCard">
            <span>Documentation gaps</span>
            <strong>{noteGaps}</strong>
            <p>completed or review-needed visits without care notes</p>
          </Link>
        </div>
      </DashboardCard>
      <DataTable
        columns={['Caregiver', 'Branch', 'Reliability', 'Documentation', 'Incidents', 'Support signal', 'Recommended action', 'Review']}
        rows={records.map((record) => {
          const caregiver = branchCaregivers.find((item) => item.id === record.caregiverId);
          const caregiverVisits = filteredVisits.filter((visit) => visit.caregiverId === record.caregiverId);
          const caregiverOperationalMetrics = getOperationalVisitMetrics(caregiverVisits);
          const closedCaregiverVisits = caregiverOperationalMetrics.closedVisits;
          const completionRate = caregiverOperationalMetrics.closedCount ? `${caregiverOperationalMetrics.completionRate}%` : 'Pending';
          const notesRate = closedCaregiverVisits.length ? `${Math.round((closedCaregiverVisits.filter((visit) => Boolean(visit.careNote)).length / closedCaregiverVisits.length) * 100)}%` : 'Pending';
          const caregiverMissedVisits = caregiverVisits.filter((visit) => getVisitDisplayStatus(visit) === 'Missed').length;
          const reviewed = Boolean(caregiverSupportReviews[record.caregiverId]);
          return [
            <Link key="caregiver" className="textAction" href={`/console/caregivers/${record.caregiverId}`}>{caregiver?.name ?? '—'}</Link>,
            getBranch(record.branchId ?? '')?.name ?? '—',
            `${completionRate} completion · ${caregiver?.onTimeRate ?? 0}% on time · ${caregiverMissedVisits} missed`,
            `${notesRate} notes · ${caregiverVisits.length} assigned visits`,
            filteredIncidents.filter((incident) => incident.caregiverId === record.caregiverId).length,
            <StatusBadge key="signal" status={record.supportSignal === 'No urgent support signal' ? 'Healthy' : 'Needs Review'} />,
            record.recommendedAction,
            <div key="review" className="inlineActions">
              <button type="button" className="textAction" onClick={() => showToast('Schedule adjustment note recorded in demo mode.')}>Adjust Schedule</button>
              <button type="button" className="textAction" onClick={() => markCaregiverSupportReviewed(record.caregiverId)}>
                {reviewed ? 'Reviewed' : 'Mark reviewed'}
              </button>
            </div>,
          ];
        })}
      />
    </AppShell>
  );
}

export function NotificationsCenterScreen() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useDemoStore();
  const [filter, setFilter] = useState<'All' | Notification['status']>('All');
  const filtered = filter === 'All' ? notifications : notifications.filter((notification) => notification.status === filter);
  return (
    <AppShell title="Notifications" subtitle="Late visits, incidents, family concerns, report updates, and demo delivery status in one queue." navItems={consoleLinks}>
      <SectionHeader
        eyebrow="Notification center"
        title="Operational notifications"
        actions={
          <div className="inlineActions">
            <label className="demoField compactField">
              <span>Status</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as 'All' | Notification['status'])}>
                {['All', 'Unread', 'Read', 'Action Required', 'Sent', 'Failed', 'Demo Only'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <button type="button" className="button secondaryButton" onClick={markAllNotificationsRead}>Mark all as read</button>
          </div>
        }
      />
      <div className="stackGrid">
        {filtered.map((notification) => (
          <article key={notification.id} className="miniSummaryCard">
            <div className="aiRiskSignalTop">
              <strong>{notification.title}</strong>
              <StatusBadge status={notification.status ?? 'Unread'} />
            </div>
            <p>{notification.message}</p>
            <p>{notification.createdAt}</p>
            <div className="inlineActions">
              {notification.entityRoute ? <Link className="textAction" href={notification.entityRoute}>Open</Link> : null}
              <button type="button" className="textAction" onClick={() => markNotificationRead(notification.id)}>Mark read</button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}

export function NurseApprovalsScreen() {
  const [approvals, setApprovals] = useState(nurseApprovals);
  const [selectedId, setSelectedId] = useState(nurseApprovals[0]?.id ?? '');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [backendConnected, setBackendConnected] = useState(false);
  const selected = approvals.find((item) => item.id === selectedId) ?? approvals[0];
  const visibleStatus = (item: typeof approvals[number]) => statusOverrides[item.id] ?? item.status;
  const pending = approvals.filter((item) => !['Approved', 'Rejected'].includes(visibleStatus(item))).length;
  const blocked = approvals.filter((item) => item.blocksFamilyVisibility && !['Approved', 'Rejected'].includes(visibleStatus(item))).length;
  const highPriority = approvals.filter((item) => ['High', 'Critical'].includes(item.priority)).length;

  useEffect(() => {
    fetchNurseApprovalsApi().then((data) => {
      setApprovals(data);
      setBackendConnected(true);
    }).catch(() => {});
  }, []);

  return (
    <AppShell
      title="Nurse approvals"
      subtitle="Review notes, incidents, medication tasks, care plan changes, and family updates before they become final or family-visible."
      navItems={consoleLinks}
    >

        {backendConnected && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {approvals.length} records</div>
        )}
      <div className="statsGrid">
        <StatCard label="Pending approval" value={pending} tone={pending ? 'warning' : 'positive'} />
        <StatCard label="High-priority reviews" value={highPriority} tone={highPriority ? 'danger' : 'neutral'} />
        <StatCard label="Family updates blocked" value={blocked} tone={blocked ? 'danger' : 'neutral'} />
        <StatCard label="Average approval time" value="42 min" tone="info" />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Approval queue">
          <DataTable
            columns={['Client', 'Type', 'Priority', 'Status', 'Assigned nurse', 'Submitted', 'Action']}
            rows={approvals.map((approval) => [
              getClient(approval.clientId)?.name ?? approval.clientId ?? 'Client',
              approval.approvalType,
              <StatusBadge key="priority" status={approval.priority} />,
              <StatusBadge key="status" status={visibleStatus(approval)} />,
              users.find((user) => user.id === approval.assignedNurseId)?.name ?? 'Nurse',
              approval.submittedTime,
              <button key="action" type="button" className="textAction" onClick={() => setSelectedId(approval.id)}>Review</button>,
            ])}
          />
        </DashboardCard>
        <DashboardCard title="Approval detail">
          {selected ? (
            <div className="longformStack">
              <div className="detailFactGrid">
                <div><span>Client</span><strong>{getClient(selected.clientId)?.name}</strong></div>
                <div><span>Visit</span><strong>{selected.visitId ?? 'Not linked'}</strong></div>
                <div><span>Caregiver</span><strong>{selected.caregiverId ? getCaregiver(selected.caregiverId)?.name : '—'}</strong></div>
                <div><span>Status</span><strong><StatusBadge status={visibleStatus(selected)} /></strong></div>
              </div>
              <AiDisclaimer>AI Draft · Needs Human Review · Not Sent · Not Final</AiDisclaimer>
              <MetricCard title="Notes submitted">
                <p>{selected.notesSubmitted}</p>
              </MetricCard>
              <MetricCard title="Nurse comments">
                <p>{selected.nurseComments ?? 'No decision comments yet.'}</p>
              </MetricCard>
              <div className="inlineActions">
                <button type="button" className="button primaryButton" onClick={async () => { setStatusOverrides((c) => ({ ...c, [selected.id]: 'Approved' })); try { const u = await decideNurseApprovalApi(selected.id, 'approved'); setApprovals((p) => p.map((a) => a.id === u.id ? u : a)); setStatusOverrides((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Approve</button>
                <button type="button" className="button secondaryButton" onClick={async () => { setStatusOverrides((c) => ({ ...c, [selected.id]: 'Changes Requested' })); try { const u = await decideNurseApprovalApi(selected.id, 'needs_clarification'); setApprovals((p) => p.map((a) => a.id === u.id ? u : a)); setStatusOverrides((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Request changes</button>
                <button type="button" className="button ghostButton" onClick={async () => { setStatusOverrides((c) => ({ ...c, [selected.id]: 'Rejected' })); try { const u = await decideNurseApprovalApi(selected.id, 'rejected'); setApprovals((p) => p.map((a) => a.id === u.id ? u : a)); setStatusOverrides((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Reject</button>
                <button type="button" className="button ghostButton" onClick={() => setStatusOverrides((current) => ({ ...current, [selected.id]: 'Escalated' }))}>Escalate</button>
              </div>
              <Timeline items={selected.auditTrail} />
            </div>
          ) : <EmptyState title="No approval selected" text="Choose an item from the queue." />}
        </DashboardCard>
      </div>
    </AppShell>
  );
}

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
        setFindings(findingsData);
        setRules(rulesData);
        setBackendConnected(true);
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
              finding.clientId ? getClient(finding.clientId)?.name : finding.caregiverId ? getCaregiver(finding.caregiverId)?.name : finding.relatedType,
              finding.owner,
              finding.recommendedAction,
              <div key="actions" className="inlineActions">
                <button type="button" className="textAction" onClick={async () => { setStatuses((c) => ({ ...c, [finding.id]: 'Acknowledged' })); try { const u = await updateFindingStatusApi(finding.id, 'in_progress'); setFindings((p) => p.map((f) => f.id === u.id ? u : f)); setStatuses((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Acknowledge</button>
                <button type="button" className="textAction" onClick={async () => { setStatuses((c) => ({ ...c, [finding.id]: 'Resolved' })); try { const u = await updateFindingStatusApi(finding.id, 'resolved'); setFindings((p) => p.map((f) => f.id === u.id ? u : f)); setStatuses((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Resolve</button>
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

export function SocialWorkScreen() {
  const [cases, setCases] = useState(socialWorkCases);
  const [caseStatuses, setCaseStatuses] = useState<Record<string, string>>({});
  const [backendConnected, setBackendConnected] = useState(false);
  const visibleStatus = (item: typeof cases[number]) => caseStatuses[item.id] ?? item.status;
  const open = cases.filter((item) => visibleStatus(item) !== 'Closed').length;
  const highRisk = cases.filter((item) => ['High', 'Critical'].includes(item.riskLevel)).length;
  const followUps = cases.filter((item) => item.nextFollowUpDate.includes('Today')).length;

  useEffect(() => {
    fetchSocialWorkCasesApi().then((data) => {
      setCases(data);
      setBackendConnected(true);
    }).catch(() => {});
  }, []);

  return (
    <AppShell title="Social work" subtitle="Track family concerns, well-being signals, support needs, and family-safe responses without exposing internal notes." navItems={consoleLinks}>
      {backendConnected && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">Live backend connected · {cases.length} records</div>
      )}
      <div className="statsGrid">
        <StatCard label="Open cases" value={open} tone={open ? 'warning' : 'positive'} />
        <StatCard label="High-risk cases" value={highRisk} tone={highRisk ? 'danger' : 'neutral'} />
        <StatCard label="Follow-ups due today" value={followUps} tone={followUps ? 'warning' : 'neutral'} />
        <StatCard label="Linked family concerns" value={cases.filter((item) => item.linkedConcernId).length} tone="info" />
      </div>
      <DataTable
        columns={['Client', 'Case type', 'Risk', 'Status', 'Social worker', 'Next follow-up', 'Family-safe response', 'Actions']}
        rows={cases.map((item) => [
          getClient(item.clientId)?.name,
          item.caseType,
          <StatusBadge key="risk" status={item.riskLevel} />,
          <StatusBadge key="status" status={visibleStatus(item)} />,
          users.find((user) => user.id === item.assignedSocialWorkerId)?.name ?? 'Social worker',
          item.nextFollowUpDate,
          item.familySafeResponse ?? 'Draft response required',
          <div key="actions" className="inlineActions">
            <button type="button" className="textAction" onClick={async () => { setCaseStatuses((c) => ({ ...c, [item.id]: 'Escalated' })); try { const u = await updateSocialWorkCaseStatusApi(item.id, 'escalated'); setCases((p) => p.map((c2) => c2.id === u.id ? u : c2)); setCaseStatuses((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Escalate</button>
            <button type="button" className="textAction" onClick={async () => { setCaseStatuses((c) => ({ ...c, [item.id]: 'Closed' })); try { const u = await updateSocialWorkCaseStatusApi(item.id, 'closed'); setCases((p) => p.map((c2) => c2.id === u.id ? u : c2)); setCaseStatuses((c) => { const n = { ...c }; delete n[u.id]; return n; }); } catch {} }}>Close case</button>
          </div>,
        ])}
      />
    </AppShell>
  );
}

export function IntakeAgentsScreen() {
  const [records, setRecords] = useState(intakeRecords);
  const [backendConnected, setBackendConnected] = useState(false);
  const stageCounts = records.reduce<Record<string, number>>((acc, item) => {
    acc[item.stage] = (acc[item.stage] ?? 0) + 1;
    return acc;
  }, {});
  const activeStages = Object.entries(stageCounts);

  useEffect(() => {
    fetchIntakeRecordsApi().then((data) => {
      setRecords(data);
      setBackendConnected(true);
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
              {records.filter((item) => item.stage === stage).map((item) => (
                <div key={item.id} className="visitCard">
                  <div className="visitCardTop"><strong>{item.prospectName}</strong><StatusBadge status={item.priority} /></div>
                  <p>{item.requiredServices.join(', ')}</p>
                  <p><strong>Next:</strong> {item.nextAction}</p>
                </div>
              ))}
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
            users.find((user) => user.id === item.assignedAgentId)?.name,
            getBranch(item.branchId)?.name,
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

export function MedicalAvailabilityScreen() {
  const [medRecords, setMedRecords] = useState(medicalAvailabilityRecords);
  const [backendConnected, setBackendConnected] = useState(false);
  const blocked = medRecords.filter((item) => item.blocksVisit).length;
  const missing = medRecords.filter((item) => ['Missing', 'Expired'].includes(item.status)).length;
  const needsConfirmation = medRecords.filter((item) => item.status === 'Needs Confirmation').length;

  useEffect(() => {
    fetchMedicalAvailabilityApi().then((data) => {
      setMedRecords(data);
      setBackendConnected(true);
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
        columns={['Client / Visit', 'Availability type', 'Status', 'Owner', 'Detail', 'Next action', 'Blocks visit']}
        rows={medRecords.map((item) => [
          item.clientId ? getClient(item.clientId)?.name : 'Agency',
          item.type,
          <StatusBadge key="status" status={item.status} />,
          item.owner,
          item.detail,
          item.nextAction,
          item.blocksVisit ? <StatusBadge key="blocker" status="Blocker" /> : <StatusBadge key="available" status="Available" />,
        ])}
      />
    </AppShell>
  );
}

export function ExpirationCenterScreen() {
  const { showToast } = useDemoStore();
  const [expRecords, setExpRecords] = useState(expirationRecords);
  const [backendConnected, setBackendConnected] = useState(false);
  const expiring30 = expRecords.filter((item) => item.state === 'Expiring in 30 days').length;
  const expiring7 = expRecords.filter((item) => item.state === 'Expiring in 7 days').length;
  const blockers = expRecords.filter((item) => item.blocksVisits || ['Expired', 'Missing', 'Blocker'].includes(item.state)).length;

  useEffect(() => {
    fetchExpirationRecordsApi().then((data) => {
      setExpRecords(data);
      setBackendConnected(true);
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
            <button type="button" className="textAction" onClick={async () => { showToast('Renewal action recorded.'); try { const u = await updateRenewalStatusApi(item.id, 'renewed'); setExpRecords((p) => p.map((r) => r.id === u.id ? u : r)); } catch {} }}>Renewal action</button>
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

export function SystemReadinessScreen() {
  const hardcodedReadiness = [
    ['Authentication hardening', 'Production Blocker', 'Demo role switching exists; production auth/session hardening remains.'],
    ['RBAC / agency isolation', 'Needs Configuration', 'Demo-safe scope exists; production verification still required.'],
    ['Database backups', 'Needs Configuration', 'Mongo backup scripts exist; automated backup policy is not deployed.'],
    ['Monitoring', 'Needs Configuration', 'Health/ready endpoints exist; external monitoring provider is not configured.'],
    ['Audit logging', 'Pilot Ready', 'Core visit, AI, setup, and workflow events have audit patterns.'],
    ['Email/SMS provider setup', 'Needs Configuration', 'Demo notification drafts only. No real sends in local demo.'],
    ['Privacy/compliance review', 'Production Blocker', 'Family visibility rules are demo-tested; formal review remains.'],
    ['Deployment environment', 'Demo Ready', 'Local stack and build checks pass for demo.'],
  ];
  const [readiness, setReadiness] = useState(hardcodedReadiness);

  useEffect(() => {
    getSystemStatusApi().then((payload) => {
      const rows: string[][] = [
        ['API status', payload.status === 'ok' ? 'Demo Ready' : 'Needs Configuration', `API is ${payload.status}. Environment: ${payload.environment}.`],
        ['Database', payload.database?.status === 'connected' ? 'Demo Ready' : 'Needs Configuration', `Database ${payload.database?.status ?? 'unknown'}${payload.database?.engine ? ` (${payload.database.engine})` : ''}.`],
        ['Email provider', payload.notificationProviders?.email === 'none' ? 'Needs Configuration' : 'Pilot Ready', `Email provider: ${payload.notificationProviders?.email ?? 'not configured'}.`],
        ['SMS provider', payload.notificationProviders?.sms === 'none' ? 'Needs Configuration' : 'Pilot Ready', `SMS provider: ${payload.notificationProviders?.sms ?? 'not configured'}.`],
        ['AI mode', payload.ai?.mode ? 'Pilot Ready' : 'Needs Configuration', `AI mode: ${payload.ai?.mode ?? 'unknown'}${payload.ai?.provider ? ` via ${payload.ai.provider}` : ''}.`],
        ['Storage', payload.storage?.type ? 'Demo Ready' : 'Needs Configuration', `Storage: ${payload.storage?.type ?? 'unknown'}${payload.storage?.seedProtection ? ` · seed protection: ${payload.storage.seedProtection}` : ''}.`],
        ['Demo mode', payload.demoMode ? 'Demo Ready' : 'Pilot Ready', `Demo mode is ${payload.demoMode ? 'enabled' : 'disabled'}.`],
      ];
      if (payload.warnings?.length) {
        rows.push(['Warnings', 'Needs Configuration', payload.warnings.join(' ')]);
      }
      setReadiness(rows);
    }).catch(() => {});
  }, []);

  return (
    <AppShell title="System readiness" subtitle="A blunt go-live view. Demo-ready does not mean production-ready." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Demo ready" value={readiness.filter((item) => item[1] === 'Demo Ready').length} tone="positive" />
        <StatCard label="Pilot ready" value={readiness.filter((item) => item[1] === 'Pilot Ready').length} tone="info" />
        <StatCard label="Needs configuration" value={readiness.filter((item) => item[1] === 'Needs Configuration').length} tone="warning" />
        <StatCard label="Production blockers" value={readiness.filter((item) => item[1] === 'Production Blocker').length} tone="danger" />
      </div>
      <DataTable
        columns={['Area', 'State', 'Reality']}
        rows={readiness.map(([area, state, reality]) => [
          area,
          <StatusBadge key="state" status={state} />,
          reality,
        ])}
      />
    </AppShell>
  );
}

export function QualityRulesScreen() {
  const { settings, updateAgencySettings } = useDemoStore();
  const [rules, setRules] = useState<QualityRules>({
    familyConcernResponseSlaHours: settings.qualityRules?.familyConcernResponseSlaHours ?? 8,
    incidentFollowUpSlaHours: settings.qualityRules?.incidentFollowUpSlaHours ?? 4,
    weeklyReportDueDay: settings.qualityRules?.weeklyReportDueDay ?? 'Friday',
    clientRiskThreshold: settings.qualityRules?.clientRiskThreshold ?? 60,
    caregiverSupportThreshold: settings.qualityRules?.caregiverSupportThreshold ?? 2,
    billingApprovalRequirement: settings.qualityRules?.billingApprovalRequirement ?? 'Coordinator Review',
    branchPerformanceThreshold: settings.qualityRules?.branchPerformanceThreshold ?? 75,
  });
  return (
    <AppShell title="Quality rules" subtitle="Management thresholds for concern response, incident follow-up, branch performance, billing review, and client risk." navItems={consoleLinks}>
      <DashboardCard title="Management rules">
        <div className="formGridTwo">
          <label className="demoField"><span>Family concern response SLA (hours)</span><input type="number" value={rules.familyConcernResponseSlaHours} onChange={(event) => setRules({ ...rules, familyConcernResponseSlaHours: Number(event.target.value) })} /></label>
          <label className="demoField"><span>Incident follow-up SLA (hours)</span><input type="number" value={rules.incidentFollowUpSlaHours} onChange={(event) => setRules({ ...rules, incidentFollowUpSlaHours: Number(event.target.value) })} /></label>
          <label className="demoField"><span>Weekly report due day</span><input value={rules.weeklyReportDueDay} onChange={(event) => setRules({ ...rules, weeklyReportDueDay: event.target.value })} /></label>
          <label className="demoField"><span>Client risk threshold</span><input type="number" value={rules.clientRiskThreshold} onChange={(event) => setRules({ ...rules, clientRiskThreshold: Number(event.target.value) })} /></label>
          <label className="demoField"><span>Caregiver support threshold</span><input type="number" value={rules.caregiverSupportThreshold} onChange={(event) => setRules({ ...rules, caregiverSupportThreshold: Number(event.target.value) })} /></label>
          <label className="demoField"><span>Branch performance threshold</span><input type="number" value={rules.branchPerformanceThreshold} onChange={(event) => setRules({ ...rules, branchPerformanceThreshold: Number(event.target.value) })} /></label>
          <label className="demoField fullWidthField"><span>Billing approval requirement</span><select value={rules.billingApprovalRequirement} onChange={(event) => setRules({ ...rules, billingApprovalRequirement: event.target.value as QualityRules['billingApprovalRequirement'] })}><option>Coordinator Review</option><option>Owner Review</option></select></label>
        </div>
        <div className="inlineActions">
          <button type="button" className="button primaryButton" onClick={() => updateAgencySettings({ qualityRules: rules })}>Save quality rules</button>
          <Link className="button ghostButton" href="/console/billing">Open billing readiness</Link>
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function CustomerSuccessScreen() {
  const { settings, users, caregivers, clients, carePlans, visits, familyMembers, weeklyReports, incidents, familyConcerns, implementationMilestones, adoptionGaps, reviewAdoptionGap } = useDemoStore();
  const implementation = buildImplementationProgress({
    settings,
    usersInvited: users.length,
    caregivers,
    clients,
    carePlans,
    visits,
    familyMembers,
    weeklyReports,
    incidents,
    concerns: familyConcerns,
    milestones: implementationMilestones,
  });
  const adoption = buildAdoptionMetrics({ caregivers, visits, weeklyReports, familyMembers });
  return (
    <AppShell title="Customer success" subtitle="Track implementation progress, adoption gaps, and next actions so the agency can adopt CareProof after the pilot." navItems={consoleLinks}>
      <div className="dashboardSplit">
        <DashboardCard title="Implementation progress">
          <div className="readinessScoreCard">
            <strong>{implementation.progress}%</strong>
            <span>{implementation.completedSteps}/11 complete</span>
          </div>
          <p>{implementation.recommendedNextAction}</p>
          <div className="stackGrid compactStack">
            {implementationMilestones.map((milestone) => (
              <div key={milestone.id} className="miniSummaryCard miniSummaryTight">
                <strong>{milestone.label}</strong>
                <StatusBadge status={milestone.completedAt ? 'Completed' : 'Scheduled'} />
              </div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="Implementation timeline">
          <Timeline items={implementationMilestones.map((milestone) => ({ label: milestone.label, time: milestone.completedAt ?? 'Pending', actor: milestone.completedAt ? 'Agency team' : 'Next step' }))} />
        </DashboardCard>
      </div>

      <div className="statsGrid">
        <StatCard label="Active caregivers this week" value={adoption.activeCaregiversThisWeek} tone="positive" />
        <StatCard label="Caregivers with app usage" value={adoption.caregiversWithAppUsage} tone="info" />
        <StatCard label="Visits documented" value={adoption.visitsDocumented} />
        <StatCard label="Completed checklists" value={adoption.visitsWithCompletedChecklist} tone="positive" />
        <StatCard label="Visits with notes" value={adoption.visitsWithCareNotes} tone="info" />
        <StatCard label="Family updates sent" value={adoption.familyUpdatesSent} tone="positive" />
        <StatCard label="Family portal users active" value={adoption.familyPortalUsersActive} tone="info" />
        <StatCard label="Weekly reports sent" value={adoption.weeklyReportsSent} tone="positive" />
      </div>

      <DashboardCard title="Adoption gaps">
        <div className="stackGrid">
          {adoptionGaps.map((gap) => (
            <div key={gap.id} className="miniSummaryCard">
              <div className="aiRiskSignalTop">
                <strong>{gap.label}</strong>
                <StatusBadge status={gap.reviewed ? 'Completed' : 'Needs Review'} />
              </div>
              <p><strong>Count:</strong> {gap.count}</p>
              <p><strong>Impact:</strong> {gap.impact}</p>
              <p><strong>Next action:</strong> {gap.recommendedAction}</p>
              <button type="button" className="textAction" onClick={() => reviewAdoptionGap(gap.id)}>
                {gap.reviewed ? 'Reviewed' : 'Mark reviewed'}
              </button>
            </div>
          ))}
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function PilotReviewScreen() {
  const { pilotReviewSummary, visits, incidents, familyConcerns, weeklyReports, familyMembers, showToast } = useDemoStore();
  const outcomes = buildPilotReviewOutcomes({ visits, incidents, concerns: familyConcerns, weeklyReports });
  const exportPilotReview = () => {
    downloadCsvFile('careproof-pilot-review.csv', [
      ['metric', 'value'],
      ['pilotStartDate', pilotReviewSummary.pilotStartDate],
      ['pilotEndDate', pilotReviewSummary.pilotEndDate],
      ['clientsIncluded', pilotReviewSummary.clientsIncluded],
      ['caregiversIncluded', pilotReviewSummary.caregiversIncluded],
      ['visitsScheduled', pilotReviewSummary.visitsScheduled],
      ['visitsCompleted', pilotReviewSummary.visitsCompleted],
      ['familyUsersEnabled', pilotReviewSummary.familyUsersEnabled],
      ['visitCompletionRate', outcomes.visitCompletionRate],
      ['onTimeCheckInRate', outcomes.onTimeCheckInRate],
      ['missedVisitsDetected', outcomes.missedVisitsDetected],
      ['incidentsCaptured', outcomes.incidentsCaptured],
      ['familyConcernsTracked', outcomes.familyConcernsTracked],
      ['weeklyReportsSent', outcomes.weeklyReportsSent],
      ['notesCapturedPerVisit', outcomes.notesCapturedPerVisit],
    ]);
    showToast('Pilot review CSV exported in demo mode.');
  };
  return (
    <AppShell title="Pilot review" subtitle="Review post-pilot outcomes, compare before vs after, and decide whether the agency is ready to expand." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Pilot clients" value={pilotReviewSummary.clientsIncluded} />
        <StatCard label="Pilot caregivers" value={pilotReviewSummary.caregiversIncluded} />
        <StatCard label="Visits scheduled" value={pilotReviewSummary.visitsScheduled} />
        <StatCard label="Visits completed" value={pilotReviewSummary.visitsCompleted} tone="positive" />
        <StatCard label="Family users enabled" value={pilotReviewSummary.familyUsersEnabled} tone="info" />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Pilot summary">
          <div className="detailFactGrid">
            <div><span>Pilot start</span><strong>{pilotReviewSummary.pilotStartDate}</strong></div>
            <div><span>Pilot end</span><strong>{pilotReviewSummary.pilotEndDate}</strong></div>
            <div><span>Family users enabled</span><strong>{familyMembers.filter((member) => member.portalAccessEnabled).length}</strong></div>
            <div><span>Weekly reports sent</span><strong>{weeklyReports.filter((report) => report.status === 'Sent').length}</strong></div>
          </div>
        </DashboardCard>
        <DashboardCard title="Operational outcomes">
          <ul className="featureList">
            <li>Visit completion rate: {outcomes.visitCompletionRate}</li>
            <li>On-time check-in rate: {outcomes.onTimeCheckInRate}</li>
            <li>Missed visits detected: {outcomes.missedVisitsDetected}</li>
            <li>Incidents captured: {outcomes.incidentsCaptured}</li>
            <li>Family concerns tracked: {outcomes.familyConcernsTracked}</li>
            <li>Weekly reports sent: {outcomes.weeklyReportsSent}</li>
            <li>Notes captured per visit: {outcomes.notesCapturedPerVisit}</li>
          </ul>
        </DashboardCard>
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Before CareProof">
          <ul className="featureList">
            <li>Manual follow-up</li>
            <li>Unclear visit status</li>
            <li>Scattered notes</li>
            <li>Delayed family updates</li>
            <li>Manual reports</li>
          </ul>
        </DashboardCard>
        <DashboardCard title="After CareProof">
          <ul className="featureList">
            <li>Visit timeline</li>
            <li>Alert queue</li>
            <li>Family updates</li>
            <li>Report generation</li>
            <li>Audit history</li>
          </ul>
        </DashboardCard>
      </div>
      <DashboardCard title="Expansion recommendation">
        <div className="stackGrid">
          {[
            'Continue pilot only if documentation adoption remains uneven.',
            'Expand to more clients once family contact setup is complete.',
            'Expand to more caregivers after training checklists are complete.',
            'Enable family reports for all active pilot clients.',
            'Prepare production rollout for the next branch after pilot review.',
          ].map((item) => <div key={item} className="miniSummaryCard"><p>{item}</p></div>)}
        </div>
        <div className="inlineActions">
          <button type="button" className="button secondaryButton" onClick={exportPilotReview}>Export CSV</button>
          <button type="button" className="button ghostButton" onClick={() => showToast('PDF export can be connected for production; CSV export is available in this demo.')}>Export PDF</button>
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function SupportCenterScreen() {
  const { supportTickets, createSupportTicket, updateSupportTicketStatus, addSupportTicketResponse } = useDemoStore();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('Getting started');
  const [priority, setPriority] = useState<SupportTicket['priority']>('Medium');
  const [message, setMessage] = useState('');
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  return (
    <AppShell title="Support center" subtitle="Help topics, common issues, and a demo-safe internal support workflow for the agency team." navItems={consoleLinks}>
      <div className="cardGridThree">
        {['Getting started', 'Scheduling visits', 'Caregiver check-in/out', 'Family portal', 'Incidents', 'Reports', 'Billing readiness', 'User roles', 'Settings'].map((topic) => (
          <DashboardCard key={topic} title={topic}>
            <p>Use this topic to guide setup, day-to-day operations, and common handoff questions.</p>
          </DashboardCard>
        ))}
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Create support ticket">
          <div className="formStack">
            <label className="demoField"><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
            <label className="demoField"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as SupportTicket['category'])}>{['Getting started', 'Scheduling visits', 'Caregiver check-in/out', 'Family portal', 'Incidents', 'Reports', 'Billing readiness', 'User roles', 'Settings'].map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="demoField"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value as SupportTicket['priority'])}>{['Low', 'Medium', 'High'].map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="demoField"><span>Message</span><textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
            <button type="button" className="button primaryButton" onClick={() => {
              const result = createSupportTicket({ subject, category, priority, message });
              if (result.ok) {
                setSubject('');
                setCategory('Getting started');
                setPriority('Medium');
                setMessage('');
              }
            }}>Create ticket</button>
          </div>
        </DashboardCard>
        <DashboardCard title="Common issues">
          <div className="stackGrid">
            {[
              ['Caregiver cannot check in', 'Likely cause: visit is on the wrong device or connectivity is delayed.', '/caregiver/today'],
              ['Family cannot see report', 'Likely cause: report is still Ready and not marked Sent.', '/console/reports'],
              ['Visit shows late', 'Likely cause: grace period or delayed access still needs coordinator review.', '/console/operations'],
              ['Checklist incomplete', 'Likely cause: required task was marked unable to complete without follow-up.', '/caregiver/visit/visit-maria-am'],
              ['Report not ready', 'Likely cause: notes or incidents still need coordinator review.', '/console/reports'],
              ['Demo reset needed', 'Likely cause: walkthrough state drifted too far from baseline.', '/console/settings'],
            ].map(([title, copy, href]) => (
              <div key={title} className="miniSummaryCard">
                <strong>{title}</strong>
                <p>{copy}</p>
                <Link className="textAction" href={href}>Open related screen</Link>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
      <DashboardCard title="Support tickets">
        <div className="stackGrid">
          {supportTickets.map((ticket) => (
            <div key={ticket.id} className="miniSummaryCard">
              <div className="aiRiskSignalTop">
                <strong>{ticket.subject}</strong>
                <StatusBadge status={ticket.status} />
              </div>
              <p>{ticket.category} · {ticket.priority} priority</p>
              <p>{ticket.message}</p>
              <label className="demoField">
                <span>Status</span>
                <select value={ticket.status} onChange={(event) => updateSupportTicketStatus(ticket.id, event.target.value as SupportTicket['status'])}>
                  {['New', 'Reviewing', 'Waiting on User', 'Resolved', 'Closed'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="demoField">
                <span>Add response</span>
                <textarea rows={3} value={responseDrafts[ticket.id] ?? ''} onChange={(event) => setResponseDrafts({ ...responseDrafts, [ticket.id]: event.target.value })} />
              </label>
              <div className="inlineActions">
                <button type="button" className="button secondaryButton" onClick={() => {
                  addSupportTicketResponse(ticket.id, responseDrafts[ticket.id] ?? '');
                  setResponseDrafts({ ...responseDrafts, [ticket.id]: '' });
                }}>Add response</button>
                <button type="button" className="button ghostButton" onClick={() => updateSupportTicketStatus(ticket.id, 'Closed')}>Close Ticket</button>
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function PilotFeedbackScreen() {
  const { pilotFeedback, visits, submitPilotFeedback, updatePilotFeedbackStatus } = useDemoStore();
  const [feedbackType, setFeedbackType] = useState<PilotFeedback['feedbackType']>('Workflow confusion');
  const [role, setRole] = useState<PilotFeedback['role']>('Coordinator');
  const [severity, setSeverity] = useState<PilotFeedback['severity']>('Medium');
  const [message, setMessage] = useState('');
  const [relatedClientId, setRelatedClientId] = useState('');
  const [relatedVisitId, setRelatedVisitId] = useState('');
  const [contact, setContact] = useState('');

  return (
    <AppShell title="Pilot feedback" subtitle="Capture buyer, coordinator, caregiver, and family feedback during demos or limited pilots without losing the operational context." navItems={consoleLinks}>
      <div className="dashboardSplit">
        <DashboardCard title="Submit pilot feedback">
          <div className="formStack">
            <label className="demoField"><span>Feedback type</span><select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value as PilotFeedback['feedbackType'])}>{['Bug', 'Feature request', 'Workflow confusion', 'Training issue', 'Family communication issue', 'Caregiver app issue'].map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="demoField"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as PilotFeedback['role'])}>{['Owner', 'Coordinator', 'Caregiver', 'Family'].map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="demoField"><span>Severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value as PilotFeedback['severity'])}>{['Low', 'Medium', 'High', 'Critical'].map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="demoField"><span>Message</span><textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe the bug, workflow confusion, or training issue." /></label>
            <label className="demoField"><span>Related client (optional)</span><select value={relatedClientId} onChange={(event) => setRelatedClientId(event.target.value)}><option value="">None</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="demoField"><span>Related visit (optional)</span><select value={relatedVisitId} onChange={(event) => setRelatedVisitId(event.target.value)}><option value="">None</option>{visits.map((visit) => <option key={visit.id} value={visit.id}>{`${getClient(visit.clientId)?.name ?? visit.clientId} · ${visit.startLabel}`}</option>)}</select></label>
            <label className="demoField"><span>Contact (optional)</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="name@agency.com or phone" /></label>
            <button
              type="button"
              className="button primaryButton"
              onClick={() => {
                const result = submitPilotFeedback({
                  feedbackType,
                  role,
                  severity,
                  message,
                  relatedClientId: relatedClientId || undefined,
                  relatedVisitId: relatedVisitId || undefined,
                  contact: contact || undefined,
                });
                if (result.ok) {
                  setFeedbackType('Workflow confusion');
                  setRole('Coordinator');
                  setSeverity('Medium');
                  setMessage('');
                  setRelatedClientId('');
                  setRelatedVisitId('');
                  setContact('');
                }
              }}
            >
              Submit feedback
            </button>
          </div>
        </DashboardCard>
        <DashboardCard title="How to use this page">
          <ul className="featureList">
            <li>Capture objections, workflow confusion, and training gaps while the pilot is fresh.</li>
            <li>Separate bugs from adoption issues so the team does not hide training debt inside product tickets.</li>
            <li>Use severity only for impact, not emotion. Critical means the workflow is unsafe or blocked.</li>
          </ul>
        </DashboardCard>
      </div>
      <DashboardCard title="Submitted feedback">
        <div className="stackGrid">
          {pilotFeedback.map((item) => (
            <div key={item.id} className="miniSummaryCard">
              <div className="aiRiskSignalTop">
                <strong>{item.feedbackType}</strong>
                <StatusBadge status={item.status} />
              </div>
              <p>{item.role} · {item.severity} severity · {item.createdAt}</p>
              <p>{item.message}</p>
              <p>
                <strong>Related:</strong>{' '}
                {item.relatedClientId ? getClient(item.relatedClientId)?.name ?? item.relatedClientId : 'No client linked'}
                {item.relatedVisitId ? ` · ${item.relatedVisitId}` : ''}
              </p>
              {item.contact ? <p><strong>Contact:</strong> {item.contact}</p> : null}
              <label className="demoField">
                <span>Status</span>
                <select value={item.status} onChange={(event) => updatePilotFeedbackStatus(item.id, event.target.value as PilotFeedback['status'])}>
                  {['New', 'Reviewing', 'Planned', 'Resolved', 'Closed'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      </DashboardCard>
    </AppShell>
  );
}

export function TrainingScreen() {
  const { trainingChecklists, trainingProgress, completeTrainingItem, resetTrainingProgress } = useDemoStore();
  return (
    <AppShell title="Training" subtitle="Role-based training checklists to help coordinators, caregivers, families, and owners adopt the platform quickly." navItems={consoleLinks}>
      <div className="cardGridTwo">
        {trainingChecklists.map((checklist) => {
          const progress = checklist.items.filter((item) => trainingProgress[checklist.role]?.[item.id]).length;
          return (
            <DashboardCard key={checklist.role} title={`${checklist.role} training`}>
              <div className="readinessHeader">
                <strong>{progress}/{checklist.items.length} complete</strong>
                <button type="button" className="textAction" onClick={() => resetTrainingProgress(checklist.role)}>Reset</button>
              </div>
              <div className="stackGrid">
                {checklist.items.map((item) => (
                  <div key={item.id} className="miniSummaryCard miniSummaryTight">
                    <strong>{item.label}</strong>
                    <div className="inlineActions">
                      <StatusBadge status={trainingProgress[checklist.role]?.[item.id] ? 'Completed' : 'Scheduled'} />
                      <Link className="textAction" href={item.href}>Open</Link>
                      {!trainingProgress[checklist.role]?.[item.id] ? (
                        <button type="button" className="textAction" onClick={() => completeTrainingItem(checklist.role, item.id)}>Complete</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>
          );
        })}
      </div>
    </AppShell>
  );
}

export function DataQualityScreen() {
  const { clients, familyMembers, carePlans, caregivers, visits, weeklyReports, users, dataQualityReviews, markDataQualityReviewed, showToast } = useDemoStore();
  const issues = buildDataQualityIssues({ clients, familyMembers, carePlans, caregivers, visits, weeklyReports, users });
  const activeIssues = issues.filter((issue) => issue.count > 0);
  const clearedIssues = issues.filter((issue) => issue.count === 0);
  const highSeverityIssues = activeIssues.filter((issue) => ['High', 'Critical'].includes(issue.severity)).length;
  const affectedRecordCount = activeIssues.reduce((sum, issue) => sum + issue.affectedRecords.length, 0);
  return (
    <AppShell title="Data quality" subtitle="Clean setup problems, documentation gaps, and risky records before they weaken operations or expansion." navItems={consoleLinks}>
      <div className="stackGrid">
        <div className="statsGrid">
          <StatCard label="Active data issues" value={activeIssues.length} tone={activeIssues.length ? 'warning' : 'positive'} />
          <StatCard label="High severity" value={highSeverityIssues} tone={highSeverityIssues ? 'danger' : 'positive'} />
          <StatCard label="Affected records" value={affectedRecordCount} tone={affectedRecordCount ? 'warning' : 'positive'} />
          <StatCard label="Checks cleared" value={clearedIssues.length} tone="positive" />
        </div>

        <DashboardCard title="Issues needing action">
          {activeIssues.length ? (
            <div className="stackGrid">
              {activeIssues.map((issue) => (
                <div key={issue.id} className="miniSummaryCard">
                  <div className="aiRiskSignalTop">
                    <strong>{issue.type}</strong>
                    <StatusBadge status={dataQualityReviews[issue.id] ? 'Completed' : issue.severity} />
                  </div>
                  <div className="detailFactGrid">
                    <div><span>Count</span><strong>{issue.count}</strong></div>
                    <div><span>Affected</span><strong>{issue.affectedRecords.length}</strong></div>
                  </div>
                  <p><strong>Recommended fix:</strong> {issue.recommendedFix}</p>
                  <p><strong>Affected records:</strong> {issue.affectedRecords.length ? issue.affectedRecords.join(', ') : 'No explicit records listed in demo state.'}</p>
                  <div className="inlineActions">
                    <button type="button" className="textAction" onClick={() => markDataQualityReviewed(issue.id)}>
                      {dataQualityReviews[issue.id] ? 'Reviewed' : 'Mark reviewed'}
                    </button>
                    <button
                      type="button"
                      className="textAction"
                      onClick={() =>
                        showToast(
                          issue.affectedRecords.length
                            ? `Affected records: ${issue.affectedRecords.slice(0, 4).join(', ')}${issue.affectedRecords.length > 4 ? '…' : ''}`
                            : 'No affected records listed for this demo issue.',
                        )
                      }
                    >
                      View records
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active data quality issues" text="The current demo data passes the active setup and documentation checks." />
          )}
        </DashboardCard>

        <DashboardCard title="Checks currently clear">
          <div className="cardGridThree">
            {clearedIssues.map((issue) => (
              <div key={issue.id} className="miniSummaryCard miniSummaryTight">
                <div className="aiRiskSignalTop">
                  <strong>{issue.type}</strong>
                  <StatusBadge status="Completed" />
                </div>
                <p>{issue.recommendedFix}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </AppShell>
  );
}

export function RolloutScreen() {
  const { rolloutPlan, adoptionGaps, toggleRolloutChecklistItem } = useDemoStore();
  const nextAction = buildRolloutNextActions(rolloutPlan, adoptionGaps);
  return (
    <AppShell title="Rollout plan" subtitle="Use pilot scope, checklist completion, and remaining risks to plan the next agency expansion step." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Branches included" value={rolloutPlan.currentScope.branchesIncluded} />
        <StatCard label="Clients included" value={rolloutPlan.currentScope.clientsIncluded} />
        <StatCard label="Caregivers included" value={rolloutPlan.currentScope.caregiversIncluded} />
        <StatCard label="Family users enabled" value={rolloutPlan.currentScope.familyUsersEnabled} />
        <StatCard label="Visit volume" value={rolloutPlan.currentScope.visitVolume} />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Recommended next expansion">
          <div className="stackGrid">
            {rolloutPlan.recommendations.map((item) => (
              <div key={item.id} className="miniSummaryCard">
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="Rollout next action">
          <p>{nextAction}</p>
        </DashboardCard>
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Rollout checklist">
          <div className="stackGrid">
            {rolloutPlan.checklist.map((item) => (
              <label key={item.id} className="checklistRow checklistToggle">
                <input type="checkbox" checked={item.completed} onChange={() => toggleRolloutChecklistItem(item.id)} />
                <strong>{item.label}</strong>
              </label>
            ))}
          </div>
        </DashboardCard>
        <DashboardCard title="Expansion risks">
          <ul className="featureList">
            {rolloutPlan.risks.map((risk) => <li key={risk}>{risk}</li>)}
          </ul>
        </DashboardCard>
      </div>
    </AppShell>
  );
}

export function KnowledgeBaseScreen() {
  const { knowledgeBaseArticles } = useDemoStore();
  const [search, setSearch] = useState('');
  const filtered = knowledgeBaseArticles.filter((article) => {
    const haystack = `${article.title} ${article.category} ${article.roleTag} ${article.body}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });
  return (
    <AppShell title="Knowledge base" subtitle="Short internal articles for setup, operations, caregiver workflow, family updates, incidents, and reports." navItems={consoleLinks}>
      <SectionHeader
        eyebrow="Internal knowledge base"
        title="Search help articles"
        actions={<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search articles" />}
      />
      <div className="stackGrid">
        {filtered.map((article) => (
          <DashboardCard key={article.id} title={article.title}>
            <p><strong>{article.category}</strong> · {article.roleTag}</p>
            <p>{article.body}</p>
          </DashboardCard>
        ))}
      </div>
    </AppShell>
  );
}

export function SystemStatusScreen() {
  const { systemStatus, apiConnected } = useSystemReadiness();

  return (
    <AppShell title="System status" subtitle="Deployment posture, backend readiness, provider mode, and operational warnings before a safe pilot go-live." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Environment" value={systemStatus.environment} tone={systemStatus.environment === 'production' ? 'positive' : 'warning'} />
        <StatCard label="API status" value={apiConnected ? systemStatus.status : 'Demo fallback'} tone={apiConnected ? (systemStatus.status === 'ready' ? 'positive' : 'warning') : 'warning'} />
        <StatCard label="Database" value={systemStatus.database?.status ?? 'unknown'} tone={systemStatus.database?.status === 'connected' ? 'positive' : 'warning'} />
        <StatCard label="Notification mode" value={`${systemStatus.notificationProviders?.email ?? 'demo'} / ${systemStatus.notificationProviders?.sms ?? 'demo'}`} tone="info" />
        <StatCard label="AI mode" value={systemStatus.ai?.mode ?? 'demo'} tone={systemStatus.ai?.mode === 'configured' ? 'positive' : 'warning'} />
        <StatCard label="Demo reset" value={systemStatus.disableDemoReset || !systemStatus.demoMode ? 'Protected' : 'Enabled'} tone={systemStatus.disableDemoReset || !systemStatus.demoMode ? 'positive' : 'danger'} />
      </div>
      <div className="dashboardSplit">
        <DashboardCard title="Runtime details">
          <ul className="featureList">
            <li>App URL: {systemStatus.appUrl ?? 'Not configured'}</li>
            <li>API base URL: {systemStatus.apiBaseUrl ?? 'Not configured'}</li>
            <li>Storage: {systemStatus.storage?.type ?? 'Unknown'}</li>
            <li>Seed protection: {systemStatus.storage?.seedProtection ?? 'Unknown'}</li>
            <li>Version: {systemStatus.version ?? 'Unknown'}</li>
            <li>Checked: {systemStatus.timestamp ?? 'Unknown'}</li>
          </ul>
        </DashboardCard>
        <DashboardCard title="Warnings">
          <ul className="featureList">
            {(systemStatus.warnings?.length ? systemStatus.warnings : ['No warnings reported.']).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </DashboardCard>
      </div>
    </AppShell>
  );
}

export function GoLiveChecklistScreen() {
  const { goLiveChecklist } = useSystemReadiness();

  return (
    <AppShell title="Go-live checklist" subtitle="Use this page to stress test the stack before moving from local demo to a limited pilot deployment." navItems={consoleLinks}>
      <div className="statsGrid">
        <StatCard label="Overall status" value={goLiveChecklist.summaryStatus.toUpperCase()} tone={goLiveChecklist.summaryStatus === 'pass' ? 'positive' : goLiveChecklist.summaryStatus === 'warning' ? 'warning' : 'danger'} />
        <StatCard label="Checklist items" value={goLiveChecklist.items.length} />
      </div>
      <div className="stackGrid">
        {goLiveChecklist.items.map((item) => (
          <DashboardCard key={item.id} title={item.label}>
            <div className="inlineActions">
              <StatusBadge status={item.status === 'pass' ? 'Completed' : item.status === 'warning' ? 'Needs Review' : 'Missed'} />
            </div>
            <p>{item.detail}</p>
          </DashboardCard>
        ))}
      </div>
    </AppShell>
  );
}

export function IntegrationsReadinessScreen() {
  const { integrations } = useSystemReadiness();
  const { showToast } = useDemoStore();
  const configuredCount = integrations.filter((integration) => integration.status === 'Configured').length;
  const demoCount = integrations.filter((integration) => integration.status === 'Demo').length;
  const futureCount = integrations.filter((integration) => integration.status === 'Future').length;
  const notConfiguredCount = integrations.filter((integration) => integration.status === 'Not configured').length;
  const getIntegrationActionLabel = (integration: IntegrationCardPayload) => {
    if (integration.status === 'Configured') return 'Test Connection';
    if (integration.status === 'Demo') return 'Record Demo Check';
    if (integration.status === 'Future') return 'Review Future Scope';
    return 'Review Configuration';
  };
  const getIntegrationOutcome = (integration: IntegrationCardPayload) => {
    if (integration.status === 'Configured') return `${integration.label} connection check passed in demo mode.`;
    if (integration.status === 'Demo') return `${integration.label} is running in demo mode; no external send was attempted.`;
    if (integration.status === 'Future') return `${integration.label} is future-ready only; no live integration is claimed.`;
    return `${integration.label} needs configuration before pilot use.`;
  };

  return (
    <AppShell title="Integration readiness" subtitle="See what is configured, still in demo mode, or only future-ready before promising anything in a pilot rollout." navItems={consoleLinks}>
      <div className="stackGrid">
        <div className="statsGrid">
          <StatCard label="Configured" value={configuredCount} tone={configuredCount ? 'positive' : 'neutral'} />
          <StatCard label="Demo mode" value={demoCount} tone={demoCount ? 'warning' : 'neutral'} />
          <StatCard label="Needs config" value={notConfiguredCount} tone={notConfiguredCount ? 'danger' : 'positive'} />
          <StatCard label="Future-ready" value={futureCount} tone="info" />
        </div>

        <div className="cardGridThree">
          {integrations.map((integration) => (
            <DashboardCard key={integration.id} title={integration.label}>
              <div className="inlineActions">
                <StatusBadge status={integration.status} />
              </div>
              <p>{integration.description}</p>
              <div className="detailFactGrid">
                <div><span>Status</span><strong>{integration.status}</strong></div>
                <div><span>Required config</span><strong>{integration.requiredConfig}</strong></div>
              </div>
              <button type="button" className="button secondaryButton" onClick={() => showToast(getIntegrationOutcome(integration))}>
                {getIntegrationActionLabel(integration)}
              </button>
            </DashboardCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export function DataExportScreen() {
  const { clients, caregivers, visits, incidents, familyConcerns, weeklyReports, users, showToast } = useDemoStore();
  const auditLogs = visits.flatMap((visit) => visit.auditLogs);
  const exportTypes: Array<'clients' | 'caregivers' | 'visits' | 'incidents' | 'familyConcerns' | 'weeklyReports' | 'auditLogs'> = [
    'clients',
    'caregivers',
    'visits',
    'incidents',
    'familyConcerns',
    'weeklyReports',
    'auditLogs',
  ];
  const exportLabels: Record<typeof exportTypes[number], string> = {
    clients: 'Clients',
    caregivers: 'Caregivers',
    visits: 'Visits',
    incidents: 'Incidents',
    familyConcerns: 'Family concerns',
    weeklyReports: 'Weekly reports',
    auditLogs: 'Audit logs',
  };

  const downloadCsv = (type: typeof exportTypes[number]) => {
    const payload = buildDataExportCsv(type, { clients, caregivers, visits, incidents, familyConcerns, weeklyReports, auditLogs, users });
    if (!payload.csv) {
      showToast(`No ${type} records are available to export in this demo state.`);
      return;
    }
    const blob = new Blob([payload.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = payload.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(`${payload.rowCount} ${type} records exported in demo mode.`);
  };

  return (
    <AppShell title="Data export" subtitle="Owner and admin export surface for agency-scoped operational records, with safe CSV downloads." navItems={consoleLinks}>
      <div className="stackGrid">
        {exportTypes.map((type) => (
          <DashboardCard key={type} title={exportLabels[type]}>
            <p>Export agency-scoped {exportLabels[type].toLowerCase()} data as CSV for pilot review, billing prep, or offline validation.</p>
            <div className="inlineActions">
              <button type="button" className="button primaryButton" onClick={() => downloadCsv(type)}>
                Export CSV
              </button>
              <button type="button" className="button ghostButton" onClick={() => showToast('PDF export can be connected for production; CSV export is available in this demo.')}>
                Export PDF
              </button>
            </div>
          </DashboardCard>
        ))}
      </div>
    </AppShell>
  );
}

export { AuditTimeline, ApprovalBadge, DetailDrawer, MetricCard, ModuleDashboard, NextActionPanel, PageHeader, RiskBadge } from './ui';
