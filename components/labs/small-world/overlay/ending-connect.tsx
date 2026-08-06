'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { ZOOM_START } from '../ending-timeline'
import { NOTE_SETTLED_ZOOM } from './note-settle'
import { useConnectSpacing } from './use-connect-spacing'
import { useNoteTracking } from './use-note-tracking'
import { PALETTE } from '../palette'

/**
 * THE CONNECT BLOCK (Task 65) — the ending's clickable half, in the `sw-ending` slot.
 *
 * The note lying on the desk carries the message; this carries the ADDRESSES. Splitting them that
 * way is not a compromise, it is what each half is good at: ink on a canvas texture survives being
 * foreshortened to a hundred device pixels, and a real `<a href>` survives being tabbed to, read by
 * a screen reader, middle-clicked, and copied. Painting `mailto:` into a texture would have looked
 * the same in a screenshot and been a picture of a link.
 *
 * ── THE CLICK MODEL (aa399f6, and Task 61's tap blanket) ──────────────────────────────────────
 * The slot inherits `pointer-events: none` from the overlay root and this component NEVER puts it
 * back on a container. Only the four controls take pointer events, and only once they are actually
 * legible — a transparent element that swallows a click is the exact failure the canvas-first model
 * exists to forbid, and the ending is the one place in the lab where the canvas underneath still
 * has to receive `onPointerMissed`.
 *
 * ── THE ENTRANCE ──────────────────────────────────────────────────────────────────────────────
 * Staged off `zoom` and nothing else: no clock, no transition, no mount animation. Scrub backwards
 * and it runs backwards through the same arithmetic. Each control has its own window so they arrive
 * in reading order, which is a stagger you can hold still in the middle of.
 *
 * ── THE FOCUS RULE ────────────────────────────────────────────────────────────────────────────
 * A keyboard visitor can reach these before the scroll does, and a focused control that cannot be
 * seen is worse than one that cannot be reached. So focus anywhere in the block forces it fully
 * visible and fully live, whatever the scroll says. That is why the reveal is state and not CSS.
 */

type Control = { key: string; label: string; href?: string }

function controls(): Control[] {
  return [
    { key: 'email', label: 'Email', href: `mailto:${siteConfig.email}` },
    ...socialLinks.map((l) => ({ key: l.name.toLowerCase(), label: l.name, href: l.url })),
  ]
}

/** Every control the block stages, the anchors plus the restart. Derived so the schedule below
 *  cannot fall out of step with the list it is scheduling. */
const CONTROL_COUNT = controls().length + 1

/**
 * ── WHEN THE ENTRANCE MAY START (Task 72, review finding C2) ───────────────────────────────────
 *
 * The window used to open at 0.5 of the pull-back with a 0.34 fade, and a blind playthrough caught
 * what that costs: through roughly 96–98% of the track the pills were printed across the note's
 * second line at up to 0.93 opacity. The reason is in `note-settle.ts` — the note is a static mesh
 * and it is the CAMERA that moves, sweeping the note up the frame and straight through the pills'
 * band before the pills have finished arriving.
 *
 * So the entrance is no longer authored, it is SOLVED: it starts where the note has stopped
 * travelling, and everything else is a share of what is left. Aram's instruction was "pills enter
 * AFTER the note settles"; `NOTE_SETTLED_ZOOM` is what "settles" means as arithmetic, and this is
 * that instruction with nothing typed in between.
 *
 * THE OTHER OPTION HE OFFERED, AND WHY IT IS NOT WHAT SHIPPED. "Or slide with an offset that never
 * intersects it" is buildable and was worked out: the pills would enter from below the frame's edge
 * and ride up underneath the note, which needs about 180 px of travel — the offset has to keep a
 * half-revealed pill below an edge that is still 175 px lower at 97% of the track. It works, and it
 * turns a 16 px lift into a full slide-in, which is a far louder gesture than the frame Aram
 * approved contains. Staging late buys the same freedom from the note and leaves the block's
 * character alone, so the lift stays at 16 px.
 *
 * WHAT THE SHAPE OF THE WINDOW PRESERVES. The old numbers spent roughly two parts of the window on
 * one control's own fade to one part on the spread between controls (0.34 against 3 x 0.055). That
 * ratio is what makes the arrival read as reading order rather than as a ripple, so it is kept
 * exactly and the window it is measured against is the only thing that changed. The last control's
 * fade now closes EXACTLY at 1 by construction rather than 0.0006 short of it — see the note on the
 * restart's resting reveal below.
 */
