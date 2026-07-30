import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import { PALETTE } from '@/components/labs/small-world/palette'
import { buildMergedClay, type ClayPart } from '@/components/labs/small-world/scene/props/clay-kit'
import {
  INK_PIECE_LIMIT,
  PEEKER_SPECS,
  peekerDressing,
  peekerPieces,
  peekerRootTilt,
  type PeekerLimbs,
} from '@/components/labs/small-world/scene/props/peeker-cast'
import {
  INK_WIDTH,
  facing,
  flipY,
  inflateClay,
} from '@/components/labs/small-world/scene/props/peeker-kit'
import {
  DRESS_REACH,
  FACE_BOX,
  MASCOT_BOX,
  PEEKER_ABS_Z,
  PEEKER_CAST,
  peekerUnroll,
} from '@/components/labs/small-world/scene/props/peeker-stage'

/**
 * Task 56 — the mascot cast, measured rather than assumed.
 *
 * `MASCOT_BOX`, `FACE_BOX` and `DRESS_REACH` are what every clearance decision in peeker-stage.ts
 * rests on. R14's equivalent constant was a guess that turned out to be 50% short, which quietly
 * made both of its benches optimistic. So this file builds the REAL merged geometry for all twelve
 * characters and all six dressings, reproduces the scene graph the rig renders (root tilt → joint →
 * limb transform), sweeps the whole gesture range, adds the ink hull, and pins the envelopes TIGHT
 * IN BOTH DIRECTIONS: nothing may outgrow a box, and no box may be left slack.
 */

const ART_DIR = join(process.cwd(), 'components/labs/small-world/scene/props')
const KINDS = PEEKER_CAST.flatMap((p) => [
  { biome: p.biome, kind: p.left },
  { biome: p.biome, kind: p.right },
]) as { biome: (typeof PEEKER_CAST)[number]['biome']; kind: keyof typeof PEEKER_SPECS }[]

type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
const EMPTY: Box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }

function union(a: Box, b: Box): Box {
  return {
    x0: Math.min(a.x0, b.x0),
    x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1),
    z0: Math.min(a.z0, b.z0),
    z1: Math.max(a.z1, b.z1),
  }
}

/** Vertex bounds of a merged part list, with the ink hull, after `matrix`. */
function boundsOf(parts: ClayPart[], matrix: THREE.Matrix4): Box {
  const geo = buildMergedClay(parts.map((p) => ({ ...p, geo: p.geo.clone() })))
  const ink = inflateClay(geo, INK_WIDTH)
  const pos = ink.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  let out = { ...EMPTY }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix)
    out = union(out, { x0: v.x, x1: v.x, y0: v.y, y1: v.y, z0: v.z, z1: v.z })
  }
  geo.dispose()
  ink.dispose()
  return out
}

/** The rig's own scene graph, at one point of the gesture range. */
function figureBounds(
  biome: (typeof PEEKER_CAST)[number]['biome'],
  kind: keyof typeof PEEKER_SPECS,
  dir: 1 | -1,
  idle: number,
  unroll: number
): Box {
  const spec = PEEKER_SPECS[kind]
  const pieces = peekerPieces(biome, kind, dir)
  const root = new THREE.Group()
  root.rotation.z = peekerRootTilt(kind, dir)

  const limbs: PeekerLimbs = { a: null, b: null, c: null }
  const holders = pieces.map((piece) => {
    const g = new THREE.Group()
    g.position.set(piece.at[0], piece.at[1], piece.at[2])
    root.add(g)
    if (piece.slot !== 'body') limbs[piece.slot as 'a' | 'b' | 'c'] = g
    return g
  })
  spec.apply(limbs, { idle, unroll }, dir)
  root.updateMatrixWorld(true)

  let out = { ...EMPTY }
  pieces.forEach((piece, i) => {
    out = union(out, boundsOf(piece.parts, holders[i].matrixWorld))
  })
  return out
}

const sweptCache = new Map<string, Box>()

/**
 * Union over the whole gesture range — 7 idle samples x the unroll sweep. Memoised because
 * rebuilding twelve characters' merged geometry per assertion is by far the slowest thing here.
 */
