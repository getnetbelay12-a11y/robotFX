'use client';

import Link from 'next/link';
import {
  AppShell,
  DashboardCard,
  DataTable,
  StatCard,
  StatusBadge,
  consoleLinks,
  useReferenceData,
} from '../../careproof-ui';
import { caregivers, clients } from '../../../data/demoCareProofData';
import { getVisitDisplayStatus } from '../../../lib/careproof-status';
import { useDemoStore } from '../../../lib/demoStore';
import {
  buildAgencyHealthScore,
  buildBranchPerformance,
  buildCaregiverSupportRecords,
  buildClientRiskRecords,
  buildExecutiveTrends,
  buildFamilyCommunicationHealth,
  getOperationalVisitMetrics,
} from '../../../lib/management-helpers';

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
