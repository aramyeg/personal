import { test, expect } from '@playwright/test'

test.describe('labs attic', () => {
  test('list view shows the failed experiments section with the retrospective', async ({ page }) => {
    await page.goto('/labs?view=list')
    await expect(page.getByRole('heading', { name: 'failed experiments' })).toBeVisible()
    await expect(page.getByText('Three passes, three verdicts.', { exact: false })).toBeVisible()
  })

  test('the retired lab still routes to its playable page', async ({ page }) => {
    await page.goto('/labs?view=list')
    await page.getByRole('link', { name: /Powder Lines/ }).click()
    await expect(page).toHaveURL(/\/labs\/snowpark/)
  })
})
