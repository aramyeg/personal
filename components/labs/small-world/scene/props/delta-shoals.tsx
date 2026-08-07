'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { clusterPlacements, InstancedFamilies, type ClusterSpec, type FamilySpec } from './approach-kit'
import type { JourneyRef } from '../use-journey'

/**
 * A2 GRAND DELTA — BRAIDED SHOALS (Task 86). Fills approach-kit's cluster sampler with this
 * wedge's OWN grammar: water splitting land into ribbons, read through overlapping mass —
 * sandbar streaks, dense dark reed clumps, a few wide mangrove thickets at the limb, and a
 * couple of readable mid-scale objects where the foreshortening is shallow enough to read them.
 *
 * THE DEFECT: at chapter 2's own checkpoint the bottom third of the planet — this wedge's
 * approach, foreshortened ~6:1 — was a bald olive-green dome (see approach-kit's header for why
 * that compression is unforgiving of anything but overlapping mass). At chapter 3's checkpoint
 * the delta's own lower-middle band was thin. delta.tsx already dresses this wedge's INTERIOR
 * (theta ≈ 5.5–6.05, t ≈ 0.52–0.71 here): every window below is chosen to sit OUTSIDE that
 * range, so this file complements delta.tsx rather than re-painting it.
 *
 * ZONES (t = travel fraction of chapter 2, x = lateral world offset, girl's lane at x=0):
 *   Zone A "approach"  t ∈ [0.02, 0.32], |x| ∈ [0.50, 1.65] — the PRIORITY bald-dome fix.
 *     Screen-x at the checkpoint maps to THIS x, not longitude, so the rim (sandbars/reeds/
 *     mangroves toward |x| ≈ 1.65) and the dome's FACE (low |x|, the ground-fleck band below)
 *     are two different sub-regions of the same zone and need different treatment.
 *   Zone B "tail"       t ∈ [0.72, 1.00], |x| ∈ [0.50, 1.55] — starts just past delta.tsx's
 *     furthest lurker (the stilt hut, t ≈ 0.71), so the two files' content never overlaps.
 *
 * DRAW CALLS / TRIANGLES (self-reported, before any dry/channel rejection — rejection can
 * only shrink these): 6 InstancedMesh total.
 *   sandbars        ~79 instances ×  80 tri  ≈  6.3k
 *   reed beds      ~140 instances ×  48 tri  ≈  6.7k
 *   mangrove trunks   5 instances × 252 tri  ≈  1.3k
 *   mangrove canopy   5 instances ×  80 tri  ≈  0.4k
 *   beach debris      3 instances × 108 tri  ≈  0.3k
 *   ground fleck   ~126 instances ×  64 tri  ≈  8.1k
 *   total ≈ 23.1k triangles, comfortably under the 45k budget.
 *
 * REVISION LOG.
 * Round 1 (blind capture at the real checkpoints): sandbars read as pale cut-paper patches and
 * reeds as brown straw, not landscape. Fixed by rescaling the sandbars (~2x too big) with the
 * arithmetic inline, moving the sandbar majority tone down toward deltaSilt (BAR_TONE) with
 * plain deltaSand demoted to a minority "crest" accent, and darkening + densifying the reeds
 * (pineDeep majority, tighter clumps).
 * Round 3 (one more capture): rim (the mangrove/reed band toward the limb) reads well, but the
 * FACE of the dome — low |x|, roughly [0.48, 1.00] — was still bare olive with only a scatter of
 * sparse props on it, the largest untextured area left in the lab. Fixed by adding the ground
 * fleck family (small pebble/shell/mud-patch decals, centred |x| ≈ 0.70 so the hard lane guard
 * at |x| ≥ 0.45 doesn't eat the inward edge of the cluster) and folding the old separate
 * driftwood-log and bar-creature families into one "beach debris" compound so the draw-call
 * budget had room for it — sandbars, reeds and mangroves are untouched from round 1.
 */

const CHAPTER = 2 // A2 grand delta, lap-1 (A)
const VARIANT = 0 as const

const ZONE_A_T: [number, number] = [0.02, 0.32]
const ZONE_A_X: [number, number] = [0.5, 1.65]
const ZONE_B_T: [number, number] = [0.72, 1.0]
const ZONE_B_X: [number, number] = [0.5, 1.55]

