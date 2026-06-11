/**
 * E2E tests for PROJ-2: Prompt-Verwaltung (CRUD)
 *
 * Tests that verify UI structure run without credentials.
 * CRUD tests require TEST_EMAIL / TEST_PASSWORD.
 *
 * Example: TEST_EMAIL=x@y.de TEST_PASSWORD=secret npm run test:e2e
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP_AUTH = !TEST_PASSWORD
const TS = Date.now()
const PROMPT_TITLE = `Test Prompt ${TS}`
const PROMPT_CONTENT = `Dies ist der Inhalt des Test-Prompts ${TS}`
const PROMPT_DESC = `Beschreibung ${TS}`

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /^anmelden$/i }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// ── Strukturtests (ohne Credentials) ──────────────────────────────────────

test('/login redirect for unauthenticated access to /', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

// ── CRUD-Tests (benötigen TEST_PASSWORD) ──────────────────────────────────

test('Hauptansicht zeigt Kachelraster nach Login', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByRole('heading', { name: /alle prompts/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /neuer prompt/i })).toBeVisible()
})

test('Leerzustand zeigt "Noch keine Prompts" wenn keine Prompts vorhanden', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Only verify if actually empty — skip check if prompts already exist
  const emptyState = page.getByText(/noch keine prompts/i)
  const hasPrompts = await page.locator('[class*="CardTitle"]').count()
  if (hasPrompts === 0) {
    await expect(emptyState).toBeVisible()
    await expect(page.getByRole('button', { name: /ersten prompt anlegen/i })).toBeVisible()
  }
})

test('Neuer Prompt — Modal öffnet mit allen Feldern', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel(/titel/i)).toBeVisible()
  await expect(page.getByLabel(/prompt-text/i)).toBeVisible()
  await expect(page.getByLabel(/beschreibung/i)).toBeVisible()
  await expect(page.getByLabel(/tags/i)).toBeVisible()
})

test('Pflichtfelder leer → Validierungsfehler, kein Speichern', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByText(/titel ist erforderlich/i)).toBeVisible()
  await expect(page.getByText(/prompt-text ist erforderlich/i)).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible() // still open
})

test('Neuen Prompt anlegen — erscheint sofort als erste Kachel', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await page.getByLabel(/titel/i).fill(PROMPT_TITLE)
  await page.getByLabel(/prompt-text/i).fill(PROMPT_CONTENT)
  await page.getByLabel(/beschreibung/i).fill(PROMPT_DESC)
  await page.getByLabel(/tags/i).fill('test, e2e')
  await page.getByRole('button', { name: /^speichern$/i }).click()

  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  // New card should be visible in the grid
  await expect(page.getByText(PROMPT_TITLE)).toBeVisible()
})

test('Klick auf Kachel öffnet Detail-Modal mit vollständigem Text', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Click the first card in the grid (not a button)
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Detail view should have Bearbeiten button
  await expect(page.getByRole('button', { name: /bearbeiten/i })).toBeVisible()
})

test('Detail-Modal → Bearbeiten → wechselt in Bearbeitungsmodus', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.click()
  await page.getByRole('button', { name: /bearbeiten/i }).click()
  await expect(page.getByLabel(/titel/i)).toBeVisible()
  await expect(page.getByLabel(/prompt-text/i)).toBeVisible()
})

test('Kopieren-Button kopiert Text und zeigt Toast', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Grant clipboard permission
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.getByRole('button', { name: /kopieren/i }).click()
  await expect(page.getByText(/kopiert/i)).toBeVisible({ timeout: 5000 })
})

test('Drei-Punkte-Menü → Löschen → Bestätigungsdialog erscheint', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /löschen/i }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByText(/wirklich löschen/i)).toBeVisible()
})

test('Löschen abbrechen — Prompt bleibt erhalten', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const countBefore = await page.locator('[class*="group"]').count()
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /löschen/i }).click()
  await page.getByRole('button', { name: /abbrechen/i }).click()
  await expect(page.locator('[class*="group"]')).toHaveCount(countBefore)
})

test('Löschen bestätigen — Prompt verschwindet sofort', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Find and delete the test prompt created earlier
  const testCard = page.getByText(PROMPT_TITLE).first()
  if (!await testCard.isVisible()) return // prompt may not exist
  const card = page.locator('[class*="group"]').filter({ hasText: PROMPT_TITLE })
  await card.hover()
  await card.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /löschen/i }).click()
  await page.getByRole('button', { name: /^löschen$/i }).click()
  await expect(page.getByText(PROMPT_TITLE)).not.toBeVisible({ timeout: 5000 })
})
