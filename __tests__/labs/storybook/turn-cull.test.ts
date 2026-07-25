import { describe, expect, it } from 'vitest'
import { TURN_CULL_RAMP, turnCullOpacity, turnCulled } from '@/components/labs/storybook/book/turn-cull'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// Batch C-3 turn-time culling of interaction-only pieces. The gate that matters
// is that the mechanism is VISUAL ONLY and never reaches a rest pose: a piece
// that vanished at rest, or a keep that vanished at all, would be a real bug.

describe('turnCullOpacity — the ramp window', () => {
  it('is fully opaque at rest (callers pass 0 when no turn is running)', () => {
    expect(turnCullOpacity(0)).toBe(1)
    expect(turnCulled(0)).toBe(false)
  })

  it('is fully opaque at both ends of the turn, so a landed spread is never dimmed', () => {
    expect(turnCullOpacity(1)).toBe(1)
    expect(turnCullOpacity(0.999999)).toBeCloseTo(1, 4)
  })

  it('fades out across the first ramp and is gone by its end', () => {
    expect(turnCullOpacity(TURN_CULL_RAMP / 2)).toBeCloseTo(0.5, 6)
    expect(turnCullOpacity(TURN_CULL_RAMP)).toBe(0)
    expect(turnCulled(TURN_CULL_RAMP)).toBe(true)
  })

  it('stays fully culled through the fast middle — the draw-call win', () => {
    for (const e of [0.15, 0.3, 0.5, 0.7, 0.85]) {
      expect(turnCullOpacity(e), `eased t=${e}`).toBe(0)
      expect(turnCulled(e)).toBe(true)
    }
  })

  it('ramps back over the last 15%, landing the return inside the settle beat', () => {
    expect(turnCullOpacity(1 - TURN_CULL_RAMP)).toBe(0)
    expect(turnCullOpacity(1 - TURN_CULL_RAMP / 2)).toBeCloseTo(0.5, 6)
  })

  it('is monotone down then up, so nothing flickers mid-ramp', () => {
    const steps = 200
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
