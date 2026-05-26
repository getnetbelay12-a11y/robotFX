'use client';

export function AuditTimeline({
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
