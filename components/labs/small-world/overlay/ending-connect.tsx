'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { ZOOM_START } from '../ending-timeline'
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

/** Where each control's own fade sits inside the pull-back. */
const FIRST_IN = 0.5
const FADE = 0.34
const STAGGER = 0.055

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
 */
export function connectReveal(t: number, index: number): number {
  const zoom = (t - ZOOM_START) / (1 - ZOOM_START)
  return smoothstep((zoom - (FIRST_IN + index * STAGGER)) / FADE)
}

type Control = { key: string; label: string; href?: string; tint: string }

function controls(): Control[] {
  return [
    { key: 'email', label: 'Email', href: `mailto:${siteConfig.email}`, tint: PALETTE.honey },
    ...socialLinks.map((l) => ({
      key: l.name.toLowerCase(),
      label: l.name,
      href: l.url,
      tint: l.icon === 'github' ? PALETTE.blossom : PALETTE.river,
    })),
  ]
}

function tabStyle(reveal: number, tint: string): CSSProperties {
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
    border: `3px solid ${PALETTE.ink}`,
    background: tint,
    boxShadow: `3px 3px 0 ${PALETTE.ink}`,
    cursor: 'pointer',
  }
}

export function EndingConnect({ t, onRestart }: { t: number; onRestart: () => void }) {
  const [focused, setFocused] = useState(false)
  const items = controls()
  const revealOf = (i: number) => (focused ? 1 : connectReveal(t, i))

  return (
    <div
      data-testid="sw-connect"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 'max(20px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        // inherited from the overlay root, restated so a later edit has to mean it
        pointerEvents: 'none',
      }}
    >
      <nav
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
            style={tabStyle(revealOf(i), c.tint)}
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
          borderBottom: `2px dashed ${PALETTE.ink}`,
          padding: '1px 2px 2px',
          cursor: 'pointer',
        }}
      >
        start the story over
      </button>
    </div>
  )
}
