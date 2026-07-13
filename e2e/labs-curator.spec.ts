import { expect, test, type Page } from '@playwright/test'

// Pre-seeds tourDone so the first-run tour overlay doesn't block clicks in
// tests that aren't specifically exercising it. Persist merge fills the rest
// of the state with defaults. addInitScript re-runs on every navigation in
// this page's lifetime, including page.reload() — guard on an empty key so a
// later reload doesn't clobber state the app itself has since persisted
// (e.g. a pipeline drag).
const seedTourDone = (page: Page) =>
  page.addInitScript(() => {
    if (window.localStorage.getItem('labs-curator')) return
    window.localStorage.setItem(
      'labs-curator',
      JSON.stringify({ state: { tourDone: true }, version: 2 }),
    )
  })

// A generous timeout on the post-sign-in assertion: fullyParallel workers all
// hit the same on-demand dev server, and a cold Turbopack compile of a route
// under contention can exceed the default 5s expect timeout (dev-server
// compile latency — see the settle-wait guard on the Esc-ordering test below).
const signIn = async (page: Page) => {
  await seedTourDone(page)
  await page.goto('/labs/curator')
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 })
}

/** Desktop shows the sidebar nav directly; mobile hides it behind a hamburger + drawer. */
async function selectModule(page: Page, label: string): Promise<void> {
  const hamburger = page.getByRole('button', { name: 'Open navigation' })
  if (await hamburger.isVisible()) {
    await hamburger.click()
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: label }).click()
  } else {
    await page.getByRole('navigation', { name: 'Modules' }).getByRole('button', { name: label }).click()
  }
}

/** Drags the open "Your Company" deal from Sourced into Offer.
 *  Tries page.dragAndDrop first; dnd-kit's PointerSensor needs a real move past
 *  its 4px activation threshold before it arms, which a single-jump drag can
 *  miss, so fall back to a manual pointer sequence with an initial small move. */
async function dragOpenDealToOffer(page: Page): Promise<void> {
  const sourceSelector = '[data-testid="column-sourced"] [data-testid="deal-card"]'
  // The outer `column-offer` div is a CSS grid item and stretches to match the
  // row's tallest column (Closed Won), but dnd-kit's droppable ref lives on
  // its inner card-list child, which stays a compact `min-h-[80px]` near the
  // top. Target that child directly or the drop lands far below the real hit
  // area on an empty column.
  const targetSelector = '[data-testid="column-offer"] > div:last-child'
  const offerHasOpenDeal = page
    .locator('[data-testid="column-offer"]')
    .locator('[data-testid="deal-card"]', { hasText: 'Your Company' })

  await page.dragAndDrop(sourceSelector, targetSelector)
  if (await offerHasOpenDeal.count()) return

  const source = page.locator(sourceSelector, { hasText: 'Your Company' })
  const target = page.locator(targetSelector)
  await source.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Could not measure drag source/target for manual fallback')

  const startX = sourceBox.x + sourceBox.width / 2
  const startY = sourceBox.y + sourceBox.height / 2
  const endX = targetBox.x + targetBox.width / 2
  const endY = targetBox.y + targetBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Cross dnd-kit's 4px activation threshold, then give it a tick to mount
  // the drag overlay and measure droppable rects before continuing.
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 })
  await page.waitForTimeout(150)
  await page.mouse.move(endX, endY, { steps: 20 })
  await page.waitForTimeout(150)
  await page.mouse.up()
}

