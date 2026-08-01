'use client'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { DESK_TOP_Y } from '../desk-stage'
import { useClayRamp } from '../toon-ramp'
import { buildMergedClay, type ClayPart } from './clay-kit'
import { peekerPieces } from './peeker-cast'
import { INK_WIDTH, inflateClay } from './peeker-kit'
import type { PeekerBiome, PeekerKind } from './peeker-stage'

/**
 * TWO MASCOT FIGURINES (Task 66) — the checkpoint bluebird and penguin, shrunk to desk-toy scale
 * and stood on their own turned bases. Static: no `useFrame`, no idle, no gate, no interaction —
 * they are props, like the mug and the pencil cup either side of them.
 *
 * WHY THESE TWO. Aram's pick: spring's bluebird and winter's penguin bookend the journey (chapter
 * 0 and chapter 5), so a pair of them on the desk reads as "souvenirs from the whole trip" rather
 * than as an arbitrary sample of the cast.
 *
 * WHERE THE GEOMETRY COMES FROM. `peekerPieces(biome, kind, 1)` is the same data the checkpoint
 * rig animates — each piece a `{ slot, at, parts }` with the piece's own local offset. Flattening
 * every piece's `parts` with its `at` baked in (`flattenMascot` below) collapses the two-piece rig
 * (body + one hinged wing/flipper) into the single static pose it happens to author at rest — there
 * is no pose-at-rest helper because the mascot rig only exists as an authored T-pose plus a driven
 * hinge, and drive = 0 IS that authored pose. No animation code is imported.
 *
 * SCALE, MEASURED RATHER THAN ASSUMED. A mascot is authored at its own arbitrary local scale (the
 * bluebird's raw merged geometry stands 1.377 local units tall, the penguin's 1.272 — the peeker
 * rig's "authored ~1 unit tall" convention is a rough one, and the two characters do not agree with
 * each other, let alone with a round number). So each figure is measured with a throwaway
 * `buildMergedClay` pass, and the scale that lands it at `FIGURE_REACH` tall is solved from that
 * measurement rather than eyeballed.
 *
 * THE HEIGHT NUMBER ITSELF IS A CORRECTION, not the brief's original 0.62. At the money shot
 * (`ndcYAt` with `ZOOM_FACTOR`/`ENDING_AIM_DROP`, exactly as the containment tests project it),
 * 0.62 world units of desk-toy height measures ~79-82px on a 1440x900 frame across this placement's
 * whole z run — short of the ~90-110px target. 0.72 lands at ~91-93px, comfortably inside it, for a
 * 16% taller figure than the first estimate. `desk-figurines.test.ts` pins the measured range.
 *
 * PLACEMENT IS NOT THE BRIEF'S z ∈ [9.7, 10.1] — and that is a finding, not a shortcut. `DESK_NOTE`
 * actually occupies x ∈ [-1.266, 1.386], z ∈ [9.729, 11.371] (its rotated footprint, measured the
 * same way `deskNoteFits` measures it). A figurine's own base has to clear that box on at least one
 * axis. Clearing it on x is not available within the |x| ≤ 1.5 core-band cap on the RIGHT side —
 * the note's footprint already runs to x = 1.386, leaving under 0.11 of frame before the cap, less
 * than one base radius. Pushing z forward past the note (into wing territory) trades one hazard for
 * a worse one: the desk surface itself leaves the bottom of the money shot at z ≈ 12.0
 * (`DESK_STAGE_EXIT_Z`), so a figurine parked there would not be on screen at the reveal it exists
 * for. Pulling z back toward `DESK_BACK_Z` (8.257) fails the OTHER gate — `propCeiling` at z ≈ 8.5
 * is under half a unit, too little headroom for a 0.72-tall figure under the journey camera. The
 * one axis with room on both sides is z, sitting BEHIND the note (smaller z, further from the
 * viewer) with the note's own near edge for a floor: FIGURINE_Z = 9.5 clears the note's z-minimum
 * (9.729) with room to spare and sits 1.24 in front of `DESK_BACK_Z`, comfortably inside the
 * journey's ceiling at that depth (see the containment numbers below).
 *
 * CONTRAST — MEASURED AGAINST THE DESK, NOT THE SKY (WCAG relative-luminance ratio, `(L1+.05)/
 * (L2+.05)`). Both figurines land on `DESK_NOTE`'s own surface, the blotter (`PALETTE.deskMat`),
 * since the mat's footprint (|x| ≤ 3.15, z ∈ [8.75, 12.25]) comfortably covers x = ±1.4, z = 9.5.
 *
 *   PENGUIN — reads fine unaided. Its dominant mass, `penguinBack`, measures 5.37:1 against
 *   `deskMat` (5.97 vs `deskTop`, 3.87 vs `deskGrain`) — the best-separated figure in either cast,
 *   because a blue-charcoal bird was already built to out-contrast a pale sky. The white front
 *   (`foxBelly`) is 1.52:1, over the floor. Only the small warm accent (`penguinFlash`, bill+feet)
 *   dips to 1.30:1 against the mat — under floor, but it is bounded on every side by the dark back
 *   tone rather than sitting directly against the desk, the same "reads by adjacency" argument
 *   `peeker-winter.tsx` makes for the same colour against the sky.
 *
 *   BLUEBIRD — this is the real finding. Its dominant mass, `bluebell`, measures 1.32:1 against
 *   `deskMat` — UNDER the 1.35 floor, i.e. this bird would measurably wash into the blotter it
 *   stands on. (It fares worse still off the mat: 1.05:1 against the bare `deskGrain`.) The mascot
 *   rig buys this figure's separation with its ink contour (`ink` measures 7.5:1 against the mat),
 *   and that is what this component does too — the contour is the FIX for the bluebird, not a
 *   flourish, and it is the reason `buildDeskFigurineInk` exists at the cost of a second draw. The
 *   bases carry the rest: both are turned in `PALETTE.ink` (rim) over `PALETTE.earthDeep` (body) —
 *   7.5:1 and 5.9:1 against the mat — so the toy also anchors itself with a dark foot and a matching
 *   contact shadow. `desk-figurines.test.ts` pins the numbers this docblock states rather than
 *   re-deriving new ones, so a future palette edit cannot make the claim quietly false.
 *
 * INK: KEPT, as ONE merged contour for the pair — see FIGURINE_INK_GAIN for the width and for
 * why dropping it was the wrong economy.
 */

