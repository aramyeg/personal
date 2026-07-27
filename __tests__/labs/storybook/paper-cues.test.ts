/**
 * THE PAPER-CUE VOCABULARY (E3 affordance language) — the gate.
 *
 * The user's law (2026-07-26): "written action labels near triggers ('bluntly
 * written') are OUT. Triggers must read through PAPER language: shadow,
 * elevation, a visible cut or glue line, subtle arrows (the chapter-4/s5
 * ember-arrow style is the approved reference — 'subtle and understandable')."
 *
 * scripts/storybook/generate-art.mjs answers that with three marks — cutShadow,
 * raisedEdgeShadow, cueArrow — that per-spread art passes call where their
 * transitional LIFT/HOIST/SPIN/SEND/TURN/STIR plates used to sit. This file
 * holds the four properties that make them safe to adopt:
 *
 *  1. DETERMINISM. The bake is golden-safe; a cue that wobbled between bakes
 *     would poison every piece that adopted it.
 *  2. WELL-FORMEDNESS. Fragments parse, and no NaN/undefined ever reaches a
 *     coordinate — even from a hostile call site.
 *  3. ONE LIGHT. A cut shadow and a contact pool on the same spread throw the
 *     same way, and that way is the book's own key light (shadow-light.ts).
 *  4. SUBTLETY. The ceilings in CUE_LIMITS bind, so a call site cannot turn a
 *     printed cue into a UI badge without editing the ceilings in the open.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { CAST_X, CAST_Z, THROW_PER_HEIGHT } from '@/components/labs/storybook/book/shadow-light'
import {
  CUE_LIGHT,
  CUE_LIMITS,
  CUE_THROW,
  cueArrow,
  cutShadow,
  raisedEdgeShadow,
} from '../../../scripts/storybook/generate-art.mjs'

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'storybook', 'generate-art.mjs')

// ---------------------------------------------------------------- extraction
// Every assertion below reads NUMBERS out of the fragment rather than matching
// substrings: a cue is geometry, and a string compare would pass on a mark
// that points the wrong way.

const OUTLINE = 'M 60 60 L 260 60 L 260 160 L 60 160 Z'

type Offset = { dx: number; dy: number }

function translates(frag: string): Offset[] {
  const out: Offset[] = []
  for (const m of frag.matchAll(/translate\((-?[\d.]+) (-?[\d.]+)\)/g)) {
    out.push({ dx: Number(m[1]), dy: Number(m[2]) })
  }
  return out
}

function opacities(frag: string): number[] {
  return [...frag.matchAll(/(?:^|[\s-])(?:fill-|stroke-)?opacity="([\d.]+)"/g)].map((m) =>
    Number(m[1])
  )
}

function strokeWidths(frag: string): number[] {
  return [...frag.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]))
}

/** Every coordinate pair in every path `d` of the fragment. */
function pathPoints(frag: string): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (const m of frag.matchAll(/ d="([^"]+)"/g)) {
    const nums = (m[1].match(/-?[\d.]+/g) ?? []).map(Number)
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
  }
  return pts
}

/** Alpha of N marks composited over one another — what the eye actually gets
 *  from a stacked penumbra. */
function composite(alphas: readonly number[]): number {
  return 1 - alphas.reduce((acc, a) => acc * (1 - a), 1)
}

const dot = (o: Offset): number => o.dx * CUE_LIGHT.x + o.dy * CUE_LIGHT.y
const mag = (o: Offset): number => Math.hypot(o.dx, o.dy)

function parses(frag: string): boolean {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">${frag}</svg>`,
    'image/svg+xml'
  )
  return doc.querySelector('parsererror') === null
}

// ------------------------------------------------------------------- the gate

