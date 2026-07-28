import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  PEEKER_SPECS,
  facing,
  peekerPieces,
  peekerRootTilt,
  type PeekerDrive,
  type PeekerLimbs,
} from '@/components/labs/small-world/scene/props/peeker-cast'
import { buildMergedClay } from '@/components/labs/small-world/scene/props/clay-kit'
import {
  PEEKER_FIGURE_BOX,
  PEEKER_MAX_SWAY,
  peekerIdle,
  peekerUnroll,
  type PeekerKind,
} from '@/components/labs/small-world/scene/props/peeker-stage'

// Task 53 — the per-character idle gestures. They are written straight onto three Groups, so
// these pins exercise the real objects: the gesture must be a pure function of the drive (scrub
// back and the pose comes back identical), bounded (nothing whips), and mirrored correctly for
// the right-hand corner (a jaw that opens down on the left must not open up on the right).

const KINDS = Object.keys(PEEKER_SPECS) as PeekerKind[]

function freshLimbs(): PeekerLimbs {
  return { a: new THREE.Group(), b: new THREE.Group(), c: new THREE.Group() }
}

function pose(limbs: PeekerLimbs): number[] {
  return [limbs.a, limbs.b, limbs.c].flatMap((g) =>
    g ? [g.rotation.x, g.rotation.y, g.rotation.z, g.scale.x, g.scale.y, g.scale.z] : []
  )
}

function driveAt(kind: PeekerKind, t: number): PeekerDrive {
  const spec = PEEKER_SPECS[kind]
  return { idle: peekerIdle(t, spec.cycles, 0), unroll: spec.rolls ? peekerUnroll(t) : 1 }
}

describe('peeker gestures', () => {
  it('poses purely from the drive — the same dwell fraction always rebuilds the same pose', () => {
    for (const kind of KINDS) {
      for (const t of [0.1, 0.37, 0.5, 0.63, 0.9]) {
        const first = freshLimbs()
        const second = freshLimbs()
        PEEKER_SPECS[kind].apply(first, driveAt(kind, t), 1)
        PEEKER_SPECS[kind].apply(second, driveAt(kind, t), 1)
        expect(pose(first), `${kind} @ ${t}`).toEqual(pose(second))
      }
    }
  })

  it('replays exactly when the dwell is scrubbed backwards', () => {
    for (const kind of KINDS) {
      const limbs = freshLimbs()
      const forward: number[][] = []
      for (let i = 0; i <= 60; i++) {
        PEEKER_SPECS[kind].apply(limbs, driveAt(kind, i / 60), 1)
        forward.push(pose(limbs))
      }
      for (let i = 60; i >= 0; i--) {
        PEEKER_SPECS[kind].apply(limbs, driveAt(kind, i / 60), 1)
        expect(pose(limbs), `${kind} @ ${i}`).toEqual(forward[i])
      }
    }
  })

  it('stays inside a sane range — no limb spins away from its figure', () => {
    for (const kind of KINDS) {
      const limbs = freshLimbs()
      for (let i = 0; i <= 400; i++) {
        PEEKER_SPECS[kind].apply(limbs, driveAt(kind, i / 400), 1)
        for (const g of [limbs.a, limbs.b, limbs.c]) {
          if (!g) continue
          expect(Math.abs(g.rotation.x)).toBeLessThanOrEqual(Math.PI)
          expect(Math.abs(g.rotation.y)).toBeLessThanOrEqual(Math.PI)
          expect(Math.abs(g.rotation.z)).toBeLessThanOrEqual(Math.PI)
          expect(g.scale.x).toBeGreaterThan(0.3)
          // the pangolin shell stretches past 1 as it unfurls; nothing may balloon beyond that
          expect(g.scale.x).toBeLessThanOrEqual(1.4)
        }
      }
    }
  })

  it('moves smoothly across the dwell — nothing in the flicker family', () => {
    const N = 2000
    for (const kind of KINDS) {
      const limbs = freshLimbs()
      let prev: number[] | null = null
      let worst = 0
      for (let i = 0; i <= N; i++) {
        PEEKER_SPECS[kind].apply(limbs, driveAt(kind, i / N), 1)
        const cur = pose(limbs)
        if (prev) for (let k = 0; k < cur.length; k++) worst = Math.max(worst, Math.abs(cur[k] - prev[k]))
        prev = cur
      }
      expect(worst, `${kind} worst per-sample step`).toBeLessThan(0.01)
    }
  })

  it('mirrors for the right-hand corner: EVERY channel of EVERY limb', () => {
    // Reflecting a figure across the YZ plane negates Euler y and z, leaves x, and leaves scale.
    // All three slots and all three rotation axes are checked: an earlier version compared only
    // rotation.z on limbs a and b, and so was blind to the two gestures that were writing an
    // un-mirrored YAW (applyChew and applyUnroll). Sampled across the dwell because a gesture
    // that happens to be at rest at one t would make any of this vacuous.
    for (const kind of KINDS) {
      for (const t of [0.12, 0.29, 0.38, 0.5, 0.62, 0.77, 0.88]) {
        const left = freshLimbs()
        const right = freshLimbs()
        const drive = driveAt(kind, t)
        PEEKER_SPECS[kind].apply(left, drive, 1)
        PEEKER_SPECS[kind].apply(right, drive, -1)
        for (const slot of ['a', 'b', 'c'] as const) {
          const l = left[slot]
          const r = right[slot]
          if (!l || !r) continue
          const where = `${kind}.${slot} @ ${t}`
          expect(r.rotation.x, `${where} pitch`).toBeCloseTo(l.rotation.x, 12)
          expect(r.rotation.y, `${where} yaw`).toBeCloseTo(-l.rotation.y, 12)
          expect(r.rotation.z, `${where} roll`).toBeCloseTo(-l.rotation.z, 12)
          expect(r.scale.toArray(), `${where} scale`).toEqual(l.scale.toArray())
        }
      }
    }
  })

  it('exercises a non-zero yaw and a limb c, so the mirror check cannot pass vacuously', () => {
    // Guards the test above: if every yaw and every c-slot were always zero it would assert
    // nothing about them. These are the exact channels that were previously uncovered.
    let sawYaw = false
    let sawSlotC = false
    for (const kind of KINDS) {
      for (const t of [0.12, 0.29, 0.38, 0.5, 0.62, 0.77, 0.88]) {
        const limbs = freshLimbs()
        PEEKER_SPECS[kind].apply(limbs, driveAt(kind, t), 1)
        if (limbs.a && Math.abs(limbs.a.rotation.y) > 1e-6) sawYaw = true
        if (limbs.c && limbs.c.scale.x !== 1) sawSlotC = true
      }
    }
    expect(sawYaw).toBe(true)
    expect(sawSlotC).toBe(true)
  })

  it('tucks the pangolins into a ball before the unroll window and opens them after', () => {
    for (const kind of ['pangolinBig', 'pangolinSmall'] as const) {
      const rolled = freshLimbs()
      const open = freshLimbs()
      PEEKER_SPECS[kind].apply(rolled, { idle: 0, unroll: 0 }, 1)
      PEEKER_SPECS[kind].apply(open, { idle: 0, unroll: 1 }, 1)
      // tucked: head swung back into the shell and shrunk small enough to hide inside it
      expect(rolled.a!.rotation.z).toBeGreaterThan(2)
      expect(rolled.a!.scale.x).toBeLessThan(0.5)
      // open: head out front at rest, tail trailing, both at full size
      expect(Math.abs(open.a!.rotation.z)).toBeLessThan(0.3)
      expect(open.a!.scale.x).toBeCloseTo(1, 10)
      expect(open.b!.scale.x).toBeCloseTo(1, 10)
      expect(open.b!.rotation.z).toBeGreaterThan(rolled.b!.rotation.z)
    }
  })
})

