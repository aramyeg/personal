import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  ESCAPE_CONFIRM_MS,
  escapeWhisperShown,
  useBookInput,
} from '@/components/labs/storybook/use-book-input'
import {
  CORNER_BOTTOM_PCT,
  CORNER_H_PCT,
  CORNER_SIDE_PCT,
  CORNER_W_PCT,
} from '@/components/labs/storybook/overlay/corner-hotspot'
import { useStorybookStore } from '@/components/labs/storybook/store'
import {
  activeGrabId,
  beginGrabChannel,
  endGrabChannel,
  resetUserDrives,
} from '@/components/labs/storybook/user-drive'

const s = () => useStorybookStore.getState()
const initial = useStorybookStore.getState()

const swipe = (dx: number, dy = 0) => {
  window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 300 }))
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: 300 + dx, clientY: 300 + dy }))
}

describe('useBookInput — grab suppression (law H1)', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))

  it('a qualifying swipe fires a turn when no grab is active', () => {
    renderHook(() => useBookInput(true))
    swipe(-100) // moved left -> 'next'
    expect(s().turning).toBe('next')
  })

  it('a qualifying swipe does NOT fire a turn when a grab is active at pointerdown time', () => {
    useStorybookStore.setState({ grab: { id: 'tab-1', kind: 'tab' } })
    renderHook(() => useBookInput(true))
    swipe(-100)
    expect(s().turning).toBeNull()
  })

  it('once the grab ends, a fresh swipe fires normally again', () => {
    useStorybookStore.setState({ grab: { id: 'tab-1', kind: 'tab' } })
    renderHook(() => useBookInput(true))
    swipe(-100)
    expect(s().turning).toBeNull()

    useStorybookStore.setState({ grab: null })
    swipe(-100)
    expect(s().turning).toBe('next')
  })

  it('keyboard turns are unaffected by an active grab (H2: turns are never blocked)', () => {
    useStorybookStore.setState({ grab: { id: 'knob-1', kind: 'knob' } })
    renderHook(() => useBookInput(true))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(s().turning).toBe('next')
    expect(s().grab).toBeNull() // requestTurn force-released it
  })

  it('wheel turns are unaffected by an active grab (H2: turns are never blocked)', () => {
    useStorybookStore.setState({ grab: { id: 'flap-1', kind: 'flap' } })
    renderHook(() => useBookInput(true))
    // One decisively-deliberate shove — well past WHEEL_THRESHOLD on its own.
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 500 }))
    expect(s().turning).toBe('next')
    expect(s().grab).toBeNull()
  })
})

describe('useBookInput — Space is not a page-turn idiom', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))

  it('Space no longer turns the page', () => {
    renderHook(() => useBookInput(true))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    expect(s().turning).toBeNull()
  })

  it('Arrow/PageDown/Home keys still turn — only Space was removed', () => {
    renderHook(() => useBookInput(true))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
    expect(s().turning).toBe('next')
  })
})

// ============================================================================
// SP-3(a) — "all four arrows turn pages" (blind re-review). A book turns left
// and right. Up and down belong to the narration column the reader scrolls,
// and this listener sits on `window`, so binding them stole the keys from any
// scroll that didn't happen to be focused.
// ============================================================================

describe('useBookInput — only the horizontal arrows are page keys', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))

  for (const key of ['ArrowUp', 'ArrowDown'] as const) {
    it(`${key} does not turn the page, and stays free to scroll the drawer`, () => {
      renderHook(() => useBookInput(true))
      const notCancelled = window.dispatchEvent(
        new KeyboardEvent('keydown', { key, cancelable: true })
      )
      expect(s().turning).toBeNull()
      // Never preventDefault-ed: the browser's own scrolling must survive.
      expect(notCancelled).toBe(true)
    })
  }

  it('ArrowRight still turns on and ArrowLeft still turns back', () => {
    renderHook(() => useBookInput(true))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(s().turning).toBe('next')

    useStorybookStore.setState({ turning: null, spread: 5 })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(s().turning).toBe('prev')
  })
})