/** Total figurine height (base + figure), world units — see the docblock for why this is 0.72 and
 *  not the brief's first-guess 0.62. */
export const FIGURINE_HEIGHT = 0.72
/** Height of the turned base alone. The figure's feet sit at exactly this height above the desk. */
export const FIGURINE_BASE_HEIGHT = 0.06
/** How tall the figure itself (feet to crown) stands once seated on its base. */
const FIGURE_REACH = FIGURINE_HEIGHT - FIGURINE_BASE_HEIGHT
/** Base radius — small enough that two of them plus a bird apiece still reads as a desk toy, not a
 *  plinth. */
export const FIGURINE_BASE_R = 0.17

/** Inset from centre — kept off x = 0, where the globe stand's own column lands on screen. */
export const FIGURINE_X = 1.4
/** Shared depth for both figurines — see the docblock for the note/back-clearance derivation. */
export const FIGURINE_Z = 9.5
/** Inward yaw (rad): the left bird turns toward +x, the right toward -x, both toward the middle of
 *  the frame. Verified against the actual rotation convention `deskPropParts` composes with. */
export const FIGURINE_YAW = 0.35

export type DeskFigurine = {
  biome: PeekerBiome
  kind: PeekerKind
  x: number
  z: number
  yaw: number
}

/** The two figurines, as data — so a test can check the shipped composition rather than a sample.
 *  Spring's bluebird and winter's penguin: the journey's first and last checkpoints. */
export const DESK_FIGURINES: readonly DeskFigurine[] = [
  { biome: 'spring', kind: 'bluebird', x: -FIGURINE_X, z: FIGURINE_Z, yaw: FIGURINE_YAW },
  { biome: 'winter', kind: 'penguin', x: FIGURINE_X, z: FIGURINE_Z, yaw: -FIGURINE_YAW },
]

