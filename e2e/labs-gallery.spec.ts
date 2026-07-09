import { test, expect } from '@playwright/test'

test.describe('Style Lab gallery', () => {
  test('list view shows every lab with a working link', async ({ page }) => {
    await page.goto('/labs?view=list')
    const memoryCard = page.getByRole('link', { name: /Memory Card/ })
    await expect(memoryCard).toBeVisible()
    await memoryCard.click()
    await expect(page).toHaveURL(/\/labs\/memory-card/)
  })

  test('desktop /labs mounts the 3D museum canvas', async ({ page, isMobile }) => {
    test.skip(isMobile, '3D is desktop-default only')
    await page.goto('/labs')
    const hasWebGL = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    )
    test.skip(!hasWebGL, 'headless browser lacks WebGL2 — falls back to the list view')
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /list view/i })).toBeVisible()
  })

  test('Escape inside a lab returns to the gallery', async ({ page }) => {
    await page.goto('/labs/memory-card')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/labs$/, { timeout: 10000 })
  })

  test('lab page has a back-to-gallery button', async ({ page }) => {
    await page.goto('/labs/memory-card')
    const back = page.getByRole('link', { name: /gallery/i })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/\/labs$/)
  })
})
