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
    for (const pair of PEEKER_CAST) {
      for (const dir of [1, -1] as const) {
        for (const vdir of [1, -1] as const) {
          const b = boundsOf(peekerDressing(pair.biome, dir, vdir), new THREE.Matrix4())
          const outward = dir === 1 ? -b.x0 : b.x1
          const inward = dir === 1 ? b.x1 : -b.x0
          const label = `${pair.biome} dir${dir} vdir${vdir}`
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
    for (const { biome, kind } of KINDS) {
      const pieces = peekerPieces(biome, kind, 1)
      const eyes = pieces
        .flatMap((piece) =>
          piece.parts
            .filter((p) => p.color === PALETTE.ink && (p.pos?.[2] ?? 0) > 0.05)
            .map((p) => ({ piece, p }))
        )
        .map(({ piece, p }) => ({
          x: (p.pos?.[0] ?? 0) + piece.at[0],
          y: (p.pos?.[1] ?? 0) + piece.at[1],
        }))
      expect(eyes.length, `${kind} has ink facial features`).toBeGreaterThan(0)
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
        for (const part of peekerDressing(biome, dir, -1)) {
          for (const s of part.scl ?? [1, 1, 1]) expect(s, `${biome} dressing`).toBeGreaterThan(0)
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
  function jawTip(kind: 'crocGape' | 'crocPeek', dir: 1 | -1, idle: number): THREE.Vector3 {
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

  it('opens the crocodiles jaws DOWNWARD, not upward', () => {
    // This pins the fix that made the delta corner work at all. The first build used a positive
    // jaw rotation, which only swings a mandible clear of the skull when the snout points UP — so
    // the whole animal had been reared vertical to make its mouth work, and it read as a green
    // tube rather than a crocodile. A mirror test cannot see this: flipping the sign preserves
    // mirror symmetry exactly, so it survived the R14-style suite. The direction the jaw travels
    // in WORLD space is the thing that actually matters, so that is what is asserted.
    for (const kind of ['crocGape', 'crocPeek'] as const) {
      for (const dir of [1, -1] as const) {
        const shut = jawTip(kind, dir, -1)
        const open = jawTip(kind, dir, 1)
        expect(open.y, `${kind} dir${dir} jaw must drop as it opens`).toBeLessThan(shut.y - 1e-4)
      }
    }
  })

  it('keeps both crocodiles snouts roughly level rather than reared', () => {
    // The same defect, from the other side: a crocodile whose snout points upward is the failure
    // mode. The mandible tip must stay well inside a shallow band around the figure's own centre.
    for (const kind of ['crocGape', 'crocPeek'] as const) {
      for (const idle of [-1, 0, 1]) {
        expect(Math.abs(jawTip(kind, 1, idle).y), `${kind} snout height`).toBeLessThan(0.45)
      }
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
      expect(peekerDressing(biome, 1, -1).length, biome).toBeGreaterThan(20)
    }
    // every biome's dressing is distinct art, not the same corner recoloured
    const sizes = PEEKER_CAST.map((p) => peekerDressing(p.biome, 1, -1).length)
    expect(new Set(sizes).size).toBeGreaterThan(3)
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
