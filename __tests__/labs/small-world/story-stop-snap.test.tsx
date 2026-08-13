import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { createRef } from 'react'
import { CHAPTER_COUNT } from '@/components/labs/small-world/chapters'
import { SNAP_CLASS, stopOffsets } from '@/components/labs/small-world/story-stops'
import { StoryStopSnap } from '@/components/labs/small-world/story-stop-snap'

/**
 * The mount rules for the story stops: WHO gets them, and that the document is handed back clean.
 *
 * The snapping itself is not testable here — jsdom has no momentum and no snap engine — so this
 * file is deliberately about the seams a regression would actually come through: a desktop visitor
 * finding snap areas, a reduced-motion visitor finding a snap type, and another route inheriting a
 * snapping root element because a cleanup was missed.
 */
const TRACK_TOTAL = 13335

function mountWith(coarse: boolean, reduced = false, progress = 0) {
  ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (query: string) => ({
      matches: query.includes('pointer: coarse') ? coarse : query.includes('reduce') ? reduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
  )
  const track = document.createElement('div')
  Object.defineProperty(track, 'scrollHeight', { value: TRACK_TOTAL + window.innerHeight })
  document.body.appendChild(track)
  const ref = createRef<HTMLElement>()
  ;(ref as { current: HTMLElement | null }).current = track
  const progressRef = { current: progress }
  return { ref, progressRef, ...render(<StoryStopSnap trackRef={ref} progressRef={progressRef} />) }
}

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove(SNAP_CLASS)
  document.body.innerHTML = ''
})

describe('StoryStopSnap', () => {
  it('mounts one snap area per checkpoint on a touch device', () => {
    const { container } = mountWith(true)
    const areas = container.querySelectorAll('[data-sw-stop]')
    expect(areas).toHaveLength(CHAPTER_COUNT)
    const expected = stopOffsets(TRACK_TOTAL)
    areas.forEach((area, c) => {
      expect((area as HTMLElement).style.top).toBe(`${expected[c]}px`)
      expect((area as HTMLElement).style.scrollSnapStop).toBe('always')
      // It must never take a tap or affect layout — it is a position, not an element.
      expect((area as HTMLElement).style.pointerEvents).toBe('none')
      expect(area.getAttribute('aria-hidden')).toBe('true')
    })
  })

  it('mounts nothing at all for a mouse — desktop keeps the scroll it had', () => {
    const { container } = mountWith(false)
    expect(container.querySelectorAll('[data-sw-stop]')).toHaveLength(0)
    expect(document.documentElement.classList.contains(SNAP_CLASS)).toBe(false)
  })

  it('mounts nothing under prefers-reduced-motion — a snap is autonomous movement', () => {
    const { container } = mountWith(true, true)
    expect(container.querySelectorAll('[data-sw-stop]')).toHaveLength(0)
    expect(document.documentElement.classList.contains(SNAP_CLASS)).toBe(false)
  })

  it('leaves the root scroller unarmed until a fling asks for it', () => {
    mountWith(true)
    // Armed only from a touchmove fast enough to be a fling; at rest the document snaps nothing,
    // which is what keeps a programmatic scroll or a tap-to-advance glide out of the mechanism.
    expect(document.documentElement.classList.contains(SNAP_CLASS)).toBe(false)
  })

  it('hands the document back clean on unmount', () => {
    const { unmount } = mountWith(true)
    document.documentElement.classList.add(SNAP_CLASS)
    unmount()
    expect(document.documentElement.classList.contains(SNAP_CLASS)).toBe(false)
  })
})
