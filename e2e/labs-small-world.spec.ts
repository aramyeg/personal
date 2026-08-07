import { expect, test } from '@playwright/test'
import { TRACK_END } from '../components/labs/small-world/ending-timeline'
// Scroll targets come from the timeline's own constants, never from a fraction typed here: Task 73
// moved every checkpoint and Task 75 moved them again (chapter 1's card was at 0.8/6, then 0.376/6,
// and is now at 0.49/6), and a hard-coded literal would have gone on passing while pointing at
// empty travel.
import {
  chapterDwellProgress,
  chapterTravelProgress,
} from '../components/labs/small-world/journey-timeline'
// ...and the words come from the leaf's own spec for the same reason. This test
// used to assert the literals 'The Pull' and 'Chapter 1', which lived on the data
// card's eyebrow; Task 76 rebuilt the right leaf as a four-beat manga page in
// Alwina's FIRST PERSON and that eyebrow — a third-person chapter label — was the
// thing the rebuild existed to remove. Literals would have gone on failing (or,
// worse, been "fixed" back to strings the page no longer has a reason to print).
import { INFO_PAGES } from '../components/labs/small-world/overlay/info-page-spec'
// ...and the story's own words from the story, for the same reason. Task 82 wired
// the approved round-3 pack and every one of these literals moved: "The Pull"
// became "Marketing, then code", "The Observatory" became "The dashboards", and
// the caption separator went from a middot to the pack's em dash. Pinned as
// strings they would have failed as a copy edit rather than as a defect.
import { ALWINA_STORY } from '../components/labs/small-world/alwina-story'
// The escape hatch's words and ids come from their own owners for the same reason:
// `alwina-cv.ts` is the single source of her roles and dates, and `cv-open.ts` owns
// the label both doors say. A literal here would be a fourth copy of her CV.
import {
  ALWINA,
  DEGREE,
  LANGUAGES,
  ROLES_NEWEST_FIRST,
  STACK,
  creditLine,
} from '../components/labs/small-world/alwina-cv'
import {
  CV_CLOSE_TESTID,
  CV_ENDING_LINK_TESTID,
  CV_LABEL,
  CV_SHEET_LINK_TESTID,
  CV_TESTID,
} from '../components/labs/small-world/overlay/cv-open'

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
// Round 20 (Task 63): the scroll track now runs past the journey — JOURNEY
// progress [0, 1] plus an ending segment up to TRACK_END. `progress` here stays
// in journey units (chapter N's stop is still near (N + 0.8)/6), so the raw
// track fraction is progress / TRACK_END. Values past 1 scrub the ending.
async function scrollToProgress(page: import('@playwright/test').Page, progress: number) {
  await page.evaluate((frac) => {
    const total = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, total * frac)
  }, progress / TRACK_END)
}

/**
 * The scroll position once it has STOPPED moving.
 *
 * `globals.css` sets `scroll-behavior: smooth`, so `window.scrollTo` starts an
 * animation and a `scrollY` read taken straight afterwards is a frame of it rather
 * than where the reader ends up. Any test that compares a position before an
 * interaction with the position after it is otherwise comparing two arbitrary
 * points on a curve — which passes and fails for reasons that have nothing to do
 * with what it is testing.
 */
