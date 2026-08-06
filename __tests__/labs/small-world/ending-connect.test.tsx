import { PALETTE } from '@/components/labs/small-world/palette'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { siteConfig, socialLinks } from '@/lib/constants'
import {
  STUDIO_PAD_RENDERED,
  EndingConnect,
  connectReveal,
} from '@/components/labs/small-world/overlay/ending-connect'
import { railDismissLive, railOpacity } from '@/components/labs/small-world/overlay/journey-progress'
import {
  NOTE_SETTLE_REMAINING,
  noteEdgeNdcY,
} from '@/components/labs/small-world/overlay/note-settle'
import { standBelowJourneyFrame } from '@/components/labs/small-world/scene/globe-stand'
import { FallbackTimeline } from '@/components/labs/small-world/fallback-timeline'
import {
  ENDING_SPAN,
  STAND_END,
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
    //
    // Sampled at t = 0.93 rather than Task 65's 0.72: the entrance is solved from the note's own
    // settling now (Task 72) and 0.72 of the ending is before it starts, where the honest reading
    // is a flat zero rather than a partial fade.
    render(<EndingConnect t={tAt(1 + 0.93 * ENDING_SPAN)} onRestart={() => {}} />)
    const email = screen.getByTestId('sw-connect-email')
    expect(Number(email.style.opacity)).toBeGreaterThan(0)
    expect(Number(email.style.opacity)).toBeLessThan(0.85)
    expect(email.style.pointerEvents).toBe('none')
  })

  it('is invisible and inert for the whole still beat', () => {
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
    const t = tAt(1 + 0.93 * ENDING_SPAN)
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

/**
 * THE RAIL LEAVES BEFORE THE PEDESTAL ARRIVES (Task 72, review finding C1).
 *
 * Task 65 keyed the fade to `zoom`, which is 0 for the whole still beat — and the still beat is
 * exactly when the globe stand rises. A blind playthrough caught the rail drawn dark-on-dark across
 * the stand's column at ~90% of the track, with the old fade not finishing until 93.6%.
 *
 * The beat is RE-DERIVED here rather than restated, and from the shipped predicate: the binding
 * event is the stand's crown crossing the journey camera's bottom frame edge, which is precisely
 * what `standBelowJourneyFrame` decides. If someone retunes the cradle or the park drop, this test
 * follows them and the component follows them, independently — which is the point of deriving it
 * twice instead of sharing a constant.
 */
const standEntersFrame = (): number => {
  // monotone: `standOffsetY` eases the stand upward on a smootherstep that never reverses, so the
  // predicate is true then false, exactly once
  let lo = 0
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (standBelowJourneyFrame(mid)) lo = mid
    else hi = mid
  }
  return hi
}

/** ...mapped back through the timeline: `stand` is `t / STAND_END`, and `t` is `(p − 1) / SPAN`. */
const STAND_ENTRY_PROGRESS = 1 + standEntersFrame() * STAND_END * ENDING_SPAN

describe('the progress rail leaves before the pedestal arrives', () => {
  it('brackets the real crossing, so the beat below is the stand and not a number', () => {
    // the guard on the derivation itself: the predicate must actually flip here
    const s = standEntersFrame()
    expect(standBelowJourneyFrame(s - 1e-6)).toBe(true)
    expect(standBelowJourneyFrame(s + 1e-6)).toBe(false)
    // ...and it happens during the RISE, well before the still beat hands over to the pull-back
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
    expect(STAND_ENTRY_PROGRESS).toBeLessThan(1 + ZOOM_START * ENDING_SPAN)
  })

  it('is EXACTLY gone by the frame the stand can first be seen in, and stays gone', () => {
    expect(railOpacity(STAND_ENTRY_PROGRESS)).toBe(0)
    for (let i = 0; i <= 400; i++) {
      const p = STAND_ENTRY_PROGRESS + (i / 400) * (TRACK_END - STAND_ENTRY_PROGRESS)
      expect(railOpacity(p), `rail still drawn at progress ${p}`).toBe(0)
    }
    expect(railOpacity(TRACK_END)).toBe(0)
  })

  it('is fully up for the whole journey, boundary included', () => {
    // the ending owns (1, TRACK_END]; progress = 1 is the journey's last frame and the rail is whole
    for (const p of [0, 0.25, 0.5, 0.9, 0.99, 1]) expect(railOpacity(p)).toBe(1)
    for (let i = 0; i <= 500; i++) expect(railOpacity(i / 500)).toBe(1)
  })

  it('is still completely gone before the connect block is legible', () => {
    // Task 65's property, kept: whatever else moved, the rail must be out before anything it could
    // sit on top of arrives. It is now a far wider margin than it was.
    let railGoneAt = TRACK_END
    for (let i = 0; i <= 4000; i++) {
      const p = 1 + (i / 4000) * ENDING_SPAN
      if (railOpacity(p) === 0) {
        railGoneAt = p
        break
      }
    }
    expect(connectReveal(tAt(railGoneAt), 0)).toBe(0)
    expect(railGoneAt).toBeLessThanOrEqual(STAND_ENTRY_PROGRESS)
  })

  it('fades monotonically across the whole track', () => {
    let prev = Infinity
    for (let i = 0; i <= 4000; i++) {
      const v = railOpacity((i / 4000) * TRACK_END)
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
    }
  })

  it('is scrubbed, not animated: retracing is bit-identical', () => {
    // Object.is rather than toBe on a tolerance — the claim is that scrubbing back runs the SAME
    // arithmetic, and "same to within an epsilon" is a different and weaker claim.
    const forward: number[] = []
    for (let i = 0; i <= 2000; i++) forward.push(railOpacity((i / 2000) * TRACK_END))
    for (let i = 2000; i >= 0; i--) {
      expect(Object.is(railOpacity((i / 2000) * TRACK_END), forward[i])).toBe(true)
    }
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
  it('is live for the whole journey, boundary included', () => {
    // it no longer survives the still beat, because the rail no longer does — the fade now starts
    // on the ending's first frame rather than on the pull-back's
    for (const p of [0, 0.5, 0.99, 1]) expect(railDismissLive(p)).toBe(true)
  })

  it('goes with the rail: never live once the stand can be seen', () => {
    for (let i = 0; i <= 400; i++) {
      const p = STAND_ENTRY_PROGRESS + (i / 400) * (TRACK_END - STAND_ENTRY_PROGRESS)
      expect(railDismissLive(p)).toBe(false)
    }
  })

  it('goes inert while the rail is still faintly visible, not once it has vanished', () => {
    // the interesting property: there is a stretch where the rail can still be seen and the button
    // is already dead. Without it, "invisible live button" is answered at the endpoint only.
    let inertButVisible = 0
    for (let i = 0; i <= 8000; i++) {
      const p = 1 + (i / 8000) * ENDING_SPAN
      const o = railOpacity(p)
      if (!railDismissLive(p) && o > 0) inertButVisible++
      // and the invariant itself: never live below the legibility bar
      if (railDismissLive(p)) expect(o).toBeGreaterThanOrEqual(0.85)
    }
    expect(inertButVisible).toBeGreaterThan(0)
  })

  it('never revives once it has gone', () => {
    let seenDead = false
    for (let i = 0; i <= 8000; i++) {
      const p = (i / 8000) * TRACK_END
      if (!railDismissLive(p)) seenDead = true
      else expect(seenDead).toBe(false)
    }
    expect(seenDead).toBe(true)
  })
})

/**
 * THE PILLS WAIT FOR THE NOTE (Task 72, review finding C2).
 *
 * The review found the connect pills printed across the note's second line through ~96–98% of the
 * track. The note is a static mesh and never moves; the CAMERA sweeps it up the frame, straight
 * through the pills' band, while the pills were already at up to 0.93 opacity.
 *
 * The pure predicate the fix is built on is `note-settle.ts`'s: how much of the note's total screen
 * travel is still ahead of it. These pin that no control is drawn AT ALL while that is above the
 * threshold — which is the whole of the crossing — rather than pinning a pixel gap, because the
 * pixel gap is viewport-dependent and this is not. The pixels were measured separately, on the
 * running build at 1440x900 and 390x844.
 */
const noteRemaining = (zoom: number): number =>
  (noteEdgeNdcY(1) - noteEdgeNdcY(zoom)) / (noteEdgeNdcY(1) - noteEdgeNdcY(0))

const zoomAt = (t: number): number => (t - ZOOM_START) / (1 - ZOOM_START)

describe('the connect block enters only after the note has settled', () => {
  it('draws nothing at all while the note is still travelling', () => {
    let stillTravelling = 0
    for (let i = 0; i <= 4000; i++) {
      const t = i / 4000
      if (noteRemaining(zoomAt(t)) <= NOTE_SETTLE_REMAINING) continue
      stillTravelling++
      for (let k = 0; k < CONTROLS.length; k++) {
        expect(connectReveal(t, k), `${CONTROLS[k]} drawn while the note is still moving (t=${t})`).toBe(0)
      }
    }
    // the guard on the guard: if the predicate were never true this would pass vacuously
    expect(stillTravelling).toBeGreaterThan(3000)
  })

  it('starts the first control exactly where the note settles, not before or long after', () => {
    // the entrance must USE the room it has: opening late enough to be safe and then leaving a
    // third of the window empty would be a different defect
    let firstDraw = 1
    for (let i = 0; i <= 20000; i++) {
      const t = i / 20000
      if (connectReveal(t, 0) > 0) {
        firstDraw = t
        break
      }
    }
    expect(noteRemaining(zoomAt(firstDraw))).toBeLessThanOrEqual(NOTE_SETTLE_REMAINING)
    // ...and within a hair of the boundary rather than idling past it
    expect(noteRemaining(zoomAt(firstDraw))).toBeGreaterThan(NOTE_SETTLE_REMAINING * 0.99)
  })

  it('lands EVERY control at exactly 1 at the bottom of the track', () => {
    // The wart this closes: `restart` is index 3 and its window used to close at zoom 1.005, so it
    // rested at 0.99937 — a control that never finished its entrance, in the one frame of the lab
    // that is meant to be finished. `toBe(1)` and not `toBeCloseTo`: the window is solved to close
    // on 1, and smoothstep(1) is exactly 1, so the exactness is the claim.
    for (let k = 0; k < CONTROLS.length; k++) {
      expect(connectReveal(1, k), `${CONTROLS[k]} does not finish its entrance`).toBe(1)
      expect(connectReveal(tAt(TRACK_END), k)).toBe(1)
    }
  })

  it('still arrives in reading order, one control at a time', () => {
    // the stagger survived being solved: no two controls share a start
    const starts = CONTROLS.map((_, k) => {
      for (let i = 0; i <= 20000; i++) if (connectReveal(i / 20000, k) > 0) return i / 20000
      return 1
    })
    for (let k = 1; k < starts.length; k++) expect(starts[k]).toBeGreaterThan(starts[k - 1])
  })

  it('is monotone in t and retraces bit-identically', () => {
    const forward: number[][] = []
    for (let i = 0; i <= 2000; i++) forward.push(CONTROLS.map((_, k) => connectReveal(i / 2000, k)))
    for (let k = 0; k < CONTROLS.length; k++) {
      let prev = -Infinity
      for (let i = 0; i <= 2000; i++) {
        expect(forward[i][k]).toBeGreaterThanOrEqual(prev)
        prev = forward[i][k]
      }
    }
    for (let i = 2000; i >= 0; i--) {
      for (let k = 0; k < CONTROLS.length; k++) {
        expect(Object.is(connectReveal(i / 2000, k), forward[i][k])).toBe(true)
      }
    }
  })
})

/**
 * THE BLOCK'S CONTRAST, ON THE SURFACE IT ACTUALLY SITS ON (Task 68).
 *
 * WCAG relative luminance and the `(L1+0.05)/(L2+0.05)` ratio, and the background is the pad's
 * MEASURED rendered colour from the shipped money shot rather than a palette hex — the pad is a
 * baked texture now, so quoting `PALETTE.deskMat` here would be measuring a surface the lab no
 * longer draws.
 *
 * The floors are the real ones: 4.5:1 for the 15px bold pill type (it is not WCAG "large", which
 * starts at 18.66px bold), and 3:1 for the FOCUS RING, which a sighted keyboard user has to be able
 * to find.
 *
 * THE PILL'S EDGE IS A STATED CONCESSION, not a pass. It ships at 2.84:1 against the pad — the same
 * number for which rose was rejected as a focus ring two paragraphs down. WCAG 1.4.11 asks for 3:1
 * on "visual information required to identify user interface components", and the thing that
 * identifies these components is their LABEL, which clears 10.19:1 against the pad and 13.59:1
 * against its own card. The border is separation, not identification, and no rose in candidate B
 * reaches 3:1 against this pad (the best is this one). Darkening it far enough would mean leaving
 * B's family for the pill's outline alone. Recorded here rather than gated at a floor it does not
 * meet.
 */
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('the connect block is legible on the studio pad', () => {
  it('carries its type at full AA, which a row of candidate-B fills could not', () => {
    // Why the pills are one near-white card rather than three tinted ones, as numbers. Candidate B
    // is all rose, and against a 4.5 floor for 15px bold, exactly ONE of the three roses that would
    // fit could hold ink type. A row where colour means something cannot be built out of one
    // usable colour — so the label carries identity and the card carries legibility.
    expect(ratio(PALETTE.ink, '#D9779B')).toBeGreaterThan(4.5) // 4.72 — the one that works
    expect(ratio(PALETTE.ink, '#CF6690')).toBeLessThan(4.5) // 3.98
    expect(ratio(PALETTE.ink, PALETTE.studioRoseDeep)).toBeLessThan(4.5) // 3.59
    // ...and what shipped clears it for all three at once
    expect(ratio(PALETTE.ink, PALETTE.studioPaper)).toBeGreaterThan(12)
  })

  it('separates its own edge from the pad, at the 2.84:1 the docblock concedes', () => {
    // the card itself is barely lighter than the pad — the BORDER is what makes it read
    expect(ratio(PALETTE.studioPaper, STUDIO_PAD_RENDERED)).toBeLessThan(1.5)
    // pinned as a RANGE, not a floor, so the concession cannot be quietly widened later
    const edge = ratio(PALETTE.studioRoseDeep, STUDIO_PAD_RENDERED)
    expect(edge).toBeGreaterThan(2.8)
    expect(edge).toBeLessThan(3)
    // ...and what actually identifies the control clears 1.4.11 comfortably
    expect(ratio(PALETTE.ink, STUDIO_PAD_RENDERED)).toBeGreaterThan(3)
  })

  it('draws a focus ring that clears 3:1 against BOTH surfaces it can fall on', () => {
    // The ring falls on the card and on the pad, and has to clear both. NOTHING in candidate B's
    // family does — its best rose is 2.84 against the pad — which is why the ring is ink.
    expect(ratio(PALETTE.studioRoseDeep, STUDIO_PAD_RENDERED)).toBeLessThan(3)
    expect(ratio(PALETTE.ink, PALETTE.studioPaper)).toBeGreaterThan(3)
    expect(ratio(PALETTE.ink, STUDIO_PAD_RENDERED)).toBeGreaterThan(3)
  })

  it('keeps the restart readable as the quiet sibling rather than the invisible one', () => {
    // it is quiet by TYPE — smaller, borderless, dashed, in the hand — never by being dimmer than
    // the legibility bar, which is the mistake LIVE_AT exists to record
    expect(ratio(PALETTE.ink, STUDIO_PAD_RENDERED)).toBeGreaterThan(4.5)
  })
})
