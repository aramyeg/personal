import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { ChapterPanels } from '@/components/labs/small-world/overlay/chapter-panels'
import { chapters } from '@/components/labs/small-world/chapters'
import { panelTapArmed, setPanelAdvance } from '@/components/labs/small-world/panel-tap'
import { pressAt } from '@/components/labs/small-world/overlay/info-page'
import { INFO_PAGES } from '@/components/labs/small-world/overlay/info-page-spec'

afterEach(() => {
  cleanup()
  setPanelAdvance(null)
})

const spread = (onAdvance: (() => void) | null = vi.fn()) => {
  render(<ChapterPanels index={2} enter={1} onAdvance={onAdvance} />)
  return { card: screen.getByTestId('sw-manga-card'), root: screen.getByTestId('sw-panel-tap') }
}

describe('the art card', () => {
  it('shows the chapter’s own page', () => {
    spread()
    expect(screen.getByTestId('sw-manga-page').dataset.mangaPage).toBe('page-2')
  })

  it('is the only thing on the spread that takes a click', () => {
    // Task 61's rule, restated for the card: the ROOT must keep letting clicks
    // through to the canvas, or tap-to-advance and the canvas easter eggs die at
    // every dwell. A visible, painted card taking clicks inside its own
    // footprint is not the blanket that rule forbids.
    const { card, root } = spread()
    expect(root.style.pointerEvents).toBe('none')
    expect(card.style.pointerEvents).toBe('auto')
  })

  it('opens the page full size, and disarms tap-to-advance while it is open', () => {
    const onAdvance = vi.fn()
    const { card } = spread(onAdvance)
    expect(panelTapArmed()).toBe(true)

    fireEvent.click(card)
    expect(screen.getByTestId('sw-manga-lightbox')).toBeTruthy()
    // A stray onPointerMissed while the modal is up would scroll the reader to
    // the next chapter out from under the page they just opened.
    expect(panelTapArmed(), 'advance is un-armed while the lightbox is open').toBe(false)
  })

  it('closes on Escape, and claims the key so the lab does not also leave for the museum', () => {
    const { card } = spread()
    fireEvent.click(card)

    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    // Dispatched by hand rather than through fireEvent so the assertion below can
    // read the real event's `defaultPrevented`; act() is then ours to supply.
    act(() => {
      window.dispatchEvent(event)
    })
    // `gallery-chrome.tsx` navigates to the museum on Escape unless the event
    // was already claimed — it checks exactly this flag.
    expect(event.defaultPrevented).toBe(true)
    expect(screen.queryByTestId('sw-manga-lightbox')).toBeNull()
  })

  it('re-arms tap-to-advance once the page is closed again', () => {
    const onAdvance = vi.fn()
    const { card } = spread(onAdvance)
    fireEvent.click(card)
    fireEvent.click(screen.getByTestId('sw-manga-lightbox'))
    expect(screen.queryByTestId('sw-manga-lightbox')).toBeNull()
    expect(panelTapArmed()).toBe(true)
  })

  it('does not close when the reader clicks the page itself', () => {
    const { card } = spread()
    fireEvent.click(card)
    fireEvent.click(screen.getAllByTestId('sw-manga-page')[1])
    expect(screen.queryByTestId('sw-manga-lightbox')).toBeTruthy()
  })
})

describe('the info leaf', () => {
  // RESTATED IN TASK 75, and the restatement is the round rather than a
  // concession to it. These used to assert the right-hand card echoed
  // `chapters[2]` — its hook, its lines, its caption — because the card was a
  // projection of the story data in the THIRD PERSON. The right leaf is now a
  // manga page in Alwina's own voice with its own copy (`info-page-spec.ts`), so
  // asserting it repeats the narrator's sentences would be asserting the defect.
  it('speaks in the first person, from its own spec', () => {
    spread()
    const leaf = screen.getByTestId('sw-panel-data')
    const spec = INFO_PAGES[2]
    const caption = spec.rows.flatMap((r) => r.cells).find((c) => c.panel.kind === 'caption')!.panel
    expect(caption.kind).toBe('caption')
    expect(leaf.textContent).toContain(caption.kind === 'caption' ? caption.text : '')
    expect(leaf.textContent).toContain(spec.footer.org)
    expect(leaf.textContent).toContain(spec.footer.period)
    // ...and it does NOT carry the narrator's third-person hook any more.
    expect(leaf.textContent).not.toContain(chapters[2].hook)
  })

  it('stamps every figure its page claims', () => {
    spread()
    const figures = INFO_PAGES[2].rows
      .flatMap((r) => r.cells)
      .flatMap((c) => (c.panel.kind === 'stamps' ? c.panel.figures : []))
    expect(figures.length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('sw-info-stamp')).toHaveLength(figures.length)
    for (const f of figures) expect(screen.getByTestId('sw-panel-data').textContent).toContain(f.value)
  })

  it('presses the stamps last, and one after another', () => {
    // The figures are the claim the rest of the page has just earned, so they
    // land after it. Asserted on the timing function rather than on a rendered
    // opacity, because the spread's entrance runs through easeOutBack — which
    // OVERSHOOTS past 1, so a mid-entrance `enter` prop does not mean a
    // mid-entrance page and a render-level assertion would be measuring the
    // easing rather than the staging.
    expect(pressAt(0, 0, 3)).toBe(0)
    expect(pressAt(0.3, 0, 3)).toBeGreaterThan(0)
    expect(pressAt(0.3, 0, 3)).toBeGreaterThan(pressAt(0.3, 1, 3))
    expect(pressAt(0.5, 1, 3)).toBeGreaterThan(pressAt(0.5, 2, 3))
    // AND EVERY STAMP IS FULLY PRESSED WHEN THE ENTRANCE ENDS. The clock parks
    // at 1 for the whole dwell, so a last stamp whose window ran past 1 would
    // sit over-sized and crooked for as long as the reader looked at it.
    for (const count of [1, 2, 3, 4]) {
      for (let i = 0; i < count; i++) expect(pressAt(1, i, count), `${i + 1} of ${count}`).toBe(1)
    }
  })
})