/** One mascot's pieces, flattened: every piece's `parts` with the piece's own `at` offset baked into
 *  `pos`, so the two-piece rig (body + one hinged limb) collapses to the single list its authored
 *  rest pose actually draws. `dir` is always 1 — a desk toy has no mirrored partner to reflect for. */
function flattenMascot(biome: PeekerBiome, kind: PeekerKind): ClayPart[] {
  const pieces = peekerPieces(biome, kind, 1)
  const parts: ClayPart[] = []
  for (const piece of pieces) {
    for (const part of piece.parts) {
      parts.push({
        ...part,
        pos: [
          (part.pos?.[0] ?? 0) + piece.at[0],
          (part.pos?.[1] ?? 0) + piece.at[1],
          (part.pos?.[2] ?? 0) + piece.at[2],
        ],
      })
    }
  }
  return parts
}

type Bounds = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

function boundsOf(geo: THREE.BufferGeometry): Bounds {
  const pos = geo.attributes.position.array as ArrayLike<number>
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < pos.length; i += 3) {
    minX = Math.min(minX, pos[i])
    maxX = Math.max(maxX, pos[i])
    minY = Math.min(minY, pos[i + 1])
    maxY = Math.max(maxY, pos[i + 1])
    minZ = Math.min(minZ, pos[i + 2])
    maxZ = Math.max(maxZ, pos[i + 2])
  }
  return { minX, maxX, minY, maxY, minZ, maxZ }
}

/** Bake a part's own local transform, then `place`, into its geometry — the same order
 *  `deskPropParts` composes in (`place · local`), so the composition is honest matrix
 *  multiplication rather than two Euler triples that would not commute. */
function bakePart(part: ClayPart, place: THREE.Matrix4): ClayPart {
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(...(part.pos ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(part.rot ?? [0, 0, 0]))),
    new THREE.Vector3(...(part.scl ?? [1, 1, 1]))
  )
  const geo = part.geo.index ? part.geo.toNonIndexed() : part.geo
  if (geo !== part.geo) part.geo.dispose()
  geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(place, local))
  return { geo, color: part.color, tag: part.tag }
}

/**
 * The turned base + its contact shadow: a dark ink rim under a warm wood-tone disc (see the
 * docblock's contrast section for why the rim is `ink`), plus a soft shadow pocket on the desk —
 * the same trick `contact()` in desk-kit.ts uses for every other prop's footing.
 */
function baseParts(fig: DeskFigurine): ClayPart[] {
  const r = FIGURINE_BASE_R
  const h = FIGURINE_BASE_HEIGHT
  const place = new THREE.Matrix4().makeTranslation(fig.x, DESK_TOP_Y, fig.z)
  const local: ClayPart[] = [
    {
      geo: new THREE.CircleGeometry(r * 1.55, 20),
      color: PALETTE.deskShade,
      pos: [0, 0.005, r * 0.22],
      rot: [-Math.PI / 2, 0, 0],
      scl: [1.15, 0.72, 1],
      tag: 'contact',
    },
    // dark turned rim — the foot doing the contrast work
    {
      geo: new THREE.CylinderGeometry(r, r * 1.08, h * 0.42, 20),
      color: PALETTE.ink,
      pos: [0, h * 0.21, 0],
      tag: 'base',
    },
    // warm wood-tone cap above it
    {
      geo: new THREE.CylinderGeometry(r * 0.82, r * 0.92, h * 0.58, 20),
      color: PALETTE.earthDeep,
      pos: [0, h * 0.42 + h * 0.29, 0],
      tag: 'base',
    },
  ]
  return local.map((part) => bakePart(part, place))
}

/**
 * One figurine's whole parts list: its measured-and-scaled figure seated on its base, both baked
 * to world space. The figure is measured with a throwaway `buildMergedClay` pass (see the
 * docblock), scaled uniformly to `FIGURE_REACH` tall, recentred over its own base in x/z, and
 * turned to face inward before the desk placement and yaw are composed in.
 */
