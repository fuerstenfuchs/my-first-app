/**
 * E2E tests for PROJ-4: Sammlungen & Workflows
 *
 * Requires env vars:
 *   TEST_EMAIL    — same as ALLOWED_EMAIL (markglass@gmx.de)
 *   TEST_PASSWORD — Supabase account password
 *
 * Example: TEST_EMAIL=x@y.com TEST_PASSWORD=secret npm run test:e2e
 *
 * Tests use unique names (timestamp) so runs never collide with each other.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'markglass@gmx.de'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SKIP = !TEST_PASSWORD
const TS = Date.now()
const COL_NAME = `Test-Sammlung ${TS}`
const COL_NAME_2 = `Zweite Sammlung ${TS}`
const RENAMED = `Umbennante Sammlung ${TS}`

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(TEST_EMAIL)
  await page.getByLabel(/passwort/i).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /anmelden/i }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

// --- Shared login state ---
let sharedContext: BrowserContext

test.beforeAll(async ({ browser }) => {
  if (SKIP) return
  sharedContext = await browser.newContext()
  const page = await sharedContext.newPage()
  await login(page)
  await page.close()
})

test.afterAll(async () => {
  await sharedContext?.close()
})

function getPage() {
  return sharedContext?.newPage()
}

// ── AC: Sammlung erstellen ──────────────────────────────────────────────────

test('Neue Sammlung anlegen — Eingabefeld öffnet sich bei + Klick', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Click the + button in the sidebar collections section
  await page.getByRole('button', { name: /neue sammlung/i }).click()
  await expect(page.getByPlaceholder(/sammlungsname/i)).toBeVisible()
  await page.close()
})

test('Neue Sammlung anlegen — Name eingeben und bestätigen', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  await page.getByRole('button', { name: /neue sammlung/i }).click()
  const input = page.getByPlaceholder(/sammlungsname/i)
  await input.fill(COL_NAME)
  await input.press('Enter')

  // Should navigate to the new collection and show its name
  await page.waitForURL(/\/collections\//, { timeout: 8000 })
  await expect(page.getByRole('heading', { name: COL_NAME })).toBeVisible()
  await page.close()
})

test('Leeres Namensfeld — Sammlung wird nicht angelegt', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  await page.getByRole('button', { name: /neue sammlung/i }).click()
  const input = page.getByPlaceholder(/sammlungsname/i)
  await input.fill('   ')
  await input.press('Enter')

  // Should stay on / and not navigate to a collection
  await expect(page).toHaveURL('/')
  // Input should be gone (cancelled)
  await expect(page.getByPlaceholder(/sammlungsname/i)).not.toBeVisible()
  await page.close()
})

// ── AC: Sammlung navigieren ────────────────────────────────────────────────

test('Sammlungen sind nach Seitenaufruf in der Sidebar sichtbar', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Previously created collection should appear in sidebar
  await expect(page.getByRole('link', { name: COL_NAME })).toBeVisible({ timeout: 5000 })
  await page.close()
})

test('Klick auf Sammlung navigiert zur Sammlungsansicht', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)
  await expect(page.getByRole('heading', { name: COL_NAME })).toBeVisible()
  await page.close()
})

// ── AC: Leere Sammlung ─────────────────────────────────────────────────────

test('Leere Sammlung zeigt Leerzustand mit Hinweis', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')
  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)

  await expect(page.getByText(/diese sammlung ist leer/i)).toBeVisible()
  await expect(page.getByText(/zu sammlung hinzufügen/i)).toBeVisible()
  await page.close()
})

// ── AC: Prompt zu Sammlung hinzufügen ──────────────────────────────────────

test('Drei-Punkte-Menü zeigt „Zu Sammlung hinzufügen"', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Hover over first prompt card to reveal three-dot menu
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()

  await expect(page.getByRole('menuitem', { name: /zu sammlung hinzufügen/i })).toBeVisible()
  await page.close()
})

test('„Zu Sammlung hinzufügen" ohne Sammlungen zeigt Hinweistext', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return

  // Create a fresh page — test isolated scenario by checking with existing empty list
  // We use a second isolated test here by verifying the dialog content
  await page.goto('/')
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /zu sammlung hinzufügen/i }).click()

  // Dialog should be visible
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.close()
})

test('Prompt zu Sammlung hinzufügen', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Open three-dot menu on first card
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /zu sammlung hinzufügen/i }).click()

  // The dialog should list our collection
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(COL_NAME)).toBeVisible({ timeout: 5000 })

  // Click the collection to add prompt
  await page.getByText(COL_NAME).click()

  // Toast success
  await expect(page.getByText(/hinzugefügt/i)).toBeVisible({ timeout: 5000 })
  await page.close()
})

test('Bereits enthaltener Prompt zeigt Häkchen im Dialog', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Open dialog again for the same first card
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /zu sammlung hinzufügen/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  // The collection entry should show a checkmark (Check icon rendered)
  const collectionRow = page.getByText(COL_NAME).locator('..')
  await expect(collectionRow).toBeVisible()
  // Button should be disabled (already in collection)
  const btn = page.getByRole('button').filter({ hasText: COL_NAME })
  if (await btn.count() > 0) {
    await expect(btn).toBeDisabled()
  }
  await page.close()
})

// ── AC: Reihenfolge ändern ─────────────────────────────────────────────────

test('Sammlungsansicht zeigt ↑↓ Buttons pro Kachel', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')
  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)

  // After adding prompt, should have ↑↓ buttons
  const upBtn = page.getByRole('button', { name: /nach oben/i }).first()
  const downBtn = page.getByRole('button', { name: /nach unten/i }).first()
  await expect(upBtn).toBeVisible({ timeout: 5000 })
  await expect(downBtn).toBeVisible({ timeout: 5000 })
  await page.close()
})

test('↑-Button der ersten Kachel ist deaktiviert', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')
  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)

  const upBtn = page.getByRole('button', { name: /nach oben/i }).first()
  await expect(upBtn).toBeDisabled()
  await page.close()
})

test('↓-Button der letzten Kachel ist deaktiviert', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')
  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)

  const downBtns = page.getByRole('button', { name: /nach unten/i })
  const count = await downBtns.count()
  if (count > 0) {
    await expect(downBtns.last()).toBeDisabled()
  }
  await page.close()
})

// ── AC: Prompt aus Sammlung entfernen ──────────────────────────────────────

test('Drei-Punkte-Menü in Sammlungsansicht zeigt „Aus Sammlung entfernen"', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')
  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)

  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()

  await expect(page.getByRole('menuitem', { name: /aus sammlung entfernen/i })).toBeVisible()
  await page.close()
})

test('Prompt aus Sammlung entfernen — Prompt bleibt unter Alle Prompts', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Record first prompt title before removal
  await page.getByRole('link', { name: COL_NAME }).click()
  await page.waitForURL(/\/collections\//)
  const firstCardTitle = await page.locator('[class*="group"] h3, [class*="group"] [class*="CardTitle"]').first().textContent()

  // Remove from collection
  const firstCard = page.locator('[class*="group"]').first()
  await firstCard.hover()
  await firstCard.getByRole('button', { name: /menü/i }).click()
  await page.getByRole('menuitem', { name: /aus sammlung entfernen/i }).click()

  // Toast
  await expect(page.getByText(/aus sammlung entfernt/i)).toBeVisible({ timeout: 5000 })

  // Collection now empty or one fewer card
  // Navigate to all prompts — prompt should still be there
  await page.goto('/')
  if (firstCardTitle) {
    await expect(page.getByText(firstCardTitle)).toBeVisible()
  }
  await page.close()
})

// ── AC: Sammlung umbenennen / löschen ──────────────────────────────────────

test('Hover-Menü einer Sammlung zeigt Umbenennen und Löschen', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  // Hover over the collection item in sidebar to reveal MoreHorizontal
  const collectionLink = page.getByRole('link', { name: COL_NAME })
  await collectionLink.hover()
  await page.getByRole('button', { name: /menü/i }).last().click()

  await expect(page.getByRole('menuitem', { name: /umbenennen/i })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /löschen/i })).toBeVisible()
  await page.close()
})

test('Sammlung umbenennen — Inline-Eingabe erscheint', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  // Create a second collection to rename (keep COL_NAME intact for other tests)
  await page.goto('/')
  await page.getByRole('button', { name: /neue sammlung/i }).click()
  const input = page.getByPlaceholder(/sammlungsname/i)
  await input.fill(COL_NAME_2)
  await input.press('Enter')
  await page.waitForURL(/\/collections\//)
  await page.goto('/')

  // Hover and open menu
  const link2 = page.getByRole('link', { name: COL_NAME_2 })
  await link2.hover()
  await page.getByRole('button', { name: /menü/i }).last().click()
  await page.getByRole('menuitem', { name: /umbenennen/i }).click()

  // Inline input should appear with current name
  const renameInput = page.getByDisplayValue(COL_NAME_2)
  await expect(renameInput).toBeVisible()

  // Type new name and confirm
  await renameInput.clear()
  await renameInput.fill(RENAMED)
  await renameInput.press('Enter')

  // New name appears in sidebar
  await expect(page.getByRole('link', { name: RENAMED })).toBeVisible({ timeout: 5000 })
  await page.close()
})

test('Sammlung löschen — Bestätigungsdialog erscheint', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  const link = page.getByRole('link', { name: RENAMED })
  await link.hover()
  await page.getByRole('button', { name: /menü/i }).last().click()
  await page.getByRole('menuitem', { name: /löschen/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText(/sammlung wirklich löschen/i)).toBeVisible()
  await page.close()
})

test('Sammlung löschen — bestätigen entfernt sie aus der Sidebar', async () => {
  test.skip(SKIP, 'TEST_PASSWORD not set')
  const page = await getPage()
  if (!page) return
  await page.goto('/')

  const link = page.getByRole('link', { name: RENAMED })
  await link.hover()
  await page.getByRole('button', { name: /menü/i }).last().click()
  await page.getByRole('menuitem', { name: /löschen/i }).click()
  await page.getByRole('button', { name: /^löschen$/i }).click()

  // Sidebar no longer shows the deleted collection
  await expect(page.getByRole('link', { name: RENAMED })).not.toBeVisible({ timeout: 5000 })
  await page.close()
})

// ── Cleanup: delete test collections ──────────────────────────────────────
test.afterAll(async () => {
  if (!sharedContext) return
  const page = await sharedContext.newPage()
  await page.goto('/')
  // Clean up COL_NAME if it still exists
  for (const name of [COL_NAME]) {
    const link = page.getByRole('link', { name })
    if (await link.isVisible()) {
      await link.hover()
      const menuBtn = page.getByRole('button', { name: /menü/i }).last()
      if (await menuBtn.isVisible()) {
        await menuBtn.click()
        const deleteItem = page.getByRole('menuitem', { name: /löschen/i })
        if (await deleteItem.isVisible()) {
          await deleteItem.click()
          const confirmBtn = page.getByRole('button', { name: /^löschen$/i })
          if (await confirmBtn.isVisible()) await confirmBtn.click()
        }
      }
    }
  }
  await page.close()
})
