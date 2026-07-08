import { expect, test } from '@playwright/test'

test.describe('snowpark lab', () => {
  test('game canvas mounts and the HUD appears', async ({ page }) => {
    await page.goto('/labs/snowpark')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByTestId('hud-score')).toBeVisible()
  })

  test('first Esc pauses in place, second Esc returns to the gallery', async ({ page }) => {
    await page.goto('/labs/snowpark')
    await expect(page.getByTestId('hud-score')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('paused', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/labs\/snowpark/)
    // Guard against a false green: a navigation that merely lags route
    // compilation could still slip through if we asserted the URL only once,
    // right after the first Escape. Wait and re-assert before the second Escape.
    await page.waitForTimeout(700)
    await expect(page).toHaveURL(/\/labs\/snowpark/)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/labs(\?.*)?$/)
  })

  test('reduced motion renders the static skill sheet, not the running game', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/snowpark')
    await expect(page.getByRole('button', { name: 'start the run anyway' })).toBeVisible()
    await expect(page.getByText('React', { exact: true })).toBeVisible()
  })
})
