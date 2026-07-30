'use client'
import { useEffect, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { useClayRamp } from '../toon-ramp'
import { buildMergedClay, type ClayPart } from './clay-kit'
import { INK_WIDTH, flipY, inflateClay, type V3 } from './peeker-kit'
import { canyonDressing, canyonPieces } from './peeker-canyon'
import { deltaDressing, deltaPieces } from './peeker-delta'
import { desertDressing, desertPieces } from './peeker-desert'
import { jungleDressing, junglePieces } from './peeker-jungle'
import { springDressing, springPieces } from './peeker-spring'
import { winterDressing, winterPieces } from './peeker-winter'
import type { PeekerBiome, PeekerKind, Vdir } from './peeker-stage'

/**
 * Task 56 — assembly for the checkpoint mascots: which pieces a character is made of, how its one
 * idle gesture moves them, and how a piece becomes a draw call.
 *
 * The art itself lives one file per biome (`peeker-jungle.tsx` and friends) so each corner
 * composition can be read and revised on its own; this module only knows how to put them on
 * screen. Every piece is a handful of clay primitives baked into ONE merged vertex-coloured
 * geometry under the shared toon ramp, so a whole character costs two or three draws and shades
 * exactly like the world below it — plus, unlike the world, an ink contour (see `inflateClay`).
 */

export type PeekerSlot = 'body' | 'a' | 'b' | 'c'

/** One merged mesh of a figure, the joint it hangs from, and whether it carries an ink contour. */
export type PeekerPiece = { slot: PeekerSlot; at: V3; parts: ClayPart[]; ink?: boolean }

/** `a`/`b` are hinged pieces (wing, jaw, tail); `c` is a whole-body deformer (the pangolin ball). */
export type PeekerLimbs = { a: THREE.Group | null; b: THREE.Group | null; c?: THREE.Group | null }
export type PeekerDrive = { idle: number; unroll: number }

/**
 * Each biome's art: its two characters and the set dressing they are staged in.
 *
 * `dressing` TAKES THE KIND (Task 62), and the reason is a correction rather than a feature. One
 * dressing per biome meant a pair was two animals in one composition mirrored — which is exactly
 * the "same asset twice" read T61's recast existed to remove, applied to the setting instead of to
 * the cast. Aram's own words on the two corners that showed it worst: the eagle should have a NEST,
 * not the pangolin's cliff, and the penguin should be on drifting ice rather than under the bear's
 * pine. Four biomes still answer the same art for both sides, and that is a judgement per corner,
 * not a limit of the shape.
 *
 * A dressing is still ONE merged draw per side, so nothing about the cost changes.
 */
type BiomeArt = {
  pieces: (kind: PeekerKind, dir: 1 | -1) => PeekerPiece[]
  dressing: (kind: PeekerKind) => ClayPart[]
}

/**
 * One entry per biome. The cast in peeker-stage.ts guarantees a biome only ever asks for its own
 * two kinds, so each `pieces` narrows to that pair.
 */
const ART: Record<PeekerBiome, BiomeArt> = {
  spring: {
    pieces: (kind, dir) => springPieces(kind === 'robin' ? 'robin' : 'bluebird', dir),
    dressing: springDressing,
  },
  jungle: {
    pieces: (kind, dir) => junglePieces(kind === 'cockatoo' ? 'cockatoo' : 'macaw', dir),
    dressing: jungleDressing,
  },
  delta: {
    pieces: (kind, dir) => deltaPieces(kind === 'snake' ? 'snake' : 'crocGape', dir),
    dressing: deltaDressing,
  },
  desert: {
    pieces: (kind, dir) => desertPieces(kind === 'fennec' ? 'fennec' : 'camelAdult', dir),
    dressing: desertDressing,
  },
  canyon: {
    pieces: (kind, dir) => canyonPieces(kind === 'eagle' ? 'eagle' : 'pangolinBig', dir),
    dressing: (kind) => canyonDressing(kind === 'eagle' ? 'eagle' : 'pangolinBig'),
  },
  winter: {
    pieces: (kind, dir) => winterPieces(kind === 'penguin' ? 'penguin' : 'polarBear', dir),
    dressing: (kind) => winterDressing(kind === 'penguin' ? 'penguin' : 'polarBear'),
  },
}

export function peekerPieces(biome: PeekerBiome, kind: PeekerKind, dir: 1 | -1): PeekerPiece[] {
  return ART[biome].pieces(kind, dir)
}

export function peekerDressing(
  biome: PeekerBiome,
  kind: PeekerKind,
  dir: 1 | -1,
  vdir: Vdir
): ClayPart[] {
  const parts = ART[biome].dressing(kind)
  return flipY(vdir, dir === 1 ? parts : mirrorX(parts))
}

function mirrorX(parts: ClayPart[]): ClayPart[] {
  return parts.map((p) => ({
    ...p,
    pos: p.pos ? ([-p.pos[0], p.pos[1], p.pos[2]] as V3) : undefined,
    rot: p.rot ? ([p.rot[0], -p.rot[1], -p.rot[2]] as V3) : undefined,
  }))
}

// --- rendering --------------------------------------------------------------

function useMerged(parts: ClayPart[]): THREE.BufferGeometry {
  const geo = useMemo(() => buildMergedClay(parts), [parts])
  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

function useInk(geo: THREE.BufferGeometry, on: boolean): THREE.BufferGeometry | null {
  const ink = useMemo(() => (on ? inflateClay(geo, INK_WIDTH) : null), [geo, on])
  useEffect(() => () => ink?.dispose(), [ink])
  return ink
}

/** A merged clay mesh with its optional ink contour behind it. */
function ClayPiece({ parts, ink }: { parts: ClayPart[]; ink?: boolean }) {
  const ramp = useClayRamp()
  const geo = useMerged(parts)
  const inkGeo = useInk(geo, ink === true)
  return (
    <>
      <mesh geometry={geo}>
        <meshToonMaterial vertexColors gradientMap={ramp} />
      </mesh>
      {inkGeo ? (
        <mesh geometry={inkGeo}>
          <meshBasicMaterial color={PALETTE.ink} side={THREE.BackSide} />
        </mesh>
      ) : null}
    </>
  )
}

/**
 * One side's set dressing: one merged draw (plus its contour). Static under the rig's motion, with
 * the single exception of a `drifts` kind — see `peekerDrift`, where the raft and its passenger are
 * moved together because they are one floating object.
 */
export function PeekerDressing({
  biome,
  kind,
  dir,
  vdir,
}: {
  biome: PeekerBiome
  kind: PeekerKind
  dir: 1 | -1
  vdir: Vdir
}) {
  const parts = useMemo(() => peekerDressing(biome, kind, dir, vdir), [biome, kind, dir, vdir])
  return <ClayPiece parts={parts} ink />
}

/**
 * One character: each piece merged to a single draw, with the hinged pieces wired into the rig's
 * limb refs by slot. Geometries are built once per (biome, kind, dir) and disposed with the figure.
 */
export function PeekerFigure({
  biome,
  kind,
  limbs,
  dir,
}: {
  biome: PeekerBiome
  kind: PeekerKind
  limbs: MutableRefObject<PeekerLimbs>
  dir: 1 | -1
}) {
  const pieces = useMemo(() => peekerPieces(biome, kind, dir), [biome, kind, dir])
  return (
    <group rotation={[0, 0, peekerRootTilt(kind, dir)]}>
      {pieces.map((piece, i) =>
        piece.slot === 'body' ? (
          <group key={piece.slot} position={piece.at}>
            <ClayPiece parts={piece.parts} ink={inked(piece, i)} />
          </group>
        ) : (
          <group
            key={piece.slot}
            position={piece.at}
            ref={(g) => {
              limbs.current[piece.slot as 'a' | 'b' | 'c'] = g
            }}
          >
            <ClayPiece parts={piece.parts} ink={inked(piece, i)} />
          </group>
        )
      )}
    </group>
  )
}

/**
 * How many of a figure's pieces carry an ink contour. Each one is a second draw call, and the
 * three-piece characters (the crocodile with its forefoot, the pangolin with head and tail) would
 * otherwise put a checkpoint at +16 against a +14 budget. Two is enough: the contour earns its
 * cost on the masses that carry the silhouette, and a tail or a foot tucked against the body gains
 * almost nothing from being outlined.
 */
export const INK_PIECE_LIMIT = 2

function inked(piece: PeekerPiece, index: number): boolean {
  return piece.ink === true && index < INK_PIECE_LIMIT
}

/**
 * Static roll baked onto a figure's root.
 *
 * It used to exist to keep a pair that shares ONE build from reading as the same animal at two
 * scales; Task 61's recast removed every such pair, so the only tilt left is one that is doing
 * character work rather than disambiguation. A fox cocks its whole body when it is listening, and
 * the fennec is standing beside an animal whose defining line is a long vertical neck — so the tilt
 * buys a diagonal in a corner that would otherwise be two uprights.
 */
export function peekerRootTilt(kind: PeekerKind, dir: 1 | -1): number {
  return kind === 'fennec' ? -0.12 * dir : 0
}

// --- per-kind gesture + spec ------------------------------------------------

/**
 * Every character owns exactly ONE idle gesture, driven by the panel's scroll dwell (NOT the
 * arrival clock — what a character does while you read stays a pure function of scroll position)
 * and scaled by presence so it eases in with the entrance and out with the exit.
 *
 * `dir` is threaded in because a hinge that swings a wing up for a left-hand figure has to swing
 * the other way once the figure is reflected: rotations about Y and Z both flip sign.
 */
export type PeekerSpec = {
  apply: (limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1) => void
  /** Idle oscillations across the panel dwell. */
  cycles: number
  /** Whole-figure sway amplitude (rad) the rig lays on top. */
  sway: number
  /** Pangolins arrive as a spinning ball and unfurl once parked. */
  rolls?: boolean
  /**
   * The composition FLOATS: dressing and figure share a slow roll and heave, so the raft and its
   * passenger move as one object (Task 62 — the penguin's ice floe).
   *
   * A kind that sets this must leave room for the raft's roll inside `PEEKER_MAX_SWAY`, since the
   * two add on the figure. That is why the penguin's own `sway` came down when it gained the floe:
   * the total is what the envelope benches sweep, and it may not grow.
   */
  drifts?: boolean
}

/** Wings beat about the shoulder; the body sway does the rest. */
function applyWing(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = dir * (0.1 + 0.3 * drive.idle)
}

/**
 * A slow gape: the jaw hangs open and eases shut, never snapping.
 *
 * The sign is NEGATIVE, and that is load-bearing rather than arbitrary. A mandible hinged at the
 * back of the skull only swings AWAY from the skull when the rotation opposes the direction the
 * snout points, and these crocodiles lie horizontally with their snouts pointing into the frame.
 * The first pass used a positive sign, which forced the whole animal to rear up vertically to make
 * its jaw open at all — and a vertical crocodile reads as a green tube, not a crocodile.
 */
function applyJaw(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = -dir * (0.16 + 0.15 * drive.idle)
  if (limbs.b) limbs.b.rotation.z = dir * 0.12 * drive.idle
}

/**
 * The snake: the raised head sways over its coil, and the tongue FLICKS.
 *
 * The sway is the ordinary smooth channel, but a tongue that eases in and out over the whole dwell
 * is a slug rather than a flick — the one thing a reader knows about a snake's tongue is that it is
 * quick. So the tongue is driven by a SHAPED idle: `2·idle − 1` clamped at zero leaves it retracted
 * for half the cycle and shoots it out over the other half, which is fast enough to read as a flick
 * while still being a pure function of scroll position. It is a scale rather than a rotation because
 * the tongue has to appear from inside a closed mouth, and a hinge would swing it out through the
 * jaw.
 */
function applyFlick(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) {
    limbs.a.rotation.z = dir * (-0.05 + 0.14 * drive.idle)
    limbs.a.rotation.y = dir * 0.16 * drive.idle
  }
  if (limbs.b) {
    const out = Math.max(0, 2 * drive.idle - 1)
    limbs.b.scale.set(0.24 + 0.76 * out, 1, 1)
  }
}

/**
 * The fennec: one huge ear swivels, and the brush tail sweeps behind it.
 *
 * The ear is the whole character — it is most of the silhouette and it is the only part of a fox
 * that moves while the animal holds still. Swivelling it about its BASE (a yaw, so the dish turns
 * toward and away from the reader, plus a little roll) is what reads as listening; rocking the whole
 * head would just nod it.
 */
function applyEar(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) {
    limbs.a.rotation.y = dir * (-0.12 + 0.34 * drive.idle)
    limbs.a.rotation.z = dir * 0.09 * drive.idle
  }
  if (limbs.b) limbs.b.rotation.z = dir * (0.06 - 0.2 * drive.idle)
}

