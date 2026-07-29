import * as THREE from 'three'
import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'

/**
 * Task 56 — shared vocabulary for the checkpoint mascots and their set dressing.
 *
 * AUTHORING CONVENTION, and every biome file follows it:
 *
 *  - Local space is SCREEN space. +X points INTO the frame (toward the middle), +Y is up, +Z is
 *    toward the camera. The origin is the character's read centre — roughly its chest.
 *  - Everything is authored ~1 unit tall, so the rig's single uniform scale IS the figure's world
 *    height, and `MASCOT_BOX`/`DRESS_REACH` in peeker-stage.ts are in those same units.
 *  - Figures are authored for the LEFT side and reflected for the right by `facing(-1, …)`, which
 *    flips x offsets and the two Euler components that live in the reflected planes. Reflecting
 *    the PLACEMENT rather than applying a negative scale keeps every normal outward-facing, so the
 *    toon bands never invert.
 *  - Set dressing is authored hanging BELOW its character (the bottom-anchored corner, which is
 *    what every shipped viewport currently resolves to) and reflected upward by `flipY` when a
 *    composition anchors to the top edge instead.
 *
 * SCALE NOTE, because it changes how these are drawn: a mascot is ~270px tall on a 1600x900
 * frame, where the R14 peekers were ~160px. Features that were single blobs before are now
 * authored as real shapes with an ink line and a tone step, because at this size the four-band
 * toon ramp flattens a smooth form into one silhouette and the colour blocks do all the reading.
 */

export type V3 = [number, number, number]

export const sph = (r: number, color: string, pos: V3, scl?: V3, seg = 12): ClayPart => ({
  geo: new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)),
  color,
  pos,
  scl,
})

export const cone = (
  r: number,
  h: number,
  color: string,
  pos: V3,
  rot?: V3,
  scl?: V3,
  seg = 8
): ClayPart => ({ geo: new THREE.ConeGeometry(r, h, seg), color, pos, rot, scl })

export const cyl = (
  rTop: number,
  rBot: number,
  h: number,
  color: string,
  pos: V3,
  rot?: V3,
  scl?: V3,
  seg = 8
): ClayPart => ({ geo: new THREE.CylinderGeometry(rTop, rBot, h, seg), color, pos, rot, scl })

/**
 * Reflect a part list across the YZ plane. A rotation R reflects to M·R·M with M = diag(−1,1,1),
 * which for every Euler component is (rx, −ry, −rz) — and because that identity distributes over a
 * composition it holds whatever order the Euler is applied in.
 */
export function facing(d: 1 | -1, parts: ClayPart[]): ClayPart[] {
  if (d === 1) return parts
  return parts.map((p) => ({
    ...p,
    pos: p.pos ? ([-p.pos[0], p.pos[1], p.pos[2]] as V3) : undefined,
    rot: p.rot ? ([p.rot[0], -p.rot[1], -p.rot[2]] as V3) : undefined,
  }))
}

/**
 * Reflect a part list across the XZ plane, for a composition anchored to the TOP edge instead of
 * the bottom. Same derivation as `facing` with M = diag(1,−1,1): Euler goes to (−rx, ry, −rz).
 */
export function flipY(v: 1 | -1, parts: ClayPart[]): ClayPart[] {
  if (v === -1) return parts
  return parts.map((p) => ({
    ...p,
    pos: p.pos ? ([p.pos[0], -p.pos[1], p.pos[2]] as V3) : undefined,
    rot: p.rot ? ([-p.rot[0], p.rot[1], -p.rot[2]] as V3) : undefined,
  }))
}

/** Shift a whole part list, for trimming a figure into the band the frame actually shows. */
export function shift(dx: number, dy: number, parts: ClayPart[]): ClayPart[] {
  return parts.map((p) => ({
    ...p,
    pos: [(p.pos?.[0] ?? 0) + dx, (p.pos?.[1] ?? 0) + dy, p.pos?.[2] ?? 0] as V3,
  }))
}

const Y_UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()

