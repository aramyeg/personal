'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { canonicalTheta } from '../renewal'
import { useClayRamp } from '../toon-ramp'
import { buildMergedClay, ClayFrozenFall, type ClayPart } from './clay-kit'
import { GatedProp } from './gated-prop'
import {
  clusterPlacements,
  InstancedFamilies,
  type FamilySpec,
  type LocalFn,
  type Placed,
} from './approach-kit'
import { EGG_THETA, EGG_X } from './yeti-egg'
import type { JourneyRef } from '../use-journey'

/**
 * TASK 86 — DRESSING CHAPTER 5'S FRAME BY DRESSING CHAPTER 6'S APPROACH.
 *
 * The journey camera is static and the planet turns under it, so the bottom third of the
 * frame at a checkpoint is the NEXT wedge's own approach (approach-kit's header derives the
 * projection). Chapter 5 (index 4)'s checkpoint bottom third is therefore this file's
 * subject even though it lives inside the WINTER wedge (chapter index 5, variant 1 — lap-2 /
 * "B"). The audit evidence: a pale, bald dome below y≈540 at chapter 5's stop, with a thin
 * sparse row of conifers on the right edge only. No mass, no dark note, no silhouette.
 *
 * The fix is this wedge's own grammar — CONIFER STANDS + SNOW DRIFTS + BOULDER/STUMP GROUPS
 * — applied to the two windows that actually paint the frames that matter:
 *
 *   ZONE A "approach"  t ∈ [0.02, 0.32], |x| ∈ [0.50, 1.65] — chapter 5's bottom third. THE
 *                       PRIORITY: this is the whole reason the file exists, so it gets the
 *                       conifer stands (the dark note), the densest drifts and the boulder
 *                       clusters, plus the two hero silhouette accents.
 *   ZONE B "tail"      t ∈ [0.72, 1.00], |x| ∈ [0.50, 1.55] — winter's OWN lower-middle. The
 *                       ending plays over this wedge, so it stays light: ground-cover only
 *                       (drifts + a few boulders), no tall mass, nothing that competes with
 *                       the still beat.
 *
 * Both zones are read through `clusterPlacements` (approach-kit), never a flat scatter — an
 * isolated upright prop at this band's ~6:1 foreshortening reads as a dangling leg or a drip
 * (the audit's own words for chapter 3's palms and chapter 4's geysers), and clumped, jittered
 * members with real overlap are what buys chapter 1's "one decorated edge" instead.
 */

const CHAPTER = 5 // winter wedge index
const VARIANT = 1 as const // lap-2 / B

const ZONE_A_T: [number, number] = [0.02, 0.32]
const ZONE_A_X: [number, number] = [0.5, 1.65]
const ZONE_B_T: [number, number] = [0.72, 1.0]
const ZONE_B_X: [number, number] = [0.5, 1.55]

// --- the yeti hotspot exclusion ---------------------------------------------------------
//
// `yeti-egg.tsx` hides the click easter egg at (EGG_THETA 6.15, EGG_X 0.8) — on the winter
// wedge's right-hand flank, at the EDGE of the Forest's own SNOW_CAP conifer scatter (that
// file's own comment: "0.559 rad off that centre... at the edge of the instanced scatter").
// Converting EGG_THETA into this wedge's own (t, x) space (chapterTheta(5, t) = (5+t)·
// CHAPTER_SLICE + STANCE_ALPHA, CHAPTER_SLICE = 2π/3, STANCE_ALPHA ≈ 0.348) puts the egg at
// t ≈ 0.770 — just inside ZONE B's window, not zone A, so zone A carries no risk at all.
// Zone B's own drift/boulder windows DO reach that t, so every zone-B cluster call below is
// filtered through `clearOfYeti`: a rectangular clearance in (canonical theta, world x)
// around the egg's own point, wide enough that nothing new sits on top of it or immediately
// screens the trunk it peeks from. This is a real exclusion, not a hopeful window edge — the
// filter runs on the actual placed positions, after jitter, not on the cluster centres.
const EGG_TC = canonicalTheta(EGG_THETA)
const EGG_THETA_MARGIN = 0.16 // rad — roughly the SNOW_CAP forest's own member spacing
const EGG_X_MARGIN = 0.32 // world units

function angularGap(a: number, b: number): number {
  const TWO_PI = Math.PI * 2
  let d = (a - b) % TWO_PI
  if (d < 0) d += TWO_PI
  if (d > Math.PI) d = TWO_PI - d
  return d
}