/**
 * The majority sandbar tone (round-1 fix #2): the reviewer's read was that plain deltaSand sits
 * far enough above deltaSilt in value that every bar cut a hard edge against its own ground — a
 * wet bar should be only "a step lighter than its own mud." Lerped 60% of the way from deltaSand
 * toward deltaSilt so the bulk of the family sinks into the ground colour; plain deltaSand is
 * kept as the minority (1-in-3) "crest" accent below, which is the only lighter note left.
 * Computed once at module load — deterministic, not a runtime/random value.
 */
const BAR_TONE = '#' + new THREE.Color(PALETTE.deltaSand).lerp(new THREE.Color(PALETTE.deltaSilt), 0.6).getHexString()

// --- geometry builders --------------------------------------------------------------------

/**
 * Flat wide ellipsoid — a squashed bar of wet silt. 8×6 sphere baked anisotropic.
 *
 * ROUND-1 SCALE FIX: the previous build (radius 0.22, scale 1.45×0.13×0.82) produced a base
 * ~0.64 long × 0.057 tall × 0.36 wide, and the [0.65,1.3] member-scale range could push a bar to
 * ~0.83 long — roughly 2x the reviewer's ceiling (long ≤0.40, tall <0.05, wide <0.18). Recomputed
 * from a 0.30-diameter sphere (radius 0.15): base extents 0.30 long × 0.036 tall × 0.135 wide: at
 * the new member-scale ceiling of 1.15 that's 0.345 / 0.0414 / 0.155 — all under cap with margin.
 * ~80 tri (segment count unchanged).
 */
function makeSandbarGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.15, 8, 6)
  g.scale(1.0, 0.12, 0.45)
  return g
}

/**
 * A tuft of short, densely-fanned blades — the delta's marsh-grass unit, merged into ONE
 * geometry so a whole tuft is a single instance. ROUND-1 FIX: shortened (H 0.27→0.16) and
 * thickened (W0 0.011→0.014, blades 6→8) per the reviewer's "shorter and denser rather than
 * tall and sparse" — tall thin sparse blades at this foreshortening were the poultry-leg defect
 * in miniature. 8 blades × 3 segs × 2 tri = 48 tri.
 */
function makeReedTuftGeometry(): THREE.BufferGeometry {
  const blades = 8
  const seg = 3
  const H = 0.16 // blade height (shortened)
  const LEAN = 0.025 // outward lean reach (tightened, so the tuft stays a compact mass)
  const W0 = 0.014 // base half-width (thickened for coverage)
  const verts: number[] = []
  const push = (v: THREE.Vector3) => verts.push(v.x, v.y, v.z)
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.35
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const L: THREE.Vector3[] = []
    const Rr: THREE.Vector3[] = []
    for (let s = 0; s <= seg; s++) {
      const p = s / seg
      const y = H * p
      const rad = LEAN * p * p
      const w = W0 * (1 - p * 0.85)
      const cx = rad * ca
      const cz = rad * sa
      L.push(new THREE.Vector3(cx - w * -sa, y, cz - w * ca))
      Rr.push(new THREE.Vector3(cx + w * -sa, y, cz + w * ca))
    }
    for (let s = 0; s < seg; s++) {
      push(L[s]); push(Rr[s]); push(Rr[s + 1])
      push(L[s]); push(Rr[s + 1]); push(L[s + 1])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  g.computeVertexNormals()
  return g
}

/** A local-only clone of clay-kit's merge idiom (position + normal, NO vertex colour) — the
 *  InstancedFamilies pathway tints a whole instance from FamilySpec.color/colorDeep, so a
 *  vertex-coloured geometry (buildMergedClay) would carry an attribute nothing reads. Kept
 *  here rather than exported from clay-kit because this task owns exactly one file. */
type RawPart = {
  geo: THREE.BufferGeometry
  pos?: [number, number, number]
  rot?: [number, number, number]
  scl?: [number, number, number]
}
function mergeRaw(parts: RawPart[]): THREE.BufferGeometry {
  const q = new THREE.Quaternion()
  const positions: number[] = []
  const normals: number[] = []
  for (const part of parts) {
    q.setFromEuler(new THREE.Euler(...(part.rot ?? [0, 0, 0])))
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(part.pos ?? [0, 0, 0])),
      q,
      new THREE.Vector3(...(part.scl ?? [1, 1, 1]))
    )
    const g = part.geo.toNonIndexed()
    g.applyMatrix4(m)
    const pos = g.attributes.position.array as ArrayLike<number>
    const nor = g.attributes.normal.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i])
      normals.push(nor[i])
    }
    g.dispose()
    part.geo.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return out
}