/** Euler that stands a +Y-axis primitive up along `dir`. */
export function alignY(dir: THREE.Vector3): V3 {
  _q.setFromUnitVectors(Y_UP, dir.clone().normalize())
  _e.setFromQuaternion(_q, 'XYZ')
  return [_e.x, _e.y, _e.z]
}

// --- faces ------------------------------------------------------------------

/**
 * A whole EYE, which at this scale is four pieces rather than one dark dot: a pale sclera bead, a
 * dark iris in front of it, a bright catch-light and a lid line above. The catch-light is what
 * makes a clay animal look alive rather than taxidermied, and the lid is what stops the toon ramp
 * flattening the eye into the head.
 */
export function eye(
  at: V3,
  r: number,
  opts: { sclera?: string; iris?: string; lid?: string; lidTilt?: number; bare?: boolean } = {}
): ClayPart[] {
  const [x, y, z] = at
  const iris = opts.iris ?? PALETTE.ink
  return [
    // `bare` skips the sclera for a character whose face is already pale — a white bead on a white
    // face patch reads as a goggle, and the face itself is the better sclera.
    ...(opts.bare ? [] : [sph(r, opts.sclera ?? PALETTE.snow, [x, y, z], [1, 1.02, 0.55], 12)]),
    sph(
      opts.bare ? r * 0.82 : r * 0.62,
      iris,
      [x + r * 0.16, y - r * 0.04, z + r * 0.42],
      [1, 1.05, 0.6],
      10
    ),
    sph(r * 0.24, PALETTE.snow, [x + r * 0.46, y + r * 0.38, z + r * 0.62], undefined, 6),
    ...(opts.lid
      ? [
          cyl(r * 0.2, r * 0.2, r * 2.1, opts.lid, [x, y + r * 0.82, z + r * 0.2], [
            0,
            0,
            Math.PI / 2 + (opts.lidTilt ?? 0),
          ]),
        ]
      : []),
  ]
}

/** A ring of blunt tufts breaking a round mass into a shaggy silhouette. */
export function tufts(
  center: V3,
  r: number,
  n: number,
  color: string,
  from: number,
  to: number,
  len = 0.55
): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (from + (to - from) * (i / Math.max(1, n - 1)))
    const l = r * (len + 0.16 * Math.sin(i * 2.1))
    out.push(
      cone(
        r * 0.32,
        l,
        color,
        [center[0] + Math.cos(a) * r * 0.95, center[1] + Math.sin(a) * r * 0.95, center[2] - 0.02],
        [0, 0, a - Math.PI / 2],
        [1, 1, 0.7],
        6
      )
    )
  }
  return out
}

// --- foliage ----------------------------------------------------------------

/**
 * One broad leaf: a flattened teardrop with a darker mid-rib laid over it. The rib is not detail
 * for its own sake — it is the one thing that keeps a big leaf from reading as a green pebble once
 * the toon ramp has flattened its shading.
 */
export function leaf(
  at: V3,
  len: number,
  wide: number,
  tilt: number,
  color: string,
  rib?: string,
  yaw = 0
): ClayPart[] {
  const out: ClayPart[] = [
    sph(len * 0.5, color, at, [1, wide, 0.16], 12),
  ]
  if (rib) out.push(cyl(len * 0.02, len * 0.035, len * 0.86, rib, [at[0], at[1], at[2] + len * 0.03], [0, 0, Math.PI / 2]))
  return out.map((p) => ({ ...p, rot: [p.rot?.[0] ?? 0, (p.rot?.[1] ?? 0) + yaw, (p.rot?.[2] ?? 0) + tilt] as V3 }))
}

