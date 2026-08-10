import { expect, test } from '@playwright/test'
import { TRACK_END } from '../components/labs/small-world/ending-timeline'
// Scroll targets come from the timeline's own constants, never from a fraction typed here: Task 73
// moved every checkpoint and Task 75 moved them again (chapter 1's card was at 0.8/6, then 0.376/6,
// and is now at 0.49/6), and a hard-coded literal would have gone on passing while pointing at
// empty travel.
import {
  DWELL_MID,
  TRAVEL_END,
  chapterDwellProgress,
  chapterTravelProgress,
} from '../components/labs/small-world/journey-timeline'
import { CHAPTER_COUNT } from '../components/labs/small-world/chapters'
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
  CONTACT_HREF,
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

/**
 * Wait until an element has STOPPED MOVING.
 *
 * The chapter spread rolls in on a wall-clock entrance, so "visible" and "where it
 * is going to be" are two different moments. Anything that measures a position — or
 * that must not have its position measured for it, which is what Playwright's own
 * scroll-into-view does — has to wait for the second one.
 */
async function awaitStable(locator: import('@playwright/test').Locator) {
  let last: { x: number; y: number } | null = null
  for (let i = 0; i < 40; i++) {
    const box = await locator.boundingBox()
    if (box && last && Math.abs(box.x - last.x) < 0.5 && Math.abs(box.y - last.y) < 0.5) return box
    last = box
    await locator.page().waitForTimeout(100)
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
    // SCROLL ON WITHIN THE SAME CHAPTER (Task 109). This used to travel to chapter
    // 2's release leg, which crosses chapter 2's OWN checkpoint on the way — and
    // since the pace governor the journey genuinely stops there and plays its beat,
    // so a spread was up at the destination and the assertion read the new one. The
    // test's claim is that a spread dismisses when the reader moves on, and the
    // release leg of the chapter it belongs to is where that is asked cleanly.
    await scrollToProgress(page, chapterTravelProgress(0))
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
    // ONE PILL, AND IT IS HERS (Task 85, finding 1). The email and GitHub pills
    // carried Aram's addresses on a page that is Alwina's CV; they are gone until
    // real ones exist for her, so this asserts what remains rather than three.
    await expect(ending.getByTestId('sw-connect-linkedin')).toBeVisible({ timeout: 10_000 })
    await expect(ending.getByTestId('sw-connect-linkedin')).toHaveAttribute('href', CONTACT_HREF)
    await expect(ending.getByTestId('sw-connect-email')).toHaveCount(0)
    await expect(ending.getByTestId('sw-connect-github')).toHaveCount(0)
    await expect(ending.getByTestId('sw-connect-restart')).toBeVisible()
  })

  /**
   * TASK 85, FINDING 1 — the audit's CRITICAL, measured on the SHIPPED ROUTE.
   *
   * The unit gate reads components; this reads the page a recruiter actually
   * loads, which is where the defect was found: three pills resolving to
   * `aramyeg96@gmail.com`, `github.com/aramyeg` and `linkedin.com/in/aramyeg`,
   * a document title naming him, and a CV overlay on the same page printing her
   * LinkedIn. It sweeps the ending (where the pills are), the crawlable fallback
   * that ships in the initial HTML, and the document title.
   */
  test('no address, profile or title on the lab route belongs to anyone but her', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/labs/small-world')

    // The initial HTML first — this is what a crawler and a link preview get, and
    // the fallback footer printed his three addresses into it.
    const html = await (await page.request.get('/labs/small-world')).text()
    expect(html, 'server-rendered HTML').not.toMatch(/aramyeg/i)

    await expect(page).toHaveTitle(new RegExp(ALWINA.name))
    expect(await page.title()).not.toMatch(/aram/i)

    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, TRACK_END)
    const ending = page.getByTestId('sw-ending')
    await expect(ending).toBeAttached({ timeout: 10_000 })
    await expect(ending.getByTestId('sw-connect-linkedin')).toBeVisible({ timeout: 10_000 })

    // Every anchor the ending offers, and every one on the page besides.
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '')
    )
    for (const h of hrefs) expect(h, 'a link on the lab route').not.toMatch(/aramyeg/i)
    // ...and no invented address for her either: the rule the plain CV has kept
    // since T83, now true of the whole route.
    for (const h of hrefs) expect(h, 'a link on the lab route').not.toMatch(/^mailto:/)
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
    // NO TAP HERE ANY MORE, and its absence is the assertion (Task 85, finding 2).
    // The stack used to put the comic in front on every chapter, so on a phone this
    // door was behind the manga page and the audit did not find it at all. Chapter 1
    // now opens on the details, which means "one interaction" is the CLICK BELOW on
    // both form factors rather than a tap to find the door and then a click on it.
    const link = page.getByTestId(CV_SHEET_LINK_TESTID)
    await expect(link).toBeVisible({ timeout: 10_000 })
    // A WORD, not an icon — the whole remedy for the pattern the research found.
    await expect(link).toHaveText(CV_LABEL)

    // LET THE LEAF LAND, AND DO THE HARNESS'S SCROLLING BEFORE THE CLOCK STARTS.
    // The leaf enters on `translateX(120% * (1-enter))`, so while it is arriving the
    // link is still travelling — and Playwright's click does `scrollIntoViewIfNeeded`
    // first, which chased it and eased the track 794 → 481. The overlay's own restore
    // then put it back, so the assertion at the end was measuring the harness scrolling
    // and the product undoing it: a pass that proved nothing, and a fail that blamed
    // the wrong thing. Waiting for the leaf to stop moving and scrolling it into view
    // HERE means the position sampled below is the one the reader clicks from.
    await awaitStable(link)
    await link.scrollIntoViewIfNeeded()

    // The page's own smooth scroll is still easing after `scrollTo`; read the resting
    // position rather than a frame of the animation, or the comparison at the end is
    // against a number that was never where the reader was.
    const before = await settledScrollY(page)
    await link.click()
    // The click itself must not have moved the world either — this is what makes the
    // final comparison a statement about the CV rather than about the two scrolls
    // cancelling.
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(before, 0)

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
    await settledScrollY(page)
    // THE CONNECT BLOCK NEVER HOLDS STILL, and that is T72 rather than this lane: it
    // RIDES THE NOTE through `use-note-tracking`, a rAF that writes the block's own
    // transform every frame the camera breathes. Measured on Pixel 5 with the scroll
    // parked at 11487, the block swept translate3d(-17.29, -67.12) → (1.45, -51.74)
    // over three seconds and kept going, so Playwright's "two identical frames" check
    // can never pass for anything inside it. (The pre-existing ending test only ever
    // asserts visibility, which is why nothing had met this before.)
    //
    // So the actionability check is replaced rather than waived: assert the link is the
    // TOPMOST element at its own centre — which is the thing `force` gives up, and the
    // only thing a stability wait was buying here — and then click. A 91x28 target
    // drifting ~2px per 300ms is not a hit-testing risk for a finger or for this.
    const hittable = await link.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return top === el || el.contains(top)
    })
    expect(hittable, 'the ending CV link is topmost at its own centre').toBe(true)
    await link.click({ force: true })
    const cv = page.getByTestId(CV_TESTID)
    await expect(cv).toBeVisible({ timeout: 10_000 })
    await expect(cv).toContainText(creditLine(ROLES_NEWEST_FIRST[0]))
    // ...and the close is a word too.
    await page.getByTestId(CV_CLOSE_TESTID).click()
    await expect(cv).toBeHidden()
    await expect(ending.getByTestId('sw-connect-restart')).toBeVisible()
  })
  /**
   * TASK 85, FINDING 2 — a phone visitor who taps NOTHING still learns who she is.
   *
   * The audit completed an entire phone playthrough without once seeing her name:
   * the identity leaf was the hidden face of the stack in all six chapters, and
   * `elementFromPoint` over the centre of the name node returned the manga IMG.
   * This asserts the remedy in the audit's own terms — painted AND hit-testable at
   * chapter 1's stop with no interaction at all — because "rendered" was already
   * true when it was broken.
   */
  test('the first stop shows her name and her line without being touched', async ({ page }) => {
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    await scrollToProgress(page, chapterDwellProgress(0))
    const leaf = page.getByTestId('sw-panel-data')
    await expect(leaf).toBeVisible({ timeout: 10_000 })
    await awaitStable(leaf)

    // `display`, not `name`: the sheet inside the world calls her Alwi (Task 103).
    // The legal name is still gated — on the plain CV and on the tab title.
    for (const text of [ALWINA.display, ALWINA.says]) {
      const node = leaf.getByText(text, { exact: true }).first()
      await expect(node, `"${text}" is on the page`).toBeVisible({ timeout: 10_000 })
      // TOPMOST AT ITS OWN CENTRE, AND THE TOPMOST THING BELONGS TO THIS LEAF.
      // Visibility alone is what the audit found to be true and useless: the name
      // was painted at full opacity underneath an opaque manga page, in the OTHER
      // leaf of the stack. So the question is whether anything from outside this
      // leaf covers it.
      //
      // NOT "is the hit-test result an ancestor of the text". That was the first
      // form and webkit fails it while rendering the name perfectly: the sheet
      // gives each line its own `rotateX`/`translateZ` wrapper, and those stacking
      // contexts make a transparent SIBLING the topmost element at that point.
      // Hit-test order is not paint occlusion, and the defect this exists for is
      // the other card being in front — which this still catches exactly.
      //
      // POLLED, because the leaf ARRIVES: it enters on `translateX(120% * (1 -
      // enter))` driven by the wall clock, and a hit-test taken mid-entrance
      // reads the canvas behind it. Captured on webkit against the pre-fix build:
      // the frame under test still had the "!" burst up and no cards at all, so
      // the check "failed" on a chapter that had not started yet. Polling makes
      // this an assertion about the RESTING state, which is the state the finding
      // is about, without weakening what is asserted.
      await expect
        .poll(
          async () =>
            node.evaluate((el) => {
              const r = el.getBoundingClientRect()
              const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
              if (!top) return 'nothing hit-tests there'
              return top.closest('[data-testid="sw-panel-data"]') ? null : `covered by ${top.tagName}`
            }),
          { message: `"${text}" is covered from outside its own leaf`, timeout: 15_000 }
        )
        .toBeNull()
    }
    // ...and the escape hatch is on the same face, which is the other half of the
    // finding: the plain CV was not findable on a phone either.
    await expect(page.getByTestId(CV_SHEET_LINK_TESTID)).toBeVisible({ timeout: 10_000 })
  })

  /**
   * TASK 85, FINDING 4 — a headline may not be set wider than the card that holds it.
   *
   * Chapter 3's "THE SMALL STUFF" had its initial T cut off by the leaf's left edge
   * and hung STUFF over the right border, at 1440, 1024, 390 and 360 alike. The unit
   * gate holds the arithmetic; THIS measures the rendered box, which is the only
   * thing that can catch a string whose real metrics beat the estimate.
   */
  test('no chapter sets its headline wider than its own leaf', async ({ page }) => {
    // SIX CHAPTERS, EACH WAITED UNTIL ITS LEAF STOPS MOVING. That is a minute of
    // real work on a loaded machine and it is not a hang, so it gets a budget
    // rather than the default 30s — a sweep timed out mid-chapter would report a
    // clipped headline that was never measured.
    test.setTimeout(150_000)
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      await scrollToProgress(page, chapterDwellProgress(c))
      const leaf = page.getByTestId('sw-info-page')
      await expect(leaf).toBeVisible({ timeout: 10_000 })
      await awaitStable(leaf)
      const box = await leaf.evaluate((el) => {
        const hero = el.querySelector('[data-testid="sw-info-hero"]')
        const span = hero?.querySelector('span')
        if (!span) return null
        const lb = el.getBoundingClientRect()
        const hb = span.getBoundingClientRect()
        return {
          text: span.textContent,
          overflowLeft: lb.left - hb.left,
          overflowRight: hb.right - lb.right,
        }
      })
      if (!box) continue
      expect(box.overflowLeft, `chapter ${c + 1} "${box.text}" is cut on the left`).toBeLessThanOrEqual(0)
      expect(box.overflowRight, `chapter ${c + 1} "${box.text}" overhangs the right`).toBeLessThanOrEqual(0)
    }
  })

  /**
   * TASK 85, FINDING 6 — a reader who stops anywhere gets a whole picture.
   *
   * The photo reveal was a scroll-bound `clip-path` with no completion, so parking
   * at local 0.25 of any chapter left the panel 93.18% blank — permanently, since
   * the page's clock is the scroll. The T82 inequality (`PAGE_SPAN_END < DWELL_MID`)
   * held the whole time and did not prevent it, because a reader does not only rest
   * where a fling snaps: the card's entrance rides the arrival wall clock and always
   * completes while the page's ink rides scroll.
   *
   * So this sweeps the whole band in which a card is up — TRAVEL_END, where the leaf
   * starts arriving, to PANEL_END — rather than the story stops alone.
   */
  test('nothing on the leaf is hidden at any position a reader can park at', async ({ page }) => {
    // THIRTY PARKED POSITIONS, each of which has to settle before it is read.
    // Same reason as the headline sweep above.
    test.setTimeout(240_000)
    await page.goto('/labs/small-world')
    test.skip(!(await webglAvailable(page)), 'no WebGL in this browser build')
    await waitForSceneReady(page)
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      for (const local of [TRAVEL_END + 0.01, 0.28, 0.34, DWELL_MID, 0.6]) {
        await scrollToProgress(page, (c + local) / CHAPTER_COUNT)
        // `scrollToProgress` returns before the page's own smooth scroll has
        // finished, and the leaf's entrance is a wall clock on top of that. Read
        // a frame of either and the measurement is of the animation.
        const leaf = page.getByTestId('sw-info-page')
        if (!(await leaf.isVisible({ timeout: 4_000 }).catch(() => false))) continue
        await awaitStable(leaf)
        const worst = await leaf.evaluate((el) => {
          let hidden = 0
          for (const img of el.querySelectorAll('img')) {
            const cs = getComputedStyle(img)
            // A clip is what could remove; a mask is what may only dim.
            const m = /inset\(([^)]*)\)/.exec(cs.clipPath)
            if (m) {
              const right = m[1].trim().split(/\s+/)[1] ?? '0px'
              if (right.endsWith('%')) hidden = Math.max(hidden, parseFloat(right))
            }
          }
          return hidden
        })
        expect(
          worst,
          `chapter ${c + 1} at local ${local}: art ${worst}% removed by a clip`
        ).toBeLessThanOrEqual(0)
      }
    }
  })
})