/** True when a placed member sits clear of the yeti's hotspot footprint. */
function clearOfYeti(p: Placed): boolean {
  return !(angularGap(p.tc, EGG_TC) < EGG_THETA_MARGIN && Math.abs(p.pos.x - EGG_X) < EGG_X_MARGIN)
}

// --- conifer stand geometry (trunk + crown, 2 instanced draws) --------------------------
//
// Authored at UNIT scale (member scale `s` from the cluster spec does the final sizing, and
// scales trunk + crown together so a short tree keeps a short-tree's proportions rather than
// growing a giant's trunk under a sapling's crown). Low segment counts per the performance
// rule: the trunk is a 6-sided cylinder, the crown a 7-sided cone — the same tiers `clay-
// kit.tsx`'s ClaySnowConifer uses per its own tier, just one tier instead of three, because
// what buys the "one dark serrated mass" here is CLUSTER overlap between 5-9 trees, not a
// fussier silhouette on any one of them (approach-kit's own thesis, restated at chapter 1).
const TRUNK_H = 0.34
const CROWN_H = 0.62
const CROWN_BASE_Y = 0.28 // sits slightly below the trunk top so the two meet with no gap
const CROWN_LIFT = CROWN_BASE_Y + CROWN_H / 2

// --- snow drift geometry (1 instanced draw) ----------------------------------------------
//
// REVISION ROUND 1 — the first pass read as broken polystyrene slabs, not snow. Three
// separate defects, all numeric, all fixed here:
//
//  1. SCALE. The unit sphere has radius 0.5, i.e. diameter 1, so a per-axis squash factor
//     IS the full extent at member scale s=1 (extent = squashFactor · s — no hidden ×2 or
//     ×radius to lose track of). The calibration: chapter 1's largest lower-third element
//     spans ~0.35 world units, and a drift may run up to ~0.45 long but must stay under
//     ~0.07 tall and ~0.20 wide. With the cluster scale ranges capped at s=1.0 (driftA) /
//     s=0.8 (driftB), the squash factors below are solved backwards from those ceilings:
//     DRIFT_SY=0.065 → max height 0.065·1.0 = 0.065 (< 0.07); DRIFT_SX=0.42 → max length
//     0.42 (< 0.45); DRIFT_SZ=0.17 → max width 0.17 (< 0.20). The OLD factors (2.5/0.24/0.92)
//     were reading their own squash number as if it were half the extent instead of the
//     whole of it at s=1 — an arithmetic miss, not a taste call, and about 2.9-3.8x over
//     on each axis, which matches the "2.5x too big" verdict.
//  2. SILHOUETTE. `driftGeo` below moved from an 8×6 sphere to 12×8 — cheap at this budget
//     (192 tri/instance vs 96) and enough to stop the hard-squashed mound showing its own
//     facets as edges, which is what read as "broken slab" rather than "soft crest".
//  3. VALUE. The base tone moved from `snow` (near-white) to `ice` — a pale but genuinely
//     cooler, less-than-white blue — so a drift no longer matches the ground's own near-
//     white and has to be READ by its `frostShadow` hollow shading rather than by a bright
//     outline against a bright field. `snow` itself is kept, but only as the small caught-
//     snow accents on the hero LeaningSnag prop below, per the correction's own instruction.
const DRIFT_SX = 0.42
const DRIFT_SY = 0.065
const DRIFT_SZ = 0.17
const DRIFT_LIFT = 0.5 * DRIFT_SY

// --- boulder / stump geometry (1 instanced draw) ------------------------------------------
//
// A faceted icosahedron (20 triangles, fixed — the cheapest "chipped rock" primitive in the
// kit) squashed slightly so it sits rather than floats. At reading distance in a cluster of
// 3-6 with a scale gradient this reads equally well as broken rock or an old snow-capped
// stump, which is what lets it stand in for both without a second geometry / draw call.
const BOULDER_SQUASH_Y = 0.74
const BOULDER_SQUASH_Z = 0.92
const BOULDER_LIFT = 0.14 * BOULDER_SQUASH_Y

type Accent = { theta: number; x: number; rotation: [number, number, number]; kind: 'fall' | 'snag' }

/**
 * A leaning dead trunk with a snapped top and a couple of caught-snow tufts — the "taller
 * silhouette accent" half of the grammar that ISN'T a frozen fall. Built the same way
 * `ClayFrozenFall` is (a handful of primitives baked into one vertex-coloured draw via
 * `buildMergedClay`), so it costs one draw call regardless of how many parts it is made of.
 * Deliberately never placed alone — see the accent picks below, both of which anchor to an
 * actual stand member's own position, because an isolated thin vertical at this band's
 * foreshortening is exactly the "dangling leg" defect this whole file exists to remove.
 */
