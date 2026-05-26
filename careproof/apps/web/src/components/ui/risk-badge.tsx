'use client';

export function RiskBadge({ level }: { level: string }) {
  const toneMap: Record<string, string> = {
    Low: 'statusBadge-neutral',
    Medium: 'statusBadge-warning',
    High: 'statusBadge-danger',
    Critical: 'statusBadge-danger',
  };
  const tone = toneMap[level] ?? 'statusBadge-neutral';
  return <span className={`statusBadge ${tone}`}>{level}</span>;
}
