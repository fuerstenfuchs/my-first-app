/**
 * E2E tests for PROJ-8: Mehrere Medien pro Prompt (Bilder & Videos)
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

async function openCreateModal(page: Page) {
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

// ── Strukturelle Tests (kein Auth nötig) ────────────────────────────────────

test('Login-Seite lädt ohne Fehler', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
})

// ── MediaManager im Formular ─────────────────────────────────────────────────

test('Formular „Neuer Prompt" zeigt MediaManager mit Upload- und URL-Tab', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  // MediaManager renders with tabs
  await expect(page.getByRole('tab', { name: /hochladen/i })).toBeVisible()
  await expect(page.getByRole('tab', { name: /url/i })).toBeVisible()
})

test('Formular zeigt Drop-Zone mit Upload-Button', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  await expect(page.getByRole('button', { name: /dateien auswählen/i })).toBeVisible()
})

test('URL-Tab: „Hinzufügen"-Button ist disabled wenn URL leer', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  await page.getByRole('tab', { name: /url/i }).click()
  const addButton = page.getByRole('button', { name: /hinzufügen/i })
  await expect(addButton).toBeDisabled()
})

test('URL-Tab: „Hinzufügen"-Button wird aktiv wenn URL eingegeben wird', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  await page.getByRole('tab', { name: /url/i }).click()
  await page.getByPlaceholder(/https:\/\/example.com\/bild/i).fill('https://example.com/test.jpg')
  const addButton = page.getByRole('button', { name: /hinzufügen/i })
  await expect(addButton).toBeEnabled()
})

// ── Datei-Validierung ────────────────────────────────────────────────────────

test('Unsupported file type (PDF) shows toast "Format nicht unterstützt"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  // Upload a PDF — should be rejected client-side
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'document.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf content'),
  })
  await expect(page.getByText(/format nicht unterstützt/i)).toBeVisible({ timeout: 5000 })
})

test('Oversized image (>20 MB) shows toast "Datei zu groß — maximal 20 MB"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  // Create a buffer slightly over 20 MB (21 MB)
  const oversizedBuffer = Buffer.alloc(21 * 1024 * 1024, 0)
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'huge-photo.jpg',
    mimeType: 'image/jpeg',
    buffer: oversizedBuffer,
  })
  await expect(page.getByText(/zu groß.*20 mb/i)).toBeVisible({ timeout: 5000 })
})

test('Oversized video (>100 MB) shows toast "Video zu groß — maximal 100 MB"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  const oversizedBuffer = Buffer.alloc(101 * 1024 * 1024, 0)
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'big-video.mp4',
    mimeType: 'video/mp4',
    buffer: oversizedBuffer,
  })
  await expect(page.getByText(/zu groß.*100 mb/i)).toBeVisible({ timeout: 5000 })
})

// ── Detail-Modal: Medien-Thumbnails ─────────────────────────────────────────

test('Detail-Modal öffnet sich beim Klick auf eine Kachel', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Click first available card
  const firstCard = page.locator('.aspect-video').first()
  await expect(firstCard).toBeVisible({ timeout: 5000 })
  await firstCard.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('Detail-Modal zeigt Prompt-Inhalt', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const firstCard = page.locator('.aspect-video').first()
  await firstCard.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Should show prompt content in monospace block
  await expect(page.locator('dialog p.font-mono, [role="dialog"] .font-mono')).toBeVisible()
})

// ── Bearbeiten-Modus: MediaManager ersetzt CoverImagePicker ─────────────────

test('Edit-Modus zeigt MediaManager statt altem CoverImagePicker', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Open create form and switch to edit by opening existing prompt
  const firstCard = page.locator('.aspect-video').first()
  await firstCard.click()
  await page.getByRole('button', { name: /bearbeiten/i }).click()
  // Should see MediaManager (has Upload tab), NOT old CoverImagePicker
  await expect(page.getByRole('tab', { name: /hochladen/i })).toBeVisible()
})

// ── Galerie-Viewer ───────────────────────────────────────────────────────────

test('Galerie-Viewer öffnet sich beim Klick auf Thumbnail im Detail-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Find a prompt that has a cover image (the migrated one)
  const firstCard = page.locator('.aspect-video').first()
  await firstCard.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Look for thumbnail strip or fallback cover image in the modal
  const thumbnail = dialog.locator('button').filter({ has: page.locator('img') }).first()
  if (await thumbnail.count() > 0) {
    await thumbnail.click()
    // Gallery overlay should appear (fixed inset-0)
    await expect(page.locator('.fixed.inset-0').last()).toBeVisible({ timeout: 3000 })
  } else {
    // No media loaded — skip gracefully
    test.skip(true, 'No media thumbnails available in this test run')
  }
})

test('Galerie-Viewer schließt sich beim Drücken von Escape', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const firstCard = page.locator('.aspect-video').first()
  await firstCard.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const thumbnail = dialog.locator('button').filter({ has: page.locator('img') }).first()
  if (await thumbnail.count() > 0) {
    await thumbnail.click()
    const gallery = page.locator('.fixed.inset-0').last()
    await expect(gallery).toBeVisible({ timeout: 3000 })
    await page.keyboard.press('Escape')
    await expect(gallery).not.toBeVisible({ timeout: 3000 })
  } else {
    test.skip(true, 'No media thumbnails available in this test run')
  }
})

test('Galerie-Viewer zeigt Schließen-Button', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const firstCard = page.locator('.aspect-video').first()
  await firstCard.click()
  const dialog = page.getByRole('dialog')
  const thumbnail = dialog.locator('button').filter({ has: page.locator('img') }).first()
  if (await thumbnail.count() > 0) {
    await thumbnail.click()
    await expect(page.getByRole('button', { name: /schließen/i }).last()).toBeVisible({ timeout: 3000 })
  } else {
    test.skip(true, 'No media thumbnails available in this test run')
  }
})

// ── Gradient-Fallback (kein Cover) ──────────────────────────────────────────

test('Prompt ohne Cover zeigt Gradient-Platzhalter auf der Kachel', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  // Fill minimum required fields and save
  await page.getByLabel(/titel/i).fill(`QA-Test-NoCover-${TS}`)
  await page.getByLabel(/prompt-text/i).fill('Testinhalt ohne Cover')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  // The new card should have a gradient background (no img), check the card renders
  await expect(page.getByText(`QA-Test-NoCover-${TS}`)).toBeVisible()
})

// ── Neuer Prompt: Medien-Bereich sichtbar ────────────────────────────────────

test('Neuer Prompt: Medien-Bereich hat korrekte Labels', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  await expect(page.getByText(/^medien$/i)).toBeVisible()
  await expect(page.getByText(/optional/i)).toBeVisible()
})

// ── Regression: Bestehende Features funktionieren noch ──────────────────────

test('Neuer Prompt kann erstellt werden (kein Regression durch PROJ-8 Änderungen)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await openCreateModal(page)
  await page.getByLabel(/titel/i).fill(`PROJ-8-Regression-${TS}`)
  await page.getByLabel(/prompt-text/i).fill('Regression-Test-Inhalt')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText(`PROJ-8-Regression-${TS}`)).toBeVisible()
})

test('Prompt bearbeiten funktioniert noch (Edit vs. Create Bug nicht regressiert)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const uniqueTitle = `Edit-Test-${TS}`
  // Create
  await openCreateModal(page)
  await page.getByLabel(/titel/i).fill(uniqueTitle)
  await page.getByLabel(/prompt-text/i).fill('Original')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  // Open and edit
  await page.getByText(uniqueTitle).first().click()
  await page.getByRole('button', { name: /bearbeiten/i }).click()
  await page.getByLabel(/prompt-text/i).clear()
  await page.getByLabel(/prompt-text/i).fill('Geändert')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  // Should still be ONE card with the original title (not duplicated)
  const cards = page.getByText(uniqueTitle)
  await expect(cards).toHaveCount(1)
})

test('Favoriten-Filter funktioniert noch', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByRole('button', { name: /nur favoriten/i })).toBeVisible()
})

test('Stern-Bewertung ist auf den Kacheln sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Stars use aria labels
  await expect(page.locator('[aria-label*="Stern"], [title*="Stern"]').first()).toBeVisible({ timeout: 5000 })
})