/**
 * The eagle MANTLES: the near wing lifts and half-opens, then folds back down.
 *
 * Deliberately a wider swing than `applyWing`'s beat and on a much slower cycle. A small fast beat
 * on a corner bird reads as a sparrow fluttering; a raptor's shoulder movement is one big slow
 * gesture, and the wing's own shape is what has to be read rather than its speed. The yaw opens the
 * wing away from the body as it lifts so the primaries separate from the flank instead of sliding
 * along it.
 *
 * The roll is NEGATIVE where `applyWing`'s is positive, and that is geometry rather than taste. The
 * wing is authored folded, reaching out and DOWN toward the frame edge; a positive z rotation
 * sweeps an outward-pointing vector further downward, which closes the wing tighter against the
 * flank. Only the negative sense lifts the tip, and lifting is the whole gesture.
 */
function applyMantle(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) {
    limbs.a.rotation.z = -dir * (0.06 + 0.46 * drive.idle)
    limbs.a.rotation.y = dir * 0.2 * drive.idle
  }
}

/** The bear's near foreleg rocks where it is planted in the drift — a big animal shifting its weight. */
function applyPaw(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = dir * (-0.05 + 0.16 * drive.idle)
}

/**
 * The penguin's flipper waggles — a big amplitude on a stiff limb, which is the whole joke.
 *
 * Negative for the same reason `applyMantle` is: the flipper hangs DOWN at rest, and only the
 * negative sense swings it outward into a wave. The positive sense folds it in across the white
 * front, which both hides the limb and cuts the one shape that makes the bird a penguin.
 */