function LeaningSnag(x: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ramp = useClayRamp()
  const geo = useMemo(() => {
    const parts: ClayPart[] = [
      // lower trunk, leaning off vertical
      { geo: new THREE.CylinderGeometry(0.028, 0.046, 0.5, 6), color: PALETTE.clayPath, pos: [0, 0.24, 0], rot: [0, 0, 0.4] },
      // upper trunk continuing the lean, narrower — the two segments read as one bent stem
      { geo: new THREE.CylinderGeometry(0.014, 0.026, 0.3, 6), color: PALETTE.clayPath, pos: [0.19, 0.52, 0], rot: [0, 0, 0.75] },
      // the snapped top, angled further off — what makes it read as dead rather than planted
      { geo: new THREE.ConeGeometry(0.02, 0.1, 6), color: PALETTE.driftShade, pos: [0.3, 0.66, 0], rot: [0, 0, 1.25] },
      // snow caught in the crook and drifted at the base
      { geo: new THREE.SphereGeometry(0.05, 8, 6), color: PALETTE.snow, pos: [0.09, 0.34, 0.02], scl: [1.3, 0.55, 1] },
      { geo: new THREE.SphereGeometry(0.065, 8, 6), color: PALETTE.snow, pos: [-0.03, 0.015, 0.03], scl: [1.7, 0.42, 1.1] },
    ]
    return buildMergedClay(parts)
  }, [])
  return (
    <mesh {...x} geometry={geo}>
      <meshToonMaterial vertexColors gradientMap={ramp} />
    </mesh>
  )
}

/** Everything this file places, computed once as a pure function of the seeds below — no
 *  Math.random, no wall clock, no dependency on anything but the terrain and the yeti's own
 *  published coordinates. */
