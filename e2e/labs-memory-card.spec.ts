import { expect, test, type Page } from '@playwright/test'

const BOOT_SESSION_KEY = 'memory-card-booted'

/**
 * Seeds the boot-beat's sessionStorage guard before the app's own scripts run,
 * so a journey that isn't testing the beat itself never eats its fixed 3s
 * window (boot-beat interference rule — every non-boot journey seeds this).
 */
async function skipBootBeat(page: Page) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem(key, '1')
  }, BOOT_SESSION_KEY)
}

test.describe('memory card lab — boot', () => {
  test('the boot beat auto-advances to the screen once its timer ends', async ({ page }) => {
    await page.goto('/labs/memory-card')
    await expect(page.getByTestId('boot-beat')).toBeVisible()
    // BEAT_DURATION_MS is a 3s timer, but the figure/card-arc scenes mount
    // concurrently and do real synchronous WebGL setup (PMREM env bake, GLTF
    // loads) that can delay the timer firing — generous margin for that,
    // heavier still on emulated mobile devices.
    await expect(page.getByTestId('boot-beat')).toBeHidden({ timeout: 15000 })
    await expect(page.getByRole('list', { name: /save files/i })).toBeVisible()
  })

  test('a keydown mid-beat skips it instantly, without waiting for the timer', async ({
    page,
  }) => {
    await page.goto('/labs/memory-card')
    await expect(page.getByTestId('boot-beat')).toBeVisible()
    await page.keyboard.press('a')
    await expect(page.getByTestId('boot-beat')).toBeHidden({ timeout: 1000 })
    await expect(page.getByRole('list', { name: /save files/i })).toBeVisible()
  })

  test('a sessionStorage-seeded session skips the beat entirely', async ({ page }) => {
    await skipBootBeat(page)
    await page.goto('/labs/memory-card')
    await expect(page.getByRole('list', { name: /save files/i })).toBeVisible()
    await expect(page.getByTestId('boot-beat')).toBeHidden()
  })
})

test.describe('memory card lab — save select', () => {
  test.beforeEach(async ({ page }) => {
    await skipBootBeat(page)
  })

  test('keyboard-only: arrow to a save, load it, and escape restores focus', async ({ page }) => {
    await page.goto('/labs/memory-card')
    await expect(page.getByRole('list', { name: /save files/i })).toBeVisible()

    const slot01 = page.getByRole('button', { name: /^slot 01/i })
    const slot02 = page.getByRole('button', { name: /^slot 02/i })

    // .focus() sets DOM focus directly (no click), so it doesn't fire the
    // rail's click-to-activate handler on the already-active first row.
    await slot01.focus()
    await page.keyboard.press('ArrowDown') // slot 01 (already active) -> slot 02 (360dialog)
    await expect(slot02).toBeFocused()

    await page.keyboard.press('Enter')
    const overlay = page.getByRole('dialog', { name: /360dialog platform/i })
    await expect(overlay).toBeVisible()
    await expect(page).toHaveURL(/\/labs\/memory-card\/save\/360dialog/)

    await page.keyboard.press('Escape')
    await expect(overlay).toBeHidden()
    await expect(page).toHaveURL(/\/labs\/memory-card$/)
    await expect(slot02).toBeFocused()
  })

  test('deep link: the standalone save page stands alone with a back link and both attributions', async ({
    page,
  }) => {
    await page.goto('/labs/memory-card/save/amio-bank')
    await expect(page).toHaveTitle(/AMIO Bank iBank/)
    await expect(
      page.getByRole('heading', { name: /amio bank ibank/i, level: 1 })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /select file/i })).toBeVisible()
    await expect(page.getByText(/crt model by meipal \(cc by 4\.0\)/i)).toBeVisible()
    await expect(page.getByText(/character base by quaternius \(cc0\)/i)).toBeVisible()
  })

  test('mobile viewport: two taps on a rail row load its save as a full sheet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/labs/memory-card')
    const slot03 = page.getByRole('button', { name: /^slot 03/i })
    await expect(slot03).toBeVisible()

    // The rail's click handler is shared by touch and mouse (no separate touch
    // listener), so .click() exercises the same "first tap highlights, second
    // activates" path a real tap would — and keeps this journey runnable on
    // every configured browser project, not just the two with hasTouch.
    await slot03.click()
    await slot03.click()

    const overlay = page.getByRole('dialog', { name: /snb mobile banking/i })
    await expect(overlay).toBeVisible()
    const box = await overlay.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(350)
  })

  test('reduced motion: the beat never shows and LOAD still works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/memory-card')
    await expect(page.getByTestId('boot-beat')).toBeHidden()
    await expect(page.getByRole('list', { name: /save files/i })).toBeVisible()

    await page.getByRole('button', { name: /load slot 01/i }).click()
    await expect(page.getByRole('dialog', { name: /amio bank ibank/i })).toBeVisible()
    await expect(page).toHaveURL(/\/labs\/memory-card\/save\/amio-bank/)
  })

  test('a11y smoke: one dialog, aria-modal, roving tabindex, attribution visible', async ({
    page,
  }) => {
    await page.goto('/labs/memory-card')
    await expect(page.getByRole('list', { name: /save files/i })).toBeVisible()
    // Scoped to the credits footer — the "save?" system dialog's content also
    // carries its own copy of both attribution lines (always in the DOM, for
    // crawlers), so an unscoped getByText matches twice.
    await expect(
      page.getByLabel('Credits').getByText(/crt model by meipal \(cc by 4\.0\)/i)
    ).toBeVisible()

    // Exactly one rail row carries the roving tabindex before anything opens.
    await expect(page.locator('#save-index button[tabindex="0"]')).toHaveCount(1)

    // Slot 04 is the first system save (system data) — two taps opens its dialog.
    const slot04 = page.getByRole('button', { name: /^slot 04/i })
    await slot04.click()
    await slot04.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveCount(1)
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(page.locator('#save-index button[tabindex="0"]')).toHaveCount(1)
  })
})