export function deskFigurineParts(fig: DeskFigurine): ClayPart[] {
  const probe = buildMergedClay(flattenMascot(fig.biome, fig.kind))
  const b = boundsOf(probe)
  probe.dispose()

  const scale = FIGURE_REACH / (b.maxY - b.minY)
  const shift = new THREE.Vector3(
    -((b.minX + b.maxX) / 2) * scale,
    FIGURINE_BASE_HEIGHT - b.minY * scale,
    -((b.minZ + b.maxZ) / 2) * scale
  )
  const figureLocal = new THREE.Matrix4().compose(
    shift,
    new THREE.Quaternion(),
    new THREE.Vector3(scale, scale, scale)
  )
  const place = new THREE.Matrix4()
    .makeTranslation(fig.x, DESK_TOP_Y, fig.z)
    .multiply(new THREE.Matrix4().makeRotationY(fig.yaw))
    .multiply(figureLocal)

  const figureParts = flattenMascot(fig.biome, fig.kind).map((part) => bakePart(part, place))
  return [...baseParts(fig), ...figureParts]
}

/** ...and the FIGURE half alone, without base or contact pocket — what the ink contour is drawn
 *  around. A base is a plinth, not a character, and outlining it would read as a sticker. */
function figureOnlyParts(fig: DeskFigurine): ClayPart[] {
  return deskFigurineParts(fig).filter((p) => p.tag !== 'base' && p.tag !== 'contact')
}

/**
 * How heavy the contour is, relative to the one the checkpoint rig draws.
 *
 * `INK_WIDTH` is authored in a mascot's OWN local units and applied inside a group the checkpoint
 * rig scales to about 200 px. These figurines bake their scale into the geometry and stand at
 * ~92 px, so the faithful conversion is `INK_WIDTH · scale` — which lands a line under half a device
 * pixel wide, i.e. no line at all. A contour is not decoration on these two: with ink dropped the
 * bluebird's body measures 1.32:1 against the blotter it stands on, which is a bird that vanishes.
 * So the width is scaled proportionally and then multiplied UP, and the multiplier is the smallest
 * that keeps the line reading at figurine size rather than the one that matches at corner size.
 */
export const FIGURINE_INK_GAIN = 2.4

/** Both figurines' clay, merged into the one geometry the component draws. Exported so a test can
 *  measure the shipped scene rather than a sample of it. */
export function buildDeskFigurines(): THREE.BufferGeometry {
  return buildMergedClay(DESK_FIGURINES.flatMap(deskFigurineParts))
}

/**
 * ...and BOTH figures' ink contours, merged into one geometry — so the pair costs two draws in
 * total rather than the seven the checkpoint rig's per-piece inking would have cost here.
 *
 * That is the reason the contour survived at all. The first cut dropped ink entirely to hold the
 * pair to a single draw, which is the right instinct applied to the wrong quantity: the saving was
 * one draw call against a budget with a dozen to spare, and the cost was the whole reason a pale
 * blue bird is visible on a blue-grey blotter.
 */
export function buildDeskFigurineInk(): THREE.BufferGeometry {
  const clay = buildMergedClay(DESK_FIGURINES.flatMap(figureOnlyParts))
  const ink = inflateClay(clay, INK_WIDTH * FIGURE_REACH * FIGURINE_INK_GAIN)
  clay.dispose()
  return ink
}

/** The two desk-toy mascots. Static: no frame subscription, no props. Mount once, alongside the
 *  rest of the desk set. */
export function DeskFigurines() {
  const ramp = useClayRamp()
  const geo = useMemo(buildDeskFigurines, [])
  const ink = useMemo(buildDeskFigurineInk, [])
  useEffect(
    () => () => {
      geo.dispose()
      ink.dispose()
    },
    [geo, ink]
  )
  return (
    <group>
      <mesh geometry={ink}>
        <meshBasicMaterial color={PALETTE.ink} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={geo}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
    </group>
  )
}