describe('useBookInput — Escape mid-grab releases the grab, not the lab (BW reviewer report)', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))

  it('Escape while a grab is active releases the grab and prevents default', () => {
    useStorybookStore.setState({ grab: { id: 'knob-1', kind: 'knob' } })
    renderHook(() => useBookInput(true))
    const notCancelled = window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    )
    // preventDefault() was called — dispatchEvent reports this by returning
    // false — which is exactly what stops GalleryChrome's bubble-phase
    // handler (it bails on e.defaultPrevented) from navigating to /labs.
    expect(notCancelled).toBe(false)
    expect(s().grab).toBeNull()
    expect(s().turning).toBeNull()
    expect(s().spread).toBe(5) // still on the same spread — no navigation, no turn
  })

  it('Escape while a grab is active never arms the exit whisper — it is about the piece, not the book', () => {
    useStorybookStore.setState({ grab: { id: 'knob-1', kind: 'knob' } })
    const { unmount } = renderHook(() => useBookInput(true))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(escapeWhisperShown()).toBe(false)
    unmount()
  })
})

// ============================================================================
// SP-3(d) — THE EXIT ASKS TWICE. "Escape still ejects to /labs unannounced":
// one stray key and the reader loses the book, mid-spread, with no warning and
// nowhere to say no. The first Escape now buys a whisper in the book's own
// voice; a second inside the window is let through to GalleryChrome untouched.
// ============================================================================

describe('useBookInput — Escape asks before it closes the book', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const esc = (): boolean =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))

  it('spends the first Escape on the whisper, not on the exit', () => {
    const { unmount } = renderHook(() => useBookInput(true))
    // dispatchEvent returns false when preventDefault ran; stopPropagation in
    // the same capture-phase listener is what actually keeps the key from
    // GalleryChrome's window listener.
    expect(esc()).toBe(false)
    expect(escapeWhisperShown()).toBe(true)
    expect(s().spread).toBe(5)
    unmount()
  })

  it('lets a second Escape inside the window through, and drops the whisper', () => {
    const { unmount } = renderHook(() => useBookInput(true))
    esc()
    vi.advanceTimersByTime(ESCAPE_CONFIRM_MS - 1)
    expect(esc()).toBe(true) // untouched — GalleryChrome's own handler exits
    expect(escapeWhisperShown()).toBe(false)
    unmount()
  })

  it('closes the offer after the window and starts again from step one', () => {
    const { unmount } = renderHook(() => useBookInput(true))
    esc()
    vi.advanceTimersByTime(ESCAPE_CONFIRM_MS)
    expect(escapeWhisperShown()).toBe(false)
    // A key pressed a beat too late is a first press, not a confirmation.
    expect(esc()).toBe(false)
    expect(escapeWhisperShown()).toBe(true)
    unmount()
  })

  it('does not let a grab-release Escape count as either step', () => {
    const { unmount } = renderHook(() => useBookInput(true))
    esc()
    expect(escapeWhisperShown()).toBe(true)

    useStorybookStore.setState({ grab: { id: 'tab-1', kind: 'tab' } })
    expect(esc()).toBe(false) // released the grab, exit untouched
    expect(s().grab).toBeNull()
    expect(escapeWhisperShown()).toBe(true) // the offer is still open
    unmount()
  })

  it('disarms when the input layer goes away, so a stale press cannot exit', () => {
    const { unmount } = renderHook(() => useBookInput(true))
    esc()
    unmount()
    expect(escapeWhisperShown()).toBe(false)
  })
})

// ============================================================================
// R-1 — THE RELEASE BACKSTOP. "After pointerup the mechanism keeps tracking the
// mouse… the cursor stays stuck on `grabbing` for the rest of the session. This
// makes the page feel possessed." (s6 blind re-review, finding 1.)
//
// Root cause, reproduced live (bench/hotfix-r1-p45.mjs): a handle layer can only
// hear a `pointerup` that r3f delivers to its OWN mesh, and r3f only does that
// while the pointer capture holds — it swallows `pointercancel` and
// `lostpointercapture` before they reach an object at all. Lose the capture
// mid-drag (element removal, a real pointercancel, a dev Fast Refresh) and the
// grab was stranded forever: store `grab`, scrub channel and cursor all live,
// with the naked pointer still driving the paper.
// ============================================================================

