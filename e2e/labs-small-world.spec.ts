import { expect, test } from '@playwright/test'

async function webglAvailable(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const c = document.createElement('canvas')
      return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
    } catch {
      return false
    }
  })
}

// Round 15 note (Task 54): checkpoint entrances are now played by a wall-clock
// reveal, not by the scroll position alone. Both panel expectations below still
// hold — the cards MOUNT on arrival (earlier than before, at the girl's stop
// rather than at the dwell's panel window) and they UNMOUNT after a ~0.4s
// retraction rather than instantly, which the auto-retrying matchers absorb. If
// either becomes flaky, the fix is to wait for the retraction, not to loosen the
// assertion. Note that this helper's scrollTo is ANIMATED (globals.css sets
// scroll-behavior: smooth), so landing in a dwell can spend that checkpoint's one
// absorption on the way in — the journey settles on the requested position either
// way, it just may take up to a second longer than the scroll animation.
async function scrollToProgress(page: import('@playwright/test').Page, progress: number) {
  await page.evaluate((p) => {
    const total = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, total * p)
  }, progress)
}

// SmallWorldExperience renders `null` until a mount effect confirms WebGL and
// checks prefers-reduced-motion, then swaps in the tall scroll track. Scrolling
// before that swap computes progress against the short fallback page height, so
// wait for the canvas (a proxy for the track having mounted) before scrolling.
async function waitForSceneReady(page: import('@playwright/test').Page) {
  await page.waitForSelector('canvas', { timeout: 10_000 })
  // The themed planet loader overlays the scene through its min-hold + reveal;
  // wait for it to finish and unmount so scroll-driven panels aren't covered
  // when assertions run. `detached` resolves immediately if it is already gone.
  await page.waitForSelector('[data-sw-loader]', { state: 'detached', timeout: 12_000 })
}

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

  test('comic panel opens at the first discovery stop', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, 0.8 / 6)
    const panel = page.getByTestId('sw-panel-data')
    await expect(panel).toBeVisible({ timeout: 10_000 })
    await expect(panel).toContainText('BlueNet')
    await expect(panel).toContainText('Chapter 1')
  })

  test('panel dismisses when scrolling on', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, 0.8 / 6)
    await expect(page.getByTestId('sw-panel-data')).toBeVisible({ timeout: 10_000 })
    await scrollToProgress(page, 1.2 / 6)
    await expect(page.getByTestId('sw-panel-data')).toBeHidden()
  })

  test('the journey ends on to-be-continued with contact links', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, 1)
    const end = page.getByTestId('sw-panel-end')
    await expect(end).toBeVisible({ timeout: 10_000 })
    await expect(end).toContainText(/to be continued/i)
    await expect(end.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com/)
  })
})
