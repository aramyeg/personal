import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CARD_PAD,
  DRESS_MIN_SIZE_FRAC,
  DRESS_PHASE,
  DRESS_REACH,
  FACE_BOX,
  FIGURE_PHASE,
  MASCOT_BOX,
  NAV_PILL,
  PEEKER_CAST,
  PEEKER_DEPTH,
  PEEKER_MIN_SIZE_FRAC,
  PEEKER_PRESENCE_PEAK,
  PEEKER_SIZE_FRAC,
  PEEK_SIDE_STAGGER,
  WORLD_BOT,
  WORLD_MARGIN,
  WORLD_TOP,
  WORLD_U0,
  WORLD_U1,
  dataCardHeight,
  overlayBoxes,
  peekerAnchor,
  peekerCardClearance,
  peekerCastFor,
  peekerClock,
  peekerDepthMargin,
  peekerHalfHeight,
  peekerIdle,
  peekerPresence,
  peekerRollSpin,
  peekerUnroll,
  peekerWorldClearance,
  worldBlocked,
  type Side,
} from '@/components/labs/small-world/scene/props/peeker-stage'

/**
 * Task 56 — the checkpoint mascots' staging.
 *
 * The rework's promise to Aram is specific and testable: the characters are much bigger than the
 * R14 peekers, they are NEVER covered by the comic cards, and the planet is never covered by them.
 * Everything below gates one of those three, against MEASURED inputs rather than modelled ones.
 */

const FOV = 38
const CAMERA_DISTANCE = 12.1
/** The bake's terrain+prop ceiling budget: 1.35 x the planet's radius of 2.2. */
const CEILING = 2.97

/**
 * The comic cards' REAL boxes, read off the running lab with `getBoundingClientRect` by
 * `.superpowers/sdd/bench/task56-measure.mjs` at eleven device frames — each row the union over
 * all six chapters, because the data card's height is content-driven and the worst chapter is not
 * the same one at every width. `overlayBoxes` is checked against these: it may be conservative
 * (larger), never optimistic.
 */
const MEASURED_CARDS: {
  frame: string
  w: number
  h: number
  art: [number, number, number, number] | null
  data: [number, number, number, number]
}[] = [
  { frame: 'desktop-1920', w: 1920, h: 1080, art: [36, 135, 360, 600], data: [1524, 115, 1880, 619] },
  { frame: 'desktop-1600', w: 1600, h: 900, art: [36, 73, 360, 539], data: [1204, 54, 1560, 558] },
  { frame: 'desktop-1440', w: 1440, h: 900, art: [36, 73, 360, 539], data: [1044, 54, 1400, 558] },
  { frame: 'laptop-1280', w: 1280, h: 800, art: [36, 39, 360, 505], data: [884, 20, 1240, 524] },
  { frame: 'small-1024', w: 1024, h: 768, art: [31, 71, 296, 452], data: [697, -9, 992, 531] },
  { frame: 'tablet-912', w: 912, h: 1368, art: [28, 295, 264, 635], data: [618, 139, 887, 792] },
  { frame: 'tablet-820', w: 820, h: 1180, art: null, data: [232, 65, 588, 569] },
  { frame: 'tablet-768', w: 768, h: 1024, art: null, data: [206, 56, 562, 560] },
  { frame: 'narrow-575', w: 575, h: 760, art: null, data: [109, 40, 466, 544] },
  { frame: 'phone-414', w: 414, h: 896, art: null, data: [29, 48, 385, 552] },
  { frame: 'phone-390', w: 390, h: 844, art: null, data: [23, 45, 367, 549] },
]

/** A wider sweep than the measured set, for the placement invariants. */
const FRAMES: [number, number][] = [
  [2560, 1440], [1920, 1080], [1600, 900], [1512, 982], [1440, 900], [1366, 768], [1280, 800],
  [1180, 820], [1024, 768], [912, 1368], [900, 1200], [820, 1180], [768, 1024], [744, 1133],
  [640, 900], [575, 760], [430, 932], [414, 896], [390, 844], [360, 780], [320, 700],
]

const anchorAt = (w: number, h: number, side: Side) => {
  const halfH = peekerHalfHeight(FOV)
  return peekerAnchor(halfH, (halfH * w) / h, { width: w, height: h }, side)
}