describe('paper-cue vocabulary — determinism', () => {
  it('each cue is byte-identical across repeated calls, and holds no state', () => {
    const cutA = cutShadow(40, 120, 300, 140, { spread: 5 })
    const raisedA = raisedEdgeShadow(OUTLINE, { lift: 6 })
    const arrowA = cueArrow(180, 120, 56, { dir: -35 })
    const chevA = cueArrow(180, 120, 56, { variant: 'chevrons', count: 4 })

    // interleave other calls: a helper that cached or accumulated would drift
    cueArrow(0, 0, 9, { dir: 77 })
    cutShadow(1, 2, 3, 4, {})
    raisedEdgeShadow(OUTLINE, { lift: 99, part: 'lip' })

    expect(cutShadow(40, 120, 300, 140, { spread: 5 })).toBe(cutA)
    expect(raisedEdgeShadow(OUTLINE, { lift: 6 })).toBe(raisedA)
    expect(cueArrow(180, 120, 56, { dir: -35 })).toBe(arrowA)
    expect(cueArrow(180, 120, 56, { variant: 'chevrons', count: 4 })).toBe(chevA)
  })

  it('the cues use no PRNG: defaults are stable without a seed argument', () => {
    // Nothing in the three signatures takes a seed, so this is a structural
    // statement — but it is the property the bake depends on, so it is stated.
    const runs = new Set(
      Array.from({ length: 8 }, () => cueArrow(100, 100, 40, {}) + cutShadow(0, 0, 50, 50, {}))
    )
    expect(runs.size).toBe(1)
  })
})

describe('paper-cue vocabulary — well-formed fragments', () => {
  const cases: Array<[string, string]> = [
    ['cutShadow', cutShadow(30, 40, 300, 90, { spread: 4 })],
    ['cutShadow (path form)', cutShadow(30, 40, 300, 90, { d: 'M 30 40 Q 150 10 300 90' })],
    ['raisedEdgeShadow (pool)', raisedEdgeShadow(OUTLINE, { lift: 5, part: 'pool' })],
    ['raisedEdgeShadow (lip)', raisedEdgeShadow(OUTLINE, { lift: 5, part: 'lip' })],
    ['raisedEdgeShadow (both)', raisedEdgeShadow(OUTLINE, { lift: 5 })],
    ['cueArrow', cueArrow(200, 200, 60, { dir: 20 })],
    ['cueArrow (chevrons)', cueArrow(200, 200, 60, { variant: 'chevrons', count: 5 })],
  ]

  for (const [name, frag] of cases) {
    it(`${name} parses and leaks no NaN/undefined`, () => {
      expect(frag.length).toBeGreaterThan(0)
      expect(frag).not.toContain('NaN')
      expect(frag).not.toContain('undefined')
      expect(parses(frag)).toBe(true)
    })
  }

  it('hostile inputs still produce clean coordinates', () => {
    const hostile = [
      cutShadow(Number.NaN, undefined as unknown as number, 90, 10, {
        spread: Number.NaN,
        strength: Number.NaN,
      }),
      raisedEdgeShadow(OUTLINE, { lift: Number.NaN, steps: Number.NaN, light: { x: 0, y: 0 } }),
      cueArrow(Number.NaN, 10, Number.NaN, { dir: Number.NaN, weight: Number.NaN }),
      cueArrow(10, 10, 30, { variant: 'chevrons', count: Number.NaN }),
    ]
    for (const frag of hostile) {
      expect(frag).not.toContain('NaN')
      expect(frag).not.toContain('undefined')
      expect(parses(frag)).toBe(true)
    }
    // An empty outline is a no-op, not a broken fragment.
    expect(raisedEdgeShadow('', { lift: 3 })).toBe('')
  })
})

