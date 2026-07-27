/**
 * SPREAD 5 REVEAL LEGIBILITY — "there is no reward state that beats the rest
 * state."
 *
 * A context-quarantined blind reader played chapter IV and wrote the sentence
 * this file exists to keep answered:
 *
 *   S5-10  "Operating both movers makes the picture worse. Both mechanisms
 *           resolve to the same visual: a flat gold rectangle lying on the deck.
 *           Work both and the spread loses both of its upright silhouettes and
 *           gains two blank gold placemats. There is no reward state that beats
 *           the rest state."
 *
 * The repaints that answer it are raster work, and the raster claims live in
 * scripts/storybook/bench/s5r2-art-gates.mjs where they can be measured in
 * pixels. What belongs HERE is everything a jsdom unit test can honestly hold:
 * the painters' declared geometry, the registration between the two faces of the
 * dissolve, and the byte-stability of what they emit.
 *
 *   L1  BAY RHYTHM. The venetian rack is sliced into six vertical slats at
 *       u = k/6 (popup-dissolve-layer's slatUvs). If an arch centre sat on one
 *       of those seams the reveal would ship with an arch cut in half down the
 *       middle at rest, so: the bay count is a multiple of the slat count, every
 *       seam lands on a PIER, and no arch centre comes near one.
 *   L2  THE ARCH IS AN ARCH. Its springing line is derived from its own opening
 *       width, never typed — the first bake of this face drew a 111px head rise
 *       over a 63px opening and the openings read as bullets.
 *   L3  REGISTRATION. The walkers stand at dissolveScene's own camel stations
 *       and are not shorter than the camel glyph they replace, because the
 *       reader has to see "this became that" at the same places. (An earlier
 *       reader met a smaller caravan on the closed face and called it "a flock
 *       of birds"; that scale is the floor, not the target.)
 *   L4  NO LETTERING. Written action labels near a trigger are out book-wide.
 *       No s5 piece may emit a letterform, and the painter module may not even
 *       carry the machinery to draw one.
 *   L5  THE CANVASES ARE UNTOUCHED. Both repaints had to land inside the meshes
 *       the mechanism already solves for.
 *   L6  DETERMINISM. Two calls of each s5 painter emit byte-identical SVG, which
 *       is what makes the bake golden-safe.
 *   L7  THE HOARD IS BANDED. Its value stops run monotonically down v with the
 *       ridge as the brightest — that is the whole of "reads as a lit crest over
 *       a shaded flank when it stands, and as a raking light across a drift when
 *       the reader pulls it flat".
 *
 * Every number below is READ from the painters' exported constants. Nothing here
 * is a station typed off a screenshot: a sample box typed by hand measures the
 * typist.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  S5_ARCADE,
  S5_DUNE_CAMEL,
  S5_HOARD,
  S5_PLATE,
  PIECES,
  dissolveScene,
  dissolveDunes,
  dissolveGold,
  goldHeap,
} from '../../../scripts/storybook/generate-art.mjs'

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'storybook', 'generate-art.mjs')
const SOURCE = readFileSync(SCRIPT_PATH, 'utf8')

type Piece = { id: string; seed: number; w: number; h: number }
const piece = (id: string): Piece => {
  const p = (PIECES as Piece[]).find((x) => x.id === id)
  if (!p) throw new Error(`no such piece in the bake registry: ${id}`)
  return p
}

const RACK = piece('ch4-dissolve-gold')
const DUNES = piece('ch4-dissolve-dunes')
const MOUND = piece('ch4-goldpile-face')

describe('L1 — the arcade\'s bays and the rack\'s slats agree', () => {
  it('cuts a whole number of bays per slat', () => {
    expect(S5_ARCADE.BAYS % S5_ARCADE.SLATS).toBe(0)
    expect(S5_ARCADE.BAYS).toBeGreaterThanOrEqual(S5_ARCADE.SLATS)
  })

  it('puts every slat seam down the middle of a pier', () => {
    const piers: number[] = S5_ARCADE.PIERS
    for (let k = 1; k < S5_ARCADE.SLATS; k++) {
      const seam = k / S5_ARCADE.SLATS
      const nearest = Math.min(...piers.map((u) => Math.abs(u - seam)))
      expect(nearest).toBeLessThan(1e-9)
    }
  })

  it('keeps every arch centre clear of every seam by half a bay', () => {
    const centres: number[] = S5_ARCADE.CENTRES
    const half = 0.5 / S5_ARCADE.BAYS
    for (const u of centres) {
      for (let k = 1; k < S5_ARCADE.SLATS; k++) {
        const seam = k / S5_ARCADE.SLATS
        // 0.98 of half a bay, not half a bay: this is a geometric identity, and
        // the slack is only for the float arithmetic that proves it.
        expect(Math.abs(u - seam)).toBeGreaterThan(half * 0.98)
      }
    }
  })

  it('leaves the slot plate its own station on both faces', () => {
    expect(S5_PLATE.U0 + S5_PLATE.W).toBeCloseTo(1, 10)
    // and the band R1 measures the openings in must fall clear of the springing
    // and of the sill, or it is measuring furniture
    expect(S5_ARCADE.SAMPLE_V0).toBeGreaterThan(S5_ARCADE.spring(RACK.w / RACK.h))
    expect(S5_ARCADE.SAMPLE_V1).toBeLessThan(S5_ARCADE.V_SILL)
  })
})

describe('L2 — the arch head is half its opening', () => {
  it('derives the springing from the bay, so the head is a round arch', () => {
    const aspect = RACK.w / RACK.h
    const spring = S5_ARCADE.spring(aspect)
    const riseV = spring - S5_ARCADE.V_CROWN
    const openingU = (1 - S5_ARCADE.PIER) / S5_ARCADE.BAYS
    // rise in canvas px == half the opening in canvas px
    expect(riseV * RACK.h).toBeCloseTo((openingU * RACK.w) / 2, 6)
  })

  it('stacks its stations in the order a building has them', () => {
    const spring = S5_ARCADE.spring(RACK.w / RACK.h)
    const order = [
      S5_ARCADE.V_CORNICE,
      S5_ARCADE.V_CROWN,
      spring,
      S5_ARCADE.V_SILL,
      S5_ARCADE.V_PLINTH,
    ]
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1])
  })
})

describe('L3 — the reveal registers on the closed face', () => {
  const dunesScene = dissolveScene(DUNES.w, DUNES.h, DUNES.seed)
  const goldScene = dissolveScene(RACK.w, RACK.h, RACK.seed)

  it('shares the landmark station across the two faces\' different seeds', () => {
    // The piece registry gives the two faces DIFFERENT seeds, so the crest
    // wobble genuinely differs between them; what the mechanism's "this became
    // that" hangs on is the landmark and the walking stations, and those are
    // seed-independent by construction. This test is what keeps them so.
    expect(goldScene.sun).toEqual(dunesScene.sun)
    expect(goldScene.camels.map((c: number[]) => c[0])).toEqual(dunesScene.camels.map((c: number[]) => c[0]))
  })

  it('stands a walker at each camel station, no shorter than the camel', () => {
    const need = S5_DUNE_CAMEL.SCALE * S5_DUNE_CAMEL.INK
    expect(S5_ARCADE.FIG_H).toBeGreaterThan(need)
    // the walkers must stand ON the paving and reach no higher than the band
    // the opening gates are read in, or the two measurements collide
    expect(S5_ARCADE.FIG_V).toBeGreaterThan(S5_ARCADE.V_PLINTH)
    expect(S5_ARCADE.FIG_V).toBeLessThanOrEqual(1)
    expect(S5_ARCADE.FIG_V - S5_ARCADE.FIG_H).toBeGreaterThan(S5_ARCADE.SAMPLE_V1)
  })

  it('keeps the walkers off the piers, so they read against lit openings', () => {
    const halfW = (S5_ARCADE.FIG_HALFW * S5_ARCADE.FIG_H * RACK.h) / RACK.w
    const pierHalf = (S5_ARCADE.PIER * 0.5) / S5_ARCADE.BAYS
    for (const [x] of goldScene.camels as number[][]) {
      const u = x / RACK.w
      const nearestPier = Math.min(...(S5_ARCADE.PIERS as number[]).map((p) => Math.abs(p - u)))
      expect(nearestPier).toBeGreaterThan(pierHalf)
      // and none of them may wander under the slot plate
      expect(u + halfW).toBeLessThan(S5_PLATE.U0)
    }
  })
})

describe('L4 — the book prints no action labels', () => {
  const faces: Array<[string, string]> = [
    ['ch4-dissolve-gold', dissolveGold(RACK.w, RACK.h, RACK.seed)],
    ['ch4-dissolve-dunes', dissolveDunes(DUNES.w, DUNES.h, DUNES.seed)],
    ['ch4-goldpile-face', goldHeap(MOUND.w, MOUND.h, MOUND.seed)],
  ]

  it.each(faces)('%s emits no text and no letterforms', (_id, svg) => {
    expect(svg).not.toMatch(/<text/i)
    expect(svg).not.toMatch(/>PULL</)
    expect(svg).not.toMatch(/PULL/)
    expect(svg).not.toMatch(/font-family/i)
  })

  it('has removed the letter machinery from the painter itself', () => {
    // Not merely "unused": present, it is one edit away from being re-engraved.
    expect(SOURCE).not.toMatch(/\bfunction\s+strokeWord\b/)
    expect(SOURCE).not.toMatch(/\bstrokeWord\s*\(/)
  })

  it('still paints the slot plate on BOTH dissolve faces, at one station', () => {
    // The plate is shared so it cannot flicker as the slats flip; if one face
    // ever loses it, the reader watches a brass band appear out of nothing.
    const gold = dissolveGold(RACK.w, RACK.h, RACK.seed)
    const dunes = dissolveDunes(DUNES.w, DUNES.h, DUNES.seed)
    const plateX = (RACK.w * S5_PLATE.U0).toFixed(1).replace(/\.0$/, '')
    for (const svg of [gold, dunes]) expect(svg).toContain(plateX)
  })
})

describe('L5 — the repaints stayed inside their meshes', () => {
  it('keeps the declared canvases', () => {
    expect([RACK.w, RACK.h]).toEqual([1024, 788])
    expect([DUNES.w, DUNES.h]).toEqual([1024, 788])
    expect([MOUND.w, MOUND.h]).toEqual([900, 900])
  })

  it('keeps the two dissolve faces at one aspect', () => {
    expect(RACK.w / RACK.h).toBeCloseTo(DUNES.w / DUNES.h, 10)
  })
})

describe('L6 — the painters are byte-stable', () => {
  const cases: Array<[string, () => string]> = [
    ['ch4-dissolve-gold', () => dissolveGold(RACK.w, RACK.h, RACK.seed)],
    ['ch4-dissolve-dunes', () => dissolveDunes(DUNES.w, DUNES.h, DUNES.seed)],
    ['ch4-goldpile-face', () => goldHeap(MOUND.w, MOUND.h, MOUND.seed)],
  ]

  it.each(cases)('%s emits identical SVG twice', (_id, paint) => {
    const a = paint()
    const b = paint()
    expect(a.length).toBeGreaterThan(2000)
    expect(a).toBe(b)
    expect(a).not.toMatch(/NaN|undefined|Infinity/)
  })
})

describe('L7 — the hoard is banded to its own folds', () => {
  it('runs its value stops monotonically down v', () => {
    const vs = (S5_HOARD.STOPS as Array<[number, string]>).map(([v]) => v)
    for (let i = 1; i < vs.length; i++) expect(vs[i]).toBeGreaterThan(vs[i - 1])
    expect(vs[0]).toBe(0)
    expect(vs[vs.length - 1]).toBe(1)
  })

  it('puts its brightest stop on the ridge and its darkest at the hinges', () => {
    const stops = S5_HOARD.STOPS as Array<[number, string]>
    const lum = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16)
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
    }
    const crest = stops.find(([v]) => v === S5_HOARD.V_CREST)
    expect(crest).toBeDefined()
    const crestL = lum(crest![1])
    for (const [v, hex] of stops) {
      if (v === S5_HOARD.V_CREST) continue
      expect(lum(hex)).toBeLessThan(crestL)
    }
    // and the two hinges, which lie on the deck, are the darkest of all
    const hinge = Math.max(lum(stops[0][1]), lum(stops[stops.length - 1][1]))
    for (const [v, hex] of stops) {
      if (v === 0 || v === 1) continue
      expect(lum(hex)).toBeGreaterThan(hinge)
    }
  })

  it('grades its coins bigger toward the spill than at the ridge', () => {
    expect(S5_HOARD.COIN_R_FOOT).toBeGreaterThan(S5_HOARD.COIN_R_CREST * 2)
  })

  it('keeps its named treasure clear of the ridge fold', () => {
    // A crown creased down the middle by the mound's own fold is not a crown.
    const pieces = S5_HOARD.PIECES as Record<string, number[]>
    for (const [name, [, v]] of Object.entries(pieces)) {
      expect(Math.abs(v - S5_HOARD.V_CREST), name).toBeGreaterThan(0.05)
    }
  })
})