function sweptBounds(
  biome: (typeof PEEKER_CAST)[number]['biome'],
  kind: keyof typeof PEEKER_SPECS,
  dir: 1 | -1
): Box {
  const key = `${biome}:${kind}:${dir}`
  const hit = sweptCache.get(key)
  if (hit) return hit
  let out = { ...EMPTY }
  for (const idle of [-1, -0.6, -0.2, 0, 0.2, 0.6, 1]) {
    for (const clock of [0.7, 0.8, 0.9, 1]) {
      const unroll = PEEKER_SPECS[kind].rolls ? peekerUnroll(clock) : 1
      out = union(out, figureBounds(biome, kind, dir, idle, unroll))
    }
  }
  sweptCache.set(key, out)
  return out
}

describe('the measured mascot envelope', () => {
  const swept = new Map<string, Box>()
  for (const { biome, kind } of KINDS) {
    for (const dir of [1, -1] as const) {
      swept.set(`${kind}:${dir}`, sweptBounds(biome, kind, dir))
    }
  }

  it('fits every character inside MASCOT_BOX, in both facings, across the gesture range', () => {
    for (const [key, b] of swept) {
      const dir = key.endsWith(':1') ? 1 : -1
      // `out` is toward the frame's outer edge, which is −x for a left-hand (dir +1) figure
      const outward = dir === 1 ? -b.x0 : b.x1
      const inward = dir === 1 ? b.x1 : -b.x0
      expect(outward, `${key} outward`).toBeLessThanOrEqual(MASCOT_BOX.out)
      expect(inward, `${key} inward`).toBeLessThanOrEqual(MASCOT_BOX.in)
      expect(b.y1, `${key} up`).toBeLessThanOrEqual(MASCOT_BOX.up)
      expect(-b.y0, `${key} down`).toBeLessThanOrEqual(MASCOT_BOX.down)
      expect(Math.max(b.z1, -b.z0), `${key} depth`).toBeLessThanOrEqual(PEEKER_ABS_Z)
    }
  })

  it('leaves no face of MASCOT_BOX slack — some character reaches each one', () => {
    // Without this the box could be inflated to make the fits-inside test vacuous, and every
    // clearance number in peeker-stage.ts would be quietly pessimistic.
    let out = -Infinity
    let inward = -Infinity
    let up = -Infinity
    let down = -Infinity
    for (const [key, b] of swept) {
      const dir = key.endsWith(':1') ? 1 : -1
      out = Math.max(out, dir === 1 ? -b.x0 : b.x1)
      inward = Math.max(inward, dir === 1 ? b.x1 : -b.x0)
      up = Math.max(up, b.y1)
      down = Math.max(down, -b.y0)
    }
    expect(MASCOT_BOX.out - out).toBeLessThan(0.08)
    expect(MASCOT_BOX.in - inward).toBeLessThan(0.08)
    expect(MASCOT_BOX.up - up).toBeLessThan(0.08)
    expect(MASCOT_BOX.down - down).toBeLessThan(0.08)
  })

  it('puts every dressing inside its own envelope', () => {
    // Per KIND rather than per biome since Task 62: two corners now field a different composition
    // on each side (the eagle's eyrie, the penguin's floe), and a per-biome loop would have gated
    // only whichever one the ART table happened to answer for the pair's first kind.
    for (const { biome, kind } of KINDS) {
      for (const dir of [1, -1] as const) {
        for (const vdir of [1, -1] as const) {
          const b = boundsOf(peekerDressing(biome, kind, dir, vdir), new THREE.Matrix4())
          const outward = dir === 1 ? -b.x0 : b.x1
          const inward = dir === 1 ? b.x1 : -b.x0
          const label = `${biome}/${kind} dir${dir} vdir${vdir}`
          expect(outward, `${label} outward`).toBeLessThanOrEqual(DRESS_REACH.out)
          expect(inward, `${label} inward`).toBeLessThanOrEqual(DRESS_REACH.in)
          // The dressing reaches FAR past the character on the side its composition is anchored
          // to, and only NEAR past it on the other — the same asymmetry `compositionBox` encodes.
          const upLimit = MASCOT_BOX.up + (vdir === 1 ? DRESS_REACH.far : DRESS_REACH.near)
          const downLimit = MASCOT_BOX.down + (vdir === 1 ? DRESS_REACH.near : DRESS_REACH.far)
          expect(b.y1, `${label} up`).toBeLessThanOrEqual(upLimit + 0.001)
          expect(-b.y0, `${label} down`).toBeLessThanOrEqual(downLimit + 0.001)
        }
      }
    }
  })

  it('keeps every face inside FACE_BOX, which is what stays on screen', () => {
    // The face box is an authoring contract: a character's eyes and muzzle live in it, so the
    // staging can guarantee they are never cropped. Verified through the eye geometry, which is
    // the one part every character shares and the one the reader looks for.
    //
    // The eye is found by its `tag`, not by its colour. Task 61 had to change this: the old locator
    // was "any `ink` part sitting forward in Z", which was only ever a proxy for "a face", and it
    // stopped being one the moment the recast put ink on an eagle's talons and a polar bear's
    // claws. It did not go quiet — it started measuring a foot at y = −0.263 and failing — but a
    // version of the same drift that landed a few hundredths the other way would have passed while
    // measuring nothing, which is the defect this suite has already been bitten by twice.
    for (const { biome, kind } of KINDS) {
      const pieces = peekerPieces(biome, kind, 1)
      const eyes = pieces
        .flatMap((piece) => piece.parts.filter((p) => p.tag === 'eye').map((p) => ({ piece, p })))
        .map(({ piece, p }) => ({
          x: (p.pos?.[0] ?? 0) + piece.at[0],
          y: (p.pos?.[1] ?? 0) + piece.at[1],
        }))
      expect(eyes.length, `${kind} has an authored eye`).toBeGreaterThan(0)
      for (const e of eyes) {
        expect(e.x, `${kind} eye x`).toBeGreaterThanOrEqual(-FACE_BOX.out)
        expect(e.x, `${kind} eye x`).toBeLessThanOrEqual(FACE_BOX.in)
        expect(e.y, `${kind} eye y`).toBeGreaterThanOrEqual(-FACE_BOX.down)
        expect(e.y, `${kind} eye y`).toBeLessThanOrEqual(FACE_BOX.up)
      }
    }
  })
})