// --- the figure envelope, MEASURED -------------------------------------------
//
// PEEKER_FIGURE_BOX is load-bearing: both clearance benches in peeker-stage.test.ts use it as the
// figure's extent, and a figure that quietly outgrew it would make both of them optimistic. So
// build the real merged geometry, reproduce the scene graph exactly (root tilt → limb joint →
// limb transform), sweep the gesture range, and measure the true vertex extent.

/** Mirrors the scene graph PeekerFigure builds, so the measurement includes joints and gestures. */
function figureRig(kind: PeekerKind, dir: 1 | -1) {
  const root = new THREE.Group()
  root.rotation.z = peekerRootTilt(kind, dir)
  const limbs: PeekerLimbs = { a: null, b: null, c: null }
  const meshes: { obj: THREE.Object3D; geo: THREE.BufferGeometry }[] = []
  for (const piece of peekerPieces(kind, dir)) {
    const geo = buildMergedClay(piece.parts)
    const holder = new THREE.Object3D()
    if (piece.slot === 'body') {
      holder.position.set(...piece.at)
      root.add(holder)
    } else {
      const joint = new THREE.Group()
      joint.position.set(...piece.at)
      joint.add(holder)
      root.add(joint)
      limbs[piece.slot] = joint
    }
    meshes.push({ obj: holder, geo })
  }
  return { root, limbs, meshes }
}

type Box = { minX: number; maxX: number; minY: number; maxY: number; absZ: number }

const EMPTY: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, absZ: 0 }

/** Signed local bounding box over the whole gesture range — per axis, because a raised wingtip
 *  and a downward reach are different questions for the clearance benches. */
