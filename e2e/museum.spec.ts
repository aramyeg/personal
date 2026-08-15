import { test, expect } from '@playwright/test'

test.describe('Museum at /', () => {
  test('curtain covers the load, then departs to reveal the hall', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/')
    const hasWebGL = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    )
    test.skip(!hasWebGL, 'headless browser lacks WebGL2 — falls back to the list view')
    await expect(page.locator('[data-phase]')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-phase]')).toHaveCount(0, { timeout: 20000 })
    await expect(page.getByText(/shift to run/i)).toBeVisible()
  })

  test('? reopens the visitor guide and Esc closes it', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/')
    const hasWebGL = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    )
    test.skip(!hasWebGL, 'headless browser lacks WebGL2 — falls back to the list view')
    await expect(page.locator('[data-phase]')).toHaveCount(0, { timeout: 20000 })
    await page.getByRole('button', { name: /show controls guide/i }).click()
    await expect(page.getByText(/visitor.s guide/i)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText(/visitor.s guide/i)).toHaveCount(0)
  })

  test('classic claude serves the original portfolio', async ({ page }) => {
    await page.goto('/classic-claude')
    await expect(page).toHaveTitle(/Classic Claude/)
    await expect(page.locator('#hero')).toBeVisible()
  })
})
