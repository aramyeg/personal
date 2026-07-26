/**
 * THE CURSOR MUST NOT LIE TO A READER WHO PAUSES (E3 R-2).
 *
 * s6 blind re-review, finding 4: "Move onto a grabbable and stop: cursor stays
 * empty. Jiggle the pointer 1px: cursor becomes `grab`. The cursor lies whenever
 * the reader pauses." Two separate holes produced that, and both are gated here:
 *
 *  1. hover was written ONLY from r3f's `onPointerOver`, which fires once per
 *     entry — and the write is refused while the book is booting, mid-turn, or
 *     holding a grab. Refuse once and there is no second chance for a hand that
 *     is already sitting on the piece. `markHandleHovered` now runs on every
 *     move as well, so the same question gets asked again once the answer can
 *     change.
 *  2. r3f can only learn a pointer position from an event ON ITS CANVAS, and a
 *     hand that arrived before the canvas existed (or that turned the page from
 *     the keyboard) never sends one. `hover-prime` remembers the last position
 *     the WINDOW saw and re-delivers it — with the `offsetX/offsetY` r3f's own
 *     `compute` reads, which a constructed PointerEvent leaves at 0.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { markHandleHovered } from '@/components/labs/storybook/book/handle-hover'
import {
  __setLastWindowPointer,
  installPointerTracker,
  lastWindowPointer,
  primeHover,
} from '@/components/labs/storybook/book/hover-prime'
import { useStorybookStore } from '@/components/labs/storybook/store'

const s = () => useStorybookStore.getState()
const initial = useStorybookStore.getState()

describe('markHandleHovered — the same permission, asked again', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))

  it('writes hover on a settled spread', () => {
    useStorybookStore.setState({ booted: true, spread: 6 })
    markHandleHovered('ch5-tea', 6)
    expect(s().hover).toBe('ch5-tea')
  })

  it('refuses while the book is booting, and answers as soon as it is booted', () => {
    useStorybookStore.setState({ booted: false, spread: 6 })
    markHandleHovered('ch5-tea', 6)
    expect(s().hover).toBeNull()
    // The reader has not moved: the ONLY thing that changed is the book. This
    // second call is the one ParallaxRig's replay makes on their behalf.
    useStorybookStore.setState({ booted: true })
    markHandleHovered('ch5-tea', 6)
    expect(s().hover).toBe('ch5-tea')
  })

  it('refuses mid-turn, and answers once the turn lands', () => {
    useStorybookStore.setState({ booted: true, spread: 6, turning: 'next' })
    markHandleHovered('ch5-tea', 6)
    expect(s().hover).toBeNull()
    useStorybookStore.setState({ turning: null })
    markHandleHovered('ch5-tea', 6)
    expect(s().hover).toBe('ch5-tea')
  })

  it('never speaks for a piece on another spread, or while a grab is held', () => {
    useStorybookStore.setState({ booted: true, spread: 6 })
    markHandleHovered('ch1-rank', 2)
    expect(s().hover).toBeNull()
    useStorybookStore.setState({ grab: { id: 'ch5-throng', kind: 'flap' } })
    markHandleHovered('ch5-tea', 6)
    expect(s().hover).toBeNull()
  })
})

describe('hover-prime — re-delivering a hand that never moved', () => {
  const canvas = (): HTMLElement => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 1100, bottom: 850, width: 1000, height: 800 }) as DOMRect
    return el
  }

  beforeEach(() => __setLastWindowPointer(null))

  it('remembers the last window pointer, from before the canvas existed', () => {
    installPointerTracker()
    installPointerTracker() // idempotent: the loader may mount more than once
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 640, clientY: 400 }))
    expect(lastWindowPointer()).toEqual({ x: 640, y: 400 })
  })

  it('re-delivers it as a pointermove carrying canvas-relative offsets', () => {
    const el = canvas()
    const seen: PointerEvent[] = []
    el.addEventListener('pointermove', (e) => seen.push(e as PointerEvent))
    __setLastWindowPointer({ x: 640, y: 400 })
    primeHover(el)
    expect(seen).toHaveLength(1)
    expect(seen[0].clientX).toBe(640)
    // r3f's own compute reads offsetX/offsetY; a constructed PointerEvent has
    // them at 0, which would aim every primed ray at the canvas's corner.
    expect(seen[0].offsetX).toBe(540)
    expect(seen[0].offsetY).toBe(350)
  })

  it('says nothing when the pointer has never been seen or is off the canvas', () => {
    const el = canvas()
    const seen: Event[] = []
    el.addEventListener('pointermove', (e) => seen.push(e))
    primeHover(el) // no pointer known
    __setLastWindowPointer({ x: 20, y: 20 }) // outside the canvas rect
    primeHover(el)
    expect(seen).toHaveLength(0)
  })
})