function applyFlipper(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = -dir * (-0.16 + 0.62 * drive.idle)
}

/** Camels chew sideways — a yaw on the jaw reads far more camel than a hinge. */
function applyChew(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (!limbs.a) return
  limbs.a.rotation.z = dir * 0.05 * (0.5 + 0.5 * drive.idle)
  // dir applies to yaw as well as roll: reflecting a figure negates BOTH Euler y and z, so a yaw
  // written without it leaves the right-hand animal chewing the wrong way round.
  limbs.a.rotation.y = dir * 0.09 * drive.idle
}

/**
 * Head swings out of the ball, tail unfurls behind it, and the shell itself stretches from a
 * sphere into a body — without that last part the "unroll" is just a ball growing a face.
 */
function applyUnroll(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  const u = drive.unroll
  if (limbs.a) {
    limbs.a.rotation.z = dir * (2.5 - 2.62 * u)
    const s = 0.4 + 0.6 * u
    limbs.a.scale.set(s, s, s)
    limbs.a.rotation.y = dir * 0.22 * drive.idle * u
  }
  if (limbs.b) {
    limbs.b.rotation.z = dir * (-2.5 + 2.1 * u)
    const s = 0.55 + 0.45 * u
    limbs.b.scale.set(s, s, s)
  }
  if (limbs.c) limbs.c.scale.set(1 + 0.34 * u, 1 - 0.22 * u, 1 - 0.06 * u)
}

