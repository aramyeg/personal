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

/** Each biome's art: its two characters and the set dressing they are staged in. */
type BiomeArt = {
  pieces: (kind: PeekerKind, dir: 1 | -1) => PeekerPiece[]
  dressing: () => ClayPart[]
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
    pieces: (kind, dir) => deltaPieces(kind === 'crocPeek' ? 'crocPeek' : 'crocGape', dir),
    dressing: deltaDressing,
  },
  desert: {
    pieces: (kind, dir) => desertPieces(kind === 'camelCalf' ? 'camelCalf' : 'camelAdult', dir),
    dressing: desertDressing,
  },
  canyon: {
    pieces: (kind, dir) => canyonPieces(kind === 'pangolinSmall' ? 'pangolinSmall' : 'pangolinBig', dir),
    dressing: canyonDressing,
  },
  winter: {
    pieces: (kind, dir) => winterPieces(kind === 'yetiSmall' ? 'yetiSmall' : 'yetiBig', dir),
    dressing: winterDressing,
  },
}

export function peekerPieces(biome: PeekerBiome, kind: PeekerKind, dir: 1 | -1): PeekerPiece[] {
  return ART[biome].pieces(kind, dir)
}

export function peekerDressing(biome: PeekerBiome, dir: 1 | -1, vdir: Vdir): ClayPart[] {
  const parts = ART[biome].dressing()
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

/** A biome's set dressing: one merged draw (plus its contour), static under the rig's motion. */
export function PeekerDressing({ biome, dir, vdir }: { biome: PeekerBiome; dir: 1 | -1; vdir: Vdir }) {
  const parts = useMemo(() => peekerDressing(biome, dir, vdir), [biome, dir, vdir])
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
 * Static roll baked onto a figure's root — what keeps a pair that shares one build from reading as
 * the same animal at two scales.
 */
export function peekerRootTilt(kind: PeekerKind, dir: 1 | -1): number {
  return kind === 'crocPeek' ? -0.2 * dir : 0
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

/** The small croc barely opens — it just works its jaw and taps a claw. */
function applyChomp(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = -dir * (0.06 + 0.07 * drive.idle)
  if (limbs.b) limbs.b.rotation.z = dir * (-0.1 + 0.18 * drive.idle)
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

/** The yeti's arm rocks slowly where it grips the branch. */
function applyArm(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = dir * (-0.08 + 0.22 * drive.idle)
}

export const PEEKER_SPECS: Record<PeekerKind, PeekerSpec> = {
  bluebird: { apply: applyWing, cycles: 6, sway: 0.05 },
  robin: { apply: applyWing, cycles: 5, sway: 0.055 },
  macaw: { apply: applyWing, cycles: 6, sway: 0.05 },
  cockatoo: { apply: applyWing, cycles: 5, sway: 0.055 },
  crocGape: { apply: applyJaw, cycles: 2, sway: 0.03 },
  crocPeek: { apply: applyChomp, cycles: 2.5, sway: 0.035 },
  camelAdult: { apply: applyChew, cycles: 4, sway: 0.04 },
  camelCalf: { apply: applyChew, cycles: 5, sway: 0.05 },
  pangolinBig: { apply: applyUnroll, cycles: 2.5, sway: 0.05, rolls: true },
  pangolinSmall: { apply: applyUnroll, cycles: 3, sway: 0.055, rolls: true },
  yetiBig: { apply: applyArm, cycles: 2, sway: 0.045 },
  yetiSmall: { apply: applyArm, cycles: 2.5, sway: 0.055 },
}
