import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildStudioEquirect } from '@/components/labs/small-world/scene/studio-env'
import { PALETTE } from '@/components/labs/small-world/palette'

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

  /**
   * TWO GATES THAT USED TO STAND HERE ARE GONE, and their absence is the point.
   *
   * One asked for 20% of the sphere below half the median; one asked for a specific share of
   * directions in which rose gold rails. Both were priors of mine rather than anything derived from
   * the reference, and both failed the moment the room was corrected — which is the tell. Kept, they
   * would have pulled the room back toward the shape I had guessed at instead of toward the
   * approved render.
   *
   * What replaced them is where the question belongs. Clipping is judged per REGION on the shipped
   * capture (`task68-compare.mjs`, `CLIP_TOLERANCE`) against the approved render's own 4.2% on the
   * ring — a like-for-like number on the observable, rather than a statistic about a sphere the ring
   * only partly samples. This file keeps what is genuinely a property of the ROOM: a dark end well
   * below its middle in every channel, and a core well above it.
   */

  it('does not rail the SHIPPED tint across the room, only at the core', () => {
    // What survives of that pair, expressed against the thing it is actually about: rose gold rails
    // where the room's red exceeds 1/tint_red, and it must not do so across the general room. Read
    // off the shipped palette rather than a hardcoded 0.757, so desaturating the metal — which is
    // what brought its chroma back to the reference — is credited here instead of leaving this
    // measuring a colour the lab no longer uses. No LOWER bound: how much highlight the ring shows
    // is a property of the ring, and it is gated per-region on the capture.
    const tintR = new THREE.Color(PALETTE.standRoseGold).convertSRGBToLinear().r
    expect(all.filter((t) => t.r * tintR > 1).length / all.length).toBeLessThan(0.14)
  })

  it('keeps the pink cast of candidate B in the room rather than going neutral grey', () => {
    const lit = all.filter((t) => t.lum > median)
    const meanR = lit.reduce((s, t) => s + t.r, 0) / lit.length
    const meanB = lit.reduce((s, t) => s + t.b, 0) / lit.length
    expect(meanR).toBeGreaterThan(meanB)
    expect(meanR / meanB).toBeLessThan(1.35)
  })
})