describe('paper-cue vocabulary — one light', () => {
  it('mirrors shadow-light.ts rather than inventing a lamp', () => {
    // The bake script cannot import the TS module, so the numbers are mirrored.
    // This is the assertion that keeps the mirror honest.
    expect(CUE_LIGHT.x).toBeCloseTo(CAST_X, 12)
    expect(CUE_LIGHT.y).toBeCloseTo(CAST_Z, 12)
    expect(CUE_THROW).toBe(THROW_PER_HEIGHT)
  })

  it('a cut and a raised edge at the same place throw the same way', () => {
    // Same location, generous scale so the 1-decimal coordinate rounding is
    // negligible against the direction being measured.
    const cut = translates(cutShadow(60, 160, 260, 160, { spread: 30 }))
    const raised = translates(raisedEdgeShadow(OUTLINE, { lift: 50, part: 'pool' }))

    const shadowSide = [...cut, ...raised].filter((o) => dot(o) > 0)
    const litSide = [...cut, ...raised].filter((o) => dot(o) < 0)

    expect(shadowSide.length).toBeGreaterThanOrEqual(2 * 5)
    expect(litSide.length).toBeGreaterThanOrEqual(1)

    // Every penumbra/pool step points down-light, along the SAME unit vector.
    for (const o of shadowSide) {
      expect(o.dx / mag(o)).toBeCloseTo(CUE_LIGHT.x, 2)
      expect(o.dy / mag(o)).toBeCloseTo(CUE_LIGHT.y, 2)
    }
    // The lit lip sits on the other side of the line, in both helpers.
    for (const o of litSide) {
      expect(o.dx / mag(o)).toBeCloseTo(-CUE_LIGHT.x, 2)
      expect(o.dy / mag(o)).toBeCloseTo(-CUE_LIGHT.y, 2)
    }
    expect(translates(cutShadow(60, 160, 260, 160, { spread: 30 })).some((o) => dot(o) < 0)).toBe(
      true
    )
    expect(
      translates(raisedEdgeShadow(OUTLINE, { lift: 50, part: 'lip' })).every((o) => dot(o) < 0)
    ).toBe(true)
  })

  it('a rotated texture may rotate the light, and only that', () => {
    // The s5 tongue's image axes are rotated against the page; passing its own
    // light must move the penumbra with it, not soften or brighten it.
    const turned = translates(
      cutShadow(60, 160, 260, 160, { spread: 30, light: { x: -CUE_LIGHT.y, y: CUE_LIGHT.x } })
    )
    const straight = translates(cutShadow(60, 160, 260, 160, { spread: 30 }))
    expect(turned.length).toBe(straight.length)
    for (let i = 0; i < turned.length; i++) {
      expect(mag(turned[i])).toBeCloseTo(mag(straight[i]), 1)
    }
    expect(turned.some((o) => Math.abs(dot(o)) > 0.2)).toBe(false)
  })

  it('a raised edge throws further the higher it stands', () => {
    const low = translates(raisedEdgeShadow(OUTLINE, { lift: 4, part: 'pool' }))
    const high = translates(raisedEdgeShadow(OUTLINE, { lift: 20, part: 'pool' }))
    expect(Math.max(...high.map(mag))).toBeGreaterThan(Math.max(...low.map(mag)))
    // and it throws by lift * cot(elevation), the shared physics
    expect(Math.max(...high.map(mag))).toBeCloseTo(20 * CUE_THROW, 1)
  })
})

describe('cueArrow — direction and bounds', () => {
  it('honours dir: 0 and 180 are mirrored, not identical', () => {
    const east = cueArrow(200, 200, 60, { dir: 0 })
    const west = cueArrow(200, 200, 60, { dir: 180 })
    expect(east).not.toBe(west)

    const key = (pts: Array<[number, number]>) =>
      pts
        .map(([px, py]) => `${px.toFixed(0)},${py.toFixed(0)}`)
        .sort()
        .join('|')
    // Rotating by 180 reflects every vertex through the arrow's centre.
    const reflected = pathPoints(east).map(
      ([px, py]) => [400 - px, 400 - py] as [number, number]
    )
    // guard: an empty point set would make the comparison below vacuous
    expect(reflected.length).toBeGreaterThanOrEqual(7)
    expect(pathPoints(west).length).toBe(reflected.length)
    expect(key(reflected)).toBe(key(pathPoints(west)))
  })

  it('points where it is told, at any angle', () => {
    for (const dir of [-90, -35, 0, 45, 120, 180, 265]) {
      const pts = pathPoints(cueArrow(200, 200, 60, { dir }))
      expect(pts.length).toBeGreaterThan(0)
      // The tip is the vertex furthest from centre along the direction axis.
      const ux = Math.cos((dir * Math.PI) / 180)
      const uy = Math.sin((dir * Math.PI) / 180)
      const along = pts.map(([px, py]) => (px - 200) * ux + (py - 200) * uy)
      expect(Math.max(...along)).toBeGreaterThan(0.3 * 60)
    }
  })

  it('stays inside its declared box, stroke included, at every angle', () => {
    for (const variant of ['arrow', 'chevrons'] as const) {
      for (const dir of [-90, -20, 0, 33, 90, 150, 200, 315]) {
        const size = 64
        const frag = cueArrow(200, 200, size, { dir, variant, count: 5, weight: 4 })
        const halfStroke = Math.max(...strokeWidths(frag)) / 2
        const pts = pathPoints(frag)
        expect(pts.length).toBeGreaterThan(0)
        for (const [px, py] of pts) {
          expect(Math.hypot(px - 200, py - 200) + halfStroke).toBeLessThanOrEqual(size / 2 + 0.1)
        }
      }
    }
  })
})

