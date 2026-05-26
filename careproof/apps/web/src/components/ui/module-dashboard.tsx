'use client';

import type { ReactNode } from 'react';

export function ModuleDashboard({ children }: { children: ReactNode }) {
  return <div className="dashboardSplit">{children}</div>;
}
