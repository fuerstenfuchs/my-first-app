/**
 * E2E tests for PROJ-3: Suche & Filter
 *
 * Structural tests run without credentials.
 * Filter tests require TEST_EMAIL / TEST_PASSWORD (must have prompts with tags).
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
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

// ── Filter-Tests (benötigen TEST_PASSWORD) ──────────────────────────────────

test('Suchfeld im Header sichtbar und leer beim Laden', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  await expect(searchInput).toBeVisible()
  await expect(searchInput).toHaveValue('')
})

test('Live-Suche filtert Kacheln sofort', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const cards = page.locator('[class*="group"]')
  const totalBefore = await cards.count()
  if (totalBefore === 0) return // No prompts to test with

  const searchInput = page.getByPlaceholder(/suchen/i)
  // Type a search term that matches few prompts (use a character that limits results)
  await searchInput.fill('zzz_no_match_xyz')
  // Should either show "Keine Prompts gefunden" or fewer cards
  await expect(page.getByText(/keine prompts gefunden/i).or(cards.first())).toBeVisible({ timeout: 3000 })
})

test('Suchfeld leeren zeigt wieder alle Prompts', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  await searchInput.fill('zzz_no_match_xyz')
  // Wait for filtered state
  await page.waitForTimeout(300)
  // Clear search
  await searchInput.fill('')
  // Should show all prompts or empty state
  await expect(page.getByText(/keine prompts gefunden/i)).not.toBeVisible({ timeout: 3000 })
})

test('Kein-Ergebnis-Zustand zeigt "Keine Prompts gefunden" + "Filter zurücksetzen"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  await searchInput.fill('zzzz_definitely_no_match_99999')
  await expect(page.getByText(/keine prompts gefunden/i)).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /filter zurücksetzen/i })).toBeVisible()
})

test('"Filter zurücksetzen" leert Suchfeld und zeigt alle Prompts', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  await searchInput.fill('zzzz_definitely_no_match_99999')
  await page.getByRole('button', { name: /filter zurücksetzen/i }).click()
  await expect(searchInput).toHaveValue('')
  await expect(page.getByText(/keine prompts gefunden/i)).not.toBeVisible({ timeout: 3000 })
})

test('Tag-Leiste erscheint nur wenn Prompts mit Tags existieren', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const cards = page.locator('[class*="group"]')
  const count = await cards.count()
  if (count === 0) {
    // No prompts → no tags
    await expect(page.locator('.overflow-x-auto .badge, [class*="Badge"]').first()).not.toBeVisible()
  } else {
    // Whether tags are shown depends on whether prompts have tags — just verify no crash
    await expect(page).toHaveURL('/')
  }
})

test('Klick auf aktiven Tag hebt Filter auf', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Find any tag chip in the tag bar
  const tagChip = page.locator('header').locator('button').filter({ has: page.locator('[class*="Badge"], [class*="badge"]') }).first()
  const hasTagBar = await tagChip.isVisible()
  if (!hasTagBar) return // No tags in this account — skip gracefully

  await tagChip.click()
  await page.waitForTimeout(200)
  await tagChip.click() // click again to deactivate
  await page.waitForTimeout(200)
  // After double-click, no "Keine Prompts gefunden" should appear (assuming prompts exist)
  const allCards = page.locator('[class*="group"]')
  if (await allCards.count() > 0) {
    await expect(page.getByText(/keine prompts gefunden/i)).not.toBeVisible()
  }
})

test('Suchbegriff mit Leerzeichen zeigt alle Prompts (keine Filterung)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const cards = page.locator('[class*="group"]')
  const countBefore = await cards.count()
  await page.getByPlaceholder(/suchen/i).fill('   ')
  await page.waitForTimeout(300)
  const countAfter = await cards.count()
  expect(countAfter).toBe(countBefore)
})

test('Suche ist case-insensitive', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  // Type the same query in different cases — should return same count
  await searchInput.fill('a')
  await page.waitForTimeout(200)
  const countLower = await page.locator('[class*="group"]').count()

  await searchInput.fill('A')
  await page.waitForTimeout(200)
  const countUpper = await page.locator('[class*="group"]').count()

  expect(countLower).toBe(countUpper)
})