export const PEEKER_SPECS: Record<PeekerKind, PeekerSpec> = {
  bluebird: { apply: applyWing, cycles: 6, sway: 0.05 },
  robin: { apply: applyWing, cycles: 5, sway: 0.055 },
  macaw: { apply: applyWing, cycles: 6, sway: 0.05 },
  cockatoo: { apply: applyWing, cycles: 5, sway: 0.055 },
  crocGape: { apply: applyJaw, cycles: 2, sway: 0.03 },
  // A snake watching from a limb barely moves; the tongue is what carries the cycle, so it is a
  // touch quicker than its partner rather than slower.
  snake: { apply: applyFlick, cycles: 3, sway: 0.03 },
  camelAdult: { apply: applyChew, cycles: 4, sway: 0.04 },
  // The quickest thing in the whole cast, and it should be: a fennec is a small nervous animal
  // standing next to the slowest one in the set.
  fennec: { apply: applyEar, cycles: 6, sway: 0.055 },
  pangolinBig: { apply: applyUnroll, cycles: 2.5, sway: 0.05, rolls: true },
  // The slowest, for the same reason in reverse — one big mantle across the whole dwell.
  eagle: { apply: applyMantle, cycles: 1.5, sway: 0.04 },
  polarBear: { apply: applyPaw, cycles: 2, sway: 0.045 },
  // Its own sway is down from 0.055 because the floe under it now rolls: the bird's body sway and
  // the raft's roll add, and `PEEKER_MAX_SWAY` is what the envelope benches sweep. 0.03 + the
  // raft's 0.024 lands at 0.054, so the total the rig can produce did not grow — which is the point.
  penguin: { apply: applyFlipper, cycles: 3.5, sway: 0.03, drifts: true },
}
