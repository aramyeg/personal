import { describe, expect, it } from 'vitest'
import {
  TURN_CULL_HIDE_AT,
  TURN_CULL_RESTORE_FROM,
  TURN_CULL_RESTORE_TO,
  turnCullOpacity,
  turnCulled,
} from '@/components/labs/storybook/book/turn-cull'
import { SETTLE_MS, TURN_MS, turnPublishedT } from '@/components/labs/storybook/book/use-turn-driver'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// Batch C-3 turn-time culling of interaction-only pieces (s4 pack 4c). The gates
// that matter: the mechanism is VISUAL ONLY and never reaches a rest pose, and
// the restore actually happens INSIDE the landing settle rather than at the
// commit frame.

describe("turnCullOpacity — the pack window against the driver's published t", () => {
  it('is fully opaque at rest (callers pass 0 when there is no frame at all)', () => {
    expect(turnCullOpacity(0)).toBe(1)
    expect(turnCulled(0)).toBe(false)
  })

  it("fades out across the pack's leading margin and is gone by the hide point", () => {
    expect(TURN_CULL_HIDE_AT).toBe(0.08) // pack fallback: the 0.03 fade-out eye-gated as a ~2-frame blink
    expect(turnCullOpacity(TURN_CULL_HIDE_AT / 2)).toBeCloseTo(0.5, 6)
    expect(turnCullOpacity(TURN_CULL_HIDE_AT)).toBe(0)
    expect(turnCulled(TURN_CULL_HIDE_AT)).toBe(true)
  })

  it('stays fully culled through the body of the turn — the draw-call win', () => {
    for (const t of [0.08, 0.1, 0.3, 0.5, 0.7, 0.8]) {
      expect(turnCullOpacity(t), `t=${t}`).toBe(0)
    }
  })

  it('ramps back across the landing settle and is whole by the commit', () => {
    expect(turnCullOpacity(TURN_CULL_RESTORE_FROM)).toBe(0)
    const mid = (TURN_CULL_RESTORE_FROM + TURN_CULL_RESTORE_TO) / 2
    expect(turnCullOpacity(mid)).toBeCloseTo(0.5, 6)
    expect(turnCullOpacity(TURN_CULL_RESTORE_TO)).toBe(1)
  })

  // THE TRAP THIS LOCKS DOWN. The pack's literal upper bound is 0.97, but the M2
  // settle publishes frame.t through easeTurnWeightedInv, so t never exceeds
  // ~0.905 — a hardcoded 0.97 would hold the pieces hidden through the whole
  // settle and snap them back on the commit frame, the exact pop the window is
  // meant to prevent. The restore band is therefore DERIVED from the driver.
  it("the restore band is reachable — it ends at the driver's true maximum published t", () => {
    const maxPublished = turnPublishedT(TURN_MS + SETTLE_MS, TURN_MS)
    expect(TURN_CULL_RESTORE_TO).toBeCloseTo(maxPublished, 12)
    expect(maxPublished).toBeLessThan(0.97) // the literal pack bound is unreachable
    expect(turnCullOpacity(maxPublished)).toBe(1)
  })

  it('the restore band IS the settle tail, start to finish', () => {
    expect(TURN_CULL_RESTORE_FROM).toBeCloseTo(turnPublishedT(TURN_MS, TURN_MS), 12)
    // Nothing is restored while the main sweep is still running.
    expect(turnCullOpacity(turnPublishedT(TURN_MS * 0.999, TURN_MS))).toBe(0)
  })

  it('every frame the driver can actually publish gets a defined opacity in [0,1]', () => {
    const steps = 400
    for (let i = 0; i <= steps; i++) {
      const t = turnPublishedT(((TURN_MS + SETTLE_MS) * i) / steps, TURN_MS)
      const o = turnCullOpacity(t)
      expect(o).toBeGreaterThanOrEqual(0)
      expect(o).toBeLessThanOrEqual(1)
    }
  })

  it('is monotone down then up, so nothing flickers mid-ramp', () => {
    const steps = 500
    let prev = turnCullOpacity(0)
    let rising = false
    for (let i = 1; i <= steps; i++) {
      const v = turnCullOpacity(i / steps)
      if (!rising && v > prev + 1e-12) rising = true
      else if (rising) expect(v).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = v
    }
    expect(rising).toBe(true)
  })

  it('treats a non-finite progress as "not turning" rather than blanking the piece', () => {
    expect(turnCullOpacity(Number.NaN)).toBe(1)
  })
})

describe('C-3 scope — which s4 pieces the cull is allowed to touch', () => {
  const s4 = CHAPTERS.find((c) => c.spread === 4)!
  const mechOf = (id: string): SceneLayer['mech'] => s4.layers.find((l) => l.id === id)!.mech

  it('the culled families are the two READER INSTRUMENTS, and the keep is not among them', () => {
    // The renderers that call turnCullOpacity are the volvelle and keepwinch
    // layers; this pins the s4 pieces those families own, so moving the keep
    // (or the ring) into a culled family fails here rather than in a capture.
    expect(mechOf('ch3-dispatch')).toBe('volvelle')
    expect(mechOf('ch3-keep-winch')).toBe('keepwinch')
    expect(mechOf('ch3-keep')).toBe('keepstack')
    expect(mechOf('ch3-ring-tower')).toBe('stripflap')
    expect(['volvelle', 'keepwinch']).not.toContain(mechOf('ch3-keep'))
  })
})

describe('C-3 opt-in pieces — the flagged playables, and the structure left alone', () => {
  const layerOf = (spread: number, id: string): SceneLayer =>
    CHAPTERS.find((c) => c.spread === spread)!.layers.find((l) => l.id === id)!

  it('ch5-raise-stall is culled — the s5->s6 turn pair was the last draw-budget miss', () => {
    const stall = layerOf(6, 'ch5-raise-stall')
    expect(stall.mech).toBe('tabpiece')
    if (stall.mech === 'tabpiece') expect(stall.turnCull).toBe(true)
  })

  it('the OTHER tab piece stays uncalled: s5 goldpile is the spread\'s standing gold, not an instrument', () => {
    // The flag costs a pooled material and moves the piece into the transparent
    // pass, so it is opt-in per piece rather than per family. ch4-goldpile is
    // the mound the treasure "grows" as the spread blooms — it reads as scene,
    // and the s4->s5 pair already clears its budget without culling it.
    const goldpile = layerOf(5, 'ch4-goldpile')
    expect(goldpile.mech).toBe('tabpiece')
    if (goldpile.mech === 'tabpiece') expect(goldpile.turnCull ?? false).toBe(false)
  })
})
