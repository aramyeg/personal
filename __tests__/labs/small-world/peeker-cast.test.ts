import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  PEEKER_SPECS,
  type PeekerDrive,
  type PeekerLimbs,
} from '@/components/labs/small-world/scene/props/peeker-cast'
import { peekerIdle, peekerUnroll, type PeekerKind } from '@/components/labs/small-world/scene/props/peeker-stage'

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

  it('mirrors for the right-hand corner: every hinge swings the opposite way', () => {
    for (const kind of KINDS) {
      const left = freshLimbs()
      const right = freshLimbs()
      const drive = driveAt(kind, 0.62)
      PEEKER_SPECS[kind].apply(left, drive, 1)
      PEEKER_SPECS[kind].apply(right, drive, -1)
      for (const [l, r] of [
        [left.a, right.a],
        [left.b, right.b],
      ] as const) {
        if (!l || !r) continue
        expect(r.rotation.z, `${kind} hinge`).toBeCloseTo(-l.rotation.z, 10)
        expect(r.scale.x).toBeCloseTo(l.scale.x, 10)
      }
    }
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