const FADE_SHARE = 2 / 3

/** What is left of the pull-back once the note has stopped moving: 0.188 of it, about 30vh. */
const WINDOW = 1 - NOTE_SETTLED_ZOOM

/** Where the first control's fade begins. */
const FIRST_IN = NOTE_SETTLED_ZOOM

/** How long one control takes to arrive... */
const FADE = WINDOW * FADE_SHARE

/** ...and how far apart their starts are, so the last one lands exactly as the pull-back ends. */
const STAGGER = (WINDOW - FADE) / (CONTROL_COUNT - 1)

/**
 * Below this RENDERED opacity a control is not legible enough to be honest about being clickable.
 *
 * It is rendered opacity and not reveal, which is a distinction the first cut got wrong: `restart`
 * was drawn at `reveal * 0.82` and armed at `reveal >= 0.85`, so it became clickable at 0.697 on
 * screen — under the bar this very constant defines. The dim is gone rather than the threshold
 * lowered, because a control that must be dimmer than the legibility bar to look secondary is being
 * asked to carry with alpha what type should carry: `restart` is smaller, borderless, dashed and in
 * the hand, and that is what makes it the quiet one.
 */
const LIVE_AT = 0.85

const smoothstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * The ending's own `t` → this control's reveal. `t` is what `JourneyUi.ending` publishes (quantized
 * to 1/60, so the whole scrub costs at most sixty re-renders); the zoom window is re-derived from
 * the timeline's own `ZOOM_START` rather than restated.
 *
 * THE LAST CONTROL NOW LANDS AT EXACTLY 1, which the old schedule did not. `restart` is index 3
 * (there are four controls: the mail anchor, two social anchors, and it), and its window used to
 * close at zoom 1.005 — so at the bottom of the track it rested at reveal 0.99937, i.e. 99.94%
 * opacity and 0.0101 px of leftover translate. Nobody could see that, which is exactly why it
 * survived: it is a control that never finishes its entrance, sitting in the one frame of the lab
 * that is meant to be finished. The window is solved from `CONTROL_COUNT` now, so the arithmetic
 * closes on 1 for whatever the list holds rather than for the list it held when someone typed 0.055.
 */
export function connectReveal(t: number, index: number): number {
  const zoom = (t - ZOOM_START) / (1 - ZOOM_START)
  return smoothstep((zoom - (FIRST_IN + index * STAGGER)) / FADE)
}

/**
 * THE SURFACE THESE SIT ON, measured rather than assumed (Task 68).
 *
 * The block lies over the desk pad, which is now a baked texture rather than a palette hex — so the
 * background every contrast ratio below is against is a MEASUREMENT of the shipped money shot
 * (`shots5/desktop-money.png`, region `pad_pink_back`), not a colour anyone chose. Quoting a palette
 * entry here would be measuring the contrast of a surface that is no longer drawn.
 */
export const STUDIO_PAD_RENDERED = '#E7D8DB'

/** How the pill separates itself from the pad. Soft and blurred, not the hard offset stamp Task 65
 *  used: that was a sticker on a clay world, and this is a card on a matte studio desk. */
const PILL_SHADOW = '0 2px 7px rgba(43, 43, 51, 0.16)'

function tabStyle(reveal: number, isFocused: boolean): CSSProperties {
  return {
    // NEVER 'auto' on a control nobody can read yet — see the click model above. `opacity` below is
    // the reveal itself, so this threshold and the rendered one are the same number for all four
    // controls; that is the point of dropping the restart's dim.
    pointerEvents: reveal >= LIVE_AT ? 'auto' : 'none',
    opacity: reveal,
    transform: `translateY(${(1 - reveal) * 16}px)`,
    display: 'inline-block',
    fontFamily: 'var(--sw-font-display)',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 0.3,
    color: PALETTE.ink,
    textDecoration: 'none',
    padding: '9px 20px',
    borderRadius: 999,
    border: `2px solid ${PALETTE.studioRoseDeep}`,
    background: PALETTE.studioPaper,
    boxShadow: isFocused ? FOCUS_RING : PILL_SHADOW,
    cursor: 'pointer',
  }
}

