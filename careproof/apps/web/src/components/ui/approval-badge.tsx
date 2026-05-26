'use client';

export function ApprovalBadge({ status }: { status: string }) {
  const toneMap: Record<string, string> = {
    Approved: 'statusBadge-success',
    Rejected: 'statusBadge-danger',
    'Needs Clarification': 'statusBadge-warning',
    'Pending Review': 'statusBadge-warning',
    'Changes Requested': 'statusBadge-warning',
    Escalated: 'statusBadge-danger',
  };
  const tone = toneMap[status] ?? 'statusBadge-neutral';
  return <span className={`statusBadge ${tone}`}>{status}</span>;
}
