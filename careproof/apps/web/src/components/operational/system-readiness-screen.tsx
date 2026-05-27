'use client';

import { useEffect, useState } from 'react';
import { AppShell, DataTable, StatusBadge, StatCard, consoleLinks } from '../careproof-ui';
import { getSystemStatusApi } from '../../lib/api-client';

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

export function SystemReadinessScreen() {
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
