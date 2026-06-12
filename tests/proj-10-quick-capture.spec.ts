/**
 * E2E tests for PROJ-10: Quick Capture (FAB, Keyboard-Shortcut, Modal, Image Upload)
 *
 * Structural tests run without credentials.
 * Modal / save tests require TEST_EMAIL / TEST_PASSWORD.
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP_AUTH = !TEST_PASSWORD
const TS = Date.now()

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// ── Strukturelle Tests (kein Auth nötig) ────────────────────────────────────

test('Login-Seite lädt ohne Fehler', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
})

test('Hauptseite leitet Unauthentifizierte zu /login weiter', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/login/)
})

// ── FAB Tests ─────────────────────────────────────────────────────────────────

test('FAB ist nach Login auf der Hauptseite sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const fab = page.getByRole('button', { name: /quick capture öffnen/i })
  await expect(fab).toBeVisible({ timeout: 5000 })
})

test('FAB hat mindestens 56px Touch-Target (h-14 w-14)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const fab = page.getByRole('button', { name: /quick capture öffnen/i })
  await expect(fab).toBeVisible()
  const box = await fab.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(56)
  expect(box?.height).toBeGreaterThanOrEqual(56)
})

test('FAB klick öffnet Quick-Capture-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('heading', { name: /quick capture/i })).toBeVisible()
})

test('FAB-Klick öffnet kein zweites Modal wenn bereits offen', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Click FAB again — should not open second dialog
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  const dialogs = page.getByRole('dialog')
  await expect(dialogs).toHaveCount(1)
})

test('FAB ist auch auf der Collections-Seite sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  const fab = page.getByRole('button', { name: /quick capture öffnen/i })
  await expect(fab).toBeVisible({ timeout: 5000 })
})

// ── Keyboard-Shortcut Tests ───────────────────────────────────────────────────

test('Q-Taste öffnet Quick-Capture-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.keyboard.press('q')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 })
  await expect(page.getByRole('heading', { name: /quick capture/i })).toBeVisible()
})

test('Großes Q öffnet Quick-Capture-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.keyboard.press('Q')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 })
})

test('Q-Taste wird ignoriert wenn Suche-Input fokussiert ist', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Focus the search field
  await page.getByPlaceholder(/suchen/i).click()
  await page.keyboard.press('q')
  // Modal should NOT open — q was typed into search
  await expect(page.getByRole('heading', { name: /quick capture/i })).not.toBeVisible()
  // q was inserted into search
  const searchValue = await page.getByPlaceholder(/suchen/i).inputValue()
  expect(searchValue).toContain('q')
})

test('Q tut nichts wenn Quick-Capture bereits offen ist', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.keyboard.press('q')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('q')
  // Still only one dialog
  await expect(page.getByRole('dialog')).toHaveCount(1)
})

// ── Modal — Formular ──────────────────────────────────────────────────────────

test('Modal: Prompt-Text-Feld hat Auto-Fokus', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Textarea should be focused
  const textarea = page.locator('#qc-content')
  await expect(textarea).toBeFocused({ timeout: 2000 })
})

test('Modal: Speichern ohne Prompt-Text zeigt Validierungsfehler', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByText(/pflichtfeld|erforderlich/i)).toBeVisible()
  // Dialog stays open
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('Modal: Auto-Titel aus ersten 50 Zeichen wenn kein Titel eingegeben', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  const longText = `PROJ10-AutoTitle-${TS} ` + 'x'.repeat(80)
  await page.locator('#qc-content').fill(longText)
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
  // The prompt title should be the first 50 chars of the text
  const expectedTitle = longText.trim().slice(0, 50).trimEnd()
  await expect(page.getByText(expectedTitle)).toBeVisible({ timeout: 5000 })
})

test('Modal: Eigener Titel wird unverändert gespeichert', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const customTitle = `PROJ10-CustomTitle-${TS}`
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Prompt Text für Custom Title Test')
  await page.locator('#qc-title').fill(customTitle)
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
  await expect(page.getByText(customTitle)).toBeVisible({ timeout: 5000 })
})

// ── Post-Save-Verhalten ───────────────────────────────────────────────────────

test('Nach Speichern schließt Modal und neuer Prompt erscheint im Grid', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ10-Grid-${TS}`
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Quick Capture E2E Test Prompt')
  await page.locator('#qc-title').fill(title)
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
  await expect(page.getByText(title)).toBeVisible({ timeout: 5000 })
})

test('Nach Speichern erscheint Success-Toast mit Aktions-Buttons', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ10-Toast-${TS}`
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Toast-Test Prompt')
  await page.locator('#qc-title').fill(title)
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
  // Toast with actions should appear
  await expect(page.getByText(/prompt gespeichert/i)).toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('button', { name: /im editor öffnen/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /prompt ansehen/i })).toBeVisible()
})

test('Toast-Aktion „Im Editor öffnen" öffnet den Editor', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ10-OpenEditor-${TS}`
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Editor-Test Prompt')
  await page.locator('#qc-title').fill(title)
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /im editor öffnen/i }).click()
  // Editor modal should open with edit mode
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText(/prompt bearbeiten/i)).toBeVisible()
})

// ── isDirty — Schutz vor Datenverlust ────────────────────────────────────────

test('isDirty=false: ESC schließt Modal ohne Dialog', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // No content typed → isDirty = false
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 })
})

test('isDirty=true: ESC zeigt Bestätigungs-Dialog', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Etwas eingegeben')
  await page.keyboard.press('Escape')
  // Discard confirmation dialog should appear
  await expect(page.getByText(/quick capture verwerfen/i)).toBeVisible({ timeout: 2000 })
  await expect(page.getByRole('button', { name: /weiter bearbeiten/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /verwerfen/i })).toBeVisible()
})

test('isDirty: „Weiter bearbeiten" schließt Dialog, Quick Capture bleibt offen mit Daten', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Inhalt bleibt erhalten')
  await page.keyboard.press('Escape')
  await expect(page.getByText(/quick capture verwerfen/i)).toBeVisible()
  await page.getByRole('button', { name: /weiter bearbeiten/i }).click()
  // Modal stays open with data
  await expect(page.getByRole('heading', { name: /quick capture/i })).toBeVisible()
  await expect(page.locator('#qc-content')).toHaveValue('Inhalt bleibt erhalten')
})

test('isDirty: „Verwerfen" schließt Modal und löscht Daten', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await page.locator('#qc-content').fill('Wird verworfen')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /verwerfen/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 })
  // Reopen — form should be empty
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.locator('#qc-content')).toHaveValue('')
})

// ── Drop-Zone ─────────────────────────────────────────────────────────────────

test('Drop-Zone ist im Modal sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /quick capture öffnen/i }).click()
  await expect(page.getByText(/bilder hier ablegen/i)).toBeVisible()
})

// ── Regression: Bestehende Features funktionieren noch ───────────────────────

test('Neuer Prompt via Header-Button funktioniert noch (kein Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ10-Regression-${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: /neuer prompt/i })).toBeVisible()
  await page.getByLabel(/titel/i).fill(title)
  await page.getByLabel(/prompt-text/i).fill('Regression Test PROJ-10')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText(title)).toBeVisible()
})

test('Suche funktioniert noch nach PROJ-10', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByPlaceholder(/suchen/i)).toBeVisible()
  await page.getByPlaceholder(/suchen/i).fill('test')
  // Grid updates (no crash)
  await page.waitForTimeout(500)
  await expect(page.getByPlaceholder(/suchen/i)).toHaveValue('test')
})

test('Favoriten-Herz funktioniert noch', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByTitle(/nur favoriten/i).or(page.getByLabel(/nur favoriten/i))).toBeVisible()
})
