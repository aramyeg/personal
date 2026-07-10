import { expect, test } from '@playwright/test'

test.describe('storybook plain view', () => {
  test('tells all six kingdoms with contact', async ({ page }) => {
    await page.goto('/labs/storybook?view=plain')
    for (const company of ['BlueNet', 'FLYERBEE', '360dialog', 'Accenture', 'AKNA', 'xDataGroup']) {
      await expect(page.getByText(new RegExp(company)).first()).toBeVisible()
    }
    await expect(page.getByRole('link', { name: /send a raven/i })).toHaveAttribute('href', /mailto:/)
  })

  test('reduced motion gets the plain tale automatically', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/storybook')
    await expect(page.getByText(/Vault-Dragon/).first()).toBeVisible()
  })
})

test.describe('storybook book', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WebGL-dependent')

  test('opens the cover and turns pages by keyboard', async ({ page }) => {
    await page.goto('/labs/storybook')
    await expect(page.getByRole('button', { name: /open the book/i })).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText(/Once upon a time — which is to say/)).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText(/Inn of a Hundred Keys/).first()).toBeVisible({ timeout: 10_000 })
  })

  test('escape returns to the gallery', async ({ page }) => {
    await page.goto('/labs/storybook')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500) // settle wait — dev-server nav can lag (snowpark lesson)
    await expect(page).toHaveURL(/\/labs$/)
  })

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('/labs/storybook')
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
})