test.describe('curator lab', () => {
  test('login gate: unauthenticated visit shows the login card; signing in sets an httpOnly session cookie', async ({
    page,
  }) => {
    await seedTourDone(page)
    await page.goto('/labs/curator')
    await expect(page.getByLabel('Work email')).toBeVisible()

    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 })

    const cookies = await page.context().cookies()
    const sessionCookie = cookies.find((c) => c.name === 'curator_session')
    expect(sessionCookie?.httpOnly).toBe(true)
  })

  test('module nav updates the URL, survives reload, and deep-links to the handbook', async ({ page }) => {
    await signIn(page)

    await selectModule(page, 'Personnel')
    await expect(page).toHaveURL(/\?m=personnel/)
    await expect(page.getByRole('heading', { name: 'Personnel', level: 1 })).toBeVisible({ timeout: 15_000 })

    await page.reload()
    await expect(page).toHaveURL(/\?m=personnel/)
    await expect(page.getByRole('heading', { name: 'Personnel', level: 1 })).toBeVisible()

    await page.goto('/labs/curator?m=engineering')
    await expect(page.getByRole('heading', { name: 'Engineering', level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('personnel table paginates and filters', async ({ page }) => {
    await signIn(page)
    await selectModule(page, 'Personnel')

    await expect(page.getByText('Page 1 of 2')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('personnel-row')).toHaveCount(3)

    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText('Page 2 of 2')).toBeVisible()

    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(page.getByText('Page 1 of 2')).toBeVisible()

    await page.getByPlaceholder(/Filter records/).fill('accenture')
    await expect(page.getByTestId('personnel-row')).toHaveCount(1)
  })

  test('pipeline drag moves the open deal into Offer and persists across reload', async ({ page, isMobile }) => {
    // The pipeline board is a static 4-col grid only from the lg breakpoint up;
    // below that it's a horizontally-scrolling row (`auto-cols-[260px]
    // overflow-x-auto`) where Sourced and Offer sit ~544px apart on a
    // ~393px-wide mobile viewport. No single scroll position makes both
    // endpoints simultaneously reachable by direct pointer coordinates, and a
    // real cross-column drag there depends on dnd-kit's edge-proximity
    // auto-scroll, whose rAF-driven timing isn't practical to script
    // deterministically — so this one is desktop-only.
    test.skip(isMobile, 'pipeline board is a horizontally-scrolling row on mobile; cross-column drag needs library auto-scroll')
    await signIn(page)
    await selectModule(page, 'Pipeline')

    const openDealInSourced = page
      .locator('[data-testid="column-sourced"] [data-testid="deal-card"]', { hasText: 'Your Company' })
    await expect(openDealInSourced).toBeVisible({ timeout: 15_000 })

    await dragOpenDealToOffer(page)

    const openDealInOffer = page
      .locator('[data-testid="column-offer"] [data-testid="deal-card"]', { hasText: 'Your Company' })
    await expect(openDealInOffer).toBeVisible()

    await page.reload()
    await expect(openDealInOffer).toBeVisible()
  })

  test('ticket flow walks requester → details → review and submits with an AY- toast', async ({ page }) => {
    await signIn(page)
    await selectModule(page, 'Tickets')
    await expect(page.getByRole('heading', { name: 'Tickets', level: 1 })).toBeVisible({ timeout: 15_000 })

    await page.getByLabel('Full name').fill('Jane Doe')
    await page.getByLabel('Email').fill('jane@example.com')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByLabel('Category').selectOption('freelance')
    await page.getByRole('radio', { name: 'High' }).click()
    await page.getByLabel('Message').fill('This is a test inquiry with more than twenty characters in it.')
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText('Jane Doe')).toBeVisible()
    await expect(page.getByText('jane@example.com')).toBeVisible()
    await expect(page.getByText('Freelance')).toBeVisible()
    await expect(page.getByText('high')).toBeVisible()

    // Submit pushes the toast synchronously before setting window.location.href
    // to a mailto: URL; chromium/mobile-chrome no-op that navigation since no
    // mail handler is registered, so we assert the toast and don't wait on nav.
    await page.getByRole('button', { name: 'Submit ticket' }).click()
    await expect(page.getByText(/Ticket AY-\d{4} created/)).toBeVisible()
  })

  test('NPS survey fires once after three module switches and does not reappear after reload', async ({ page }) => {
    await signIn(page)

    await selectModule(page, 'Rooms')
    await selectModule(page, 'Personnel')
    await selectModule(page, 'Pipeline')

    const survey = page.getByRole('dialog', { name: 'Feedback survey' })
    await expect(survey).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('How likely are you to recommend this CV')).toBeVisible()

    await page.getByRole('button', { name: '9', exact: true }).click()
    await expect(page.getByText('Thanks for your feedback')).toBeVisible()

    await page.reload()
    await selectModule(page, 'Rooms')
    await selectModule(page, 'Personnel')
    await selectModule(page, 'Pipeline')
    await expect(survey).toBeHidden()
  })

  test('first-run tour walks a new visitor through four coach marks, then never reappears', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the tour is desktop-only by design')

    await page.goto('/labs/curator')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 15_000 })

    const tour = page.getByRole('dialog', { name: 'Product tour' })
    await expect(tour).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Step 1 of 4')).toBeVisible()

    await tour.getByRole('button', { name: 'Next' }).click()
    await tour.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Step 3 of 4')).toBeVisible()

    await tour.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Step 2 of 4')).toBeVisible()

    await tour.getByRole('button', { name: 'Next' }).click()
    await tour.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Step 4 of 4')).toBeVisible()

    await tour.getByRole('button', { name: 'Get started' }).click()
    await expect(tour).toBeHidden()
    await expect(page.getByRole('dialog', { name: 'Feedback survey' })).not.toBeVisible()

    await page.reload()
    await expect(tour).toBeHidden()
  })

  test('escape closes an open SPEC popover before it navigates to the gallery', async ({ page }) => {
    await page.goto('/labs/curator')

    await page.getByRole('button', { name: /spec/i }).click()
    // exact: the chip's own visible text is now "SPEC · Session Management",
    // which would otherwise substring-match this locator too.
    await expect(page.getByText('Session Management', { exact: true })).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('Escape')
    await expect(page.getByText('Session Management', { exact: true })).toBeHidden()
    // settle-wait guard: dev-server route compilation can lag a wrong navigation
    await page.waitForTimeout(700)
    await expect(page).toHaveURL(/\/labs\/curator/)

    await page.keyboard.press('Escape')
    // museum-at-root: GalleryChrome's Esc exit targets / (matches labs-gallery.spec)
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 })
  })

  test('main content area scrolls when a module is taller than the viewport', async ({ page }) => {
    await signIn(page)
    await selectModule(page, 'Engineering')
    await expect(page.getByRole('heading', { name: 'Engineering', level: 1 })).toBeVisible({ timeout: 15_000 })

    const scrolled = await page.locator('main').evaluate((el) => {
      el.scrollTop = 400
      return el.scrollTop
    })
    expect(scrolled).toBeGreaterThan(0)
  })

  test('curator is crawlable for logged-out visitors/crawlers', async ({ page }) => {
    const res = await page.request.get('/labs/curator')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('xDataGroup')
    expect(html).toContain('Session Management')
  })
})
