import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
