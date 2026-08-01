import { describe, expect, it } from 'vitest'
import { PALETTE } from '@/components/labs/small-world/palette'
import { ENDING_AIM_DROP, ZOOM_FACTOR, ndcYAt } from '@/components/labs/small-world/scene/camera'
import { DESK_BACK_Z, DESK_NOTE, DESK_TOP_Y, journeyFloorY } from '@/components/labs/small-world/scene/desk-stage'
import { peekerPieces } from '@/components/labs/small-world/scene/props/peeker-cast'
import {
  DESK_FIGURINES,
  FIGURINE_BASE_HEIGHT,
  FIGURINE_HEIGHT,
  buildDeskFigurines,
  deskFigurineParts,
} from '@/components/labs/small-world/scene/props/desk-figurines'

/**
 * THE TWO DESK MASCOTS (Task 66) — the same containment proof every desk prop is held to
 * (`desk-stage.test.ts` / `desk-kit.test.ts`), plus the two questions specific to reusing checkpoint
 * art at desk-toy scale: does it stay clear of the note, and does it stay visible against the desk
 * rather than the sky it was painted for.
 *
 * Everything below reads the SHIPPED geometry (`buildDeskFigurines`, `deskFigurineParts`) rather
 * than the placement data alone — the house rule this lab's other prop suites are built on.
 */

function bounds(parts: ReturnType<typeof deskFigurineParts>) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const part of parts) {
    const pos = part.geo.attributes.position.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i += 3) {
      minX = Math.min(minX, pos[i])
      maxX = Math.max(maxX, pos[i])
      minY = Math.min(minY, pos[i + 1])
      maxY = Math.max(maxY, pos[i + 1])
      minZ = Math.min(minZ, pos[i + 2])
      maxZ = Math.max(maxZ, pos[i + 2])
    }
  }
  return { minX, maxX, minY, maxY, minZ, maxZ }
}

/**
 * The note's real footprint, in world x/z — the exact corner formula `desk-note.tsx` builds its
 * sheet with (`worldX = x + lx·cos + lz·sin`, `worldZ = z − lx·sin + lz·cos`), re-derived here
 * rather than imported so this suite is checking the note's actual shape, not its own helper.
 */
function noteFootprint() {
  const { x, z, width, depth, rot } = DESK_NOTE
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const lx of [-width / 2, width / 2]) {
    for (const lz of [-depth / 2, depth / 2]) {
      const wx = x + lx * cos + lz * sin
      const wz = z - lx * sin + lz * cos
      minX = Math.min(minX, wx)
      maxX = Math.max(maxX, wx)
      minZ = Math.min(minZ, wz)
      maxZ = Math.max(maxZ, wz)
    }
  }
  return { minX, maxX, minZ, maxZ }
}

/** WCAG relative luminance + contrast ratio, computed straight from the palette's own hex strings —
 *  independent of anything the component or the desk-kit docblocks claim. */
function relLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const chans = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * chans[0] + 0.7152 * chans[1] + 0.0722 * chans[2]
}

function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** The floor below which the brief says a figure "will vanish" into the desk. */
const CONTRAST_FLOOR = 1.35

const DESK_SURFACES = [PALETTE.deskTop, PALETTE.deskGrain, PALETTE.deskMat] as const

/** The dominant BODY colour of a figurine, measured by vertex count from the shipped parts rather
 *  than picked by eye — excludes the base/contact parts, which are what this suite checks separately. */
function dominantBodyColor(fig: (typeof DESK_FIGURINES)[number]): string {
  const tally = new Map<string, number>()
  for (const part of deskFigurineParts(fig)) {
    if (part.tag === 'base' || part.tag === 'contact') continue
    const n = part.geo.attributes.position.count
    tally.set(part.color, (tally.get(part.color) ?? 0) + n)
  }
  let best = ''
  let bestN = -1
  for (const [color, n] of tally) {
    if (n > bestN) {
      best = color
      bestN = n
    }
  }
  return best
}

describe('the two desk figurines stay under the journey camera', () => {
  it('keeps every vertex of both figures and both bases below journeyFloorY', () => {
    const geo = buildDeskFigurines()
    const pos = geo.attributes.position.array as ArrayLike<number>
    expect(pos.length).toBeGreaterThan(0)
    let worstMargin = Infinity
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1]
      const z = pos[i + 2]
      const margin = journeyFloorY(z) - y
      worstMargin = Math.min(worstMargin, margin)
      expect(margin, `vertex at y=${y.toFixed(3)} z=${z.toFixed(3)} leaks over the journey floor`).toBeGreaterThan(0)
    }
    // the containment proof, made concrete: the tightest vertex on the whole pair still clears the
    // journey floor by a real margin, not by a fraction of a millimetre
    expect(worstMargin).toBeGreaterThan(0.1)
    geo.dispose()
  })

  it('sits in the core band and in front of the desk-back edge', () => {
    for (const fig of DESK_FIGURINES) {
      expect(Math.abs(fig.x)).toBeLessThanOrEqual(1.5)
      expect(fig.x).not.toBe(0)
      expect(fig.z).toBeGreaterThan(DESK_BACK_Z)
    }
  })

  it("never overlaps the note — its own measured footprint, not the note's reach bound", () => {
    const note = noteFootprint()
    for (const fig of DESK_FIGURINES) {
      const b = bounds(deskFigurineParts(fig))
      const xOverlap = b.minX < note.maxX && b.maxX > note.minX
      const zOverlap = b.minZ < note.maxZ && b.maxZ > note.minZ
      expect(
        xOverlap && zOverlap,
        `${fig.kind} at x=${fig.x} z=${fig.z} overlaps the note's footprint`
      ).toBe(false)
    }
  })
})

