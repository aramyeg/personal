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

describe('the studio has RANGE in it', () => {
  const median = at(0.5)

  it('has a dark end well below its own middle', () => {
    // Ratios, not absolute floors, and that is a correction. The first gate here asked for a
    // minimum below linear 0.12, which a room CAN satisfy while still being wrong in either
    // direction: the original near-white room failed it, and the over-corrected room passed it and
    // rendered every metal 83% under the reference. What actually makes a metal read is the SPREAD
    // the room offers, and the approved render's own dark end is not dark in absolute terms — its
    // ring bottoms out around environment 0.58, a shaded white cyc rather than a black floor.
    expect(at(0.05) / median).toBeLessThan(0.45)
  })

  it('spends a real share of the sphere below half its middle', () => {
    // the original room: 0% below half the median, in every direction
    expect(lums.filter((l) => l < median * 0.5).length / lums.length).toBeGreaterThan(0.2)
  })

  it('lets EVERY channel fall well below its own middle, not just the average', () => {
    // the original room's red never dropped below 1.071 against a median of 1.721 — a ratio of
    // 0.62, so rose gold could not have a dark side even where luminance did fall
    for (const ch of ['r', 'g', 'b'] as const) {
      const vals = all.map((t) => t[ch]).sort((a, b) => a - b)
      const mid = vals[Math.round(0.5 * (vals.length - 1))]
      expect(vals[Math.round(0.05 * (vals.length - 1))] / mid).toBeLessThan(0.45)
    }
  })

  it('still carries a specular core well above its middle, so a highlight is a highlight', () => {
    expect(at(1) / median).toBeGreaterThan(2.5)
  })

  it('rails rose gold in only a small share of directions, so a metal is not mostly highlight', () => {
    // Measured as the thing that actually goes wrong rather than as a percentile. Clipping is
    // ABSOLUTE — rose gold's red channel is linear 0.757, so it rails wherever the room's red
    // exceeds 1/0.757 = 1.32 — and a ratio against the median cannot see that, because the median
    // here is dragged down by the room's dark half and "2.5x the median" catches the whole lit
    // ceiling rather than the specular core.
    //
    // The approved render's ring is 4.2% clipped: some, not none, and nowhere near the 36.8% the
    // near-white room produced.
    const rails = all.filter((t) => t.r > 1 / 0.757).length / all.length
    expect(rails).toBeGreaterThan(0.005)
    expect(rails).toBeLessThan(0.14)
  })

  it('keeps the pink cast of candidate B in the room rather than going neutral grey', () => {
    const lit = all.filter((t) => t.lum > median)
    const meanR = lit.reduce((s, t) => s + t.r, 0) / lit.length
    const meanB = lit.reduce((s, t) => s + t.b, 0) / lit.length
    expect(meanR).toBeGreaterThan(meanB)
    expect(meanR / meanB).toBeLessThan(1.35)
  })
})