async function settledScrollY(page: import('@playwright/test').Page): Promise<number> {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => window.scrollY)
    if (Math.abs(y - last) < 0.5) return y
    last = y
    await page.waitForTimeout(50)
  }
  return last
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
    // The lab tells Alwina's story now (T73), so the crawlable mirror is hers.
    await expect(fallback).toContainText(ALWINA_STORY[0].theme)
    await expect(fallback).toContainText(ALWINA_STORY[ALWINA_STORY.length - 1].caption)
    await expect(fallback).toContainText(ALWINA_STORY[ALWINA_STORY.length - 1].theme)
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
    expect(html).toContain(ALWINA_STORY[0].theme)
    expect(html).toContain('Sync Design Tech')
    expect(html).toContain(ALWINA_STORY[ALWINA_STORY.length - 1].theme)
  })

  test('comic panel opens at the first discovery stop', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, chapterDwellProgress(0))
    const panel = page.getByTestId('sw-panel-data')
    await expect(panel).toBeVisible({ timeout: 10_000 })
    // The leaf IS the info page, and it is chapter 1's. Both halves matter: the
    // first is structural (the spread mounted the right component), the second is
    // that it mounted the right CHAPTER — a spread showing chapter 4 at chapter
    // 1's stop would satisfy the first on its own.
    await expect(panel.getByTestId('sw-info-page')).toBeVisible({ timeout: 10_000 })
    await expect(panel).toContainText(INFO_PAGES[0].footer.org, { timeout: 10_000 })
    await expect(panel).toContainText(INFO_PAGES[0].ketsu.line, { timeout: 10_000 })
  })

  test('panel dismisses when scrolling on', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, chapterDwellProgress(0))
    await expect(page.getByTestId('sw-panel-data')).toBeVisible({ timeout: 10_000 })
    await scrollToProgress(page, chapterTravelProgress(1))
    await expect(page.getByTestId('sw-panel-data')).toBeHidden()
  })

  // Task 63/66: past the journey the ending owns the track — the still beat
  // (the stand rises and seats the world) and then the zoom-out desk reveal,
  // which doubles as the contact page (real anchors in the sw-ending slot).
  test('the ending settles the world on its stand, then pulls back to the contact links', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, 1.02)
    const ending = page.getByTestId('sw-ending')
    await expect(ending).toBeAttached({ timeout: 10_000 })
    await expect(ending).toHaveAttribute('data-phase', 'still')
    await scrollToProgress(page, TRACK_END)
    await expect(ending).toHaveAttribute('data-phase', 'zoom')
    await expect(ending.getByTestId('sw-connect-email')).toBeVisible({ timeout: 10_000 })
    await expect(ending.getByTestId('sw-connect-email')).toHaveAttribute('href', /^mailto:/)
    await expect(ending.getByTestId('sw-connect-github')).toHaveAttribute('href', /github\.com/)
    await expect(ending.getByTestId('sw-connect-linkedin')).toHaveAttribute('href', /linkedin\.com/)
    await expect(ending.getByTestId('sw-connect-restart')).toBeVisible()
  })

  /**
   * TASK 83 — THE ESCAPE HATCH. Task 77's N1: one plain dense readable view of her
   * CV, reachable EARLY, made of real text. The genre-wide failure is hiding it, so
   * what is tested is that a reader who has done nothing but arrive at the first
   * story stop can reach it in ONE interaction — and get the world back unmoved.
   */
  test('the plain CV opens from the first story stop, and hands the scroll back untouched', async ({
    page,
  }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, chapterDwellProgress(0))
    await expect(page.getByTestId('sw-panel-data')).toBeVisible({ timeout: 10_000 })
    // On a phone the spread is a stack and the comic is in front; the details leaf is
    // one documented tap behind it. The tab is display:none on desktop, so this is the
    // same journey on both without a viewport branch.
    const tab = page.locator('.sw-stack-tab')
    if (await tab.isVisible()) await tab.click()

    const link = page.getByTestId(CV_SHEET_LINK_TESTID)
    await expect(link).toBeVisible({ timeout: 10_000 })
    // A WORD, not an icon — the whole remedy for the pattern the research found.
    await expect(link).toHaveText(CV_LABEL)

    // The page's own smooth scroll is still easing after `scrollTo`; read the resting
    // position rather than a frame of the animation, or the comparison at the end is
    // against a number that was never where the reader was.
    const before = await settledScrollY(page)
    await link.click()

    const cv = page.getByTestId(CV_TESTID)
    await expect(cv).toBeVisible({ timeout: 10_000 })
    // REAL TEXT, and the dense block the sheet could not carry: her name, every role
    // with its employer and dates, the degree, the languages and the stack.
    await expect(cv).toContainText(ALWINA.name)
    for (const c of ROLES_NEWEST_FIRST) await expect(cv).toContainText(creditLine(c))
    await expect(cv).toContainText(creditLine(DEGREE))
    await expect(cv).toContainText(LANGUAGES.join(', '))
    await expect(cv).toContainText(STACK.join(', '))
    await expect(cv).toContainText(ALWINA.contact)

    // ESCAPE CLOSES THE CV AND NOT THE LAB — the lab's own Escape handler navigates to
    // the museum, and this page claims the key in the capture phase to stop it.
    await page.keyboard.press('Escape')
    await expect(cv).toBeHidden({ timeout: 10_000 })
    await expect(page).toHaveURL(/small-world/)
    // SCROLL PURITY: returning must not move the world.
    expect(await settledScrollY(page)).toBeCloseTo(before, 0)
    await expect(page.getByTestId('sw-panel-data')).toBeVisible()
  })

  test('the plain CV is offered again at the ending, beside the restart', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, TRACK_END)
    const ending = page.getByTestId('sw-ending')
    await expect(ending.getByTestId('sw-connect-restart')).toBeVisible({ timeout: 10_000 })
    const link = ending.getByTestId(CV_ENDING_LINK_TESTID)
    await expect(link).toHaveText(CV_LABEL)
    await link.click()
    const cv = page.getByTestId(CV_TESTID)
    await expect(cv).toBeVisible({ timeout: 10_000 })
    await expect(cv).toContainText(creditLine(ROLES_NEWEST_FIRST[0]))
    // ...and the close is a word too.
    await page.getByTestId(CV_CLOSE_TESTID).click()
    await expect(cv).toBeHidden()
    await expect(ending.getByTestId('sw-connect-restart')).toBeVisible()
  })
})