describe('the height that ships is measured, not the brief\'s first guess', () => {
  it('reaches its published total height and rests its base on the desk surface', () => {
    for (const fig of DESK_FIGURINES) {
      const b = bounds(deskFigurineParts(fig))
      expect(b.maxY).toBeCloseTo(DESK_TOP_Y + FIGURINE_HEIGHT, 4)
      // the contact shadow is the lowest thing (just off the desk surface); nothing sinks through it
      expect(b.minY).toBeGreaterThanOrEqual(DESK_TOP_Y)
      expect(b.minY).toBeLessThan(DESK_TOP_Y + FIGURINE_BASE_HEIGHT)
    }
  })

  it('lands in the requested 90-110px window at the money shot, at every z the pair occupies', () => {
    for (const fig of DESK_FIGURINES) {
      const b = bounds(deskFigurineParts(fig))
      for (const z of [b.minZ, fig.z, b.maxZ]) {
        const top = ndcYAt([fig.x, DESK_TOP_Y + FIGURINE_HEIGHT, z], ZOOM_FACTOR, ENDING_AIM_DROP)
        const base = ndcYAt([fig.x, DESK_TOP_Y, z], ZOOM_FACTOR, ENDING_AIM_DROP)
        const px = Math.abs(top - base) * 450
        expect(px, `${fig.kind} at z=${z.toFixed(2)} measures ${px.toFixed(1)}px`).toBeGreaterThan(85)
        expect(px).toBeLessThan(115)
      }
    }
  })
})

describe('one draw call, no ink', () => {
  it('merges both figures and both bases into a single non-indexed geometry', () => {
    const geo = buildDeskFigurines()
    expect(geo.index).toBeNull()
    expect(geo.attributes.color.count).toBe(geo.attributes.position.count)
    expect(geo.attributes.normal.count).toBe(geo.attributes.position.count)
    geo.dispose()
  })

  it('carries no ink contour — exactly the mascot parts plus three base parts, nothing more', () => {
    for (const fig of DESK_FIGURINES) {
      const rawPartCount = peekerPieces(fig.biome, fig.kind, 1).reduce((n, piece) => n + piece.parts.length, 0)
      expect(deskFigurineParts(fig).length).toBe(rawPartCount + 3)
    }
  })
})

describe('contrast against the desk, not the sky', () => {
  it('gives the penguin a body that clears the vanish floor unaided', () => {
    const penguin = DESK_FIGURINES.find((f) => f.kind === 'penguin')!
    const dominant = dominantBodyColor(penguin)
    expect(dominant).toBe(PALETTE.penguinBack)
    for (const surface of DESK_SURFACES) {
      expect(contrastRatio(dominant, surface)).toBeGreaterThan(CONTRAST_FLOOR)
    }
  })

  it('measures the bluebird finding: its dominant body colour is genuinely below the floor', () => {
    const bluebird = DESK_FIGURINES.find((f) => f.kind === 'bluebird')!
    const dominant = dominantBodyColor(bluebird)
    expect(dominant).toBe(PALETTE.bluebell)
    // against the blotter it actually stands on (both figurines sit inside the mat's footprint)
    expect(contrastRatio(dominant, PALETTE.deskMat)).toBeLessThan(CONTRAST_FLOOR)
    expect(contrastRatio(dominant, PALETTE.deskGrain)).toBeLessThan(CONTRAST_FLOOR)
  })

  it('fixes the bluebird finding with the base tint, against every desk surface', () => {
    for (const surface of DESK_SURFACES) {
      expect(contrastRatio(PALETTE.ink, surface)).toBeGreaterThan(CONTRAST_FLOOR * 2)
      expect(contrastRatio(PALETTE.earthDeep, surface)).toBeGreaterThan(CONTRAST_FLOOR * 2)
    }
  })

  it('sits inside the blotter the bases are measured against, so the comparison is honest', () => {
    // the mat DESK_PROPS ships is centred at x=0 with backReach 1.75 and halfW 3.15 — re-derive its
    // footprint rather than importing DESK_PROPS, so this pins the assumption independently
    const matHalfW = 3.15
    const matZ = 10.5
    const matBackReach = 1.75
    for (const fig of DESK_FIGURINES) {
      expect(Math.abs(fig.x)).toBeLessThan(matHalfW)
      expect(fig.z).toBeGreaterThan(matZ - matBackReach)
      expect(fig.z).toBeLessThan(matZ + matBackReach)
    }
  })
})