describe('overlay keep-out model', () => {
  it('covers every measured card box, at every frame', () => {
    for (const row of MEASURED_CARDS) {
      const boxes = overlayBoxes({ width: row.w, height: row.h })
      const measured = [row.art, row.data].filter(Boolean) as [number, number, number, number][]
      expect(boxes.length, row.frame).toBe(measured.length)
      for (const m of measured) {
        // the modelled box that overlaps this measured one must CONTAIN it
        const box = boxes.find((b) => b.x0 < m[2] && b.x1 > m[0])
        expect(box, `${row.frame} has a model for ${m.join(',')}`).toBeDefined()
        expect(box!.x0, `${row.frame} x0`).toBeLessThanOrEqual(m[0] + 1)
        expect(box!.y0, `${row.frame} y0`).toBeLessThanOrEqual(m[1] + 1)
        expect(box!.x1, `${row.frame} x1`).toBeGreaterThanOrEqual(m[2] - 1)
        expect(box!.y1, `${row.frame} y1`).toBeGreaterThanOrEqual(m[3] - 1)
      }
    }
  })

  it('is not slack: the art card reproduces its measurement to the pixel', () => {
    // The art card's box is pure CSS with no content in it, so the model should be exact — this
    // is what proves the derivation is right rather than merely padded until the test passed.
    for (const row of MEASURED_CARDS) {
      if (!row.art) continue
      const art = overlayBoxes({ width: row.w, height: row.h })[0]
      expect(Math.abs(art.x0 - row.art[0]), row.frame).toBeLessThan(1)
      expect(Math.abs(art.y0 - row.art[1]), row.frame).toBeLessThan(1)
      expect(Math.abs(art.x1 - row.art[2]), row.frame).toBeLessThan(1)
      expect(Math.abs(art.y1 - row.art[3]), row.frame).toBeLessThan(1)
    }
  })

  it('never over-estimates the data card by more than a card-height', () => {
    // Conservative is safe; wildly conservative would quietly shrink every mascot.
    for (const row of MEASURED_CARDS) {
      const boxes = overlayBoxes({ width: row.w, height: row.h })
      const data = boxes[boxes.length - 1]
      const measuredH = row.data[3] - row.data[1]
      expect(data.y1 - data.y0, row.frame).toBeLessThan(measuredH * 1.35)
    }
  })

  it('the data-card height model grows as the card narrows', () => {
    expect(dataCardHeight(340)).toBe(492)
    expect(dataCardHeight(276)).toBeGreaterThan(dataCardHeight(340))
    expect(dataCardHeight(246)).toBeGreaterThan(dataCardHeight(276))
  })

  it('hides the art card exactly where the panel CSS does', () => {
    expect(overlayBoxes({ width: 901, height: 800 })).toHaveLength(2)
    expect(overlayBoxes({ width: 900, height: 800 })).toHaveLength(1)
  })
})

describe('the world silhouette table', () => {
  it('is the measured profile, not a circle', () => {
    expect(WORLD_TOP).toHaveLength(WORLD_BOT.length)
    // the world reaches higher than it does low — the girl and the trees stand on top of it
    expect(Math.max(...WORLD_TOP)).toBeGreaterThan(-Math.min(...WORLD_BOT))
    // and it is nowhere near a sphere of radius 2.2, whose NDC radius would be 0.537
    expect(Math.max(...WORLD_TOP)).toBeGreaterThan(0.75)
  })

  it('leaves the frame corners empty', () => {
    // beyond the world's own span the table must report nothing blocked, or the corners could
    // never hold a composition at all
    expect(worldBlocked(-0.88, -0.8)).toBeNull()
    expect(worldBlocked(0.8, 0.88)).toBeNull()
    expect(worldBlocked(WORLD_U0 - 1, WORLD_U0 - 0.5)).toBeNull()
  })

  it('adds its margin on both sides', () => {
    const b = worldBlocked(-0.1, 0.1)!
    expect(b.top).toBeCloseTo(Math.max(...WORLD_TOP.slice(13, 20)) + WORLD_MARGIN, 3)
    expect(b.bot).toBeLessThan(Math.min(...WORLD_BOT.slice(13, 20)) + 0.0001)
  })

  it('is conservative across a column: a wide column blocks at least as much as a narrow one', () => {
    const narrow = worldBlocked(-0.3, -0.25)!
    const wide = worldBlocked(-0.6, -0.1)!
    expect(wide.top).toBeGreaterThanOrEqual(narrow.top - 1e-9)
    expect(wide.bot).toBeLessThanOrEqual(narrow.bot + 1e-9)
  })
})

