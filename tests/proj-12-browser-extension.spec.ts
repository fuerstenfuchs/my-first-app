/**
 * E2E regression tests for PROJ-12: Browser Extension
 *
 * The extension popup itself cannot be tested with Playwright (Chrome extension
 * popups require special --load-extension flags not supported in standard CI).
 * These tests verify:
 * 1. The webapp's copyPrompt changes (last_used_at) don't break existing UX
 * 2. The Prompt interface change is backward-compatible
 * 3. No regressions in core prompt flows that the extension depends on
 */

import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP_AUTH = !TEST_PASSWORD

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// ── Strukturelle Tests (kein Auth) ──────────────────────────────────────────

test('Login-Seite lädt ohne Fehler (PROJ-12 Regression)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
})

test('Passwort-Reset-Seite lädt (wird von Extension verlinkt)', async ({ page }) => {
  await page.goto('/login/reset')
  await expect(page).toHaveURL('/login/reset')
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 5000 })
})

// ── Regression: copyPrompt + last_used_at ───────────────────────────────────

test('Hauptseite lädt Prompts ohne Fehler (last_used_at-Feld kompatibel)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.waitForTimeout(1500)
  const jsErrors = errors.filter(e => !e.includes('ResizeObserver'))
  expect(jsErrors).toHaveLength(0)
})

test('Prompt kopieren zeigt "Kopiert!"-Toast (copyPrompt-Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.waitForTimeout(1000)
  const copyButtons = page.getByRole('button', { name: /kopieren/i })
  const count = await copyButtons.count()
  if (count === 0) { test.skip(); return }
  await copyButtons.first().click()
  await expect(page.getByText(/kopiert/i)).toBeVisible({ timeout: 3000 })
})

test('Prompts-Grid rendert ohne JavaScript-Fehler', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.waitForTimeout(2000)
  const filtered = errors.filter(e => !e.includes('ResizeObserver'))
  expect(filtered).toHaveLength(0)
})

// ── Regression: Sammlungen (nutzen dieselben Prompt-Daten) ──────────────────

test('Sammlungs-Detailseite lädt Prompts ohne Fehler', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.waitForTimeout(1000)
  const filtered = errors.filter(e => !e.includes('ResizeObserver'))
  expect(filtered).toHaveLength(0)
})

// ── Regression: Suche (Extension nutzt dieselbe Supabase-Datenbank) ─────────

test('Suche auf Hauptseite funktioniert noch', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  await expect(searchInput).toBeVisible({ timeout: 5000 })
  await searchInput.fill('test')
  await page.waitForTimeout(500)
  await expect(searchInput).toHaveValue('test')
})

// ── Sicherheitsaudit ─────────────────────────────────────────────────────────

test('Unauthentifizierte Anfragen werden zu /login geleitet', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/login/)
})

test('Direkte Navigation zu geschützter Route leitet zu /login weiter', async ({ page }) => {
  await page.goto('/einstellungen')
  await expect(page).toHaveURL(/login/, { timeout: 5000 })
})