describe('paper-cue vocabulary — subtlety ceilings', () => {
  // A cue that a call site can crank is a UI badge waiting to happen. These
  // bounds are what "printed ornament" means numerically.
  const loud = [
    cutShadow(20, 20, 200, 20, { spread: 8, strength: 50, hair: 500 }),
    raisedEdgeShadow(OUTLINE, { lift: 12, strength: 50 }),
    cueArrow(200, 200, 60, { opacity: 9, weight: 60 }),
    cueArrow(200, 200, 60, { variant: 'chevrons', opacity: 9, weight: 60 }),
  ]

  it('no single mark exceeds CUE_LIMITS.opacity, however loud the call site', () => {
    expect(CUE_LIMITS.opacity).toBeLessThanOrEqual(0.5)
    for (const frag of loud) {
      const alphas = opacities(frag)
      expect(alphas.length).toBeGreaterThan(0)
      for (const a of alphas) expect(a).toBeLessThanOrEqual(CUE_LIMITS.opacity)
    }
  })

  it('a stacked pool still composites under the ceiling at the contact line', () => {
    const pool = opacities(raisedEdgeShadow(OUTLINE, { lift: 12, strength: 50, part: 'pool' }))
    expect(pool.length).toBeGreaterThan(1)
    expect(composite(pool)).toBeLessThanOrEqual(CUE_LIMITS.opacity)
  })

  it('cut strokes stay under the hairline and penumbra ceilings', () => {
    const spread = 8
    const widths = strokeWidths(cutShadow(20, 20, 200, 20, { spread, strength: 50, hair: 500 }))
    for (const w of widths) expect(w).toBeLessThanOrEqual(spread * CUE_LIMITS.penumbra + 0.05)
    // the cut line itself is the thin one
    expect(Math.min(...widths)).toBeLessThanOrEqual(spread * CUE_LIMITS.cutHair + 0.05)
  })

  it('the small-scale allowance is asked for, and only buys the ember', () => {
    // The s5 brass plate crops to ~28 screen px and its marks are SOLID: at
    // that size a half-transparent ember is an absent mark, not a discreet one.
    // The ceiling therefore lifts — but only when a call site declares the
    // MEASURED span, and only for the ember. Everything else keeps 0.5, because
    // a black outline at full opacity is the UI badge these ceilings exist to
    // prevent, at any scale.
    expect(CUE_LIMITS.smallPx).toBeLessThanOrEqual(40)
    expect(CUE_LIMITS.smallOpacity).toBeLessThanOrEqual(1)
    expect(CUE_LIMITS.smallOpacity).toBeGreaterThan(CUE_LIMITS.opacity)

    const big = CUE_LIMITS.smallPx * 2
    for (const variant of ['arrow', 'chevrons'] as const) {
      // undeclared: the ordinary ceiling binds
      for (const a of opacities(cueArrow(200, 200, 60, { variant, opacity: 9 }))) {
        expect(a).toBeLessThanOrEqual(CUE_LIMITS.opacity)
      }
      // declared BIG: the ordinary ceiling still binds — size is a
      // qualification, not a switch
      for (const a of opacities(cueArrow(200, 200, 60, { variant, opacity: 9, screenPx: big }))) {
        expect(a).toBeLessThanOrEqual(CUE_LIMITS.opacity)
      }
      // hostile declaration: not a number, so no allowance
      const hostile = cueArrow(200, 200, 60, {
        variant,
        opacity: 9,
        screenPx: Number.NaN,
      })
      expect(hostile).not.toContain('NaN')
      for (const a of opacities(hostile)) expect(a).toBeLessThanOrEqual(CUE_LIMITS.opacity)

      // declared SMALL: the EMBER may go solid, and nothing else may
      const small = cueArrow(200, 200, 60, {
        variant,
        opacity: 9,
        screenPx: CUE_LIMITS.smallPx,
      })
      expect(small).not.toContain('NaN')
      expect(parses(small)).toBe(true)
      const lifted = opacities(small).filter((a) => a > CUE_LIMITS.opacity)
      expect(lifted.length, 'the allowance bought nothing').toBeGreaterThan(0)
      for (const a of lifted) expect(a).toBeLessThanOrEqual(CUE_LIMITS.smallOpacity)
      // the arrow's ink outline and its white sheen are NOT the ember
      if (variant === 'arrow') {
        const inkOp = [...small.matchAll(/stroke-opacity="([\d.]+)"/g)].map((m) => Number(m[1]))
        expect(inkOp.length).toBeGreaterThan(0)
        for (const a of inkOp) expect(a).toBeLessThanOrEqual(CUE_LIMITS.opacity)
        const sheen = [...small.matchAll(/fill="#ffffff" opacity="([\d.]+)"/g)].map((m) => Number(m[1]))
        expect(sheen.length).toBe(1)
        expect(sheen[0]).toBeLessThanOrEqual(CUE_LIMITS.opacity)
      }
    }

    // and the shadows never take it: an ember allowance is not a shadow licence
    for (const frag of [
      cutShadow(20, 20, 200, 20, { spread: 8, strength: 50, screenPx: 1 } as never),
      raisedEdgeShadow(OUTLINE, { lift: 12, strength: 50, screenPx: 1 } as never),
    ]) {
      for (const a of opacities(frag)) expect(a).toBeLessThanOrEqual(CUE_LIMITS.opacity)
    }
  })

  it('arrow strokes stay under the arrow ceiling', () => {
    const size = 60
    for (const variant of ['arrow', 'chevrons'] as const) {
      const widths = strokeWidths(cueArrow(200, 200, size, { variant, weight: 60 }))
      expect(widths.length).toBeGreaterThan(0)
      for (const w of widths) expect(w).toBeLessThanOrEqual(size * CUE_LIMITS.arrowStroke + 0.05)
    }
  })
})

