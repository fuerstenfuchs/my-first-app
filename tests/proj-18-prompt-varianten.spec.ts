/**
 * E2E tests for PROJ-18: Prompt-Varianten
 *
 * UI-Struktur-Tests laufen ohne Credentials.
 * Varianten-CRUD-Tests benötigen TEST_EMAIL / TEST_PASSWORD.
 *
 * Beispiel: TEST_EMAIL=x@y.de TEST_PASSWORD=secret npm run test:e2e -- tests/proj-18-prompt-varianten.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP_AUTH = !TEST_PASSWORD
const TS = Date.now()

const PROMPT_TITLE = `Varianten-Test ${TS}`
const PROMPT_CONTENT = `Original Prompt-Text für Varianten-Test ${TS}`
const VARIANT_CONTENT = `Variante 2 — andererer Text für denselben Prompt ${TS}`
const VARIANT_NAME = `Mit [Person] ${TS}`

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /^anmelden$/i }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

async function createPromptAndOpenModal(page: Page): Promise<void> {
  // Create a new prompt via the modal
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/titel/i).fill(PROMPT_TITLE)
  await dialog.getByLabel(/prompt-text/i).fill(PROMPT_CONTENT)
  await dialog.getByRole('button', { name: /^speichern$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // Open the view modal for the newly created prompt
  const card = page.locator('[class*="CardTitle"]').filter({ hasText: PROMPT_TITLE }).first()
  await card.click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

// ── Strukturtests (ohne Credentials) ─────────────────────────────────────────

test('PROJ-18: /login redirect für unauthentifizierten Zugriff', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

// ── Progressives Verhalten ────────────────────────────────────────────────────

test('PROJ-18: AC-1 — Eintrag ohne Varianten zeigt kein Badge', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)
  await createPromptAndOpenModal(page)

  // Kein Varianten-Badge auf der Karte
  const card = page.locator('[class*="Card"]').filter({ hasText: PROMPT_TITLE }).first()
  await page.getByRole('button', { name: /schließen/i }).click()
  await expect(card.getByText(/varianten/i)).not.toBeVisible()

  // Kein Tab, kein Dropdown im Modal
  const card2 = page.locator('[class*="CardTitle"]').filter({ hasText: PROMPT_TITLE }).first()
  await card2.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('tab')).not.toBeVisible()
  await expect(dialog.getByRole('combobox')).not.toBeVisible()
})

test('PROJ-18: AC-1b — Modal zeigt "+ Neue Variante"-Link bei Einzel-Prompt', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)
  await createPromptAndOpenModal(page)

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /neue variante/i })).toBeVisible()
  await page.getByRole('button', { name: /schließen/i }).click()
})

// ── Neue Variante erstellen ───────────────────────────────────────────────────

test('PROJ-18: AC-2 — Klick auf "+ Neue Variante" zeigt Eingabeformular', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)
  await createPromptAndOpenModal(page)

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /neue variante/i }).click()

  // Formular erscheint
  await expect(dialog.getByText(/neue variante/i)).toBeVisible()
  await expect(dialog.getByPlaceholder(/name.*optional/i)).toBeVisible()
  await expect(dialog.getByPlaceholder(/prompt-text/i)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^erstellen$/i })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /abbrechen/i })).toBeVisible()

  await page.getByRole('button', { name: /schließen/i }).click()
})

test('PROJ-18: AC-3 — Variante erstellen wechselt in Multi-Varianten-Modus', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)

  // Neuen Prompt erstellen
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/titel/i).fill(`Varianten-Modus-Test ${TS}`)
  await dialog.getByLabel(/prompt-text/i).fill(PROMPT_CONTENT)
  await dialog.getByRole('button', { name: /^speichern$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // Modal öffnen und erste Variante hinzufügen
  const card = page.locator('[class*="CardTitle"]').filter({ hasText: `Varianten-Modus-Test ${TS}` }).first()
  await card.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: /neue variante/i }).click()

  // Variante mit Name und Inhalt erstellen
  await modal.getByPlaceholder(/name.*optional/i).fill(VARIANT_NAME)
  await modal.getByPlaceholder(/prompt-text/i).fill(VARIANT_CONTENT)
  await modal.getByRole('button', { name: /^erstellen$/i }).click()

  // Nach dem Erstellen: Tabs erscheinen (Multi-Varianten-Modus)
  await expect(modal.getByRole('tab')).toBeVisible({ timeout: 8000 })
  // Mindestens 2 Tabs (Variante 1 + neue Variante)
  const tabs = modal.getByRole('tab')
  const tabCount = await tabs.count()
  expect(tabCount).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: /schließen/i }).click()
})

test('PROJ-18: AC-4 — Auto-Name "Variante N" wenn kein Name angegeben', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)
  await createPromptAndOpenModal(page)

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /neue variante/i }).click()

  // Ohne Name — nur Inhalt eingeben
  await dialog.getByPlaceholder(/prompt-text/i).fill(`Auto-name test ${TS}`)
  await dialog.getByRole('button', { name: /^erstellen$/i }).click()

  // Tabs erscheinen mit auto-generierten Namen
  await expect(dialog.getByRole('tab', { name: /variante/i }).first()).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /schließen/i }).click()
})

// ── Galerie-Badge ─────────────────────────────────────────────────────────────

test('PROJ-18: AC-5 — Galerie-Badge "N Varianten" erscheint nach Varianten-Erstellung', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)

  const promptTitle = `Badge-Test ${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/titel/i).fill(promptTitle)
  await dialog.getByLabel(/prompt-text/i).fill(PROMPT_CONTENT)
  await dialog.getByRole('button', { name: /^speichern$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  // Prompt öffnen und Variante erstellen
  const card = page.locator('[class*="CardTitle"]').filter({ hasText: promptTitle }).first()
  await card.click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: /neue variante/i }).click()
  await modal.getByPlaceholder(/prompt-text/i).fill(`Badge-Variante ${TS}`)
  await modal.getByRole('button', { name: /^erstellen$/i }).click()
  await expect(modal.getByRole('tab')).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /schließen/i }).click()

  // Badge in der Galerie-Karte prüfen
  const cardAfter = page.locator('[class*="Card"]').filter({ hasText: promptTitle }).first()
  await expect(cardAfter.getByText(/varianten/i)).toBeVisible({ timeout: 5000 })
})

// ── Modal-Navigation ──────────────────────────────────────────────────────────

test('PROJ-18: AC-6 — Tab-Klick zeigt Inhalt der gewählten Variante', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)

  // Suche einen Prompt, der schon Varianten hat (vom vorherigen Test)
  // Oder erstelle einen neuen
  const promptTitle = `Tab-Switch-Test ${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/titel/i).fill(promptTitle)
  await dialog.getByLabel(/prompt-text/i).fill('Inhalt Variante 1')
  await dialog.getByRole('button', { name: /^speichern$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  const card = page.locator('[class*="CardTitle"]').filter({ hasText: promptTitle }).first()
  await card.click()
  const modal = page.getByRole('dialog')

  // Variante erstellen
  await modal.getByRole('button', { name: /neue variante/i }).click()
  await modal.getByPlaceholder(/prompt-text/i).fill('Inhalt Variante 2 — komplett anders')
  await modal.getByRole('button', { name: /^erstellen$/i }).click()
  await expect(modal.getByRole('tab')).toBeVisible({ timeout: 8000 })

  // Auf Tab 1 klicken — Inhalt von V1 sollte erscheinen
  const tabs = modal.getByRole('tab')
  const firstTab = tabs.first()
  await firstTab.click()
  // Textarea hat Inhalt von V1
  const textarea = modal.locator('textarea').last()
  const v1Content = await textarea.inputValue()
  expect(v1Content).toContain('Inhalt Variante 1')

  // Auf Tab 2 klicken — Inhalt von V2 sollte erscheinen
  const secondTab = tabs.nth(1)
  await secondTab.click()
  const v2Content = await textarea.inputValue()
  expect(v2Content).toContain('Inhalt Variante 2')

  await page.getByRole('button', { name: /schließen/i }).click()
})

// ── Variante löschen ──────────────────────────────────────────────────────────

test('PROJ-18: AC-9 — Löschen zeigt Bestätigungsdialog', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)

  const promptTitle = `Lösch-Test ${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/titel/i).fill(promptTitle)
  await dialog.getByLabel(/prompt-text/i).fill(PROMPT_CONTENT)
  await dialog.getByRole('button', { name: /^speichern$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  const card = page.locator('[class*="CardTitle"]').filter({ hasText: promptTitle }).first()
  await card.click()
  const modal = page.getByRole('dialog')

  // Variante erstellen
  await modal.getByRole('button', { name: /neue variante/i }).click()
  await modal.getByPlaceholder(/prompt-text/i).fill(`Zum-Löschen ${TS}`)
  await modal.getByRole('button', { name: /^erstellen$/i }).click()
  await expect(modal.getByRole('tab')).toBeVisible({ timeout: 8000 })

  // Löschen-Button klicken
  await modal.getByTitle(/variante löschen/i).click()

  // Bestätigungsdialog erscheint
  const confirmDialog = page.getByRole('alertdialog')
  await expect(confirmDialog).toBeVisible()
  await expect(confirmDialog.getByText(/löschen/i)).toBeVisible()
  await expect(confirmDialog.getByRole('button', { name: /abbrechen/i })).toBeVisible()

  // Abbrechen — Variante bleibt erhalten
  await confirmDialog.getByRole('button', { name: /abbrechen/i }).click()
  await expect(modal.getByRole('tab')).toBeVisible()
  await page.getByRole('button', { name: /schließen/i }).click()
})

test('PROJ-18: AC-8 — Löschen bis 1 Variante kehrt in Einzel-Modus zurück', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)

  const promptTitle = `Revert-Test ${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/titel/i).fill(promptTitle)
  await dialog.getByLabel(/prompt-text/i).fill('Revert-Text')
  await dialog.getByRole('button', { name: /^speichern$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 5000 })

  const card = page.locator('[class*="CardTitle"]').filter({ hasText: promptTitle }).first()
  await card.click()
  const modal = page.getByRole('dialog')

  // Variante erstellen
  await modal.getByRole('button', { name: /neue variante/i }).click()
  await modal.getByPlaceholder(/prompt-text/i).fill(`Variante-2-Inhalt ${TS}`)
  await modal.getByRole('button', { name: /^erstellen$/i }).click()
  await expect(modal.getByRole('tab')).toBeVisible({ timeout: 8000 })

  // Aktive Variante löschen (V2 sollte aktiv sein nach Erstellen)
  await modal.getByTitle(/variante löschen/i).click()
  const confirmDialog = page.getByRole('alertdialog')
  await confirmDialog.getByRole('button', { name: /^löschen$/i }).click()

  // Toast erscheint
  await expect(page.getByText(/zurück/i)).toBeVisible({ timeout: 5000 })

  // Tabs sind verschwunden (Einzel-Modus)
  await expect(modal.getByRole('tab')).not.toBeVisible()

  // Content-Box erscheint wieder (normaler Modus)
  // Modal zeigt wieder den normalen Prompt-Text
  await page.getByRole('button', { name: /schließen/i }).click()
})

// ── Sicherheits-Tests ─────────────────────────────────────────────────────────
// Auth-Enforcement wird via Vitest-Unitests verifiziert (variants.test.ts).
// Hier wird geprüft, dass die API korrekt validiert wenn eingeloggt.

test('PROJ-18: Security — unauthentifizierter Zugriff wird auf /login umgeleitet', async ({ page }) => {
  // Ohne Login → Redirect auf /login (Next.js App Router schützt die App-Shell)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('PROJ-18: Security — leerer Content → 400 Validation Error (eingeloggt)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)
  const res = await page.request.post('/api/variants', {
    data: { prompt_id: '00000000-0000-4000-8000-000000000001', content: '' },
  })
  // Leer content → 400 (Zod-Validation)
  expect(res.status()).toBe(400)
})

test('PROJ-18: Security — ungültige UUID → 400 Validation Error (eingeloggt)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)
  const res = await page.request.post('/api/variants', {
    data: { prompt_id: 'nicht-eine-uuid', content: 'test content' },
  })
  expect(res.status()).toBe(400)
})

test('PROJ-18: Security — XSS in Varianten-Name wird nicht ausgeführt', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD nicht gesetzt')
  await login(page)

  await createPromptAndOpenModal(page)
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: /neue variante/i }).click()

  const xssPayload = '<script>alert("xss")</script>'
  await modal.getByPlaceholder(/name.*optional/i).fill(xssPayload)
  await modal.getByPlaceholder(/prompt-text/i).fill('legaler Inhalt')
  await modal.getByRole('button', { name: /^erstellen$/i }).click()

  // Kein Dialog (alert) erscheint — XSS nicht ausgeführt
  let alertFired = false
  page.on('dialog', () => { alertFired = true })
  await page.waitForTimeout(1000)
  expect(alertFired).toBe(false)

  await page.getByRole('button', { name: /schließen/i }).click()
})
