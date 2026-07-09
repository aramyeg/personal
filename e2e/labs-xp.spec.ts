import { expect, test } from '@playwright/test'

test.describe('xp lab', () => {
  test('boot → welcome → login lands on the desktop', async ({ page }) => {
    await page.goto('/labs/xp')
    await expect(page.getByTestId('boot-screen')).toBeVisible()
    await page.keyboard.press('Enter') // skip boot
    await page.getByRole('button', { name: 'Log on as Aram' }).click()
    await expect(page.getByRole('button', { name: 'start' })).toBeVisible()
  })

  test('desktop icon opens a window; taskbar minimizes it', async ({ page }) => {
    await page.goto('/labs/xp')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Log on as Aram' }).click()
    await page.getByText('about-me.txt', { exact: true }).dblclick()
    await expect(page.getByTestId('window-about')).toBeVisible()
    await page.getByRole('button', { name: /about-me\.txt - Notepad/ }).click()
    await expect(page.getByTestId('window-about')).toBeHidden()
  })

  test('esc with the start menu open stays in the lab; quiet esc leaves', async ({ page }) => {
    await page.goto('/labs/xp')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Log on as Aram' }).click()
    await page.getByRole('button', { name: 'start' }).click()
    await page.keyboard.press('Escape')
    // settle-wait guard: dev-server route compilation can lag a wrong navigation
    await page.waitForTimeout(700)
    await expect(page).toHaveURL(/\/labs\/xp/)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/labs(\?.*)?$/)
  })

  test('turn off computer exits to the gallery', async ({ page }) => {
    await page.goto('/labs/xp')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Log on as Aram' }).click()
    await page.getByRole('button', { name: 'start' }).click()
    await page.getByText('Turn Off Computer').click()
    await page.getByRole('button', { name: 'Turn Off' }).click()
    await expect(page).toHaveURL(/\/labs(\?.*)?$/)
  })

  test('reduced motion skips boot entirely', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/labs/xp')
    await expect(page.getByRole('button', { name: 'start' })).toBeVisible()
  })

  test('cv is server-rendered for crawlers', async ({ request }) => {
    const res = await request.get('/labs/xp')
    const html = await res.text()
    expect(html).toContain('Senior Frontend Engineer')
    expect(html).toContain('curriculum vitae')
  })
})
