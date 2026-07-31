import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { EndingConnect, connectReveal } from '@/components/labs/small-world/overlay/ending-connect'
import { railDismissLive, railOpacity } from '@/components/labs/small-world/overlay/journey-progress'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import {
  ENDING_SPAN,
  TRACK_END,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'

/** The ending's own t at a journey progress — the value `JourneyUi.ending` publishes. */
const tAt = (progress: number) => endingStateAt(progress).t
const CONTROLS = ['email', 'github', 'linkedin', 'restart'] as const

describe('the connect block', () => {
  it('offers REAL anchors, with the addresses the rest of the site uses', () => {
    render(<EndingConnect t={1} onRestart={() => {}} />)
    expect(screen.getByTestId('sw-connect-email')).toHaveAttribute(
      'href',
      `mailto:${siteConfig.email}`
    )
    for (const l of socialLinks) {
      const a = screen.getByTestId(`sw-connect-${l.name.toLowerCase()}`)
      expect(a).toHaveAttribute('href', l.url)
      // an external target without the opener guard is a tab-nabbing hole, not a style choice
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
    // mail is not a new tab: a blank window that immediately hands off to a mail client is litter
    expect(screen.getByTestId('sw-connect-email')).not.toHaveAttribute('target')
  })

  it('puts pointer events on the four controls and on NOTHING else', () => {
    const { container } = render(<EndingConnect t={1} onRestart={() => {}} />)
    const live = [...container.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.style.pointerEvents === 'auto'
    )
    expect(live.map((el) => el.dataset.testid).sort()).toEqual(
      CONTROLS.map((c) => `sw-connect-${c}`).sort()
    )
    // the block's own container restates the inherited `none` rather than relying on it
    expect(screen.getByTestId('sw-connect').style.pointerEvents).toBe('none')
  })

  it('refuses to be clickable while it is still fading in', () => {
    // The trap this closes: a control at 30% opacity that still eats the click meant for the
    // canvas. Half-legible is not clickable.
    render(<EndingConnect t={tAt(1 + 0.72 * ENDING_SPAN)} onRestart={() => {}} />)
    const email = screen.getByTestId('sw-connect-email')
    expect(Number(email.style.opacity)).toBeGreaterThan(0)
    expect(Number(email.style.opacity)).toBeLessThan(0.85)
    expect(email.style.pointerEvents).toBe('none')
  })

  it('is invisible and inert for the whole curtain call', () => {
    for (const t of [0, 0.1, ZOOM_START]) {
      const { container, unmount } = render(<EndingConnect t={t} onRestart={() => {}} />)
      for (const c of CONTROLS) {
        const el = container.querySelector<HTMLElement>(`[data-testid="sw-connect-${c}"]`)!
        expect(Number(el.style.opacity)).toBe(0)
        expect(el.style.pointerEvents).toBe('none')
      }
      unmount()
    }
  })

  it('is fully live at the bottom of the track', () => {
    const { container } = render(<EndingConnect t={tAt(TRACK_END)} onRestart={() => {}} />)
    for (const c of CONTROLS) {
      const el = container.querySelector<HTMLElement>(`[data-testid="sw-connect-${c}"]`)!
      expect(el.style.pointerEvents).toBe('auto')
    }
  })

  it('never arms a control below the RENDERED opacity it calls legible', () => {
    // The nit this closes: `restart` was drawn at reveal x 0.82 and armed on reveal, so it became
    // clickable at 0.697 on screen — under the bar the component itself sets. One rule now, and it
    // is about what is on the screen rather than about the parameter behind it.
    //
    // Sampled AT each control's own crossing rather than by brute force. A first cut rendered 601
    // times and turned out to be a five-second timeout waiting to happen on a loaded machine — a
    // flaky guard is worse than no guard, and the crossings are where the rule can actually break.
    const crossing = (index: number) => {
      let lo = 0
      let hi = 1
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2
        if (connectReveal(mid, index) >= 0.85) hi = mid
        else lo = mid
      }
      return hi
    }
    const stops = new Set<number>()
    CONTROLS.forEach((_, i) => {
      const t = crossing(i)
      for (const d of [-1e-6, 0, 1e-6, -0.01, 0.01]) stops.add(Math.min(1, Math.max(0, t + d)))
    })
    for (let i = 0; i <= 20; i++) stops.add(i / 20)

    for (const t of stops) {
      const { container, unmount } = render(<EndingConnect t={t} onRestart={() => {}} />)
      for (const c of CONTROLS) {
        const el = container.querySelector<HTMLElement>(`[data-testid="sw-connect-${c}"]`)!
        if (el.style.pointerEvents === 'auto') {
          expect(
            Number(el.style.opacity),
            `${c} armed at rendered opacity ${el.style.opacity} (t=${t})`
          ).toBeGreaterThanOrEqual(0.85)
        }
      }
      unmount()
    }
  })

  it('arrives in reading order rather than all at once', () => {
    const t = tAt(1 + 0.83 * ENDING_SPAN)
    const reveals = CONTROLS.map((_, i) => connectReveal(t, i))
    for (let i = 1; i < reveals.length; i++) {
      expect(reveals[i]).toBeLessThan(reveals[i - 1])
    }
  })

  it('is scrubbed, not animated: forward and backward give identical values', () => {
    const forward: number[][] = []
    for (let i = 0; i <= 500; i++) {
      const t = tAt(1 + (i / 500) * ENDING_SPAN)
      forward.push(CONTROLS.map((_, k) => connectReveal(t, k)))
    }
    for (let i = 500; i >= 0; i--) {
      const t = tAt(1 + (i / 500) * ENDING_SPAN)
      expect(CONTROLS.map((_, k) => connectReveal(t, k))).toEqual(forward[i])
    }
  })

  it('never goes backwards as the pull-back goes forwards', () => {
    for (let k = 0; k < CONTROLS.length; k++) {
      let prev = -Infinity
      for (let i = 0; i <= 800; i++) {
        const v = connectReveal(tAt(1 + (i / 800) * ENDING_SPAN), k)
        expect(v).toBeGreaterThanOrEqual(prev)
        prev = v
      }
    }
  })

  it('shows itself when a keyboard reaches it early, and hides again on the way out', () => {
    // The scroll says invisible; the keyboard says otherwise. A focused control that cannot be
    // seen is the worse of the two failures, so focus wins.
    render(<EndingConnect t={0.05} onRestart={() => {}} />)
    const email = screen.getByTestId('sw-connect-email')
    expect(Number(email.style.opacity)).toBe(0)

    fireEvent.focus(email)
    expect(Number(email.style.opacity)).toBe(1)
    expect(email.style.pointerEvents).toBe('auto')

    fireEvent.blur(email, { relatedTarget: document.body })
    expect(Number(screen.getByTestId('sw-connect-email').style.opacity)).toBe(0)
  })

  it('keeps the block up while focus moves BETWEEN its own controls', () => {
    render(<EndingConnect t={0.05} onRestart={() => {}} />)
    const email = screen.getByTestId('sw-connect-email')
    const restart = screen.getByTestId('sw-connect-restart')
    fireEvent.focus(email)
    fireEvent.blur(email, { relatedTarget: restart })
    expect(Number(screen.getByTestId('sw-connect-email').style.opacity)).toBe(1)
  })

  it('restarts the story through the track rather than by jumping', () => {
    const onRestart = vi.fn()
    render(<EndingConnect t={1} onRestart={onRestart} />)
    fireEvent.click(screen.getByTestId('sw-connect-restart'))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})

describe('the progress rail leaves before the composition arrives', () => {
  it('is fully up for the whole journey and the whole curtain call', () => {
    for (const p of [0, 0.5, 0.99, 1, 1 + 0.2 * ENDING_SPAN, 1 + ZOOM_START * ENDING_SPAN]) {
      expect(railOpacity(p)).toBe(1)
    }
  })

  it('is completely gone well before the connect block is legible', () => {
    expect(railOpacity(TRACK_END)).toBe(0)
    // the crossing point: the rail must be out before anything it could sit on top of arrives
    let railGoneAt = TRACK_END
    for (let i = 0; i <= 2000; i++) {
      const p = 1 + (i / 2000) * ENDING_SPAN
      if (railOpacity(p) === 0) {
        railGoneAt = p
        break
      }
    }
    expect(connectReveal(tAt(railGoneAt), 0)).toBe(0)
  })

  it('fades monotonically, and rewinds through the same values', () => {
    let prev = Infinity
    for (let i = 0; i <= 1000; i++) {
      const v = railOpacity(1 + (i / 1000) * ENDING_SPAN)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
    expect(railOpacity(1.2)).toBe(railOpacity(1.2))
  })
})

describe('the fallback page carries the same contact story', () => {
  it('offers every address the ending does — the canvas visitor is not the only visitor', () => {
    // `SmallWorldExperience` returns null under reduced motion or without WebGL: the canvas is not
    // hidden for those visitors, it never exists. If the contact links lived only in the ending,
    // this page would be a career timeline that stops at the last job and offers no way to reply.
    const { container } = render(<FallbackTimeline />)
    const hrefs = new Set(
      [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    )
    expect(hrefs.has(`mailto:${siteConfig.email}`)).toBe(true)
    for (const l of socialLinks) expect(hrefs.has(l.url)).toBe(true)
  })

  it('matches the ending link-for-link, so neither can drift', () => {
    const { container: fallback } = render(<FallbackTimeline />)
    const { container: ending } = render(<EndingConnect t={1} onRestart={() => {}} />)
    const hrefs = (root: Element) =>
      new Set([...root.querySelectorAll('a')].map((a) => a.getAttribute('href')))
    expect(hrefs(ending)).toEqual(hrefs(fallback))
  })

  it('opens its outbound profiles safely', () => {
    const { container } = render(<FallbackTimeline />)
    for (const l of socialLinks) {
      const a = [...container.querySelectorAll('a')].find((el) => el.getAttribute('href') === l.url)!
      expect(a.getAttribute('rel')).toContain('noopener')
    }
  })
})

/**
 * THE RAIL'S DISMISS CONTROL (fix round, review finding 2).
 *
 * It used to be `pointer-events: auto` unconditionally, with the whole rail only hidden at exactly
 * `opacity === 0` — so through the tail of the fade it was a topmost, focusable target at an
 * effective alpha of 0.0099. That is the trap the connect block refuses three files over, and it now
 * refuses it on the same terms: legible or inert.
 */
describe("the rail's dismiss control is live only while it is legible", () => {
  it('is live for the whole journey and the whole curtain call', () => {
    for (const p of [0, 0.5, 0.99, 1, 1 + ZOOM_START * ENDING_SPAN]) {
      expect(railDismissLive(p)).toBe(true)
    }
  })

  it('goes inert while the rail is still faintly visible, not once it has vanished', () => {
    // the interesting property: there is a stretch where the rail can still be seen and the button
    // is already dead. Without it, "invisible live button" is answered at the endpoint only.
    let inertButVisible = 0
    for (let i = 0; i <= 4000; i++) {
      const p = 1 + (i / 4000) * ENDING_SPAN
      const o = railOpacity(p)
      if (!railDismissLive(p) && o > 0) inertButVisible++
      // and the invariant itself: never live below the legibility bar
      if (railDismissLive(p)) expect(o).toBeGreaterThanOrEqual(0.85)
    }
    expect(inertButVisible).toBeGreaterThan(0)
  })

  it('never revives once it has gone', () => {
    let seenDead = false
    for (let i = 0; i <= 4000; i++) {
      const p = 1 + (i / 4000) * ENDING_SPAN
      if (!railDismissLive(p)) seenDead = true
      else expect(seenDead).toBe(false)
    }
    expect(seenDead).toBe(true)
  })
})