describe('placement', () => {
  it('never lets a character overlap a card or the navigation pill', () => {
    for (const [w, h] of FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = anchorAt(w, h, side)
        if (!a.visible || a.mode !== 'pair') continue
        const gap = peekerCardClearance({ width: w, height: h }, FOV, side)
        expect(gap, `${w}x${h} side ${side}`).toBeGreaterThanOrEqual(CARD_PAD - 0.5)
      }
    }
  })

  it('never lets any part of a composition be eaten by the world', () => {
    for (const [w, h] of FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = anchorAt(w, h, side)
        if (!a.visible) continue
        expect(peekerWorldClearance({ width: w, height: h }, FOV, side), `${w}x${h} side ${side}`)
          .toBeGreaterThanOrEqual(-1e-6)
      }
    }
  })

  it('keeps the whole FACE on screen, and lets the body crop', () => {
    for (const [w, h] of FRAMES) {
      const halfH = peekerHalfHeight(FOV)
      const halfW = (halfH * w) / h
      for (const side of [-1, 1] as const) {
        const a = anchorAt(w, h, side)
        if (!a.visible || a.mode !== 'pair') continue
        const faceOuter = a.x + side * FACE_BOX.out * a.size
        const faceTop = a.y + FACE_BOX.up * a.size
        const faceBottom = a.y - FACE_BOX.down * a.size
        expect(Math.abs(faceOuter), `${w}x${h} face x`).toBeLessThanOrEqual(halfW + 1e-6)
        expect(faceTop, `${w}x${h} face top`).toBeLessThanOrEqual(halfH + 1e-6)
        expect(faceBottom, `${w}x${h} face bottom`).toBeGreaterThanOrEqual(-halfH - 1e-6)
      }
    }
  })

  it('is 2-3x the area of the R14 peekers on a desktop frame', () => {
    // R14 sized every figure at PEEKER_SIZE_FRAC 0.36 of the half-height and the figure occupied
    // roughly one figure-height; this rework caps at 0.46 with a 1.8-figure-height character.
    const a = anchorAt(1600, 900, -1)
    const halfH = peekerHalfHeight(FOV)
    const heightNow = ((MASCOT_BOX.up + MASCOT_BOX.down) * a.size) / halfH
    const heightR14 = 0.36
    const areaRatio = (heightNow / heightR14) ** 2
    expect(areaRatio).toBeGreaterThan(2)
    expect(areaRatio).toBeLessThan(4.5)
  })

  it('shrinks rather than overlapping, and falls back to dressing before it smears', () => {
    // A portrait frame has the world filling its width; the honest outcome is a smaller
    // composition, and below the character floor, dressing alone.
    const desktop = anchorAt(1600, 900, -1)
    const phone = anchorAt(390, 844, -1)
    expect(desktop.mode).toBe('pair')
    expect(phone.mode).toBe('dressing')
    expect(phone.size).toBeLessThan(desktop.size)
    const halfH = peekerHalfHeight(FOV)
    expect(phone.size / halfH).toBeGreaterThanOrEqual(DRESS_MIN_SIZE_FRAC - 1e-9)
    expect(phone.size / halfH).toBeLessThan(PEEKER_MIN_SIZE_FRAC)
  })

  it('shows a character on every landscape frame in the sweep', () => {
    for (const [w, h] of FRAMES) {
      if (w < h) continue
      for (const side of [-1, 1] as const) {
        expect(anchorAt(w, h, side).mode, `${w}x${h} side ${side}`).toBe('pair')
      }
    }
  })

  it('never exceeds its size cap, and re-derives from the live frustum', () => {
    const halfH = peekerHalfHeight(FOV)
    for (const [w, h] of FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = anchorAt(w, h, side)
        expect(a.size / halfH, `${w}x${h}`).toBeLessThanOrEqual(PEEKER_SIZE_FRAC + 1e-9)
      }
    }
    // The composition sits a fixed number of figure-heights inside the frustum's own edge, so a
    // wider frame puts it further out in world units rather than stranding it mid-frame.
    const wide = anchorAt(2560, 1080, -1)
    const narrow = anchorAt(1280, 1080, -1)
    expect(Math.abs(wide.x)).toBeGreaterThan(Math.abs(narrow.x))
    // ...and the same viewport always resolves to the same staging.
    expect(anchorAt(1600, 900, -1)).toEqual(anchorAt(1600, 900, -1))
  })

  it('hides its composition off the edge it is anchored to', () => {
    for (const [w, h] of FRAMES) {
      for (const side of [-1, 1] as const) {
        const a = anchorAt(w, h, side)
        if (!a.visible) continue
        expect(Math.sign(a.hiddenY), `${w}x${h}`).toBe(a.vdir)
        expect(Math.abs(a.hiddenY)).toBeGreaterThan(Math.abs(a.y))
      }
    }
  })
})

