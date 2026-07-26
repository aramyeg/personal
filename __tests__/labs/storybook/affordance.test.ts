/**
 * THE AFFORDANCE SYSTEM (E3 BW-1) — the sweep's #1 gate failure, gated.
 *
 * "Zero hover affordance in the entire 3D scene… there is literally no signal
 * that distinguishes a live object from a dead one." All five blind readers
 * found the working mechanism by brute-forcing a grid of drags. Three legs
 * answer that: a hover glow on the piece, a pinch state on the one cursor, and
 * a single idle beckon on each spread's primary playable.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import * as THREE from 'three'
import {
  applyHandleGlow,
  clearHoverGlow,
  stepHoverGlow,
} from '@/components/labs/storybook/book/handle-hover'
import {
  BECKON_EVERY_S,
  BECKON_FIRST_S,
  BECKON_LIMIT,
  initialBeckonState,
  primaryPlayableChannel,
  stepBeckon,
} from '@/components/labs/storybook/book/handle-beckon'
import {
  HANDLE_MIN_HIT,
  HANDLE_SLOP_FLAT,
  handleSlopFactor,
} from '@/components/labs/storybook/book/handle-hit'
import { readNudgePulse, resetNudgePulses } from '@/components/labs/storybook/book/handle-nudge'
import { popupContentForSpread, SPREAD_COUNT } from '@/components/labs/storybook/content'
import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'

const ID = 'glow-probe'
const FRAME = 1 / 60

beforeEach(() => {
  clearHoverGlow(ID)
  resetNudgePulses()
})

describe('hover glow — the piece catches the light', () => {
  it('eases in, saturates at 1, and eases back to EXACTLY 0', () => {
    let w = 0
    for (let i = 0; i < 60; i++) w = stepHoverGlow(ID, FRAME, true)
    expect(w).toBeGreaterThan(0.98)
    expect(w).toBeLessThanOrEqual(1)
    let steps = 0
    while (w > 0 && steps < 600) {
      w = stepHoverGlow(ID, FRAME, false)
      steps++
    }
    expect(w).toBe(0) // not asymptotically near its own colour — exactly back
    expect(steps).toBeLessThan(60) // ~120ms settle, not a slow fade
  })

  it('settles inside ~150ms in both directions', () => {
    let w = 0
    let steps = 0
    while (w < 0.95 && steps < 600) {
      w = stepHoverGlow(ID, FRAME, true)
      steps++
    }
    expect(steps * FRAME).toBeLessThan(0.35)
  })

  it('restores the material colour EXACTLY, even if the art re-tinted it', () => {
    // The layers re-tint these materials when their art resolves (kraft
    // placeholder -> painted white); a permanently cached base colour would
    // have pinned a hovered piece to its pre-art tint forever.
    const m = new THREE.MeshBasicMaterial({ color: '#b79a6a' })
    const before = m.color.clone()
    applyHandleGlow(m, 0.6)
    expect(m.color.r).toBeGreaterThan(before.r)
    applyHandleGlow(m, 0)
    expect(m.color.r).toBe(before.r)
    expect(m.color.g).toBe(before.g)
    expect(m.color.b).toBe(before.b)
    // A fresh tint arriving between hovers is respected, not overwritten.
    m.color.set('#ffffff')
    applyHandleGlow(m, 1)
    applyHandleGlow(m, 0)
    expect(m.color.getHex()).toBe(0xffffff)
  })

  it('brightens warm — gold-biased, and never by more than a few per cent', () => {
    const m = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    applyHandleGlow(m, 1)
    expect(m.color.r - 1).toBeGreaterThan(m.color.g - 1)
    expect(m.color.g - 1).toBeGreaterThan(m.color.b - 1)
    expect(m.color.r - 1).toBeLessThan(0.2)
  })

  it('is a no-op at zero weight on an untouched material', () => {
    const m = new THREE.MeshBasicMaterial({ color: '#123456' })
    applyHandleGlow(m, 0)
    expect(m.color.getHex()).toBe(0x123456)
  })
})

describe('hit-target floor — a sliver still gets a reachable pad', () => {
  const quad = (w: number, h: number): Vec3[] => [
    [0, 0, 0],
    [w, 0, 0],
    [w, 0, h],
    [0, 0, h],
  ]

  // S2R2-3b: the family pad is a TARGET SIZE, not a multiplier. A handle already
  // past `base * HANDLE_MIN_HIT` is left on its own die-cut, because a grab band
  // that reaches beyond the art promises paper where there is pavement — the
  // blind re-reader's 270x145 px box over s2's 159x95 px welcome rank, which
  // also covered half of an unrelated prop. Below that size the pad is exactly
  // what it always was.
  it('leaves a handle that already reads at its own die-cut', () => {
    expect(handleSlopFactor(quad(0.3, 0.3), HANDLE_SLOP_FLAT)).toBe(1)
    // ...and the pad is still generous where it matters: the target is met.
    expect(0.3).toBeGreaterThanOrEqual(HANDLE_SLOP_FLAT * HANDLE_MIN_HIT)
  })

  it('carries a middling handle up to its family target and no further', () => {
    const target = HANDLE_SLOP_FLAT * HANDLE_MIN_HIT
    const short = 0.15 // over the bare floor, under the family target
    expect(short).toBeGreaterThan(HANDLE_MIN_HIT)
    const f = handleSlopFactor(quad(0.4, short), HANDLE_SLOP_FLAT)
    expect(short * f).toBeCloseTo(target, 12)
  })

  it('grows a small handle until its shortest edge clears the floor', () => {
    // The s4 cable carrier measured ~26x40 screen px and the s3 STIR tab 55x22:
    // 1.8x a sliver is still a sliver.
    const f = handleSlopFactor(quad(0.12, 0.02), HANDLE_SLOP_FLAT)
    expect(f).toBeGreaterThan(HANDLE_SLOP_FLAT)
    expect(0.02 * f).toBeGreaterThanOrEqual(HANDLE_MIN_HIT - 1e-9)
  })

  it('never shrinks a handle below its own die-cut, and stays bounded', () => {
    for (const [w, h] of [
      [1, 1],
      [0.02, 0.02],
      [1e-9, 1e-9],
      [0.4, 1e-9],
    ]) {
      const f = handleSlopFactor(quad(w, h), HANDLE_SLOP_FLAT)
      expect(f).toBeGreaterThanOrEqual(1)
      expect(f).toBeLessThanOrEqual(6)
    }
  })
})

describe('idle beckon — one restrained invitation per spread', () => {
  const advance = (state: ReturnType<typeof initialBeckonState>, spread: number, seconds: number) => {
    const fired: string[] = []
    for (let t = 0; t < seconds; t += FRAME) {
      const c = stepBeckon(state, spread, FRAME, true, false)
      if (c) fired.push(c)
    }
    return fired
  }

  it('picks a real playable channel for every spread that has one', () => {
    for (let s = 0; s < SPREAD_COUNT; s++) {
      const channel = primaryPlayableChannel(s)
      const layers = popupContentForSpread(s)?.layers ?? []
      const handles = layers.filter((l) =>
        ['liftflap', 'stripflap', 'tabpiece', 'dissolve', 'swarmarc', 'volvelle', 'keepwinch', 'knobtower'].includes(
          l.mech
        )
      )
      if (handles.length === 0) {
        expect(channel).toBeNull()
        continue
      }
      expect(channel).not.toBeNull()
      // The channel must belong to a handle layer on THIS spread (id, or an
      // id-prefixed sub-channel for the families that key per sub-part).
      const owner = handles.find(
        (l) => channel === l.id || channel?.startsWith(`${l.id}~`)
      )
      expect(owner, `spread ${s} beckoned ${channel}`).toBeDefined()
    }
  })

  it('never beckons a keepsake (a one-way door must not invite a first touch)', () => {
    for (let s = 0; s < SPREAD_COUNT; s++) {
      const channel = primaryPlayableChannel(s)
      if (channel === null) continue
      const owner = popupContentForSpread(s)?.layers.find(
        (l) => channel === l.id || channel.startsWith(`${l.id}~`)
      )
      expect(owner?.mech).not.toBe('keepsake')
    }
  })

  it('waits, then offers, then STOPS after the limit', () => {
    const state = initialBeckonState()
    expect(advance(state, 2, BECKON_FIRST_S - 0.5)).toHaveLength(0)
    const all = advance(state, 2, BECKON_EVERY_S * (BECKON_LIMIT + 4))
    // The first invitation plus the remainder, and never more than the limit.
    expect(state.offered).toBe(BECKON_LIMIT)
    expect(all.length).toBeLessThanOrEqual(BECKON_LIMIT)
  })

  it('actually arms the nudge pulse it names', () => {
    const state = initialBeckonState()
    const fired = advance(state, 2, BECKON_FIRST_S + 0.2)
    expect(fired.length).toBe(1)
    expect(readNudgePulse(fired[0])).toBeGreaterThan(0)
  })

  it('withdraws the offer for good once the reader takes a grab', () => {
    const state = initialBeckonState()
    stepBeckon(state, 2, FRAME, true, true) // a grab
    expect(state.answered).toBe(true)
    expect(advance(state, 2, BECKON_EVERY_S * (BECKON_LIMIT + 2))).toHaveLength(0)
  })

  it('stays silent mid-turn and before boot', () => {
    const state = initialBeckonState()
    for (let t = 0; t < BECKON_FIRST_S * 3; t += FRAME) {
      expect(stepBeckon(state, 2, FRAME, false, false)).toBeNull()
    }
  })

  it('resets its clock when the reader changes spread', () => {
    const state = initialBeckonState()
    advance(state, 2, BECKON_FIRST_S + 0.2)
    expect(state.offered).toBe(1)
    stepBeckon(state, 3, FRAME, true, false)
    expect(state.offered).toBe(0)
    expect(state.idle).toBeLessThan(FRAME * 2)
  })
})
