import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { COMPACT_QUERY } from '@/components/labs/storybook/overlay/compact-layout'
import { SpreadOverlay } from '@/components/labs/storybook/overlay/spread-overlay'
import { useStorybookStore } from '@/components/labs/storybook/store'
import { emitTurnLand } from '@/components/labs/storybook/turn-events'

const initial = useStorybookStore.getState()

const overlay = () => document.querySelector('.sb-overlay') as HTMLElement
const panel = () => document.getElementById('sb-drawer-panel') as HTMLElement
const scrim = () => document.querySelector('.sb-drawer-scrim')
const handle = () => screen.queryByRole('button', { name: /unfold the tale|fold the tale away/i })

/** Listeners registered per media query, so a test can flip the breakpoint. */
type Listeners = Map<string, Set<() => void>>

/**
 * matchMedia that actually answers for `COMPACT_QUERY` — the drawer's whole
 * existence hangs off it, so a blanket `matches: false` stub (vitest.setup.ts)
 * would only ever exercise the desktop branch.
 */
function mockViewport(compact: boolean): { setCompact: (next: boolean) => void; listeners: Listeners } {
  const listeners: Listeners = new Map()
  const state = { compact }

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query === COMPACT_QUERY ? state.compact : false
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_: string, fn: () => void) => {
      const set = listeners.get(query) ?? new Set()
      set.add(fn)
      listeners.set(query, set)
    }),
    removeEventListener: vi.fn((_: string, fn: () => void) => {
      listeners.get(query)?.delete(fn)
    }),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia

  return {
    listeners,
    setCompact: (next: boolean) => {
      state.compact = next
      act(() => {
        listeners.get(COMPACT_QUERY)?.forEach((fn) => fn())
      })
    },
  }
}

