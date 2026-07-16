import { expect, test } from '@playwright/test'

test.describe('Small World lab', () => {
  test('serves the crawlable career timeline', async ({ page }) => {
    await page.goto('/labs/small-world')
    const fallback = page.getByTestId('small-world-fallback')
    await expect(fallback).toBeAttached()
    await expect(fallback).toContainText('xDataGroup')
    await expect(fallback).toContainText('Senior Frontend Engineer')
    await expect(fallback).toContainText('BlueNet')
  })

  test('Esc returns to the museum', async ({ page }) => {
    await page.goto('/labs/small-world')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 })
  })

  test('career timeline is server-rendered for crawlers', async ({ request }) => {
    const res = await request.get('/labs/small-world')
    const html = await res.text()
    expect(html).toContain('xDataGroup')
    expect(html).toContain('Senior Frontend Engineer')
    expect(html).toContain('BlueNet')
  })
})