function measureBox(kind: PeekerKind, dir: 1 | -1): Box {
  const { root, limbs, meshes } = figureRig(kind, dir)
  const spec = PEEKER_SPECS[kind]
  const v = new THREE.Vector3()
  const box: Box = { ...EMPTY }
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    for (const idle of [-1, 0, 1]) {
      spec.apply(limbs, { idle, unroll: spec.rolls ? peekerUnroll(t) : 1 }, dir)
      root.updateMatrixWorld(true)
      for (const { obj, geo } of meshes) {
        const pos = geo.attributes.position
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(obj.matrixWorld)
          box.minX = Math.min(box.minX, v.x)
          box.maxX = Math.max(box.maxX, v.x)
          box.minY = Math.min(box.minY, v.y)
          box.maxY = Math.max(box.maxY, v.y)
          box.absZ = Math.max(box.absZ, Math.abs(v.z))
        }
      }
    }
  }
  for (const { geo } of meshes) geo.dispose()
  return box
}

function unionBox(dir: 1 | -1): Box {
  const out: Box = { ...EMPTY }
  for (const kind of KINDS) {
    const b = measureBox(kind, dir)
    out.minX = Math.min(out.minX, b.minX)
    out.maxX = Math.max(out.maxX, b.maxX)
    out.minY = Math.min(out.minY, b.minY)
    out.maxY = Math.max(out.maxY, b.maxY)
    out.absZ = Math.max(out.absZ, b.absZ)
  }
  return out
}

describe('the figure bounding box the clearance benches rest on', () => {
  it('every character fits inside PEEKER_FIGURE_BOX, in every pose, both facings', () => {
    const b = PEEKER_FIGURE_BOX
    for (const dir of [1, -1] as const) {
      const u = unionBox(dir)
      // the right-hand figure is the authored box mirrored, so compare against the mirror
      const lo = dir === 1 ? b.minX : -b.maxX
      const hi = dir === 1 ? b.maxX : -b.minX
      expect(u.minX, `minX dir ${dir}`).toBeGreaterThanOrEqual(lo)
      expect(u.maxX, `maxX dir ${dir}`).toBeLessThanOrEqual(hi)
      expect(u.minY, `minY dir ${dir}`).toBeGreaterThanOrEqual(b.minY)
      expect(u.maxY, `maxY dir ${dir}`).toBeLessThanOrEqual(b.maxY)
      expect(u.absZ, `absZ dir ${dir}`).toBeLessThanOrEqual(b.absZ)
    }
  })

  it('is tight — a box much larger than the figures would make the benches slack', () => {
    const u = unionBox(1)
    const b = PEEKER_FIGURE_BOX
    expect(Math.abs(u.minX - b.minX)).toBeLessThan(0.05)
    expect(Math.abs(u.maxX - b.maxX)).toBeLessThan(0.05)
    expect(Math.abs(u.minY - b.minY)).toBeLessThan(0.05)
    expect(Math.abs(u.maxY - b.maxY)).toBeLessThan(0.05)
    expect(Math.abs(u.absZ - b.absZ)).toBeLessThan(0.05)
  })

  it('is facing-symmetric — a mirrored figure occupies the mirrored envelope', () => {
    const l = unionBox(1)
    const r = unionBox(-1)
    expect(r.minX).toBeCloseTo(-l.maxX, 9)
    expect(r.maxX).toBeCloseTo(-l.minX, 9)
    expect(r.minY).toBeCloseTo(l.minY, 9)
    expect(r.maxY).toBeCloseTo(l.maxY, 9)
    expect(r.absZ).toBeCloseTo(l.absZ, 9)
  })

  it('no character asks for more sway than the benches sweep', () => {
    for (const kind of KINDS) expect(PEEKER_SPECS[kind].sway, kind).toBeLessThanOrEqual(PEEKER_MAX_SWAY)
  })
})

describe('facing() — the reflection the "no negative scale" claim rests on', () => {
  const part = () => ({
    geo: new THREE.BoxGeometry(1, 1, 1),
    color: '#000000',
    pos: [0.3, 0.4, 0.5] as [number, number, number],
    rot: [0.1, 0.2, 0.3] as [number, number, number],
    scl: [1.5, 1, 1] as [number, number, number],
  })

  it('is the identity for the left-hand facing', () => {
    const p = part()
    expect(facing(1, [p])[0]).toBe(p)
  })

  it('negates x offsets and the two Euler components that live in the reflected planes', () => {
    const [m] = facing(-1, [part()])
    expect(m.pos).toEqual([-0.3, 0.4, 0.5])
    expect(m.rot).toEqual([0.1, -0.2, -0.3])
  })

  it('never introduces a negative scale — that would invert every normal', () => {
    for (const kind of KINDS) {
      for (const dir of [1, -1] as const) {
        for (const piece of peekerPieces(kind, dir)) {
          for (const p of piece.parts) {
            for (const s of p.scl ?? [1, 1, 1]) expect(s, `${kind}/${dir}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('round-trips: reflecting twice restores the original placement', () => {
    const [back] = facing(-1, facing(-1, [part()]))
    expect(back.pos).toEqual([0.3, 0.4, 0.5])
    expect(back.rot).toEqual([0.1, 0.2, 0.3])
  })
})
