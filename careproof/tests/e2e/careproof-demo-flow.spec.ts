import { expect, test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearDemoStore(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('careproof-demo-store-v4');
  });
}

async function selectDemoRole(page: Page, role: string) {
  // <label><span>Demo role</span><select>…</select></label>
  await page.getByLabel('Demo role').selectOption(role);
}

function statCard(page: Page, label: string) {
  return page.locator('.statCard').filter({ hasText: label });
}

// ---------------------------------------------------------------------------
// Setup — fresh demo store for every test
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await clearDemoStore(page);
});

// ---------------------------------------------------------------------------
// 1. Coordinator: dashboard → Maria Johnson visit → proof sections
// ---------------------------------------------------------------------------

test('coordinator sees dashboard, opens Maria 9 AM visit, and confirms proof sections', async ({ page }) => {
  await page.goto('/console/dashboard');
  await expect(page.getByRole('heading', { name: 'Agency dashboard' })).toBeVisible();

  // Nurse Approvals stat on dashboard confirms the module is active
  await expect(page.getByText('Nurse Approvals').first()).toBeVisible();

  // Navigate to Maria's visit
  await page.goto('/console/visits/visit-maria-am');

  // h1 carries the full "Maria Johnson · V-XXXX" title
  await expect(page.locator('h1').filter({ hasText: 'Maria Johnson' })).toBeVisible();

  // Visit proof summary card and key fields
  await expect(page.getByText('Visit proof summary')).toBeVisible();
  await expect(page.getByText('Checklist proof')).toBeVisible();
  await expect(page.getByText('Audit events')).toBeVisible();

  // Operational trust links card
  await expect(page.getByText('Operational trust links')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. Nurse approval is required on the Maria visit
// ---------------------------------------------------------------------------

test('Maria visit shows nurse approval is required', async ({ page }) => {
  await page.goto('/console/visits/visit-maria-am');
  await expect(page.locator('h1').filter({ hasText: 'Maria Johnson' })).toBeVisible();

  // "Nurse approval" stat card must not say "Not Required"
  await expect(statCard(page, 'Nurse approval')).toBeVisible();
  await expect(statCard(page, 'Nurse approval')).not.toContainText('Not Required');
});

// ---------------------------------------------------------------------------
// 3. Nurse opens Nurse Approvals and approves the Maria family-update record
// ---------------------------------------------------------------------------

test('nurse opens approvals queue and approves Maria family update', async ({ page }) => {
  await page.goto('/console/nurse-approvals');
  await selectDemoRole(page, 'Nurse');

  await expect(page.getByRole('heading', { name: 'Nurse approvals' })).toBeVisible();
  await expect(page.getByText('Pending approval')).toBeVisible();
  await expect(page.getByText('Family updates blocked')).toBeVisible();

  // Click Review on the first Maria Johnson approval row
  const mariaRow = page.getByRole('row').filter({ hasText: 'Maria Johnson' }).first();
  await expect(mariaRow).toBeVisible();
  await mariaRow.getByRole('button', { name: 'Review' }).click();

  // Detail panel loads
  const detailPanel = page.locator('.dashboardCard').filter({ hasText: 'Approval detail' });
  await expect(detailPanel.getByText('Maria Johnson')).toBeVisible();

  // Approve → status badge changes in the panel
  await detailPanel.getByRole('button', { name: 'Approve' }).click();
  await expect(detailPanel.getByText('Approved')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 4. Nurse can request changes instead of approving
// ---------------------------------------------------------------------------

test('nurse can request changes on a nurse approval record', async ({ page }) => {
  await page.goto('/console/nurse-approvals');
  await selectDemoRole(page, 'Nurse');

  const mariaRow = page.getByRole('row').filter({ hasText: 'Maria Johnson' }).first();
  await mariaRow.getByRole('button', { name: 'Review' }).click();

  const detailPanel = page.locator('.dashboardCard').filter({ hasText: 'Approval detail' });
  await detailPanel.getByRole('button', { name: 'Request changes' }).click();
  await expect(detailPanel.getByText('Changes Requested')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 5. Family update page: care summary is PENDING until nurse approves
// ---------------------------------------------------------------------------

test('family updates page shows care summary pending before nurse approves', async ({ page }) => {
  await page.goto('/family/updates');
  await expect(page.getByRole('heading', { name: 'Family updates' })).toBeVisible();

  // Subtitle confirms intent
  await expect(
    page.getByText('Approved visit updates only, with internal staff notes kept separate.'),
  ).toBeVisible();

  // "What family can see" hero card
  await expect(page.getByText('What family can see')).toBeVisible();
  await expect(page.getByText('Family-safe visit summaries')).toBeVisible();

  // Maria's visit has no approved summary yet — the care summary label is "Care summary status"
  await expect(page.getByText('Care summary status', { exact: true })).toBeVisible();
  await expect(page.getByText('Care summary is pending staff review before it appears here.')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 6. Family updates page: shows approved content only, no internal staff notes
// ---------------------------------------------------------------------------

test('family updates page shows approved content only with no internal notes', async ({ page }) => {
  await page.goto('/family/updates');
  await expect(page.getByRole('heading', { name: 'Family updates' })).toBeVisible();

  // Family-safe copy present
  await expect(page.getByText('CareProof only shows approved updates')).toBeVisible();

  // Internal notes must never appear
  await expect(page.getByText('Internal only')).toHaveCount(0);
  await expect(page.getByText(/coordinator reviewed staffing/i)).toHaveCount(0);
  await expect(page.getByText(/staff only/i)).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 7. Family portal: nurse approval is blocking the visit update
// ---------------------------------------------------------------------------

test('family health screen shows nurse approval is blocking visit update', async ({ page }) => {
  await page.goto('/console/family-health');
  await expect(page.getByRole('heading', { name: 'Family communication health' })).toBeVisible();

  // "Approval required" stat reflects the two blocked approvals in demo data
  await expect(page.getByText('Approval required')).toBeVisible();
  await expect(statCard(page, 'Approval required')).not.toContainText('0');
});

// ---------------------------------------------------------------------------
// 8. Emily Johnson submits a family concern
// ---------------------------------------------------------------------------

test('Emily Johnson can submit a family concern and track its status', async ({ page }) => {
  await page.goto('/family/concerns');
  await expect(page.getByRole('heading', { name: 'Family concerns' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Submit Concern' })).toBeVisible();

  await page.getByLabel('Message').fill(
    'Please confirm the morning mobility check was completed safely.',
  );
  await page.getByRole('button', { name: 'Submit Concern' }).click();

  // Status tracking section now shows the submitted concern
  const trackingCard = page.locator('article.mobileFeatureCard').filter({ hasText: 'Status tracking' });
  await expect(trackingCard).toBeVisible();
  // After submit the status is "New" and the type shown
  await expect(trackingCard.getByText('New', { exact: true })).toBeVisible();
  await expect(trackingCard.getByText(/Question about missed task/)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 9. Social worker: confirm social work case for Maria Johnson exists
// ---------------------------------------------------------------------------

test('social worker sees Maria Johnson social work case', async ({ page }) => {
  await page.goto('/console/social-work');
  await selectDemoRole(page, 'Social Worker');

  await expect(page.getByRole('heading', { name: 'Social work' })).toBeVisible();
  await expect(page.getByText('Open cases')).toBeVisible();
  await expect(page.getByText('High-risk cases')).toBeVisible();
  await expect(page.getByText('Follow-ups due today')).toBeVisible();

  // Maria Johnson case row
  const mariaRow = page.getByRole('row').filter({ hasText: 'Maria Johnson' });
  await expect(mariaRow).toBeVisible();
  await expect(mariaRow.getByText('Family concern follow-up')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 10. Inspection finding for Maria visit exists
// ---------------------------------------------------------------------------

test('inspection center shows Maria visit documentation finding', async ({ page }) => {
  await page.goto('/console/inspection-center');
  await expect(page.getByRole('heading', { name: 'Inspection center' })).toBeVisible();

  // Open findings stat > 0
  await expect(statCard(page, 'Open findings')).not.toContainText('0');

  // Maria visit finding row
  await expect(page.getByText('Maria visit documentation requires review')).toBeVisible();

  // Inspection rules section (exact: avoids matching the page subtitle which also contains "inspection rules")
  await expect(page.getByText('Inspection rules', { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 11. Medication management shows connected medication safety queues
// ---------------------------------------------------------------------------

test('medication management opens and shows Maria medication safety blockers', async ({ page }) => {
  await page.goto('/console/medications');
  await expect(page.getByRole('heading', { name: 'Medication management' })).toBeVisible();

  await expect(page.getByText('Maria Johnson').first()).toBeVisible();
  await expect(page.getByText('Lisinopril').first()).toBeVisible();
  await expect(page.getByText('Low Stock').first()).toBeVisible();
  await expect(page.getByText('Acetaminophen').first()).toBeVisible();
  await expect(page.getByText('Expired').first()).toBeVisible();
  await expect(page.getByText('Insulin Glargine').first()).toBeVisible();
  await expect(page.getByText('Needs Nurse Review').first()).toBeVisible();

  await page.goto('/console/visits/visit-maria-am');
  await expect(page.getByText('Medication safety')).toBeVisible();
  await expect(page.getByText('Open medication management')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 12. Expiration center shows compliance risk + notification draft
// ---------------------------------------------------------------------------

test('expiration center shows compliance risk and notification draft for Ana Smith CPR', async ({ page }) => {
  await page.goto('/console/expiration-center');
  await expect(page.getByRole('heading', { name: 'Expiration center' })).toBeVisible();

  // "Expiring in 7 days" stat > 0
  await expect(statCard(page, 'Expiring in 7 days')).not.toContainText('0');

  // Ana Smith CPR row in the data table
  const anaRow = page.getByRole('row').filter({ hasText: 'Ana Smith' }).filter({ hasText: 'CPR' });
  await expect(anaRow).toBeVisible();
  await expect(anaRow.getByText('Expiring in 7 days')).toBeVisible();

  // Notification drafts section
  await expect(page.getByText('Notification drafts')).toBeVisible();
  // Draft text for Ana's CPR
  await expect(
    page.getByText(/CPR.*First Aid.*expires in 7 days|expires in 7 days.*CPR/i),
  ).toBeVisible();
  // Human-confirmation disclaimer
  await expect(page.getByText('Human confirmation required before external send.').first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// 13. Caregiver today page
// ---------------------------------------------------------------------------

test('caregiver today page shows assigned visits with Maria Johnson as next visit', async ({ page }) => {
  await page.goto('/caregiver');
  await expect(page.getByRole('heading', { name: 'Caregiver app' })).toBeVisible();

  // "Next visit" module label (exact match avoids "Start Next Visit" link)
  await expect(page.getByText('Next visit', { exact: true })).toBeVisible();
  await expect(page.getByText('Maria Johnson').first()).toBeVisible();

  await expect(page.getByRole('link', { name: 'Start Next Visit' })).toBeVisible();
  await expect(page.getByText('Assigned today')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 14. Caregiver check-in → checklist → note → checkout (demo-only)
// ---------------------------------------------------------------------------

test('caregiver completes Maria visit: check-in, tasks, note, checkout', async ({ page }) => {
  await page.goto('/caregiver/visit/visit-maria-am');
  await expect(page.getByRole('heading', { name: 'Visit workflow' })).toBeVisible();
  await expect(page.getByText('Maria Johnson').first()).toBeVisible();

  // Before check-in: hint text
  await expect(
    page.getByText('Check in before completing tasks, adding notes, or checking out.'),
  ).toBeVisible();

  // Check In
  await page.getByRole('button', { name: 'Check In' }).click();
  await expect(page.getByRole('button', { name: 'Check In' })).toHaveCount(0);

  // Complete all three checklist tasks
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Scheduled/ }).first().click();
  }
  await expect(page.getByRole('button', { name: /Completed/ })).toHaveCount(3);

  // Add a care note
  await page.locator('textarea').first().fill(
    'Maria completed breakfast support and mobility check with no issues noted.',
  );
  await page.getByRole('button', { name: 'Save note' }).click();

  // Checkout section unblocks
  await expect(page.getByText('Checkout readiness')).toBeVisible();
  await page.getByRole('button', { name: 'Check Out' }).click();

  // Family update draft notification after checkout
  await expect(
    page.getByText(/Family update draft|Family update.*Sent|family.*update/i).first(),
  ).toBeVisible();
});

// ---------------------------------------------------------------------------
// 15. Notification draft appears (inspection finding recommended action)
// ---------------------------------------------------------------------------

test('inspection center recommended action text acts as notification draft', async ({ page }) => {
  await page.goto('/console/inspection-center');
  await expect(page.getByRole('heading', { name: 'Inspection center' })).toBeVisible();

  // The finding's recommended action is the actionable draft
  await expect(
    page.getByText('Confirm checklist and care note before approving family update.'),
  ).toBeVisible();

  // Notification mode stat confirms drafts-only mode
  await expect(page.getByText('Draft only')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 16. System readiness does NOT claim production-ready
// ---------------------------------------------------------------------------

test('system readiness honestly reports production blockers', async ({ page }) => {
  await page.goto('/console/system-readiness');
  await expect(page.getByRole('heading', { name: 'System readiness' })).toBeVisible();

  // Subtitle is honest about non-production status
  await expect(page.getByText('Demo-ready does not mean production-ready.')).toBeVisible();

  // "Production blockers" stat must be > 0
  await expect(page.getByText('Production blockers')).toBeVisible();
  await expect(statCard(page, 'Production blockers')).not.toContainText('0');

  // At least one table row says "Production Blocker"
  await expect(page.getByText('Production Blocker').first()).toBeVisible();

  // Never claim the system is production-ready
  await expect(page.getByText('Production Ready')).toHaveCount(0);
  await expect(page.getByText('Ready for production')).toHaveCount(0);
});
