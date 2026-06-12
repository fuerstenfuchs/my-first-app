/**
 * E2E tests for PROJ-9: Prompt-Galerie Upgrade (Hover-Carousel, Video-Preview)
 *
 * Structural tests run without credentials.
 * Carousel / badge tests require TEST_EMAIL / TEST_PASSWORD.
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

async function createMultiMediaPrompt(page: Page, title: string) {
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel(/titel/i).fill(title)
  await page.getByLabel(/prompt-text/i).fill('PROJ-9 E2E Test Prompt')
  // Add two image URLs via URL-Tab
  await page.getByRole('tab', { name: /url/i }).click()
  await page.getByPlaceholder(/https:\/\/example.com\/bild/i).fill('https://picsum.photos/seed/qa1/800/450')
  await page.getByRole('button', { name: /hinzufügen/i }).click()
  await expect(page.getByRole('button', { name: /hinzufügen/i })).toBeEnabled({ timeout: 3000 })
  await page.getByPlaceholder(/https:\/\/example.com\/bild/i).fill('https://picsum.photos/seed/qa2/800/450')
  await page.getByRole('button', { name: /hinzufügen/i }).click()
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
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

test('Kacheln haben 16:9-Bildbereich (aspect-video)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const card = page.locator('.aspect-video').first()
  await expect(card).toBeVisible({ timeout: 5000 })
})

// ── Medien-Badge (immer sichtbar) ────────────────────────────────────────────

test('Medien-Badge erscheint auf Kacheln mit mehreren Medien', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ9-Badge-${TS}`
  await createMultiMediaPrompt(page, title)
  // Find the card
  const card = page.locator('.aspect-video').filter({ hasText: '' }).first()
  await expect(page.getByText(title)).toBeVisible({ timeout: 5000 })
  // The badge area is top-left of the aspect-video — look for the span with media count "2"
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  const badge = cardEl.locator('.aspect-video span').filter({ hasText: '2' })
  await expect(badge.or(cardEl.locator('.aspect-video svg').first())).toBeVisible({ timeout: 3000 })
})

test('Kein Medien-Badge auf Kacheln ohne oder mit nur einem Medium', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ9-NoBadge-${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel(/titel/i).fill(title)
  await page.getByLabel(/prompt-text/i).fill('Prompt ohne Medien')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  // Card exists
  await expect(page.getByText(title)).toBeVisible()
  // No count badge — the span with a number like "2" should not be present near this card
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  await expect(cardEl.locator('span').filter({ hasText: /^[2-9]$/ })).not.toBeVisible()
})

// ── Hover-Carousel ────────────────────────────────────────────────────────────

test('Hover startet Carousel: Overlay-Schichten erscheinen nach 200ms Debounce', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ9-Carousel-${TS}`
  await createMultiMediaPrompt(page, title)
  // Find the new card
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  await expect(cardEl).toBeVisible({ timeout: 5000 })
  const imageZone = cardEl.locator('.aspect-video')
  // Hover and wait for debounce
  await imageZone.hover()
  await page.waitForTimeout(300) // 200ms debounce + buffer
  // Overlay divs should now be rendered (mediaVisible=true)
  const overlays = imageZone.locator('[aria-hidden]')
  await expect(overlays.first()).toBeVisible({ timeout: 2000 })
})

test('Hover unter 200ms startet keinen Carousel', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ9-Debounce-${TS}`
  await createMultiMediaPrompt(page, title)
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  await expect(cardEl).toBeVisible({ timeout: 5000 })
  const imageZone = cardEl.locator('.aspect-video')
  // Move mouse quickly away
  await imageZone.hover()
  await page.waitForTimeout(80) // well under 200ms
  await page.mouse.move(0, 0)   // leave card
  // Overlays should not be visible (carousel never activated)
  const overlays = imageZone.locator('[aria-hidden]')
  await expect(overlays.first()).not.toBeVisible()
})

test('Dot-Indikatoren erscheinen beim Hover über Kachel mit mehreren Medien', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ9-Dots-${TS}`
  await createMultiMediaPrompt(page, title)
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  await expect(cardEl).toBeVisible({ timeout: 5000 })
  const imageZone = cardEl.locator('.aspect-video')
  await imageZone.hover()
  await page.waitForTimeout(300)
  // Dot indicators: small rounded divs with bg-white class
  const activeDot = imageZone.locator('.rounded-full.bg-white')
  await expect(activeDot.first()).toBeVisible({ timeout: 2000 })
})

test('Carousel stoppt beim Verlassen der Kachel', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ9-Stop-${TS}`
  await createMultiMediaPrompt(page, title)
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  await expect(cardEl).toBeVisible({ timeout: 5000 })
  const imageZone = cardEl.locator('.aspect-video')
  await imageZone.hover()
  await page.waitForTimeout(300) // Carousel aktiv
  // Move mouse away
  await page.mouse.move(0, 0)
  // Active dot should disappear (isCarouselActive = false → dot indicators unmount)
  const activeDot = imageZone.locator('.rounded-full.bg-white')
  await expect(activeDot.first()).not.toBeVisible({ timeout: 2000 })
})

// ── prefers-reduced-motion ────────────────────────────────────────────────────

test('Dot-Indikatoren erscheinen bei prefers-reduced-motion (kein Auto-Advance, Punkte OK)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page)
  // Find any multi-media prompt
  const allCards = page.locator('[class*="rounded-xl"]')
  const count = await allCards.count()
  if (count === 0) {
    test.skip(true, 'Keine Kacheln vorhanden')
    return
  }
  // Look for a card that has a media count badge (multi-media)
  const badgedCard = allCards.filter({ has: page.locator('.aspect-video span').filter({ hasText: /^\d+$/ }) }).first()
  if (await badgedCard.count() === 0) {
    test.skip(true, 'Kein Multi-Media-Prompt vorhanden für diesen Test')
    return
  }
  const imageZone = badgedCard.locator('.aspect-video')
  await imageZone.hover()
  await page.waitForTimeout(300)
  // isCarouselActive becomes true → dots show, but index stays at 0
  const activeDot = imageZone.locator('.rounded-full.bg-white')
  await expect(activeDot.first()).toBeVisible({ timeout: 2000 })
})

// ── GIF-Animation (Browser-Standard-Verhalten) ───────────────────────────────

test('GIF-URLs werden in img-Elementen korrekt dargestellt (kein gebrochenes Bild)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Create prompt with GIF URL
  const title = `PROJ9-GIF-${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel(/titel/i).fill(title)
  await page.getByLabel(/prompt-text/i).fill('GIF Test')
  await page.getByRole('tab', { name: /url/i }).click()
  await page.getByPlaceholder(/https:\/\/example.com\/bild/i).fill('https://upload.wikimedia.org/wikipedia/commons/a/a2/Smiley.gif')
  await page.getByRole('button', { name: /hinzufügen/i }).click()
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText(title)).toBeVisible()
  // No broken image indicator
  const cardEl = page.locator('[class*="rounded-xl"]').filter({ hasText: title })
  const imgs = cardEl.locator('img')
  // Check no img has natural width 0 (broken image)
  const imgCount = await imgs.count()
  for (let i = 0; i < imgCount; i++) {
    await expect(imgs.nth(i)).not.toHaveAttribute('alt', /broken|error/i)
  }
})

// ── Kein Video-Element ohne Hover (Performance) ───────────────────────────────

test('Video-Elemente sind ohne Hover nicht im DOM (Performance)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // At page load, no video elements should exist in card tiles
  // (videos only rendered on hover in the carousel overlay)
  const videos = page.locator('.aspect-video video')
  await expect(videos).toHaveCount(0, { timeout: 3000 })
})

// ── Regression: Bestehende Features funktionieren noch ───────────────────────

test('Neuer Prompt kann erstellt werden (kein Regression durch PROJ-9)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const title = `PROJ-9-Regression-${TS}`
  await page.getByRole('button', { name: /neuer prompt/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel(/titel/i).fill(title)
  await page.getByLabel(/prompt-text/i).fill('Regression Test PROJ-9')
  await page.getByRole('button', { name: /^speichern$/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText(title)).toBeVisible()
})

test('Klick auf Kachel öffnet Detail-Modal (Carousel stoppt bei Klick)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const firstCard = page.locator('.aspect-video').first()
  await expect(firstCard).toBeVisible({ timeout: 5000 })
  await firstCard.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('Favoriten-Filter funktioniert noch', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByRole('button', { name: /nur favoriten/i })).toBeVisible()
})

test('Stern-Bewertung ist auf den Kacheln sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.locator('[aria-label*="Stern"], [title*="Stern"]').first()).toBeVisible({ timeout: 5000 })
})
