export function buildNotificationTemplate(type: string, data: Record<string, string>) {
  switch (type) {
    case 'caregiver_late':
      return {
        subject: `${data.client} visit is late`,
        message: `${data.client}'s visit is late by ${data.delay}.`,
      };
    case 'visit_missed':
      return {
        subject: `${data.client} visit was missed`,
        message: `${data.client}'s visit was missed and needs coordinator follow-up.`,
      };
    case 'high_severity_incident':
      return {
        subject: `High severity incident for ${data.client}`,
        message: `A high-severity incident was submitted for ${data.client}. Review in CareProof immediately.`,
      };
    case 'family_concern_submitted':
      return {
        subject: `Family concern submitted for ${data.client}`,
        message: `A family concern was submitted for ${data.client}.`,
      };
    case 'required_task_skipped':
      return {
        subject: `Required task skipped for ${data.client}`,
        message: `A required care task was skipped during ${data.client}'s visit.`,
      };
    case 'visit_completed':
      return {
        subject: `${data.client} visit completed`,
        message: `Today’s visit for ${data.client} was completed. ${data.summary}`,
      };
    case 'weekly_report_ready':
      return {
        subject: `Weekly report ready for ${data.client}`,
        message: `The weekly care report for ${data.client} is ready.`,
      };
    case 'nurse_approval_needed':
      return {
        subject: `Nurse approval required for ${data.clientName}`,
        message: `Visit for ${data.clientName} on ${data.date} requires nurse approval.`,
      };
    case 'inspection_finding_opened':
      return {
        subject: `New inspection finding: ${data.title}`,
        message: `Inspection finding "${data.title}" opened with severity ${data.severity}.`,
      };
    case 'expiring_document':
      return {
        subject: `Document expiring: ${data.documentType} for ${data.caregiverName}`,
        message: `${data.documentType} for ${data.caregiverName} expires on ${data.expiryDate}.`,
      };
    case 'medical_availability_missing':
      return {
        subject: `Medical availability not confirmed for ${data.clientName}`,
        message: `Medical availability for client ${data.clientName} has not been confirmed.`,
      };
    case 'social_work_follow_up_due':
      return {
        subject: `Social work follow-up due for ${data.clientName}`,
        message: `Social work case for ${data.clientName} has a follow-up due on ${data.dueDate}.`,
      };
    default:
      return {
        subject: 'CareProof notification',
        message: data.message ?? 'A new CareProof event occurred.',
      };
  }
}
