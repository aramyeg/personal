import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  firePanelAdvance,
  panelTapArmed,
  setPanelAdvance,
} from '@/components/labs/small-world/panel-tap'
import { ChapterPanels } from '@/components/labs/small-world/overlay/chapter-panels'
import { chapters } from '@/components/labs/small-world/chapters'

/**
 * Task 61 — tap-to-advance after the canvas took the pointer.
 *
 * Two behaviours have to survive together and they pull against each other, so both are pinned
 * here: a click ON an interactive canvas object must NOT advance the panel, and a click anywhere
 * else must advance it exactly as it always did. The live half (a real trusted click reaching the
 * canvas at a dwell) is covered by `bench/task61-tap.mjs`, which uses the `elementFromPoint`
 * methodology rather than synthetic dispatch — a synthetic event bypasses hit-testing and so cannot
 * see the very overlay this change is about.
 */

describe('the panel-advance registry', () => {
  it('does nothing when no panel is up — which is what keeps travel clicks inert', () => {
    setPanelAdvance(null)
    expect(panelTapArmed()).toBe(false)
    expect(() => firePanelAdvance()).not.toThrow()
  })

  it('fires the live panel advance, once per missed click', () => {
    const spy = vi.fn()
    const release = setPanelAdvance(spy)
    firePanelAdvance()
    firePanelAdvance()
    expect(spy).toHaveBeenCalledTimes(2)
    release()
    firePanelAdvance()
    expect(spy, 'no advance after the panel released').toHaveBeenCalledTimes(2)
  })

  it('retracts on IDENTITY, so a mount-before-cleanup order cannot kill the incoming panel', () => {
    // React may mount the next panel before running the previous one's cleanup. An unconditional
    // clear in that order would wipe the registration that just arrived and leave tap-to-advance
    // dead until something forced a re-render.
    const first = vi.fn()
    const second = vi.fn()
    const releaseFirst = setPanelAdvance(first)
    setPanelAdvance(second) // the next panel mounts...
    releaseFirst() // ...and only then does the old one clean up
    expect(panelTapArmed(), 'the incoming panel is still armed').toBe(true)
    firePanelAdvance()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    setPanelAdvance(null)
  })
})