/**
 * The focus ring: INK, and that is a measurement rather than a preference.
 *
 * A focus indicator has to clear 3:1 against everything it can fall on, and it falls on two
 * surfaces here — the pill's own near-white card and the pink pad beyond it. NOTHING in candidate
 * B's family does: the best of its roses is `studioRoseDeep` at 2.84:1 against the pad, and the
 * rest run down to 1.40. A rose ring was the first cut and this file's own test failed it. Ink
 * clears both by a wide margin (13.59:1 on the card, 10.19:1 on the pad).
 *
 * Drawn as a double box-shadow rather than an `outline` for two reasons: it follows the pill's
 * `borderRadius` everywhere, and it needs no stylesheet, which this component does not have. The
 * near-white inner stop is what keeps the ring readable where it sits directly on the rose border.
 */
const FOCUS_RING = `0 0 0 2px ${PALETTE.studioPaper}, 0 0 0 5px ${PALETTE.ink}, ${PILL_SHADOW}`

export function EndingConnect({ t, onRestart }: { t: number; onRestart: () => void }) {
  const [focused, setFocused] = useState(false)
  // WHICH control has focus, alongside WHETHER anything does. The container's flag drives the
  // reveal (a focused control that cannot be seen is worse than one that cannot be reached); this
  // one only decides where the ring is drawn, and adds no branch to the reveal arithmetic.
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const items = controls()
  const revealOf = (i: number) => (focused ? 1 : connectReveal(t, i))
  const { navRef, spacing } = useConnectSpacing()
  // rides the camera's breath so the note never slides out from under the pills — see
  // `note-parallax-shift.ts` for why this is tracking rather than more clearance
  const trackRef = useNoteTracking()

  return (
    <div
      ref={trackRef}
      data-testid="sw-connect"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
        setFocusedKey(null)
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        // The inset is the authored 20 on every wide frame and a DERIVED, smaller number on narrow
        // ones, where the note hangs into the row (`connect-clearance.ts`). `env()` still wins
        // through the same `max()`, so a notched phone is untouched by that arithmetic.
        bottom: `max(${spacing.inset}px, env(safe-area-inset-bottom))`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.gap,
        // inherited from the overlay root, restated so a later edit has to mean it
        pointerEvents: 'none',
      }}
    >
      <nav
        ref={navRef}
        aria-label="Connect with Aram"
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          padding: '0 16px',
        }}
      >
        {items.map((c, i) => (
          <a
            key={c.key}
            data-testid={`sw-connect-${c.key}`}
            href={c.href}
            {...(c.key === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            onFocus={() => setFocusedKey(c.key)}
            style={tabStyle(revealOf(i), focusedKey === c.key)}
          >
            {c.label}
          </a>
        ))}
      </nav>

      {/* THE RESTART AFFORDANCE. Aram's own idea ("start the story over"), built in the DOM rather
          than as a canvas prop: a hotspot in the scene would need arming, an elementFromPoint-honest
          probe and a cursor state, and it would buy a control that a keyboard cannot reach. This
          rewinds through the SAME `advanceTo` the chapter panels use, so the track's own smooth
          scroll carries the visitor back and every scroll-keyed thing in the lab plays backwards on
          the way — the story really does run in reverse, rather than the page cutting to the top. */}
      <button
        type="button"
        data-testid="sw-connect-restart"
        onClick={onRestart}
        onFocus={() => setFocusedKey('restart')}
        style={{
          pointerEvents: revealOf(items.length) >= LIVE_AT ? 'auto' : 'none',
          opacity: revealOf(items.length),
          transform: `translateY(${(1 - revealOf(items.length)) * 16}px)`,
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          fontFamily: 'var(--sw-font-hand)',
          fontSize: 21,
          lineHeight: 1.1,
          color: PALETTE.ink,
          // still the quiet sibling, and still by TYPE rather than by alpha: smaller, borderless,
          // dashed, in the hand. Only the rule's colour moves into the studio's family.
          borderBottom: `2px dashed ${PALETTE.studioRoseDeep}`,
          padding: '1px 2px 2px',
          borderRadius: 3,
          boxShadow: focusedKey === 'restart' ? FOCUS_RING : undefined,
          cursor: 'pointer',
        }}
      >
        start the story over
      </button>
    </div>
  )
}
