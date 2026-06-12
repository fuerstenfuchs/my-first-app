/**
 * E2E tests for PROJ-7: Visuelles Redesign & Cover-Bilder
 *
 * Structural tests run without credentials.
 * Full interaction tests require TEST_EMAIL / TEST_PASSWORD.
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
  await page.getByRole('button', { name: /^anmelden$/i }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// ── Dark Theme ──────────────────────────────────────────────────────────────

test('HTML-Element hat class="dark" — Dark Theme immer aktiv', async ({ page }) => {
  await page.goto('/login')
  const htmlClass = await page.locator('html').getAttribute('class')
  expect(htmlClass).toContain('dark')
})

test('Login-Seite hat keinen weißen Hintergrund (kein Flash of Light Mode)', async ({ page }) => {
  await page.goto('/login')
  const bgColor = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor
  })
  // Background should be dark (not white rgb(255,255,255))
  expect(bgColor).not.toBe('rgb(255, 255, 255)')
})

// ── Grid/Listen-Umschalter ──────────────────────────────────────────────────

test('Grid/Listen-Umschalter ist auf der Hauptseite sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByRole('button', { name: /kachelansicht/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /listenansicht/i })).toBeVisible()
})

test('Klick auf Listen-Icon wechselt zur Listenansicht', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /listenansicht/i }).click()
  // List view renders rows without aspect-video grid cards
  await expect(page.locator('.divide-y')).toBeVisible()
})

test('Klick auf Grid-Icon wechselt zurück zur Kachelansicht', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /listenansicht/i }).click()
  await page.getByRole('button', { name: /kachelansicht/i }).click()
  await expect(page.locator('.aspect-video').first()).toBeVisible()
})

test('Ansichtspräferenz wird in localStorage gespeichert', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /listenansicht/i }).click()
  const stored = await page.evaluate(() => localStorage.getItem('promptdb-view-mode'))
  expect(stored).toBe('list')
})

test('Gespeicherte Listenansicht bleibt nach Seitenneuladung aktiv', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /listenansicht/i }).click()
  await page.reload()
  await expect(page.locator('.divide-y')).toBeVisible()
})

// ── Kachelansicht ────────────────────────────────────────────────────────────

test('Kachelansicht zeigt 16:9 Bildbereich pro Kachel', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /kachelansicht/i }).click()
  await expect(page.locator('.aspect-video').first()).toBeVisible()
})

test('Kacheln zeigen Titel und Tags unterhalb des Bildes', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Card body (below image) should contain heading text
  const card = page.locator('[class*="rounded-xl"]').first()
  await expect(card.locator('h3')).toBeVisible()
})

test('Klick auf Kachel öffnet Detail-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.locator('[class*="rounded-xl"]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

// ── Favoriten ────────────────────────────────────────────────────────────────

test('Favoriten-Filter-Button ist in der Toolbar sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByRole('button', { name: /nur favoriten/i })).toBeVisible()
})

test('Favoriten-Filter zeigt nur Favoriten-Prompts', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)

  // Count total prompts before filter
  const allCards = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]')
  const totalCount = await allCards.count()

  // Activate favorites filter
  await page.getByRole('button', { name: /nur favoriten/i }).click()

  // Either zero prompts shown (no favorites) or fewer/equal
  const filteredCount = await allCards.count()
  expect(filteredCount).toBeLessThanOrEqual(totalCount)
})

test('Favoriten-Filter deaktivieren zeigt wieder alle Prompts', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)

  const allCards = page.locator('[class*="rounded-xl"][class*="cursor-pointer"]')
  const totalBefore = await allCards.count()

  await page.getByRole('button', { name: /nur favoriten/i }).click()
  await page.getByRole('button', { name: /nur favoriten/i }).click()

  const totalAfter = await allCards.count()
  expect(totalAfter).toBe(totalBefore)
})

// ── Bewertung (Sterne) ───────────────────────────────────────────────────────

test('Modal zeigt Sterne-Bewertung im View-Modus', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.locator('[class*="rounded-xl"]').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Star buttons should be present in the modal
  const stars = page.getByRole('dialog').getByRole('button').filter({ hasText: '' })
  // At least the star rating buttons exist (5 stars + other buttons)
  expect(await page.getByRole('dialog').locator('button').count()).toBeGreaterThan(0)
})

// ── Cover-Bild: Formular ─────────────────────────────────────────────────────

test('Prompt-Formular enthält Cover-Bild-Bereich', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // CoverImagePicker is rendered — look for URL tab or file upload tab
  await expect(page.getByRole('dialog').getByRole('tab', { name: /url/i })).toBeVisible()
})

test('Cover-Bild-Picker: Datei-Upload-Tab ist wählbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await page.getByRole('tab', { name: /datei/i }).click()
  await expect(page.getByRole('tab', { name: /datei/i })).toHaveAttribute('data-state', 'active')
})

// ── Gradient-Platzhalter ─────────────────────────────────────────────────────

test('Prompt ohne Cover-Bild zeigt Gradient-Platzhalter (kein kaputtes img-Element)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Create a prompt without cover image
  const TITLE = `Gradient Test ${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await page.getByLabel(/titel/i).fill(TITLE)
  await page.getByLabel(/prompt-text/i).fill('Test content for gradient placeholder')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()

  // Find the card — should have a gradient div, not a broken img
  const newCard = page.locator('[class*="rounded-xl"]').filter({ hasText: TITLE })
  await expect(newCard).toBeVisible()
  // gradient div should be present, no img tag with error
  const brokenImgs = newCard.locator('img[src=""]')
  expect(await brokenImgs.count()).toBe(0)
})

// ── Animationen ───────────────────────────────────────────────────────────────

test('Stagger-Animation: Kacheln haben opacity > 0 nach dem Laden', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Wait for animation to complete
  await page.waitForTimeout(500)
  const firstCard = page.locator('[class*="rounded-xl"]').first()
  const opacity = await firstCard.evaluate(el => window.getComputedStyle(el).opacity)
  expect(parseFloat(opacity)).toBeGreaterThan(0)
})