describe('the planet is never covered', () => {
  it('keeps every mascot fragment behind the terrain ceiling, at every frame', () => {
    for (const [w, h] of FRAMES) {
      const margin = peekerDepthMargin({ width: w, height: h }, FOV, CAMERA_DISTANCE, CEILING)
      expect(margin, `${w}x${h}`).toBeGreaterThan(1)
    }
  })

  it('rests on the depth buffer, not on placement', () => {
    // The guarantee is structural: even a composition placed at the frame's centre could not draw
    // over the world, because its whole depth range sits behind the ceiling budget.
    const deepest = PEEKER_DEPTH - 0.42 * PEEKER_SIZE_FRAC * peekerHalfHeight(FOV)
    expect(deepest).toBeGreaterThan(CAMERA_DISTANCE + CEILING)
  })

  it('trips if the camera constants drift out from under it', () => {
    // peeker-stage.ts is written against scene.tsx's camera; if that changes, every clearance
    // number above is measuring the wrong frustum.
    const scene = readFileSync(
      join(process.cwd(), 'components/labs/small-world/scene/scene.tsx'),
      'utf8'
    )
    expect(scene).toContain('const CAMERA_FOV = 38')
    expect(scene).toContain('const CAMERA_DISTANCE = 12.1')
    // ...and the mascots must stay a SIBLING of the planet, never a child, or they would inherit
    // the world's spin and the camera-space staging would come apart.
    expect(scene).toMatch(/<CheckpointPeekers[^>]*\/>\s*<\/>/)
  })
})

