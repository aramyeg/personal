import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildStudioEquirect } from '@/components/labs/small-world/scene/studio-env'

/**
 * THE ROOM THE METAL REFLECTS (Task 68 review) — gated on the property whose absence shipped a glow.
 *
 * A metal at metalness 1 has no diffuse term. Every value on its surface is a sample of this
 * texture, so the surface can only be as dark as the darkest thing in the room. The first version
 * of this environment was built from candidate B's own near-white hexes with softbox gains ADDED on
 * top, and probing it found a minimum luminance of 0.897, a red channel that never fell below 1.071,
 * and ZERO texels below 0.5 — a room made entirely of light. The cradle ring came out as an emissive
 * tube: 36.8% of it railed at R ≥ 254 with 57% of the reference's value variation gone.
 *
 * Nothing downstream could have caught that. The frame bench measured the ring's MEAN luminance at
 * +1.6% — a pass — because a room with no dark end produces the right average and the wrong shape.
 * The defect is a property of this function, so this is where it is gated.
 */

/** Decode the half-float texels back to linear radiance. */
function texels(): { r: number; g: number; b: number; lum: number }[] {
  const tex = buildStudioEquirect()
  const data = tex.image.data as Uint16Array
  const out: { r: number; g: number; b: number; lum: number }[] = []
  for (let i = 0; i < data.length; i += 4) {
    const r = THREE.DataUtils.fromHalfFloat(data[i])
    const g = THREE.DataUtils.fromHalfFloat(data[i + 1])
    const b = THREE.DataUtils.fromHalfFloat(data[i + 2])
    out.push({ r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b })
  }
  tex.dispose()
  return out
}

const all = texels()
const lums = all.map((t) => t.lum).sort((a, b) => a - b)
const at = (q: number) => lums[Math.round(q * (lums.length - 1))]

describe('the studio has darkness in it', () => {
  it('reaches genuinely dark, not merely dimmer', () => {
    // the studio floor beyond the light pool — what the ring's underside reflects
    expect(at(0)).toBeLessThan(0.12)
  })

  it('spends a real share of the sphere below half, so a metal has somewhere dark to look', () => {
    const belowHalf = lums.filter((l) => l < 0.5).length / lums.length
    expect(belowHalf).toBeGreaterThan(0.35)
  })

  it('lets EVERY channel fall dark, not just the average', () => {
    // the previous room's red never dropped below 1.071 in any direction, so rose gold could not
    // have a dark side even where its luminance did fall
    expect(Math.min(...all.map((t) => t.r))).toBeLessThan(0.12)
    expect(Math.min(...all.map((t) => t.g))).toBeLessThan(0.12)
    expect(Math.min(...all.map((t) => t.b))).toBeLessThan(0.12)
  })

  it('still carries a specular core well over white, so a highlight is a highlight', () => {
    expect(at(1)).toBeGreaterThan(1.8)
  })

  it('has a range wide enough to model a curved surface', () => {
    // p05..p95 rather than the extremes: this is the band a torus's normals actually sweep
    expect(at(0.95) / Math.max(at(0.05), 1e-4)).toBeGreaterThan(8)
  })

  it('keeps the bright core to a small share of the sphere, so a metal is not mostly highlight', () => {
    expect(lums.filter((l) => l > 1.5).length / lums.length).toBeLessThan(0.06)
  })

  it('keeps the pink cast of candidate B in the room rather than going neutral grey', () => {
    // the lit half should still be warmer in red than in blue, which is what makes it B's studio
    const lit = all.filter((t) => t.lum > 0.25)
    const meanR = lit.reduce((s, t) => s + t.r, 0) / lit.length
    const meanB = lit.reduce((s, t) => s + t.b, 0) / lit.length
    expect(meanR).toBeGreaterThan(meanB)
    expect(meanR / meanB).toBeLessThan(1.35)
  })
})