describe('the chapter panel no longer blankets the canvas', () => {
  const renderPanel = (onAdvance = vi.fn()) => {
    render(<ChapterPanels index={5} enter={1} page={1} onAdvance={onAdvance} />)
    return { root: screen.getByTestId('sw-panel-tap'), onAdvance }
  }

  it('lets pointer events through to the canvas underneath', () => {
    // The whole defect in one assertion. `inset: 0` is fine — the panel is a full-frame stage and
    // its cards are positioned within it — but `pointer-events` must be `none` at the root, or the
    // canvas below never sees a click at a dwell.
    const { root } = renderPanel()
    expect(root.style.pointerEvents).toBe('none')
  })

  it('does not advance from a DOM click of its own', () => {
    // Advance now has exactly ONE path: r3f's onPointerMissed. A DOM handler left on the root would
    // double-fire with it and would also resurrect the blanket.
    const { root, onAdvance } = renderPanel()
    root.click()
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('registers its advance for the canvas while it is mounted, and clears it on unmount', () => {
    setPanelAdvance(null)
    const onAdvance = vi.fn()
    const view = render(
      <ChapterPanels index={5} enter={1} page={1} onAdvance={onAdvance} />
    )
    expect(panelTapArmed(), 'armed while the panel is up').toBe(true)
    firePanelAdvance()
    expect(onAdvance).toHaveBeenCalledTimes(1)

    view.unmount()
    // Rail 3, structurally: the registration's lifetime IS the panel's, so a missed click during
    // travel has nothing to fire. No flag to consult and no stale advance to guard against.
    expect(panelTapArmed(), 'disarmed once the panel leaves').toBe(false)
    firePanelAdvance()
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('keeps the cards visible and positioned — this is a pointer change, not a layout one', () => {
    const { root } = renderPanel()
    expect(root.style.position).toBe('absolute')
    expect(root.style.inset).toBe('0')
    expect(root.querySelector('.sw-panel-data'), 'the data card still renders').toBeTruthy()
  })
})

describe('the canvas is wired to advance on a miss', () => {
  it('passes firePanelAdvance to the Canvas as onPointerMissed', () => {
    // Source-level, because mounting r3f in jsdom does not exercise its event layer. The behaviour
    // this stands in for is captured live in bench/task61-tap.mjs; this only guards the wiring from
    // being dropped in a refactor.
    const src = readFileSync(
      join(process.cwd(), 'components/labs/small-world/scene/scene.tsx'),
      'utf8'
    )
    expect(src).toMatch(/onPointerMissed=\{firePanelAdvance\}/)
    expect(src).toMatch(/from '\.\.\/panel-tap'/)
  })
})

describe('the phone stack introduces her before it tells the story', () => {
  /**
   * TASK 85, FINDING 2 — ON A PHONE HER NAME WAS NEVER SHOWN.
   *
   * At 390x844 the two leaves share one box and the comic was in front in all
   * six chapters, so the identity leaf was permanently the hidden face:
   * `elementFromPoint` over the centre of the "Alwina Harutyunyan" node returned
   * the manga IMG. Her name, her role line, her LinkedIn and the "the plain CV"
   * door all lived there. A whole phone playthrough never surfaced any of them.
   *
   * Chapter 1 — the introduction, and the only chapter whose sheet carries the
   * intro block — now opens on the details. Everything after it leads with the
   * story, so the name is an introduction rather than a watermark.
   *
   * The tab is queried by CLASS and not by role: it is `display: none` inline
   * until the phone media query switches it on, and a hidden element is out of
   * testing-library's accessibility tree, so a role query finds nothing here
   * whatever the label says.
   */
  afterEach(cleanup)
  const front = () => screen.getByTestId('sw-panel-tap').getAttribute('data-front')
  const tab = () => document.querySelector('.sw-stack-tab') as HTMLButtonElement

  it('opens chapter 1 on the details and every other chapter on the comic', () => {
    for (const [i] of chapters.entries()) {
      const { unmount } = render(<ChapterPanels index={i} enter={1} page={1} onAdvance={null} />)
      expect(front(), `chapter ${i + 1}`).toBe(i === 0 ? 'details' : 'comic')
      unmount()
    }
  })

  it('keeps the reader’s flip inside the chapter it was made in', () => {
    // THE MOUNT IS ONE INSTANCE FOR THE WHOLE JOURNEY — `journey-overlay` re-feeds
    // `index` rather than remounting — so a default held in `useState` would apply
    // to chapter 1 and never again, and a flip made on chapter 2 would ride along
    // to chapters 3 through 6.
    const { rerender } = render(<ChapterPanels index={1} enter={1} page={1} onAdvance={null} />)
    expect(front()).toBe('comic')
    fireEvent.click(tab())
    expect(front()).toBe('details')
    // ...moving on drops it: chapter 3 is the story again.
    rerender(<ChapterPanels index={2} enter={1} page={1} onAdvance={null} />)
    expect(front()).toBe('comic')
    // ...and coming back to chapter 1 still gets chapter 1’s own default.
    rerender(<ChapterPanels index={0} enter={1} page={1} onAdvance={null} />)
    expect(front()).toBe('details')
  })

  it('names the direction the tab goes in, in both states', () => {
    // "A bare noun reads as a label for what you are looking at" — the tab’s own
    // note. Landing on chapter 1 with it offering the comic is what teaches the
    // control, which is the half of the audit’s "decorative sticker" finding
    // that a persistent identity strip would not have fixed.
    render(<ChapterPanels index={0} enter={1} page={1} onAdvance={null} />)
    expect(tab().getAttribute('aria-label')).toMatch(/back to the comic/i)
    expect(tab().textContent).toMatch(/comic/i)
    fireEvent.click(tab())
    expect(tab().getAttribute('aria-label')).toMatch(/show the details/i)
  })

  it('always opens the lightbox when a click reaches the comic card', () => {
    // The handler used to branch on `front` and swap the stack when the details
    // were up. That branch was unreachable — the mobile rule gives the art card
    // `pointer-events: none !important` in exactly that state — until chapter 1
    // defaulted to details, at which point DESKTOP chapter 1 (where no
    // `data-front` rule applies at all) would have swapped a stack that is not
    // stacked instead of opening the lightbox.
    render(<ChapterPanels index={0} enter={1} page={1} onAdvance={null} />)
    expect(front()).toBe('details')
    fireEvent.click(screen.getByTestId('sw-manga-card'))
    expect(screen.getByTestId('sw-manga-lightbox')).toBeTruthy()
  })
})