/** A WIDE multi-trunk mangrove thicket: THREE short splayed trunks (each on its own tripod of
 *  prop roots) baked into one merged mesh, so "every upright has a neighbour" holds by
 *  construction rather than by hoping the scatter lands two together — this is the fix for the
 *  "poultry leg" defect a single foreshortened trunk reads as. Canopy rides separately (below)
 *  so it can use a different colour family. ~252 tri (3 trunks × 24 + 9 roots × 20). */
function makeMangroveClumpGeometry(): THREE.BufferGeometry {
  const parts: RawPart[] = []
  const trunks: Array<[number, number]> = [
    [0, 0.07],
    [-0.07, -0.045],
    [0.07, -0.045],
  ]
  for (const [tx, tz] of trunks) {
    parts.push({ geo: new THREE.CylinderGeometry(0.024, 0.03, 0.2, 6), pos: [tx, 0.19, tz] })
    const roots = 3
    for (let r = 0; r < roots; r++) {
      const a = (r / roots) * Math.PI * 2 + tx * 3
      parts.push({
        geo: new THREE.CylinderGeometry(0.009, 0.018, 0.19, 5),
        pos: [tx + 0.065 * Math.cos(a), 0.09, tz + 0.065 * Math.sin(a)],
        rot: [Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65],
      })
    }
  }
  return mergeRaw(parts)
}

/** The clump's canopy cap — an 8×6 sphere the family's `local` flattens + widens well past its
 *  height, so it reads as broader-than-tall (the limb-silhouette requirement). ~80 tri. */
function makeCanopyGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.24, 8, 6)
}

/**
 * ROUND-3: the driftwood log and the bar-creature used to be two separate 1-instance-each
 * families (2 draw calls for 4 total objects). Folded into ONE compound "beach debris" unit — a
 * tapered log lying on its side (rotated so its long axis runs local-X — a log lies flat, it
 * never stands) with a small squashed dome bump beside it — so the round-3 ground-fleck family
 * below fits inside the 6-draw budget without enlarging the wedge's Zone-B footprint (3 compound
 * placements now vs. 4 separate objects before). ~108 tri (log ~28 + dome ~80).
 */
function makeBeachDebrisGeometry(): THREE.BufferGeometry {
  return mergeRaw([
    { geo: new THREE.CylinderGeometry(0.028, 0.045, 0.42, 7), pos: [0, 0.03, 0], rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.SphereGeometry(0.05, 8, 6), pos: [0.13, 0.033, 0.07], scl: [1.3, 0.6, 1.05] },
  ])
}

/**
 * ROUND-3 GROUND FLECK — the fix for the bare dome FACE (low |x|, the largest untextured area
 * the round-3 capture found). A tiny compound decal: one flat wet-mud patch + two small
 * pebbles/shells offset from its centre, so a SINGLE instance already reads as "a bit of dressed
 * ground" rather than a bare fleck; clusterPlacements then repeats 6-12 of these tightly per
 * cluster for the requested pebble/shell scatter, with the size gradient carried by Placed.s
 * (the spec's [0.4, 1.4] scale range). 6-sided patch + two 20-tri icosahedra: ~64 tri.
 */
function makeGroundFleckGeometry(): THREE.BufferGeometry {
  return mergeRaw([
    { geo: new THREE.CylinderGeometry(0.05, 0.06, 0.012, 6), pos: [0, 0.006, 0] },
    { geo: new THREE.IcosahedronGeometry(0.02, 0), pos: [0.035, 0.014, 0.02], scl: [1, 0.7, 1] },
    { geo: new THREE.IcosahedronGeometry(0.013, 0), pos: [-0.03, 0.01, -0.025], scl: [1, 0.65, 1] },
  ])
}

