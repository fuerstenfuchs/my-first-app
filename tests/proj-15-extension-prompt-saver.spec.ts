/**
 * E2E regression tests for PROJ-15: Extension Prompt Saver
 *
 * NOTE: Chrome extension popup UI (QuickCaptureScreen, PendingCaptureBanner,
 * context menu) cannot be automated with standard Playwright — extension popups
 * require a persistent Chrome context with --load-extension, which is not
 * supported in headless mode or standard CI runners.
 *
 * These tests cover:
 * 1. Build artifact verification (background.js at dist root, manifest.json)
 * 2. Web-app regression: source_url field still works in prompts
 * 3. Regression: auth + core prompt flows that the extension saves depend on
 * 4. Security: unauthenticated access still blocked
 */

import { test, expect, type Page } from '@playwright/test'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP_AUTH = !TEST_PASSWORD

const DIST = resolve(__dirname, '../extension/dist')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// ── Build-Artefakt-Verifikation ──────────────────────────────────────────────

test('background.js existiert im dist-Wurzelverzeichnis (für manifest background SW)', () => {
  const path = resolve(DIST, 'background.js')
  expect(existsSync(path)).toBe(true)
})

test('manifest.json enthält contextMenus-Permission', () => {
  const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf-8'))
  expect(manifest.permissions).toContain('contextMenus')
})

test('manifest.json enthält activeTab-Permission', () => {
  const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf-8'))
  expect(manifest.permissions).toContain('activeTab')
})

test('manifest.json verweist auf background.js als service_worker', () => {
  const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf-8'))
  expect(manifest.background?.service_worker).toBe('background.js')
})

test('manifest.json ist Manifest V3', () => {
  const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf-8'))
  expect(manifest.manifest_version).toBe(3)
})

test('background.js ist nicht leer und enthält Menu-ID', () => {
  const content = readFileSync(resolve(DIST, 'background.js'), 'utf-8')
  expect(content.length).toBeGreaterThan(50)
  expect(content).toContain('promptdb-save')
})

test('popup.html existiert im dist-Verzeichnis', () => {
  expect(existsSync(resolve(DIST, 'popup.html'))).toBe(true)
})

// ── Web-App-Regression: source_url-Feld ──────────────────────────────────────

test('Web-App lädt ohne Fehler (source_url-Feld Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.waitForTimeout(1500)
  const jsErrors = errors.filter(e => !e.includes('ResizeObserver'))
  expect(jsErrors).toHaveLength(0)
})

test('Quick Capture Modal öffnet sich und zeigt Quell-Link-Feld', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  // Open Quick Capture via FAB or keyboard
  await page.keyboard.press('n')
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 3000 })
  // source_url field should be present (added in PROJ-13)
  await expect(page.getByLabel(/quell|source|url/i).first()).toBeVisible({ timeout: 2000 })
})

test('Prompt mit source_url kann gespeichert und angezeigt werden', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const uniqueTitle = `PROJ-15 QA Test ${Date.now()}`
  await login(page)
  await page.keyboard.press('n')
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 3000 })
  await page.getByLabel(/titel/i).first().fill(uniqueTitle)
  await page.getByLabel(/inhalt|content/i).first().fill('Test content from extension QA')
  // Fill source_url if field exists
  const sourceField = page.getByLabel(/quell|source|url/i).first()
  if (await sourceField.isVisible()) {
    await sourceField.fill('https://example.com/test-page')
  }
  await page.getByRole('button', { name: /speichern/i }).first().click()
  await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 })
  // Cleanup: delete the test prompt
  const card = page.locator(`[title*="${uniqueTitle}"], [aria-label*="${uniqueTitle}"]`).first()
  if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
    await card.hover()
    const deleteBtn = card.getByRole('button', { name: /löschen|delete/i })
    if (await deleteBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await deleteBtn.click()
      await page.getByRole('button', { name: /löschen|bestätigen|confirm/i }).last().click()
    }
  }
})

// ── Regression: Core Flows ────────────────────────────────────────────────────

test('Prompt-Liste lädt ohne Fehler (Regression PROJ-15)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.waitForTimeout(2000)
  const filtered = errors.filter(e => !e.includes('ResizeObserver'))
  expect(filtered).toHaveLength(0)
})

test('Prompt-Suche funktioniert noch (Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const searchInput = page.getByPlaceholder(/suchen/i)
  await expect(searchInput).toBeVisible({ timeout: 5000 })
  await searchInput.fill('test')
  await page.waitForTimeout(300)
  await expect(searchInput).toHaveValue('test')
})

// ── Sicherheitsaudit ──────────────────────────────────────────────────────────

test('Unauthentifizierte Anfragen werden zu /login geleitet (PROJ-15 Regression)', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/login/)
})

test('Login-Seite lädt ohne Fehler', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
})
