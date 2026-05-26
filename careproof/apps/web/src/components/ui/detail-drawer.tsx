'use client';

import type { ReactNode } from 'react';

export function DetailDrawer({
  title,
  hasContent,
  emptyTitle,
  emptyText,
  children,
}: {
  title: string;
  hasContent: boolean;
  emptyTitle: string;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section className="dashboardCard">
      <div className="dashboardCardHeader">
        <strong>{title}</strong>
      </div>
      {hasContent ? (
        <div className="longformStack">{children}</div>
      ) : (
        <article className="emptyState">
          <strong>{emptyTitle}</strong>
          <p>{emptyText}</p>
        </article>
      )}
    </section>
  );
}
