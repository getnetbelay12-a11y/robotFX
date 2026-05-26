'use client';

import type { ReactNode } from 'react';

export function MetricCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="miniSummaryCard">
      <strong>{title}</strong>
      {children}
      {actions ? <div className="inlineActions">{actions}</div> : null}
    </div>
  );
}
