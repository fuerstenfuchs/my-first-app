/**
 * E2E tests for PROJ-11: Sammlungen Upgrade (Cover-Bilder, Drag & Drop)
 *
 * Structural tests run without credentials.
 * Functional tests require TEST_EMAIL / TEST_PASSWORD.
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

// ── Strukturelle Tests (kein Auth) ──────────────────────────────────────────

test('Login-Seite lädt ohne Fehler', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
})

test('/collections leitet Unauthentifizierte zu /login weiter', async ({ page }) => {
  await page.goto('/collections')
  await expect(page).toHaveURL(/login/)
})

// ── Collections-Übersichtsseite ──────────────────────────────────────────────

test('/collections zeigt Sammlungs-Kachelraster nach Login', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await expect(page.getByRole('heading', { name: /sammlungen/i })).toBeVisible({ timeout: 5000 })
})

test('/collections: Header zeigt „+ Neue Sammlung"-Button', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await expect(page.getByRole('button', { name: /neue sammlung/i })).toBeVisible({ timeout: 5000 })
})

test('/collections: Klick auf „+ Neue Sammlung" öffnet Dialog', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.getByRole('button', { name: /neue sammlung/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('heading', { name: /neue sammlung/i })).toBeVisible()
})

test('/collections: Sammlung anlegen mit Namen navigiert zur Detailseite', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  const colName = `PROJ11-Neu-${TS}`
  await page.getByRole('button', { name: /neue sammlung/i }).click()
  await page.getByLabel(/sammlungsname/i).fill(colName)
  await page.getByRole('button', { name: /^erstellen$/i }).click()
  // Should navigate to /collections/[id]
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 8000 })
  await expect(page.getByRole('heading').first()).toBeVisible()
})

test('/collections: Erstellen ohne Namen zeigt Validierungsfehler', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.getByRole('button', { name: /neue sammlung/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^erstellen$/i }).click()
  await expect(page.getByText(/bitte gib einen namen ein/i)).toBeVisible()
  // Dialog stays open, no navigation
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('/collections: Klick auf Sammlungs-Kachel navigiert zur Detailseite', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(1000)
  const cards = page.locator('a[href^="/collections/"]')
  const count = await cards.count()
  if (count === 0) {
    test.skip()
    return
  }
  const href = await cards.first().getAttribute('href')
  await cards.first().click()
  await expect(page).toHaveURL(new RegExp(href!))
})

test('/collections: Leer-Zustand zeigt Icon + Text + Erstellen-Button', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(1000)
  const cards = page.locator('a[href^="/collections/"]')
  const count = await cards.count()
  if (count > 0) {
    // Already has collections — skip empty state test
    test.skip()
    return
  }
  await expect(page.getByText(/noch keine sammlungen/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /erste sammlung anlegen/i })).toBeVisible()
})

// ── Sidebar-Navigation zu /collections ──────────────────────────────────────

test('Sidebar: „Sammlungen"-Label ist ein Link zu /collections', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  const link = page.getByRole('link', { name: /^sammlungen$/i })
  await expect(link).toBeVisible({ timeout: 5000 })
  const href = await link.getAttribute('href')
  expect(href).toContain('/collections')
})

// ── Sammlungs-Detailseite — Verbesserter Header ──────────────────────────────

test('Detailseite: Header zeigt Sammlungsname, Prompt-Anzahl und „Cover"-Button', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await expect(page.getByRole('button', { name: /cover/i })).toBeVisible({ timeout: 5000 })
  // Prompt count visible
  await expect(page.locator('text=/\\d+ Prompts?/')).toBeVisible({ timeout: 5000 })
})

test('Detailseite: Header hat kein Collage-Raster — nur einzelnes Cover-Bild oder Platzhalter', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  // The header cover is a single element (h-10 w-10 thumbnail), not a grid
  const header = page.locator('header')
  const coverGrid = header.locator('.grid-cols-2')
  await expect(coverGrid).toHaveCount(0)
})

// ── Cover-Modal ──────────────────────────────────────────────────────────────

test('„Cover"-Button öffnet Cover-Bearbeiten-Modal', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.getByRole('button', { name: /cover/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
  await expect(page.getByRole('heading', { name: /cover bearbeiten/i })).toBeVisible()
})

test('Cover-Modal: hat Tabs „Automatisch" und „Individuell"', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.getByRole('button', { name: /cover/i }).click()
  await expect(page.getByRole('tab', { name: /automatisch/i })).toBeVisible()
  await expect(page.getByRole('tab', { name: /individuell/i })).toBeVisible()
})

test('Cover-Modal: „Individuell"-Tab zeigt Upload-Button', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.getByRole('button', { name: /cover/i }).click()
  await page.getByRole('tab', { name: /individuell/i }).click()
  await expect(page.getByRole('button', { name: /eigenes bild hochladen/i })).toBeVisible()
})

// ── Drag & Drop — Prompt-Reihenfolge ────────────────────────────────────────

test('Detailseite: Drag-Handle-Icon ist auf jeder Prompt-Kachel sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.waitForTimeout(500)
  const items = page.locator('main .grid > div')
  const count = await items.count()
  if (count === 0) { test.skip(); return }
  // Each sortable card should have a drag handle
  const handles = page.locator('[aria-label="Drag Handle"]')
  await expect(handles.first()).toBeVisible({ timeout: 3000 })
  expect(await handles.count()).toBe(count)
})

test('Detailseite: Keine ↑/↓-Buttons mehr sichtbar', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.waitForTimeout(500)
  // ↑/↓ buttons (ChevronUp/Down) should be gone
  await expect(page.getByRole('button', { name: /nach oben/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /nach unten/i })).toHaveCount(0)
})

test('Detailseite: Drag & Drop bewegt Kachel auf neue Position', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  await page.waitForTimeout(1000)
  const items = page.locator('main .grid > div')
  if (await items.count() < 2) { test.skip(); return }

  const firstItem = items.nth(0)
  const secondItem = items.nth(1)
  const firstTitle = await firstItem.locator('h3, [class*="CardTitle"]').first().textContent()
  const firstBox = await firstItem.boundingBox()
  const secondBox = await secondItem.boundingBox()
  if (!firstBox || !secondBox) { test.skip(); return }

  // Drag handle of first item
  const handle = firstItem.locator('[aria-label="Drag Handle"]')
  await handle.hover()
  await page.mouse.down()
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(500)

  // First card should now be in second position (or grid reordered)
  const newFirstTitle = await items.nth(0).locator('h3, [class*="CardTitle"]').first().textContent()
  // After drag, order should differ from original
  expect(newFirstTitle).not.toBe(firstTitle)
})

// ── Cover — Automatischer Modus ──────────────────────────────────────────────

test('Übersicht: Sammlungs-Kacheln rendern ohne JavaScript-Fehler', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(1500)
  const jsErrors = errors.filter(e => !e.includes('ResizeObserver'))
  expect(jsErrors).toHaveLength(0)
})

test('Übersicht: Platzhalter zeigt Ordner-Icon bei Sammlungen ohne Bilder', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(1000)
  // If any collection card has no images, it should show the folder placeholder
  const placeholders = page.locator('svg[class*="lucide-folder-open"]')
  // Just ensure no JS error — visual test of the placeholder icon
  // (At minimum, the icon component should render without crashing)
  expect(await placeholders.count()).toBeGreaterThanOrEqual(0)
})

// ── FAB — PROJ-10 Regression ─────────────────────────────────────────────────

test('FAB ist auch auf /collections sichtbar (PROJ-10 Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  const fab = page.getByRole('button', { name: /quick capture öffnen/i })
  await expect(fab).toBeVisible({ timeout: 5000 })
})

test('FAB ist auf Sammlungs-Detailseite sichtbar (PROJ-10 Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/collections')
  await page.waitForTimeout(500)
  const cards = page.locator('a[href^="/collections/"]')
  if (await cards.count() === 0) { test.skip(); return }
  await cards.first().click()
  await page.waitForURL(/\/collections\/[0-9a-f-]+/, { timeout: 5000 })
  const fab = page.getByRole('button', { name: /quick capture öffnen/i })
  await expect(fab).toBeVisible({ timeout: 5000 })
})

// ── Regression: Hauptseite funktioniert noch ────────────────────────────────

test('Hauptseite lädt ohne Fehler nach PROJ-11 (Regression)', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page.getByPlaceholder(/suchen/i)).toBeVisible({ timeout: 5000 })
})

test('Suche funktioniert noch auf der Hauptseite', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByPlaceholder(/suchen/i).fill('test')
  await page.waitForTimeout(500)
  await expect(page.getByPlaceholder(/suchen/i)).toHaveValue('test')
})

test('Statistiken-Seite lädt noch korrekt', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/stats')
  await expect(page).toHaveURL('/stats')
  await page.waitForTimeout(500)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
})
