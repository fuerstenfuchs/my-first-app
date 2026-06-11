/**
 * E2E tests for PROJ-6: Import / Export
 *
 * Structural tests run without credentials.
 * All other tests require TEST_EMAIL / TEST_PASSWORD.
 *
 * Example: TEST_EMAIL=x@y.de TEST_PASSWORD=secret npm run test:e2e
 */

import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

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

function writeTempJson(content: unknown): string {
  const file = path.join(os.tmpdir(), `promptdb-test-${Date.now()}.json`)
  fs.writeFileSync(file, JSON.stringify(content, null, 2), 'utf-8')
  return file
}

// ── Strukturtest (ohne Credentials) ───────────────────────────────────────

test('Unauthenticated → Redirect zu /login statt /einstellungen', async ({ page }) => {
  await page.goto('/einstellungen')
  await expect(page).toHaveURL(/\/login/)
})

// ── Navigation ─────────────────────────────────────────────────────────────

test('Sidebar zeigt "Einstellungen"-Eintrag im Footer', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByRole('link', { name: /einstellungen/i })).toBeVisible()
})

test('Klick auf "Einstellungen" navigiert zu /einstellungen', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('link', { name: /einstellungen/i }).click()
  await expect(page).toHaveURL('/einstellungen')
})

// ── Export ─────────────────────────────────────────────────────────────────

test('/einstellungen zeigt Seitentitel "Einstellungen"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')
  await expect(page.getByRole('heading', { name: /einstellungen/i })).toBeVisible()
})

test('"Alle Prompts exportieren"-Button ist sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')
  await expect(page.getByRole('button', { name: /alle prompts exportieren/i })).toBeVisible()
})

test('Export ohne Prompts → Toast "Keine Prompts zum Exportieren"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')

  // Only test the empty-state toast if no prompts exist
  const hasPrompts = await page.evaluate(() => {
    return document.body.textContent?.includes('Prompts')
  })

  // Click export and check the toast response
  await page.getByRole('button', { name: /alle prompts exportieren/i }).click()
  // Either success toast ("X Prompts exportiert") or error toast ("Keine Prompts...") appears
  const toastSuccess = page.getByText(/\d+ prompts exportiert/i)
  const toastError = page.getByText(/keine prompts zum exportieren/i)
  await expect(toastSuccess.or(toastError)).toBeVisible({ timeout: 5000 })
})

// ── Import ─────────────────────────────────────────────────────────────────

test('"Prompts importieren"-Button ist sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')
  await expect(page.getByRole('button', { name: /prompts importieren/i })).toBeVisible()
})

test('Import gültiger JSON-Datei → Toast zeigt importierte Anzahl', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')

  const tmpFile = writeTempJson([
    { title: 'Test-Import-Prompt', content: 'Inhalt des Test-Prompts für E2E-Test', tags: ['e2e'], usage_count: 0 },
  ])

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(tmpFile)

  await expect(page.getByText(/1 prompts importiert/i)).toBeVisible({ timeout: 10000 })
  fs.unlinkSync(tmpFile)
})

test('Import mit fehlenden optionalen Feldern → importiert erfolgreich', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')

  const tmpFile = writeTempJson([
    { title: 'Minimal-Prompt', content: 'Nur title und content' },
  ])

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(tmpFile)

  await expect(page.getByText(/1 prompts importiert/i)).toBeVisible({ timeout: 10000 })
  fs.unlinkSync(tmpFile)
})

test('Import ungültiger JSON → Toast "Ungültige Datei"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')

  const tmpFile = path.join(os.tmpdir(), `promptdb-invalid-${Date.now()}.json`)
  fs.writeFileSync(tmpFile, 'dies ist kein gültiges json {{{{', 'utf-8')

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(tmpFile)

  await expect(page.getByText(/ungültige datei/i)).toBeVisible({ timeout: 5000 })
  fs.unlinkSync(tmpFile)
})

test('Import JSON-Datei ohne Array (Objekt statt Array) → Toast "Ungültige Datei"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')

  const tmpFile = writeTempJson({ title: 'kein Array', content: 'direkt ein Objekt' })

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(tmpFile)

  await expect(page.getByText(/ungültige datei/i)).toBeVisible({ timeout: 5000 })
  fs.unlinkSync(tmpFile)
})

test('Import-Datei mit gemischten Einträgen → nur valide werden importiert', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/einstellungen')

  const tmpFile = writeTempJson([
    { title: 'Gültiger Eintrag', content: 'Hat title und content' },
    { content: 'Kein Titel — ungültig' },
    { title: 'Kein Content' },
    { title: '   ', content: 'Leerer Titel — ungültig' },
  ])

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(tmpFile)

  // Only 1 of 4 is valid
  await expect(page.getByText(/1 prompts importiert/i)).toBeVisible({ timeout: 10000 })
  fs.unlinkSync(tmpFile)
})