// spread 2 = "Chapter the First"; spread 9 (SPREAD_COUNT - 1) = "The End", the
// one spread whose body carries focusable links.
describe('story drawer (compact layout)', () => {
  beforeEach(() => {
    useStorybookStore.setState(initial, true)
    mockViewport(false)
  })
  afterEach(cleanup)

  describe('desktop / wide layout', () => {
    it('renders no drawer chrome at all — the side columns are the layout', () => {
      mockViewport(false)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)

      // Not merely hidden: the old build kept a `display: none` 0×0 button in
      // the desktop DOM, which read as a dead node to anyone inspecting it.
      expect(handle()).toBeNull()
      expect(scrim()).toBeNull()
      expect(overlay()).toHaveAttribute('data-expanded', 'false')
      // Desktop text is always live — never inert.
      expect(panel()).not.toHaveAttribute('inert')
      expect(screen.getByText('Chapter the First')).toBeInTheDocument()
    })
  })

  describe('compact layout', () => {
    it('shows only the tab at rest, with the story text folded away and inert', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)

      const tab = handle()
      expect(tab).toBeInTheDocument()
      expect(tab).toHaveAttribute('aria-expanded', 'false')
      expect(tab).toHaveAttribute('aria-controls', 'sb-drawer-panel')
      expect(tab).toHaveAccessibleName(/unfold the tale/i)
      // The sheet is translated off-screen by CSS; `inert` is what keeps a
      // screen reader or Tab press out of text the reader cannot see.
      expect(panel()).toHaveAttribute('inert')
      expect(overlay()).toHaveAttribute('data-expanded', 'false')
      expect(scrim()).toBeNull()
    })

    it('unfolds on tap: aria-expanded, the sheet becomes live, a scrim appears', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)

      fireEvent.click(handle() as HTMLElement)

      expect(handle()).toHaveAttribute('aria-expanded', 'true')
      expect(handle()).toHaveAccessibleName(/fold the tale away/i)
      expect(overlay()).toHaveAttribute('data-expanded', 'true')
      expect(panel()).not.toHaveAttribute('inert')
      expect(scrim()).toBeInTheDocument()
      // Same content the desktop columns carry — narration AND the plaque.
      expect(screen.getByText('Chapter the First')).toBeInTheDocument()
      expect(document.querySelector('.sb-plaque--dark')).toBeInTheDocument()
    })

    it('folds away again on a second tap', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)

      fireEvent.click(handle() as HTMLElement)
      fireEvent.click(handle() as HTMLElement)

      expect(handle()).toHaveAttribute('aria-expanded', 'false')
      expect(overlay()).toHaveAttribute('data-expanded', 'false')
      expect(scrim()).toBeNull()
      expect(panel()).toHaveAttribute('inert')
    })

    it('a scrim tap dismisses it and hands focus back to the tab', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 9 }))
      render(<SpreadOverlay />)

      fireEvent.click(handle() as HTMLElement)
      // Reading the End spread, focus has moved onto the wax seal inside the
      // sheet — content that is about to go inert.
      const seal = screen.getByRole('link', { name: /send a raven/i })
      act(() => seal.focus())
      expect(document.activeElement).toBe(seal)

      fireEvent.click(scrim() as HTMLElement)

      expect(overlay()).toHaveAttribute('data-expanded', 'false')
      expect(document.activeElement).toBe(handle())
    })

    it('Escape dismisses it, and marks the event handled so the lab stays open', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)

      // <GalleryChrome> listens for Escape on `window` to leave for /labs and
      // bails on `defaultPrevented` — so the drawer must claim the key.
      const handled = !fireEvent.keyDown(handle() as HTMLElement, { key: 'Escape' })

      expect(handled).toBe(true)
      expect(overlay()).toHaveAttribute('data-expanded', 'false')
    })

    it('leaves Escape alone while it is already folded away', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)

      const handled = !fireEvent.keyDown(handle() as HTMLElement, { key: 'Escape' })

      // Nothing to close: Escape belongs to <GalleryChrome> again.
      expect(handled).toBe(false)
    })

    it('a downward flick from the top of the sheet dismisses it', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)

      fireEvent.pointerDown(panel(), { clientY: 120 })
      fireEvent.pointerUp(panel(), { clientY: 260 })

      expect(overlay()).toHaveAttribute('data-expanded', 'false')
    })

    it('ignores a short drag — that is a reader nudging the text, not a dismiss', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)

      fireEvent.pointerDown(panel(), { clientY: 120 })
      fireEvent.pointerUp(panel(), { clientY: 150 })

      expect(overlay()).toHaveAttribute('data-expanded', 'true')
    })

    it('never arms the flick once the reader has scrolled into the text', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)

      // Scrolled down: a downward drag here is scrolling back up, not a flick.
      Object.defineProperty(overlay(), 'scrollTop', { value: 180, configurable: true })
      fireEvent.pointerDown(panel(), { clientY: 120 })
      fireEvent.pointerUp(panel(), { clientY: 300 })

      expect(overlay()).toHaveAttribute('data-expanded', 'true')
    })

    it('folds away when the page turns, so it never covers the spread that lands', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)
      expect(overlay()).toHaveAttribute('data-expanded', 'true')

      act(() => emitTurnLand({ dir: 'next', to: 3 }))

      expect(overlay()).toHaveAttribute('data-expanded', 'false')
      expect(screen.getByText('Chapter the Second')).toBeInTheDocument()
    })

    it('keeps focus on the tab when a turn unmounts whatever was focused inside', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 9 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)
      act(() => screen.getByRole('link', { name: /send a raven/i }).focus())

      // Turning back re-keys the panel, so the focused link disappears with it
      // — without the focus hand-back, focus would silently drop to <body>.
      // (Landing on a chapter rather than the satchel keeps the assertion clear
      // of SatchelContent's async art-manifest fetch.)
      act(() => emitTurnLand({ dir: 'prev', to: 7 }))

      expect(overlay()).toHaveAttribute('data-expanded', 'false')
      expect(document.activeElement).toBe(handle())
    })

    it('mounts no tab over the closed cover — there is no tale to unfold yet', () => {
      mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 0 }))
      render(<SpreadOverlay />)

      // The old build left this button invisible (`opacity: 0`) but still
      // tappable, dangling over the shut book.
      expect(handle()).toBeNull()
      expect(overlay()).toHaveStyle({ opacity: '0' })
    })

    it('drops the drawer when the viewport grows back past the breakpoint', () => {
      const viewport = mockViewport(true)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      fireEvent.click(handle() as HTMLElement)
      expect(overlay()).toHaveAttribute('data-expanded', 'true')

      viewport.setCompact(false)

      // Back to real side columns: no tab, no scrim, nothing inert, and no
      // stale `expanded` left to report a wrong state.
      expect(handle()).toBeNull()
      expect(scrim()).toBeNull()
      expect(panel()).not.toHaveAttribute('inert')
      expect(overlay()).toHaveAttribute('data-expanded', 'false')
    })

    it('picks the drawer up when a desktop window is narrowed onto the breakpoint', () => {
      const viewport = mockViewport(false)
      act(() => useStorybookStore.setState({ spread: 2 }))
      render(<SpreadOverlay />)
      expect(handle()).toBeNull()

      viewport.setCompact(true)

      expect(handle()).toBeInTheDocument()
      expect(panel()).toHaveAttribute('inert')
    })
  })
})