// --- placement specs -----------------------------------------------------------------------

// ROUND-1: member-scale ceiling dropped 1.3→1.15 (see makeSandbarGeometry's arithmetic) so no
// bar can cross the reviewer's size caps.
const sandbarSpec = (t: [number, number], x: [number, number], clusters: number, seed: number): ClusterSpec => ({
  chapter: CHAPTER, variant: VARIANT, t, x, clusters,
  perCluster: [4, 7], spreadT: 0.05, spreadX: 0.07, scale: [0.65, 1.15], seed,
})
// ROUND-1: spreadT/spreadX tightened (0.022/0.035 → 0.014/0.02) and perCluster raised (6-10 →
// 8-12) so members overlap into one dark mass instead of reading as separated straws.
const reedSpec = (t: [number, number], x: [number, number], clusters: number, seed: number): ClusterSpec => ({
  chapter: CHAPTER, variant: VARIANT, t, x, clusters,
  perCluster: [8, 12], spreadT: 0.014, spreadX: 0.02, scale: [0.6, 1.0], seed,
})
// ROUND-1: scale range cut ~0.7x (0.85-1.25 → 0.6-0.88) per the reviewer's "cut to about 0.7x" —
// applies uniformly to both the trunk and canopy layers below, since they share this placed list.
const clumpSpec = (t: [number, number], x: [number, number], clusters: number, seed: number): ClusterSpec => ({
  chapter: CHAPTER, variant: VARIANT, t, x, clusters,
  perCluster: [1, 1], spreadT: 0.01, spreadX: 0.01, scale: [0.6, 0.88], seed,
})
// ROUND-3: the dome's FACE — low |x|, roughly [0.48, 1.00] in the checkpoint capture — was the
// largest bare area left. approach-kit enforces a hard |x| >= 0.45 lane guard AFTER jitter, so
// the cluster CENTRE is placed at |x| ≈ 0.60-0.85 (avg ≈ 0.72) rather than right at 0.50 — with
// spreadX 0.12 the worst-case member still lands at |x| ≈ 0.48, clear of the guard by a margin.
const fleckSpec: ClusterSpec = {
  chapter: CHAPTER, variant: VARIANT, t: [0.04, 0.26], x: [0.6, 0.85], side: 0, clusters: 14,
  perCluster: [6, 12], spreadT: 0.035, spreadX: 0.12, scale: [0.4, 1.4], seed: 511,
}

/**
 * The A2 grand delta's braided-shoals dressing (Task 86): sandbar ribbons for ground cover,
 * reed beds for the wedge's one dark note, a handful of wide mangrove thickets at the limb, a
 * few beach-debris readables in Zone B, and (round 3) a dense ground-fleck scatter dressing the
 * dome's FACE at low |x|, where the rim families don't reach. Every family is variant 0 (lap-1 /
 * A) — InstancedFamilies gates each instance by the renewal front at its own longitude, exactly
 * the Forest/Jungle/Delta contract.
 */