describe('paper-cue vocabulary — the register of who speaks paper', () => {
  // The vocabulary is MACHINERY. Adopting it — deleting a label plate and
  // painting a cue in its place — is per-spread scene work owned by the art
  // lanes, and this block is the REGISTER of who has done it. Every call site
  // in the painter must be accounted for here, so a cue cannot spread quietly:
  // adopting one means writing down which piece, and which mark, and why.
  //
  // WHEN A SPREAD ADOPTS A CUE: add one entry per call site — which piece,
  // which mark, and why. The table is the record of which pieces speak paper
  // instead of printing a verb; the test then guards that the machinery is used
  // THERE and nowhere it was not declared — a cue that wanders into an
  // unrelated piece is how a vocabulary turns into decoration.
  //
  // s4 round-3 and s7 round-2 adopted in the same round (SPIN/HOIST/SEND and
  // TURN all retired). The CUE-SWEEP lane closed the book: s2's LIFT ribbon and
  // manicule, s3's STIR THE SWARM lettering and s6's RAISE A STALL cartouche
  // all became marks in the same round, and the s5 brass plate — the REFERENCE
  // the whole vocabulary was generalised from — stopped being hand-rolled and
  // became calls like everybody else.
  const ADOPTERS: Readonly<Record<string, readonly string[]>> = {
    cutShadow: [
      'brassPullPlate: the slot the dissolve strip exits by, on its tab-side edge',
      'dispatchCard: the route-plate arch, die-cut into the yard paving',
      'assayCard: the three vitrine apertures, die-cut through the faceplate',
      'swarmTab: the slit the STIR card comes out of (was a flat grey line)',
    ],
    raisedEdgeShadow: [
      'dispatchCard: the thumb notch pool',
      'dispatchCard: the thumb notch lip',
      'keyboardDoor: the leaf lip, a loose ply lying on the key-board plaque',
      'cofferLid: the shut lid, a loose ply sitting on its box',
      'crankWheel: the grip lobe pool',
      'crankWheel: the grip lobe lip',
      'innCourtyardSpread: the key-board plaque pool, where the LIFT ribbon stood',
      'assayDial: the wax-seal thumb lobe standing proud of the plate',
      'assayCard: the faceplate rim, a ply riveted over the wheel',
    ],
    cueArrow: [
      'brassPullPlate: the six chevron pairs down the engraved track',
      'brassPullPlate: the one head-and-shaft arrow at the track centre',
      'dispatchCard: the rim chevrons',
      'cofferLid: one ember arrow at the hasp, along the free edge travel',
      'dispatchCablePanel: the SEND-mast sealed-letter chevron set',
      'crankWheel: the rim chevrons (the hand-rolled ink arrows converted)',
      'innCourtyardSpread: one ember arrow along the key-board leaves\' travel',
      'assayDial: the two ember chevron sets flanking the thumb lobe',
      'bazRaiseStallFace: the setting-out track chevrons, where the cartouche read',
      'swarmTab: the pull-axis chevrons, where STIR THE SWARM was set',
    ],
  }

  const source = readFileSync(SCRIPT_PATH, 'utf8')

  for (const helper of ['cutShadow', 'raisedEdgeShadow', 'cueArrow']) {
    it(`${helper} is defined and exported, and called only by declared adopters`, () => {
      expect(source).toContain(`function ${helper}(`)
      // reachable from the piece painters and from this test
      expect(source).toMatch(new RegExp(`\\n\\s*${helper},`))

      const callSites = [...source.matchAll(new RegExp(`(\\w+\\s+)?\\b${helper}\\(`, 'g'))].filter(
        (m) => m[1] !== 'function '
      )
      expect(
        callSites.length,
        `${helper} has ${callSites.length} call sites and ${ADOPTERS[helper].length} declared — ` +
          `a cue that spreads without being written down is a cue nobody reviewed`
      ).toBe(ADOPTERS[helper].length)
    })
  }

  it('every retired label plate really has lost its word', () => {
    // Every verb the book used to print at a trigger. A painter may not quietly
    // re-add one: this is the assertion that keeps the conversions from being
    // cosmetic. HOIST/SPIN/SEND went in s4 round-3 and TURN in s7 round-2;
    // LIFT, STIR and RAISE went in the cue-sweep lane and join them here, which
    // is the whole of the Wave-2 transitional label set retired.
    for (const verb of ['HOIST', 'SPIN', 'SEND', 'LIFT', 'STIR', 'RAISE', 'PULL', 'TURN']) {
      expect(
        source.includes(`engraveWord('${verb}'`),
        `${verb} is being engraved again — the affordance law retired it`
      ).toBe(false)
    }
    // STIR THE SWARM was SET IN TYPE rather than engraved, so a verb gate that
    // only watched `engraveWord` would have missed it entirely. The two words
    // are banned as strings anywhere in the painter, in either machinery.
    for (const phrase of ['STIR THE', "'SWARM'", 'RAISE A STALL']) {
      expect(
        source.includes(`>${phrase}<`) || source.includes(`(${phrase})`),
        `${phrase} is being printed again`
      ).toBe(false)
    }
    // s7's TURN, scoped to assayCard's own body so the other spreads' plates —
    // which their own lanes will convert in their own commits — are none of
    // this file's business. Sliced at the function's closing brace at column 0
    // (CRLF-tolerant: an `\n}\n` search silently ran on to the NEXT function).
    const body = source.slice(source.indexOf('function assayCard('))
    const end = body.search(/\r?\n\}\r?\n/)
    const card = body.slice(0, end < 0 ? body.length : end)
    expect(card.length, 'assayCard body not found').toBeGreaterThan(200)
    expect(card).not.toContain("'TURN'")
    expect(card, 'assayCard is engraving words again').not.toContain('engraveWord')
  })
})