describe('useBookInput — a grab always ends, whatever the browser did with the pointer', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))
  beforeEach(() => resetUserDrives())

  const armGrab = (): { released: () => number } => {
    let calls = 0
    useStorybookStore.setState({ grab: { id: 'tab-1', kind: 'tab' } })
    beginGrabChannel('tab-1', () => {
      calls++
      useStorybookStore.getState().endGrab()
    })
    return { released: () => calls }
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    it(`${type} on window ends a grab the scene never heard about`, () => {
      renderHook(() => useBookInput(true))
      const { released } = armGrab()
      window.dispatchEvent(new PointerEvent(type, { clientX: 400, clientY: 400 }))
      expect(released(), 'the grabbing layer must get its own teardown').toBe(1)
      expect(s().grab).toBeNull()
      expect(activeGrabId()).toBeNull()
    })
  }

  it('a window blur ends a grab (the button comes up somewhere the page cannot see)', () => {
    renderHook(() => useBookInput(true))
    const { released } = armGrab()
    window.dispatchEvent(new Event('blur'))
    expect(released()).toBe(1)
    expect(s().grab).toBeNull()
    expect(activeGrabId()).toBeNull()
  })

  it('clears the store even when no layer registered a release (belt and braces)', () => {
    renderHook(() => useBookInput(true))
    useStorybookStore.setState({ grab: { id: 'orphan', kind: 'flap' } })
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 }))
    expect(s().grab).toBeNull()
  })

  it('does nothing at all when no grab is held', () => {
    renderHook(() => useBookInput(true))
    let calls = 0
    beginGrabChannel('tab-1', () => calls++)
    endGrabChannel('tab-1')
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10 }))
    expect(calls).toBe(0)
  })
})

// ============================================================================
// R-4 — THE CORNER HOTSPOTS YIELD TO THE PAPER. "The invisible 288x198 corner
// button overlaps the stall row's last cards. Press-and-drag at (1330,715) and
// nothing at all happens: the row won't rise and the page won't turn."
// ============================================================================

describe('useBookInput — corner page-turn taps (R-4)', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))

  const W = window.innerWidth
  const H = window.innerHeight
  // The middle of the derived box (corner-hotspot.ts), which sits on the
  // page's own bottom-outer corner rather than the viewport's — SP-3(b).
  const inCorner = (side: 'left' | 'right'): { x: number; y: number } => {
    const outer = ((CORNER_SIDE_PCT + CORNER_W_PCT / 2) / 100) * W
    return {
      x: Math.round(side === 'left' ? outer : W - outer),
      y: Math.round(H * (1 - (CORNER_BOTTOM_PCT + CORNER_H_PCT / 2) / 100)),
    }
  }

  const tap = (p: { x: number; y: number }, dx = 0, dy = 0) => {
    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: p.x, clientY: p.y }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: p.x + dx, clientY: p.y + dy }))
  }

  it('a tap in the right corner turns the page', () => {
    renderHook(() => useBookInput(true))
    tap(inCorner('right'))
    expect(s().turning).toBe('next')
  })

  it('a tap in the left corner turns back', () => {
    renderHook(() => useBookInput(true))
    tap(inCorner('left'))
    expect(s().turning).toBe('prev')
  })

  it('a corner tap over a GRABBABLE does not turn the page — the paper wins', () => {
    useStorybookStore.setState({ hover: 'ch5-throng' })
    renderHook(() => useBookInput(true))
    tap(inCorner('right'))
    expect(s().turning).toBeNull()
  })

  it('a press-drag through the corner is a drag, not a turn', () => {
    renderHook(() => useBookInput(true))
    // Straight up out of the corner, past the tap slop but under the swipe bar.
    tap(inCorner('right'), 0, -40)
    expect(s().turning).toBeNull()
  })

  it('a press that started on a grabbed piece never turns the page', () => {
    useStorybookStore.setState({ grab: { id: 'ch5-throng', kind: 'flap' } })
    renderHook(() => useBookInput(true))
    tap(inCorner('right'))
    expect(s().turning).toBeNull()
  })

  it('a tap in the middle of the page turns nothing', () => {
    renderHook(() => useBookInput(true))
    tap({ x: Math.round(W / 2), y: Math.round(H / 2) })
    expect(s().turning).toBeNull()
  })

  it('a tap on the desk in the viewport corner turns nothing (SP-3 b)', () => {
    renderHook(() => useBookInput(true))
    // Where the hotspot used to reach, and where the spread never does.
    tap({ x: Math.round(W * 0.97), y: Math.round(H * 0.97) })
    expect(s().turning).toBeNull()
    tap({ x: Math.round(W * 0.03), y: Math.round(H * 0.97) })
    expect(s().turning).toBeNull()
  })
})