export function DeltaShoals({ journeyRef }: { journeyRef: JourneyRef }) {
  const families = useMemo<FamilySpec[]>(() => {
    // Reusable scratch matrices for the `local` callbacks below — safe because
    // InstancedFamilies calls them synchronously, one instance at a time.
    const yawT = new THREE.Matrix4()
    const liftT = new THREE.Matrix4()
    const scaleT = new THREE.Matrix4()
    const yawOnly = (m: THREE.Matrix4, p: { yaw: number }) => m.makeRotationY(p.yaw)

    // 1) SANDBAR RIBBONS — ground-cover variation, echeloned into streaks (small spreadX,
    // larger spreadT) rather than blobs, so the bald dome reads as overlapping bars instead of
    // a flat smear. No verticals at all — this family alone must not read as "props," only as
    // ground texture.
    const sandbars = [
      ...clusterPlacements(sandbarSpec(ZONE_A_T, ZONE_A_X, 10, 101)),
      ...clusterPlacements(sandbarSpec(ZONE_B_T, ZONE_B_X, 6, 131)),
    ]

    // 2) REED BEDS — dense, tightly overlapping clumps hugging the sandbar edges: the wedge's
    // one DARK note against an otherwise mid-value dome. ROUND-1: majority tone is now pineDeep
    // (a genuinely dark green — the previous pine/deltaMoss pair sat too close to the ground's
    // own value and read as brown straw); the reference's readable "one decorated edge" comes
    // from overlapping mass like this, not from spacing.
    const reeds = [
      ...clusterPlacements(reedSpec(ZONE_A_T, ZONE_A_X, 9, 211)),
      ...clusterPlacements(reedSpec(ZONE_B_T, ZONE_B_X, 5, 241)),
    ]

    // 3) MANGROVE CLUMPS — a handful of wide thickets right at the limb (|x| toward 1.65),
    // where the silhouette is drawn. Each clump is inherently multi-trunk (baked into its own
    // geometry), so it can never present as the isolated vertical this whole task exists to
    // remove, however the placement scatter lands.
    const clumps = [
      ...clusterPlacements(clumpSpec(ZONE_A_T, [1.15, 1.65], 3, 311)),
      ...clusterPlacements(clumpSpec(ZONE_B_T, [1.1, 1.55], 2, 331)),
    ]

    // 4) BEACH DEBRIS — Zone B ONLY, where chapter 2's own checkpoint foreshortens less than the
    // next wedge's approach does. ROUND-3: the two old separate 1-instance families (a driftwood
    // log, a bar creature) are now one compound object (see makeBeachDebrisGeometry) at 3 placements
    // with a scale spread (0.7-1.3) for size variety — this freed the draw-call slot ground fleck
    // (below) needed.
    const debris = clusterPlacements({
      chapter: CHAPTER, variant: VARIANT, t: [0.76, 0.95], x: [0.55, 1.25], clusters: 3,
      perCluster: [1, 1], spreadT: 0.01, spreadX: 0.01, scale: [0.7, 1.3], seed: 431,
    })

    // 5) GROUND FLECK — Zone A, INWARD band (|x| ≈ 0.48-1.00, t ∈ [0.04, 0.26]): small pebble/
    // shell/mud-patch decals so the dome's FACE (not just its rim) reads as dressed ground at
    // reading distance. See fleckSpec's comment for the lane-guard margin.
    const flecks = clusterPlacements(fleckSpec)

    return [
      // majority = BAR_TONE (silt-mixed, muted); minority third = plain deltaSand, the one
      // lighter "crest" note the reviewer asked to keep — see BAR_TONE's comment above.
      { placed: sandbars, geometry: makeSandbarGeometry(), color: BAR_TONE, colorDeep: PALETTE.deltaSand, local: yawOnly },
      // majority = pineDeep (genuinely dark); minority third = deltaMoss, a lighter-but-still-
      // dark accent so the mass isn't flat, never straying toward the strawy tones round 1 had.
      { placed: reeds, geometry: makeReedTuftGeometry(), color: PALETTE.pineDeep, colorDeep: PALETTE.deltaMoss, local: yawOnly },
      { placed: clumps, geometry: makeMangroveClumpGeometry(), color: PALETTE.mangroveBark, local: yawOnly },
      {
        placed: clumps,
        geometry: makeCanopyGeometry(),
        color: PALETTE.mossHang,
        colorDeep: PALETTE.deltaMoss,
        local: (m, p) => {
          yawT.makeRotationY(p.yaw)
          liftT.makeTranslation(0, 0.34, 0)
          scaleT.makeScale(1.7, 0.3, 1.7)
          m.multiply(liftT).multiply(yawT).multiply(scaleT)
        },
      },
      { placed: debris, geometry: makeBeachDebrisGeometry(), color: PALETTE.nestStick, colorDeep: PALETTE.nestStickDeep, local: yawOnly },
      // majority = deltaSilt (matches the base ground — "close to ground colour" is the point);
      // minority third = BAR_TONE, the same lightened-crest note the sandbars use, so the fleck
      // scatter reads as kin to the sandbars rather than a fourth unrelated material.
      { placed: flecks, geometry: makeGroundFleckGeometry(), color: PALETTE.deltaSilt, colorDeep: BAR_TONE, local: yawOnly },
    ]
  }, [])

  return <InstancedFamilies families={families} variant={VARIANT} journeyRef={journeyRef} />
}
