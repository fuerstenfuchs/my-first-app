/**
 * E2E regression tests for PROJ-13: Mobile Share Integration
 *
 * The PWA share flow (OS share sheet → /share → Quick Capture) requires
 * the app to be installed as a PWA, which isn't testable in standard Playwright.
 * These tests verify:
 * 1. PWA manifest is served and valid
 * 2. /share route loads without errors
 * 3. source_url field appears in Quick Capture and Prompt Modal
 * 4. Auth protection: /share redirects unauthenticated users to login
 * 5. No regressions in core prompt flows (backward compat with null source_url)
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

// ── PWA-Infrastruktur ────────────────────────────────────────────────────────

test('PWA-Manifest wird korrekt ausgeliefert', async ({ page }) => {
  const response = await page.goto('/manifest.json')
  expect(response?.status()).toBe(200)
  const body = await response?.json()
  expect(body.name).toBe('PromptDB')
  expect(body.display).toBe('standalone')
  expect(body.share_target).toBeDefined()
  expect(body.share_target.action).toBe('/share')
})

test('PWA-Manifest hat korrekte Share-Target-Parameter', async ({ page }) => {
  const response = await page.goto('/manifest.json')
  const body = await response?.json()
  expect(body.share_target.params.text).toBe('text')
  expect(body.share_target.params.url).toBe('url')
  expect(body.share_target.params.title).toBe('title')
})

test('Service Worker Datei wird ausgeliefert', async ({ page }) => {
  const response = await page.goto('/sw.js')
  expect(response?.status()).toBe(200)
})

test('App-Icon wird ausgeliefert', async ({ page }) => {
  const response = await page.goto('/icons/icon.svg')
  expect(response?.status()).toBe(200)
  const contentType = response?.headers()['content-type']
  expect(contentType).toContain('svg')
})

// ── /share-Route ─────────────────────────────────────────────────────────────

test('/share-Route lädt ohne JS-Fehler (nicht eingeloggt)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  // Unauthenticated share should redirect to /login
  await page.goto('/share?text=Test+Prompt&url=https%3A%2F%2Freddit.com%2Fr%2Ftest')
  // Either we land on login or on /
  await page.waitForURL(/\/(login|$)/, { timeout: 8000 })
  const filtered = errors.filter(e => !e.includes('ResizeObserver'))
  expect(filtered).toHaveLength(0)
})

test('/share leitet nicht-eingeloggten Nutzer zu /login weiter', async ({ page }) => {
  await page.goto('/share?text=Hallo&url=https%3A%2F%2Freddit.com')
  await expect(page).toHaveURL(/login/, { timeout: 8000 })
})

// ── Quick Capture — Quell-Link-Feld ──────────────────────────────────────────

test('Quick Capture zeigt Quell-Link-Feld (PROJ-13)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Open Quick Capture via FAB
  await page.getByRole('button', { name: /Quick Capture/i }).click()
  await expect(page.getByLabel(/Quell-Link/i)).toBeVisible({ timeout: 3000 })
})

test('Quick Capture akzeptiert eine URL im Quell-Link-Feld', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /Quick Capture/i }).click()
  const sourceField = page.getByLabel(/Quell-Link/i)
  await expect(sourceField).toBeVisible({ timeout: 3000 })
  await sourceField.fill('https://reddit.com/r/MachineLearning')
  await expect(sourceField).toHaveValue('https://reddit.com/r/MachineLearning')
})

// ── Prompt-Modal — Quell-Link-Feld ────────────────────────────────────────────

test('Prompt erstellen Dialog zeigt Quell-Link-Feld', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /Neuer Prompt/i }).click()
  await expect(page.getByLabel(/Quell-Link/i)).toBeVisible({ timeout: 3000 })
})

// ── Regression: Bestehende Prompts ────────────────────────────────────────────

test('Prompt-Grid lädt ohne Fehler (source_url-Feld rückwärtskompatibel)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.waitForTimeout(2000)
  const filtered = errors.filter(e => !e.includes('ResizeObserver'))
  expect(filtered).toHaveLength(0)
})

test('Prompt bearbeiten zeigt Quell-Link-Feld', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.waitForTimeout(1000)
  const cards = page.locator('.group.relative.overflow-hidden.rounded-xl')
  if (await cards.count() === 0) { test.skip(); return }
  // Hover to reveal the context menu
  await cards.first().hover()
  const menuButton = cards.first().getByRole('button', { name: /Menü/i })
  await menuButton.click()
  await page.getByRole('menuitem', { name: /Bearbeiten/i }).click()
  await expect(page.getByLabel(/Quell-Link/i)).toBeVisible({ timeout: 3000 })
})

test('Sammlungen-Seite lädt weiterhin korrekt (Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(1000)
  const filtered = errors.filter(e => !e.includes('ResizeObserver'))
  expect(filtered).toHaveLength(0)
})

// ── Auth-Schutz ───────────────────────────────────────────────────────────────

test('Unauthentifizierte Anfragen an / werden zu /login geleitet', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/login/)
})

test('/share mit ?from=share Parameter in Login-URL erhalten', async ({ page }) => {
  await page.goto('/share?text=Test')
  await expect(page).toHaveURL(/login/, { timeout: 8000 })
  // The URL should contain from=share so the login flow can redirect back
  const url = page.url()
  expect(url).toContain('from=share')
})
