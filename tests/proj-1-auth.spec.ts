/**
 * E2E tests for PROJ-1: Authentifizierung
 *
 * Tests that don't need credentials run always (redirect, error display, form structure).
 * Tests that require login use TEST_EMAIL / TEST_PASSWORD env vars.
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

// ── Redirect & route protection ────────────────────────────────────────────

test('Unauthenticated access to / redirects to /login', async ({ page }) => {
  // Clear any existing session by going to login page directly
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
})

test('Login page renders email + password form', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/e-mail/i)).toBeVisible()
  await expect(page.getByLabel(/passwort/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /^anmelden$/i })).toBeVisible()
})

test('Login page shows "Mit Google anmelden" button', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /mit google anmelden/i })).toBeVisible()
})

test('Login page has "Passwort vergessen?" link', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('link', { name: /passwort vergessen/i })).toBeVisible()
})

test('"Passwort vergessen?" link navigates to /login/reset', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: /passwort vergessen/i }).click()
  await expect(page).toHaveURL('/login/reset')
  await expect(page.getByRole('button', { name: /reset-link senden/i })).toBeVisible()
})

test('/login/reset/update is accessible directly', async ({ page }) => {
  await page.goto('/login/reset/update')
  // Page loads (may show form or redirect — just must not crash)
  await expect(page).not.toHaveURL(/error/)
})

// ── Error states (no credentials needed) ──────────────────────────────────

test('?error=not_allowed shows "nicht öffentlich zugänglich" message', async ({ page }) => {
  await page.goto('/login?error=not_allowed')
  await expect(page.getByText(/nicht öffentlich zugänglich/i)).toBeVisible()
})

test('?error=auth_failed shows failure message', async ({ page }) => {
  await page.goto('/login?error=auth_failed')
  await expect(page.getByText(/anmeldung fehlgeschlagen/i)).toBeVisible()
})

test('Wrong credentials show generic error — no hint about which field', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill('wrong@example.com')
  await page.getByLabel(/passwort/i).fill('wrongpassword')
  await page.getByRole('button', { name: /^anmelden$/i }).click()

  // Should show a toast or inline error — generic, no "email not found" / "wrong password"
  const errorMsg = page.getByText(/anmeldung fehlgeschlagen/i)
  await expect(errorMsg).toBeVisible({ timeout: 8000 })

  // Must NOT reveal which field is wrong
  await expect(page.getByText(/passwort falsch/i)).not.toBeVisible()
  await expect(page.getByText(/e-mail.*nicht.*gefunden/i)).not.toBeVisible()
})

// ── Authenticated flows (require TEST_PASSWORD) ────────────────────────────

test('Correct credentials → lands on /', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: /alle prompts/i })).toBeVisible()
})

test('Logged-in user visiting /login is redirected to /', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.goto('/login')
  await expect(page).toHaveURL('/', { timeout: 5000 })
})

test('Logout → session ended → lands on /login', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /abmelden/i }).click()
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
})

test('After logout, / redirects back to /login', async ({ page }) => {
  test.skip(SKIP_AUTH, 'TEST_PASSWORD not set')
  await login(page)
  await page.getByRole('button', { name: /abmelden/i }).click()
  await page.waitForURL(/\/login/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
})