function buildWinterStands() {
  // shared scratch matrices for the local-transform closures below (built once, mutated per
  // instance during InstancedFamilies' own build pass — the same reuse jungle.tsx's flora
  // layers use, since the pass is synchronous and sequential per family).
  const yawT = new THREE.Matrix4()
  const trans = new THREE.Matrix4()
  const scl = new THREE.Matrix4()

  const trunkLocal: LocalFn = (m, p) => {
    yawT.makeRotationY(p.yaw)
    trans.makeTranslation(0, TRUNK_H / 2, 0)
    m.multiply(trans).multiply(yawT)
  }
  const crownLocal: LocalFn = (m, p) => {
    // a slight yaw desync from the trunk (×1.3) is a free, cheap way to keep crowns from all
    // facing the same way when several trees share a cluster
    yawT.makeRotationY(p.yaw * 1.3)
    trans.makeTranslation(0, CROWN_LIFT, 0)
    m.multiply(trans).multiply(yawT)
  }
  const driftLocal: LocalFn = (m, p) => {
    yawT.makeRotationY(p.yaw)
    trans.makeTranslation(0, DRIFT_LIFT, 0)
    scl.makeScale(DRIFT_SX, DRIFT_SY, DRIFT_SZ)
    m.multiply(trans).multiply(yawT).multiply(scl)
  }
  const boulderLocal: LocalFn = (m, p) => {
    yawT.makeRotationY(p.yaw)
    trans.makeTranslation(0, BOULDER_LIFT, 0)
    scl.makeScale(1, BOULDER_SQUASH_Y, BOULDER_SQUASH_Z)
    m.multiply(trans).multiply(yawT).multiply(scl)
  }

  // CONIFER STANDS — zone A only (zone B stays free of tall mass per the brief). 7 clusters
  // of 5-9 members across the 0.30-wide t window, both flanks, with a tight per-cluster
  // spread (spreadT/spreadX small relative to the window) so members overlap into one clump
  // rather than filling the box evenly — cluster RHYTHM, the approach-kit thesis.
  const standPts = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: ZONE_A_T,
    x: ZONE_A_X,
    clusters: 7,
    perCluster: [5, 9],
    spreadT: 0.024,
    spreadX: 0.24,
    scale: [0.42, 0.74], // mixed heights: final tree height ≈ 0.4-0.7, matching the wedge's existing conifers
    seed: 8801.3,
  })

  // SNOW DRIFTS — dense under/around the stands in zone A, lighter in zone B's tail.
  const driftA = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: ZONE_A_T,
    x: ZONE_A_X,
    clusters: 8,
    perCluster: [4, 8],
    spreadT: 0.045,
    spreadX: 0.5,
    scale: [0.45, 1.0], // s capped at 1.0 — see the DRIFT_S* calibration comment above
    seed: 8830.7,
  })
  const driftB = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: ZONE_B_T,
    x: ZONE_B_X,
    clusters: 5,
    perCluster: [3, 6],
    spreadT: 0.04,
    spreadX: 0.42,
    scale: [0.35, 0.8], // smaller/lighter — zone B stays ground-cover only
    seed: 8850.1,
  }).filter(clearOfYeti)
  // REVISION ROUND 3: a little ground-cover in the near-centre gap (see standNearL/R below)
  // so the bare patch between the two near-centre stands doesn't just move from "no trees"
  // to "no snow" — light density, matching the "a little drift/boulder cover" instruction.
  const driftNear = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: [0.06, 0.3],
    x: [0.5, 0.9],
    clusters: 3,
    perCluster: [3, 6],
    spreadT: 0.035,
    spreadX: 0.2,
    scale: [0.4, 0.8],
    seed: 8831.9,
  })
  const drifts = [...driftA, ...driftB, ...driftNear]

  // BOULDER / STUMP GROUPS — clusters of 3-6 with a size gradient, filling the gaps between
  // stands in zone A and standing in lightly for zone B's ground texture.
  const boulderA = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: ZONE_A_T,
    x: ZONE_A_X,
    clusters: 6,
    perCluster: [3, 6],
    spreadT: 0.022,
    spreadX: 0.22,
    scale: [0.55, 1.05],
    seed: 8870.9,
  })
  const boulderB = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: ZONE_B_T,
    x: ZONE_B_X,
    clusters: 3,
    perCluster: [3, 5],
    spreadT: 0.018,
    spreadX: 0.18,
    scale: [0.45, 0.85],
    seed: 8890.3,
  }).filter(clearOfYeti)
  const boulderNear = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: [0.08, 0.28],
    x: [0.5, 0.88],
    clusters: 2,
    perCluster: [3, 5],
    spreadT: 0.02,
    spreadX: 0.17,
    scale: [0.5, 0.9],
    seed: 8871.6,
  })
  const boulders = [...boulderA, ...boulderB, ...boulderNear]

  // REVISION ROUND 1: two more stands pushed out to |x| ∈ [1.0, 1.6] to carry the dark edge
  // further around the limb, per the follow-up note. Same spec as the working stands above —
  // clusters/perCluster/spreadT/spreadX/scale all identical — so this is an ADDITIVE call at
  // an unchanged size, not a retune of the part that already works; only the x window and
  // the seed (a fresh draw, not a reuse) differ.
  const standFarPts = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: ZONE_A_T,
    x: [1.0, 1.6],
    clusters: 2,
    perCluster: [5, 9],
    spreadT: 0.024,
    spreadX: 0.24,
    scale: [0.42, 0.74],
    seed: 8802.9,
  })

  // REVISION ROUND 3 — THE BOTTOM-CENTRE GAP. Screen-x maps to lateral offset x, not to
  // longitude, so the bottom CENTRE of the disc at chapter 5's checkpoint is LOW |x|
  // (~0.45-0.85) — and every stand above sits further out (ZONE_A_X starts at 0.5 but its
  // clusters, seeded across the full [0.5,1.65] window, drew centres well past the near
  // edge; standFarPts is out at [1.0,1.6] on purpose). Nothing was covering the strip right
  // at the lane guard, which is exactly the strip the checkpoint camera looks straight at —
  // chapter 1's equivalent edge is covered because the jungle's crowns start at |x| ≈ 0.44.
  //
  // Same size/density as the working stands (perCluster [5,9], spreadT 0.024, scale
  // [0.42,0.74] — nothing enlarged); only the x window moves in and spreadX tightens. The x
  // window is [0.6, 0.82], centred at 0.71 rather than at the 0.475 the raw [0.48,0.90] ask
  // would average to: `clusterPlacements` drops any member that jitters inside `laneMin`
  // (0.45 default) AFTER spreadX, so a centre drawn near the window's own low edge with the
  // standard 0.24 spread would lose roughly half its members to the guard. Centring higher
  // and tightening spreadX to 0.13 keeps the worst-case inward reach (0.6 − 0.13 = 0.47)
  // outside the guard, so the whole clump plants instead of half of it silently vanishing.
  //
  // Split into two explicit-`side` calls rather than one 3-cluster call with the default
  // random sign, so "both signs of x" is guaranteed by construction rather than left to
  // whichever way three coin flips happen to land.
  const standNearL = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: [0.08, 0.28],
    x: [0.6, 0.82],
    side: -1,
    clusters: 2,
    perCluster: [5, 9],
    spreadT: 0.024,
    spreadX: 0.13,
    scale: [0.42, 0.74],
    seed: 8803.7,
  })
  const standNearR = clusterPlacements({
    chapter: CHAPTER,
    variant: VARIANT,
    t: [0.08, 0.28],
    x: [0.6, 0.82],
    side: 1,
    clusters: 1,
    perCluster: [5, 9],
    spreadT: 0.024,
    spreadX: 0.13,
    scale: [0.42, 0.74],
    seed: 8804.5,
  })
  const allStandPts = [...standPts, ...standFarPts, ...standNearL, ...standNearR]

  const trunkGeo = new THREE.CylinderGeometry(0.045, 0.07, TRUNK_H, 6)
  const crownGeo = new THREE.ConeGeometry(0.34, CROWN_H, 7)
  // 12×8 (up from 8×6) — the extra segments are what let a hard-squashed mound keep a soft
  // crest instead of showing its own facets as hard edges; still cheap (192 tri/instance)
  // against the ~35k triangle headroom this file has.
  const driftGeo = new THREE.SphereGeometry(0.5, 12, 8)
  const boulderGeo = new THREE.IcosahedronGeometry(0.14, 0)

  // 4 InstancedFamilies draw calls total (trunk, crown, drift, boulder) — see the file-level
  // triangle/draw-call accounting in the final report; every geometry above is deliberately
  // low-segment (cones 6-7 sided, sphere 12×8, icosahedron fixed at 20 tris).
  const families: FamilySpec[] = [
    { placed: allStandPts, geometry: trunkGeo, color: PALETTE.clayPath, local: trunkLocal },
    // the dark note the pale dome is missing: deep spruce/pine green, alternating a third of
    // the time for the two-tone value contrast the brief calls out by name
    { placed: allStandPts, geometry: crownGeo, color: PALETTE.spruceDeep, colorDeep: PALETTE.pineDeep, local: crownLocal },
    // crest tone down from `snow` to `ice` (revision round 1) — see the DRIFT_S* comment for
    // why pure white against a pale ground was reading as shape-with-no-form
    { placed: drifts, geometry: driftGeo, color: PALETTE.ice, colorDeep: PALETTE.frostShadow, local: driftLocal },
    { placed: boulders, geometry: boulderGeo, color: PALETTE.stone, colorDeep: PALETTE.driftShade, local: boulderLocal },
  ]

  // HERO SILHOUETTE ACCENTS — anchored to an actual stand member's own placed position (not
  // an independently authored coordinate), so "beside a stand" is guaranteed by construction
  // rather than hoped for from two unrelated seeds landing near each other. `ci`/`mi` pick a
  // specific member of a specific cluster; a small deterministic offset (derived from that
  // member's own theta/x, not a new random draw) sets the accent down next to it rather than
  // on top of it.
  const standAnchor = (ci: number): Placed | undefined =>
    standPts.find((p) => p.ci === ci && p.mi === 0) ?? standPts.find((p) => p.ci === ci)

  const accents: Accent[] = []
  const fallAnchor = standAnchor(0)
  if (fallAnchor) {
    accents.push({
      kind: 'fall',
      theta: fallAnchor.tc + 0.05,
      x: fallAnchor.pos.x + 0.16,
      rotation: [0, fallAnchor.yaw + 1.4, 0],
    })
  }
  const snagAnchor = standAnchor(3) ?? standAnchor(2)
  if (snagAnchor) {
    accents.push({
      kind: 'snag',
      theta: snagAnchor.tc - 0.045,
      x: snagAnchor.pos.x - 0.14,
      rotation: [0, snagAnchor.yaw + 0.6, 0],
    })
  }

  return { families, accents }
}

/**
 * The B2 WINTER SUMMIT wedge's approach dressing (Task 86): conifer stands + snow drifts +
 * boulder/stump groups across zone A (chapter 5's bottom third — the priority) and a lighter
 * ground-cover-only pass across zone B (winter's own tail, where the ending plays). 4
 * InstancedFamilies draw calls + 2 single-draw hero accents = 6 draw calls total, the whole
 * of this file's performance budget.
 */
export function WinterStands({ journeyRef }: { journeyRef: JourneyRef }) {
  const built = useMemo(() => buildWinterStands(), [])
  return (
    <>
      <InstancedFamilies families={built.families} variant={VARIANT} journeyRef={journeyRef} />
      {built.accents.map((a) => (
        <GatedProp key={a.kind} theta={a.theta} x={a.x} variant={1} journeyRef={journeyRef}>
          {a.kind === 'fall' ? <ClayFrozenFall rotation={a.rotation} /> : <LeaningSnag rotation={a.rotation} />}
        </GatedProp>
      ))}
    </>
  )
}
