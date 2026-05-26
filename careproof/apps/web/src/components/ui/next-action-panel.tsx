'use client';

import Link from 'next/link';

export interface NextAction {
  id: string;
  label: string;
  description: string;
  href?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function NextActionPanel({
  items,
  emptyLabel,
  emptyDescription,
  emptyHref,
  emptyActionLabel,
}: {
  items: NextAction[];
  emptyLabel?: string;
  emptyDescription?: string;
  emptyHref?: string;
  emptyActionLabel?: string;
}) {
  const displayItems: NextAction[] = items.length
    ? items
    : [
        {
          id: '__empty__',
          label: emptyLabel ?? 'No active items',
          description: emptyDescription ?? 'Everything looks good.',
          href: emptyHref,
          actionLabel: emptyActionLabel,
        },
      ];

  return (
    <div className="priorityStrip">
      {displayItems.map((item) => (
        <div key={item.id} className="priorityItem">
          <div>
            <strong>{item.label}</strong>
            <p>{item.description}</p>
          </div>
          {item.href ? (
            <Link className="button secondaryButton" href={item.href}>
              {item.actionLabel ?? 'View'}
            </Link>
          ) : item.onAction ? (
            <button type="button" className="button secondaryButton" onClick={item.onAction}>
              {item.actionLabel ?? 'Action'}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