/** A fan of leaves off one point — the workhorse of every biome's dressing. */
export function leafFan(
  at: V3,
  n: number,
  len: number,
  spread: readonly [number, number],
  colors: readonly string[],
  rib?: string,
  wide = 0.34
): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0.5 : i / (n - 1)
    const a = spread[0] + (spread[1] - spread[0]) * f
    const l = len * (0.78 + 0.28 * Math.sin(i * 1.7 + 0.6))
    out.push(
      ...leaf(
        [at[0] + Math.cos(a) * l * 0.5, at[1] + Math.sin(a) * l * 0.5, at[2] + (i % 2) * 0.03 - 0.015],
        l,
        wide,
        a,
        colors[i % colors.length],
        rib,
        (i % 3) * 0.18 - 0.18
      )
    )
  }
  return out
}

/**
 * A tapering woody limb through a list of points, built as overlapping segments. Used for
 * branches, mangrove roots, palm trunks and snow-laden boughs alike.
 */
export function limb(points: readonly V3[], r0: number, r1: number, color: string, seg = 7): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const len = _v.length()
    const f0 = i / (points.length - 1)
    const f1 = (i + 1) / (points.length - 1)
    out.push(
      cyl(
        r0 + (r1 - r0) * f1,
        r0 + (r1 - r0) * f0,
        len * 1.06,
        color,
        [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
        alignY(_v),
        undefined,
        seg
      )
    )
  }
  return out
}

/** A hanging strand — vine, moss or icicle chain — with a bead at each node. */
export function strand(
  at: V3,
  n: number,
  step: number,
  r: number,
  color: string,
  drift = 0.02,
  taper = 0.82
): ClayPart[] {
  const out: ClayPart[] = []
  let x = at[0]
  let y = at[1]
  let rr = r
  for (let i = 0; i < n; i++) {
    out.push(sph(rr, color, [x, y, at[2]], [1, 1.15, 0.8], 8))
    x += drift
    y -= step
    rr *= taper
  }
  return out
}

// --- rock -------------------------------------------------------------------

/**
 * One LOZENGE of rock: an ellipsoid stretched along its bed and rolled to that bed's dip, from
 * `[x, y, halfHeight, halfLength, dip, colour]`.
 *
 * Shared because it is the answer to the same defect in two biomes. A course drawn as one
 * constant-section slab has two straight parallel edges and a butt joint at each end, which is
 * exactly how a plank or a crate is drawn — the canyon's strata read as a wooden crate and the
 * desert's ledge as stacked decking. What makes rock read as rock is that a bed THICKENS, THINS and
 * PINCHES OUT along its length, so a course is built from a run of these with no two sharing a
 * thickness, a dip or an end.
 *
 * `z` offsets the lozenge toward the camera, for a shelf whose top surface things are seated on.
 */
export function rockBed(
  spec: readonly [number, number, number, number, number, string],
  depth: number,
  z = 0
): ClayPart {
  const [x, y, hy, hx, dip, color] = spec
  return {
    ...sph(hy, color, [x, y, z], [hx / hy, 1, depth / hy], 10),
    rot: [0, 0, dip] as V3,
  }
}

// --- ink outline ------------------------------------------------------------

/**
 * An inverted-hull outline for a merged clay geometry: every vertex pushed along its own normal,
 * drawn back-face-only in ink.
 *
 * Why the mascots have one and the world does not. The comic overlay this lab is built around is
 * all 4px ink borders and halftone; the characters are read at a distance, over a pale sky, by a
 * four-band toon ramp that flattens their interior shading almost completely. An ink contour is
 * the one cheap device that restores the silhouette the ramp throws away, and it ties the
 * characters to the card language rather than to the terrain they float above. It is deliberately
 * NOT applied to the world below, which reads by mass and colour at a much larger scale.
 */
export function inflateClay(geo: THREE.BufferGeometry, width: number): THREE.BufferGeometry {
  const out = geo.clone()
  const pos = out.attributes.position as THREE.BufferAttribute
  const nor = out.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * width,
      pos.getY(i) + nor.getY(i) * width,
      pos.getZ(i) + nor.getZ(i) * width
    )
  }
  pos.needsUpdate = true
  out.deleteAttribute('color')
  return out
}

/** Outline width in figure-heights — a constant screen weight, since figures scale uniformly. */
export const INK_WIDTH = 0.012