describe('the arrival clock', () => {
  const reveal = (chapter: number, t: number) => ({ panel: null, reveal: { chapter, t, phase: 'in' as const } })

  it('prefers Task 54s reveal clock', () => {
    expect(peekerClock(reveal(2, 0.4), 2)).toBe(0.4)
    expect(peekerClock(reveal(2, 0.4), 3)).toBeNull()
  })

  it('falls back to the panel dwell when no clock is supplied', () => {
    expect(peekerClock({ panel: { chapter: 1, t: 0.5 }, reveal: null }, 1)).toBe(1)
    expect(peekerClock({ panel: { chapter: 1, t: 0 }, reveal: null }, 1)).toBe(0)
    expect(peekerClock({ panel: { chapter: 1, t: 1 }, reveal: null }, 1)).toBe(0)
    expect(peekerClock({ panel: { chapter: 1, t: 0.5 }, reveal: null }, 2)).toBeNull()
    expect(peekerClock({ panel: null, reveal: null }, 1)).toBeNull()
  })

  it('is monotone through the fallback rise and fall', () => {
    const at = (t: number) => peekerClock({ panel: { chapter: 0, t }, reveal: null }, 0)!
    for (let t = 0.06; t < 0.36; t += 0.02) expect(at(t + 0.02)).toBeGreaterThanOrEqual(at(t))
    for (let t = 0.84; t < 0.98; t += 0.02) expect(at(t + 0.02)).toBeLessThanOrEqual(at(t))
  })

  it('lands the dressing before the characters', () => {
    expect(DRESS_PHASE[0]).toBeLessThan(FIGURE_PHASE[0])
    expect(peekerPresence(0.4, DRESS_PHASE)).toBeGreaterThan(peekerPresence(0.4, FIGURE_PHASE))
  })

  it('starts at nothing, overshoots, and settles at exactly 1', () => {
    expect(peekerPresence(0, FIGURE_PHASE)).toBeCloseTo(0, 12)
    expect(peekerPresence(FIGURE_PHASE[0], FIGURE_PHASE)).toBeCloseTo(0, 12)
    expect(peekerPresence(1, FIGURE_PHASE)).toBeCloseTo(1, 9)
    const peak = Math.max(
      ...Array.from({ length: 200 }, (_, i) => peekerPresence(i / 199, FIGURE_PHASE))
    )
    expect(peak).toBeCloseTo(PEEKER_PRESENCE_PEAK, 2)
  })

  it('has no overshoot under reduced motion', () => {
    for (let t = 0; t <= 1; t += 0.02) {
      expect(peekerPresence(t, FIGURE_PHASE, true)).toBeLessThanOrEqual(1 + 1e-9)
    }
    expect(peekerPresence(1, FIGURE_PHASE, true)).toBeCloseTo(1, 9)
  })

  it('staggers the right-hand side without ever leaving it mid-entrance at t=1', () => {
    // Both sides must be fully in by the time the clock parks, or the trailing figure would still
    // be sliding when the reader has already started reading.
    expect(PEEK_SIDE_STAGGER).toBeGreaterThan(0)
    expect(peekerPresence(1, FIGURE_PHASE, false, PEEK_SIDE_STAGGER)).toBeCloseTo(1, 6)
    expect(peekerPresence(1, DRESS_PHASE, false, PEEK_SIDE_STAGGER)).toBeCloseTo(1, 6)
    expect(peekerPresence(0.5, FIGURE_PHASE, false, PEEK_SIDE_STAGGER)).toBeLessThan(
      peekerPresence(0.5, FIGURE_PHASE)
    )
  })

  it('retracts along the same path it arrived on', () => {
    // The clock walks back down on the way out, so an exit is the entrance replayed backwards —
    // there is no separate exit window to drift out of sync.
    for (const t of [0.5, 0.62, 0.74, 0.88]) {
      expect(peekerPresence(t, FIGURE_PHASE)).toBe(peekerPresence(t, FIGURE_PHASE))
    }
  })
})

describe('idle', () => {
  it('is a pure function of the scroll dwell, with no clock in it', () => {
    expect(peekerIdle(0.25, 4, 0)).toBeCloseTo(peekerIdle(0.25, 4, 0), 12)
    expect(peekerIdle(0, 4, 0)).toBe(0)
    for (let t = 0; t <= 1; t += 0.05) expect(Math.abs(peekerIdle(t, 3, 0.2))).toBeLessThanOrEqual(1)
  })

  it('unrolls a pangolin only after it has parked, and unwinds its spin to exactly zero', () => {
    expect(peekerUnroll(0.5)).toBe(0)
    expect(peekerUnroll(1)).toBe(1)
    expect(peekerRollSpin(1)).toBe(0)
    expect(peekerRollSpin(0)).toBeGreaterThan(0)
  })
})

describe('the cast', () => {
  it('gives every chapter a biome and two different characters', () => {
    expect(PEEKER_CAST).toHaveLength(6)
    for (const pair of PEEKER_CAST) {
      expect(pair.left).not.toBe(pair.right)
    }
    expect(new Set(PEEKER_CAST.map((p) => p.biome)).size).toBe(6)
  })

  it('maps chapters in journey order and nothing beyond', () => {
    expect(peekerCastFor(0)?.biome).toBe('spring')
    expect(peekerCastFor(5)?.biome).toBe('winter')
    expect(peekerCastFor(6)).toBeNull()
    expect(peekerCastFor(-1)).toBeNull()
  })

  it('keeps the dressing envelope wider than the character it frames', () => {
    expect(DRESS_REACH.out).toBeGreaterThan(MASCOT_BOX.out)
    expect(DRESS_REACH.in).toBeGreaterThan(MASCOT_BOX.in)
    expect(FACE_BOX.out).toBeLessThan(MASCOT_BOX.out)
    expect(FACE_BOX.up).toBeLessThanOrEqual(MASCOT_BOX.up)
  })

  it('keeps the navigation pill in the keep-out set', () => {
    expect(NAV_PILL.x1).toBeGreaterThan(NAV_PILL.x0)
    expect(NAV_PILL.y1).toBeGreaterThan(NAV_PILL.y0)
  })
})
