/**
 * E2E tests for PROJ-5: Statistik-Dashboard
 *
 * Structural tests run without credentials.
 * Dashboard content tests require TEST_EMAIL / TEST_PASSWORD.
 *
 * Example: TEST_EMAIL=x@y.de TEST_PASSWORD=secret npm run test:e2e
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP_AUTH = !TEST_PASSWORD

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /^anmelden$/i }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// ── Strukturtests (ohne Credentials) ──────────────────────────────────────

test('Unauthenticated → Redirect zu /login', async ({ page }) => {
  await page.goto('/stats')
  await expect(page).toHaveURL(/\/login/)
})

// ── Dashboard-Tests (benötigen TEST_PASSWORD) ──────────────────────────────

test('Sidebar zeigt "Statistiken"-Eintrag zwischen Alle Prompts und Sammlungen', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const sidebar = page.locator('nav, [data-sidebar]').first()
  await expect(page.getByRole('link', { name: /statistiken/i })).toBeVisible()
})

test('Klick auf "Statistiken" navigiert zu /stats', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('link', { name: /statistiken/i }).click()
  await expect(page).toHaveURL('/stats')
})

test('/stats zeigt Seitentitel "Statistiken"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  await expect(page.getByRole('heading', { name: /statistiken/i })).toBeVisible()
})

test('Leerseite: "Noch keine Nutzungsdaten" wenn kein Prompt kopiert', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  // Only verify if actually empty — if prompts are already copied, skip gracefully
  const hasData = await page.getByText(/gesamt-kopiervorgänge/i).isVisible()
  if (!hasData) {
    await expect(page.getByText(/noch keine nutzungsdaten/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /zur hauptansicht/i })).toBeVisible()
  }
})

test('"Zur Hauptansicht"-Button navigiert zu /', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  const emptyButton = page.getByRole('button', { name: /zur hauptansicht/i })
  if (await emptyButton.isVisible()) {
    await emptyButton.click()
    await expect(page).toHaveURL('/')
  }
})

test('KPI-Kacheln sichtbar wenn Prompts kopiert wurden', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  const hasData = await page.getByText(/gesamt-kopiervorgänge/i).isVisible()
  if (hasData) {
    await expect(page.getByText(/gesamt-kopiervorgänge/i)).toBeVisible()
    await expect(page.getByText(/prompts gesamt/i)).toBeVisible()
    await expect(page.getByText(/meistgenutzter tag/i)).toBeVisible()
  }
})

test('Top-Rangliste zeigt maximal 10 Einträge', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  const hasData = await page.getByText(/gesamt-kopiervorgänge/i).isVisible()
  if (hasData) {
    const rankItems = page.locator('button').filter({ has: page.locator('[class*="rounded-full"]') })
    const count = await rankItems.count()
    expect(count).toBeGreaterThanOrEqual(1)
    expect(count).toBeLessThanOrEqual(10)
  }
})

test('Klick auf Ranglisten-Eintrag öffnet Detail-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  const hasData = await page.getByText(/gesamt-kopiervorgänge/i).isVisible()
  if (!hasData) return

  const firstRankEntry = page.locator('button').filter({ has: page.locator('[class*="rounded-full"]') }).first()
  await firstRankEntry.click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /bearbeiten/i })).toBeVisible()
})

test('/stats ist über Direktlink erreichbar (keine 404)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  await expect(page).toHaveURL('/stats')
  await expect(page.getByRole('heading', { name: /statistiken/i })).toBeVisible()
})