describe('mirroring', () => {
  const sample: ClayPart[] = [
    { geo: new THREE.BoxGeometry(1, 1, 1), color: PALETTE.ink, pos: [0.3, 0.4, 0.5], rot: [0.1, 0.2, 0.3] },
    { geo: new THREE.BoxGeometry(1, 1, 1), color: PALETTE.snow, pos: [-0.2, 0.1, 0] },
  ]

  it('facing() is the identity one way and an exact YZ reflection the other', () => {
    expect(facing(1, sample)).toBe(sample)
    const m = facing(-1, sample)
    expect(m[0].pos).toEqual([-0.3, 0.4, 0.5])
    expect(m[0].rot).toEqual([0.1, -0.2, -0.3])
    expect(m[1].pos).toEqual([0.2, 0.1, 0])
    expect(m[1].rot).toBeUndefined()
  })

  it('flipY() is the identity one way and an exact XZ reflection the other', () => {
    expect(flipY(-1, sample)).toBe(sample)
    const m = flipY(1, sample)
    expect(m[0].pos).toEqual([0.3, -0.4, 0.5])
    expect(m[0].rot).toEqual([-0.1, 0.2, -0.3])
  })

  it('round-trips', () => {
    const back = facing(-1, facing(-1, sample))
    expect(back[0].pos).toEqual(sample[0].pos)
    expect(back[0].rot).toEqual(sample[0].rot)
  })

  it('never applies a negative scale to any part of any character', () => {
    // The whole reason the right-hand figure is a reflected PLACEMENT rather than a scale(-1) is
    // that a mirrored scale inverts every normal and flips the toon bands. If a negative scale
    // ever crept in, that argument would be false.
    for (const { biome, kind } of KINDS) {
      for (const dir of [1, -1] as const) {
        for (const piece of peekerPieces(biome, kind, dir)) {
          for (const part of piece.parts) {
            for (const s of part.scl ?? [1, 1, 1]) {
              expect(s, `${kind} dir${dir}`).toBeGreaterThan(0)
            }
          }
        }
      }
      for (const dir of [1, -1] as const) {
        for (const part of peekerDressing(biome, kind, dir, -1)) {
          for (const s of part.scl ?? [1, 1, 1]) expect(s, `${biome}/${kind} dressing`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('mirrors the whole figure: the right-hand build occupies the mirrored envelope', () => {
    for (const { biome, kind } of KINDS) {
      const l = sweptBounds(biome, kind, 1)
      const r = sweptBounds(biome, kind, -1)
      expect(r.x0, `${kind} x0`).toBeCloseTo(-l.x1, 6)
      expect(r.x1, `${kind} x1`).toBeCloseTo(-l.x0, 6)
      expect(r.y0, `${kind} y0`).toBeCloseTo(l.y0, 6)
      expect(r.y1, `${kind} y1`).toBeCloseTo(l.y1, 6)
    }
  })

  it('mirrors every hinge, on every axis and every slot, across the gesture range', () => {
    // R14's version of this test compared only rotation.z on limbs a and b, and stayed green when
    // a `dir` factor was deleted from a yaw. This one compares all three rotation axes and the
    // full scale, on every slot a character actually uses.
    for (const { kind } of KINDS) {
      const spec = PEEKER_SPECS[kind]
      let exercised = 0
      for (const idle of [-1, -0.5, 0, 0.25, 0.5, 0.75, 1]) {
        for (const unroll of [0, 0.5, 1]) {
          const mk = (): PeekerLimbs => ({ a: new THREE.Group(), b: new THREE.Group(), c: new THREE.Group() })
          const left = mk()
          const right = mk()
          spec.apply(left, { idle, unroll }, 1)
          spec.apply(right, { idle, unroll }, -1)
          for (const slot of ['a', 'b', 'c'] as const) {
            const l = left[slot]!
            const r = right[slot]!
            expect(r.rotation.x, `${kind}.${slot}.x`).toBeCloseTo(l.rotation.x, 9)
            expect(r.rotation.y, `${kind}.${slot}.y`).toBeCloseTo(-l.rotation.y, 9)
            expect(r.rotation.z, `${kind}.${slot}.z`).toBeCloseTo(-l.rotation.z, 9)
            expect(r.scale.toArray(), `${kind}.${slot}.scale`).toEqual(l.scale.toArray())
            if (Math.abs(l.rotation.y) > 1e-6 || Math.abs(l.rotation.z) > 1e-6) exercised++
          }
        }
      }
      // anti-vacuity: a spec that moved nothing would pass every assertion above
      expect(exercised, `${kind} actually moves something`).toBeGreaterThan(0)
    }
  })
})

describe('gesture directions', () => {
  /** World-space position of a limb piece's far tip, at one point of the gesture range. */
  function jawTip(kind: 'crocGape', dir: 1 | -1, idle: number): THREE.Vector3 {
    const pieces = peekerPieces('delta', kind, dir)
    const jaw = pieces.find((p) => p.slot === 'a')!
    const root = new THREE.Group()
    root.rotation.z = peekerRootTilt(kind, dir)
    const holder = new THREE.Group()
    holder.position.set(jaw.at[0], jaw.at[1], jaw.at[2])
    root.add(holder)
    const limbs: PeekerLimbs = { a: holder, b: new THREE.Group(), c: new THREE.Group() }
    PEEKER_SPECS[kind].apply(limbs, { idle, unroll: 1 }, dir)
    root.updateMatrixWorld(true)

    // the snout end of the mandible: its furthest vertex along the facing direction
    const geo = buildMergedClay(jaw.parts.map((p) => ({ ...p, geo: p.geo.clone() })))
    const pos = geo.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    let best = new THREE.Vector3()
    let bestX = -Infinity
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(holder.matrixWorld)
      const along = v.x * dir
      if (along > bestX) {
        bestX = along
        best = v.clone()
      }
    }
    geo.dispose()
    return best
  }

  it('opens the crocodile jaw DOWNWARD, not upward', () => {
    // This pins the fix that made the delta corner work at all. The first build used a positive
    // jaw rotation, which only swings a mandible clear of the skull when the snout points UP — so
    // the whole animal had been reared vertical to make its mouth work, and it read as a green
    // tube rather than a crocodile. A mirror test cannot see this: flipping the sign preserves
    // mirror symmetry exactly, so it survived the R14-style suite. The direction the jaw travels
    // in WORLD space is the thing that actually matters, so that is what is asserted.
    for (const dir of [1, -1] as const) {
      const shut = jawTip('crocGape', dir, -1)
      const open = jawTip('crocGape', dir, 1)
      expect(open.y, `crocGape dir${dir} jaw must drop as it opens`).toBeLessThan(shut.y - 1e-4)
    }
  })

  it('keeps the crocodile snout roughly level rather than reared', () => {
    // The same defect, from the other side: a crocodile whose snout points upward is the failure
    // mode. The mandible tip must stay well inside a shallow band around the figure's own centre.
    for (const idle of [-1, 0, 1]) {
      expect(Math.abs(jawTip('crocGape', 1, idle).y), 'crocGape snout height').toBeLessThan(0.45)
    }
  })
})

describe('house rules', () => {
  const artFiles = readdirSync(ART_DIR).filter((f) => /^peeker/.test(f))

  it('covers the whole cast with art and a gesture spec', () => {
    for (const { biome, kind } of KINDS) {
      expect(PEEKER_SPECS[kind], kind).toBeDefined()
      const pieces = peekerPieces(biome, kind, 1)
      expect(pieces.length, kind).toBeGreaterThan(0)
      expect(peekerDressing(biome, kind, 1, -1).length, `${biome}/${kind}`).toBeGreaterThan(20)
    }
    // every biome's dressing is distinct art, not the same corner recoloured
    const sizes = KINDS.map(({ biome, kind }) => peekerDressing(biome, kind, 1, -1).length)
    expect(new Set(sizes).size).toBeGreaterThan(3)
  })

  it('gives the two corners Aram split their OWN dressing, not one composition mirrored', () => {
    // Task 62. The recast stopped a pair reading as one animal twice; this is the same defect one
    // layer out, and it is the one he actually saw: "the eagle should have a NEST, not the same
    // cliff as the pangolin", "the penguin on a drifting ice piece, not under a pine like the bear".
    //
    // The pin is on the ART, not on the plumbing — a `dressing(kind)` signature that returned the
    // same list for both kinds would satisfy the types and change nothing on screen. So each split
    // corner must answer genuinely different geometry, and each seat must be MADE of its own
    // material: the eagle's nest of dead wood, the penguin's raft of sea. Meanwhile the four
    // corners that were never in question must still answer the SAME list for both sides — a split
    // there would be unasked-for churn, and this is what would catch it.
    //
    // NOT the cast's tone-overlap statistic, deliberately. Two SPECIES sharing a palette is the
    // defect that test exists for; two seats in one canyon sharing the canyon's rock family is
    // correct, and the eyrie and the ledge measure 0.71 overlap for exactly that honest reason.
    // Reusing the threshold here would have been a number doing the wrong job — the same class of
    // mistake as the part-count pins T61 tried and threw away.
    const dress = (biome: (typeof KINDS)[number]['biome'], kind: (typeof KINDS)[number]['kind']) =>
      peekerDressing(biome, kind, 1, -1)
    const tones = (biome: (typeof KINDS)[number]['biome'], kind: (typeof KINDS)[number]['kind']) =>
      new Set(dress(biome, kind).map((p) => p.color))

    for (const { biome, split, kept, madeOf } of [
      {
        biome: 'canyon',
        split: 'eagle',
        kept: 'pangolinBig',
        madeOf: [PALETTE.nestStick, PALETTE.nestStickDeep],
      },
      {
        biome: 'winter',
        split: 'penguin',
        kept: 'polarBear',
        madeOf: [PALETTE.polarSea, PALETTE.polarSeaDeep],
      },
    ] as const) {
      // Not a part COUNT: the eyrie and the ledge happen to use 75 primitives each, which is the
      // same coincidence T61's discarded count pin hit in the desert. The colour SEQUENCE is the
      // cheap thing that cannot collide by accident — two lists of 75 tones in the same order are
      // the same art, and anything else is not.
      const seq = (kind: (typeof KINDS)[number]['kind']) => dress(biome, kind).map((p) => p.color)
      expect(seq(split), `${biome} really is two compositions`).not.toEqual(seq(kept))
      const newSeat = tones(biome, split)
      const oldSeat = tones(biome, kept)
      for (const tone of madeOf) {
        expect(newSeat.has(tone), `${biome}/${split} is made of its own material`).toBe(true)
        expect(oldSeat.has(tone), `${biome}/${kept} did not inherit it`).toBe(false)
      }
    }

    for (const pair of PEEKER_CAST) {
      if (pair.biome === 'canyon' || pair.biome === 'winter') continue
      expect(
        dress(pair.biome, pair.left).map((p) => p.color),
        `${pair.biome} was not asked to split`
      ).toEqual(dress(pair.biome, pair.right).map((p) => p.color))
    }
  })

  it('uses no literal colours and no non-determinism anywhere in the peeker files', () => {
    // The glob is /^peeker/ rather than /^peeker-/ on purpose: the earlier form skipped
    // `peekers.tsx`, the rig itself — the one file in the family most likely to reach for a clock.
    expect(artFiles).toContain('peekers.tsx')
    for (const file of artFiles) {
      const src = readFileSync(join(ART_DIR, file), 'utf8')
      expect(src, `${file} colour literal`).not.toMatch(/['"]#[0-9a-fA-F]{3,8}['"]/)
      expect(src, `${file} console`).not.toMatch(/console\./)
      expect(src, `${file} clock`).not.toMatch(/Date\.now|performance\.now|Math\.random/)
    }
  })

  it('gives every character an eye with a catch-light', () => {
    // The catch-light is what stops a clay animal reading as taxidermy, and it is the one facial
    // part that is easy to lose when an art file is revised.
    for (const { biome, kind } of KINDS) {
      const snowBeads = peekerPieces(biome, kind, 1)
        .flatMap((p) => p.parts)
        .filter((p) => p.color === PALETTE.snow && (p.pos?.[2] ?? 0) > 0.08)
      expect(snowBeads.length, `${kind} catch-light`).toBeGreaterThan(0)
    }
  })

  it('inks the masses that carry a silhouette, and never asks for one it will not get', () => {
    for (const { biome, kind } of KINDS) {
      const pieces = peekerPieces(biome, kind, 1)
      // the first piece is the character's main mass, and it always carries the contour
      expect(pieces[0].ink, `${kind}/${pieces[0].slot}`).toBe(true)
      // The runtime gates on ARRAY POSITION (`index < INK_PIECE_LIMIT` in peeker-cast.tsx), so an
      // ink flag on a later piece is silently dropped. An earlier version of this test counted
      // `filter(ink).slice(0, LIMIT).length <= LIMIT`, which cannot fail by construction — and
      // three characters were in fact carrying a dead flag on their third piece while it passed.
      // Asserting the flags match what the runtime will honour is what makes the claim real.
      pieces.forEach((piece, i) => {
        if (i >= INK_PIECE_LIMIT) {
          expect(piece.ink, `${kind}/${piece.slot} asks for ink it will never be drawn`).not.toBe(true)
        }
      })
    }
  })

  it('keeps the camels tack in the leather family, not the saddle-and-brass that read as a lit cigarette', () => {
    // Task 58. The halter was a `camelSaddle` bar with a `honey` bead at the muzzle end, and at
    // reading size a warm-red stroke with a bright yellow tip at the corner of a mouth is a
    // cigarette — the single loudest misread left after the T56 rework. The fix is a COLOUR family
    // as much as a shape, so the family is what is pinned: nothing warm-red and nothing brass may
    // come back onto the worked animal, and it must actually be wearing something.
    const camel = new Set(peekerPieces('desert', 'camelAdult', 1).flatMap((p) => p.parts.map((q) => q.color)))
    expect(camel.has(PALETTE.honey), 'camel brass').toBe(false)
    expect(camel.has(PALETTE.camelSaddle), 'camel saddle red').toBe(false)
    expect(camel.has(PALETTE.tackLeather), 'camel wears tack').toBe(true)

    // Task 61 keeps the other half of the rule by removing the wearer rather than re-colouring it:
    // the calf that wore the collar is gone and the fennec that replaced it is a WILD animal, so
    // the pin is that it carries no tack of any family at all. (It does wear `honey`, as the
    // crocodile, the snake and the eagle do — that is the cast's shared warm eye ring, and the
    // defect this test exists for was a bright bead at the END OF A STRAP, not a colour.)
    const fox = new Set(peekerPieces('desert', 'fennec', 1).flatMap((p) => p.parts.map((q) => q.color)))
    for (const tack of [PALETTE.tackLeather, PALETTE.tackLeatherDeep, PALETTE.camelSaddle]) {
      expect(fox.has(tack), 'the fennec runs bare').toBe(false)
    }
  })

  it('gives the polar bear a DOCUMENTED carve-out from the median band, and the devices that replace it', () => {
    // READ THIS BEFORE "FIXING" THE BEAR BACK TO A MID TONE.
    //
    // Every other figure in this cast is held to a 40-52 median dL* against its corner's backdrop.
    // The bear is not, and the exemption is arithmetic rather than taste: the winter backdrop
    // measures L* 85.6, so a 40-52 median forces a figure median of L* 33.6-45.6 — a BROWN animal.
    // No white animal has a median in that band against this sky. It was painted to the metric
    // twice, once cool and once warm, and came back as grey-lilac stone and then as a grizzly.
    // Aram asked for a white bear; whiteness wins and the median was the wrong statistic.
    //
    // What replaces it is measured on the EDGE rather than the middle, in bench/task61-edge.mjs:
    // (1) the median |dL*| across the silhouette boundary, inside-vs-outside, against a floor
    // derived from the figures that already read well, and (2) a darkest-quartile floor, so the
    // shadow and ink quartile must separate even where the median cannot. This test pins the
    // STRUCTURE those two assertions depend on — the devices that do the separating, none of which
    // a median can see.
    const parts = peekerPieces('winter', 'polarBear', 1).flatMap((p) => p.parts)
    const worn = new Set(parts.map((p) => p.color))

    // the mass really is white — this is the carve-out being USED, not merely allowed
    expect(worn.has(PALETTE.bearCoat), 'bear wears its white coat').toBe(true)
    const share = (test: (c: string) => boolean): number => {
      let hit = 0
      let all = 0
      for (const p of parts) {
        p.geo.computeBoundingBox()
        const b = p.geo.boundingBox!
        const s = p.scl ?? [1, 1, 1]
        const a = (b.max.x - b.min.x) * s[0] * (b.max.y - b.min.y) * s[1]
        all += a
        if (test(p.color)) hit += a
      }
      return hit / all
    }
    expect(share((c) => c === PALETTE.bearCoat), 'white is the MASS, not an accent').toBeGreaterThan(0.5)
    // ...and the shade step stays subtle. A white animal modelled in greys reads as a dirty one.
    // The property that actually prevents that is the VALUE GAP, not the area — a shallow step over
    // a lot of the body is plush, while a deep step over a little of it is a stain. So the gap is
    // what is pinned tightly and the area only loosely. (An area-only bound was tried first at 0.22
    // and the honest shade landed at 0.227, which said more about the threshold than the art.)
    const srgb = (v: number): number => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const lstar = (hex: string): number => {
      const n = parseInt(hex.slice(1), 16)
      const y =
        0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255)
      return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
    }
    expect(
      lstar(PALETTE.bearCoat) - lstar(PALETTE.bearDeep),
      'one stop of shade, not a grey modelling scheme'
    ).toBeLessThan(15)
    expect(share((c) => c === PALETTE.bearDeep), 'shade is a step, not the figure').toBeLessThan(0.32)
    // it keeps its ink contour, which is separation device (a)
    expect(peekerPieces('winter', 'polarBear', 1).filter((p) => p.ink).length).toBeGreaterThan(0)

    // Devices (b) and (c) live in the DRESSING, because they are what the figure is seen against:
    // a cast shadow thrown into the drift beneath it, and dark spruce massed behind its silhouette.
    // Without these the carve-out is just an unmeasured white blob on white snow.
    // ...and they belong to the BEAR'S dressing specifically, which is the thing Task 62's split
    // made possible to get wrong: the penguin's floe is a different composition on the same corner,
    // so asking the biome rather than the figure would let the bear lose its own backing silently.
    const dressing = new Set(peekerDressing('winter', 'polarBear', 1, -1).map((p) => p.color))
    expect(dressing.has(PALETTE.bearCast), 'the bear casts a shadow into the drift').toBe(true)
    expect(dressing.has(PALETTE.spruceDeep), 'dark backing behind the silhouette').toBe(true)

    // The penguin keeps its own scheme and is NOT part of the carve-out.
    const penguin = new Set(
      peekerPieces('winter', 'penguin', 1).flatMap((p) => p.parts.map((q) => q.color))
    )
    expect(penguin.has(PALETTE.penguinBack), 'penguin back tone').toBe(true)
    expect(penguin.has(PALETTE.penguinFlash), 'penguin keeps the corner one warm note').toBe(true)
  })

  it('fields two different species at every checkpoint', () => {
    // Task 61's whole point. Four corners used to field one animal twice at two sizes, and however
    // much the poses and the tack differed the pair read as one asset repeated — which is the tell
    // the R14 review called "low quality" and the thing the recast removes.
    //
    // The pin is on TONE OVERLAP, and the threshold is calibrated against the defect rather than
    // chosen. The mechanism that produced the repeated-asset read was that both halves of a pair
    // came out of ONE build — `placed(0.82, …)` over a single yeti part list, or one shared pose
    // type for the camels and the pangolins — and a shared build necessarily means a shared palette.
    // Measured, the retired winter pair used 7 of its 11 tones on both animals: a Jaccard of 0.64.
    // The recast's worst corner is the delta at 0.40, and the untouched approved pairs sit at 0.18
    // (spring) and 0.36 (jungle), so 0.5 separates the fix from the defect with real margin on both
    // sides.
    //
    // Two cheaper pins were tried first and BOTH were coincidences rather than measurements: a 6%
    // part-count margin failed the spring pair, whose two genuinely different birds land within 5%
    // of each other, and plain count inequality failed the desert, where the camel and the fennec
    // happen to use 53 primitives each. Neither was measuring the property it named.
    for (const pair of PEEKER_CAST) {
      expect(pair.left, `${pair.biome} pair`).not.toBe(pair.right)
      const tones = (k: (typeof pair)['left']): Set<string> =>
        new Set(peekerPieces(pair.biome, k, 1).flatMap((p) => p.parts.map((q) => q.color)))
      const l = tones(pair.left)
      const r = tones(pair.right)
      const shared = [...l].filter((c) => r.has(c)).length
      const union = new Set([...l, ...r]).size
      expect(shared / union, `${pair.biome} is two species, not one twice`).toBeLessThan(0.5)
    }
    // and the retired kinds really are gone from the type's inhabitants, not merely unused
    const live = new Set(PEEKER_CAST.flatMap((p) => [p.left, p.right]))
    expect(live.size, 'twelve distinct species').toBe(12)
  })

  it('stays inside the per-checkpoint draw budget', () => {
    // Measured on a real server by bench/task56-drawcalls.mjs; this is the arithmetic that has to
    // agree with it, so a third inked piece or a fourth mesh cannot creep in unnoticed.
    const BUDGET = 14
    for (const pair of PEEKER_CAST) {
      let draws = 0
      for (const kind of [pair.left, pair.right]) {
        const pieces = peekerPieces(pair.biome, kind, 1)
        draws += pieces.length + Math.min(INK_PIECE_LIMIT, pieces.filter((p) => p.ink).length)
        draws += 2 // the side's dressing: one merged mesh plus its contour
      }
      expect(draws, pair.biome).toBeLessThanOrEqual(BUDGET)
    }
  })
})
