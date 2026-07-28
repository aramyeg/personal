'use client'
import { useEffect, useMemo } from 'react'
import type { MutableRefObject, ReactElement } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { useClayRamp } from '../toon-ramp'
import { buildMergedClay, type ClayPart } from './clay-kit'
import type { PeekerKind } from './peeker-stage'

/**
 * Task 53 — the CHECKPOINT PEEKER cast: ten clay characters, two per checkpoint, that lean
 * in from the top corners while a chapter's panel is up.
 *
 * Same discipline as the terrain wildlife: every figure is a handful of clay primitives baked
 * into ONE merged vertex-coloured geometry per moving piece (buildMergedClay + the shared toon
 * ramp), so a whole character costs 1–3 draw calls and shades exactly like the world below.
 *
 * AUTHORING CONVENTION — all figures are written facing +X (toward the middle of the frame)
 * and are reflected for the right-hand corner by `facing(-1, …)`, which flips x offsets and the
 * two Euler components that live in the reflected planes. Reflecting the PLACEMENT rather than
 * applying a negative scale keeps every normal outward-facing, so the toon bands never invert.
 *
 * Local space: +Y up, +Z toward the camera, origin at the figure's read centre. Everything is
 * authored ~1 unit tall inside PEEKER_FIGURE_RADIUS so the rig's single uniform scale is the
 * figure's world height and the clearance benches have a real bound to work with.
 */

// --- primitive helpers ------------------------------------------------------

type V3 = [number, number, number]

const sph = (r: number, color: string, pos: V3, scl?: V3, seg = 10): ClayPart => ({
  geo: new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)),
  color,
  pos,
  scl,
})

const cone = (r: number, h: number, color: string, pos: V3, rot?: V3, scl?: V3, seg = 8): ClayPart => ({
  geo: new THREE.ConeGeometry(r, h, seg),
  color,
  pos,
  rot,
  scl,
})

const cyl = (rTop: number, rBot: number, h: number, color: string, pos: V3, rot?: V3, seg = 8): ClayPart => ({
  geo: new THREE.CylinderGeometry(rTop, rBot, h, seg),
  color,
  pos,
  rot,
})

/**
 * Reflect a part list across the YZ plane. A rotation R reflects to M·R·M with M = diag(-1,1,1),
 * which for every Euler component is (rx, −ry, −rz) — and because that identity distributes over
 * a composition it holds whatever order the Euler is applied in. All the primitives used here are
 * themselves symmetric about YZ, so flipping the placement flips the figure.
 */
function facing(d: 1 | -1, parts: ClayPart[]): ClayPart[] {
  if (d === 1) return parts
  return parts.map((p) => ({
    ...p,
    pos: p.pos ? ([-p.pos[0], p.pos[1], p.pos[2]] as V3) : undefined,
    rot: p.rot ? ([p.rot[0], -p.rot[1], -p.rot[2]] as V3) : undefined,
  }))
}

/**
 * Shift a whole part list up in local space. The panel cards crop each figure at roughly its
 * own mid-height, so a character only reads if its FACE lives in the top band of its bounding
 * box — this is the per-figure trim that puts it there, paired with the same offset on the
 * figure's limb joint.
 */
function raise(dy: number, parts: ClayPart[]): ClayPart[] {
  return parts.map((p) => ({
    ...p,
    pos: [p.pos?.[0] ?? 0, (p.pos?.[1] ?? 0) + dy, p.pos?.[2] ?? 0] as V3,
  }))
}

const Y_UP = new THREE.Vector3(0, 1, 0)
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()

/** Euler that stands a +Y-axis primitive up along `dir` — used to lay scales over a sphere. */
function alignY(dir: THREE.Vector3): V3 {
  _q.setFromUnitVectors(Y_UP, dir)
  _e.setFromQuaternion(_q, 'XYZ')
  return [_e.x, _e.y, _e.z]
}

/** Two ink eyes mirrored across the figure's centre plane. */
function eyes(r: number, pos: V3, spread: number): ClayPart[] {
  return [
    sph(r, PALETTE.ink, [pos[0], pos[1], pos[2] + spread], undefined, 8),
    sph(r, PALETTE.ink, [pos[0], pos[1], pos[2] - spread], undefined, 8),
  ]
}

// --- jungle: exotic birds, wings open ---------------------------------------

/** Scarlet macaw: hooked ink beak, bare cheek patch, a long open wing and streaming tail. */
function macawBody(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // plump body + shoulders, sitting below and behind the head
    sph(0.25, PALETTE.parrotBody, [-0.11, -0.15, -0.02], [1, 1.15, 0.95], 12),
    // long tail feathers streaming down and out of frame
    cone(0.055, 0.42, PALETTE.parrotWing, [-0.24, -0.4, -0.03], [0, 0, 0.45], [1, 1, 0.45]),
    cone(0.045, 0.34, PALETTE.honey, [-0.31, -0.36, 0.03], [0, 0, 0.62], [1, 1, 0.45]),
    // head
    sph(0.19, PALETTE.parrotBody, [0.09, 0.2, 0], [1, 1.06, 0.98], 12),
    // bare cheek patch — the macaw's signature pale face
    sph(0.13, PALETTE.sky, [0.18, 0.18, 0.1], [0.8, 1, 0.55], 10),
    sph(0.058, PALETTE.ink, [0.21, 0.21, 0.145], undefined, 8),
    sph(0.018, PALETTE.sky, [0.24, 0.25, 0.17], undefined, 6),
    // heavy hooked beak: dark upper mandible over a pale hook
    cone(0.095, 0.24, PALETTE.ink, [0.25, 0.13, 0.02], [0, 0, -2.5], [1, 1, 0.8]),
    sph(0.05, PALETTE.sky, [0.29, 0.03, 0.02], [1, 0.8, 0.9], 8),
    // crest feathers fanning back off the crown
    cone(0.04, 0.16, PALETTE.honey, [0.02, 0.35, 0.02], [0, 0, 0.25]),
    cone(0.038, 0.2, PALETTE.parrotBody, [-0.06, 0.35, -0.01], [0, 0, 0.5]),
    cone(0.032, 0.15, PALETTE.parrotWing, [-0.14, 0.3, 0.02], [0, 0, 0.8]),
  ])
}

/**
 * The macaw's open wing, authored about its shoulder joint so the rig can flutter it. It arcs
 * steeply UP rather than straight out to the side: at the frame's corner a horizontal wing is
 * simply off-screen, while a raised one breaks the skyline above the bird's own head.
 */
function macawWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.2, PALETTE.parrotBody, [-0.08, 0.09, 0], [1.1, 0.65, 0.8], 10),
    sph(0.18, PALETTE.parrotWing, [-0.19, 0.24, 0.01], [1.2, 0.5, 0.7], 10),
    sph(0.15, PALETTE.honey, [-0.27, 0.4, 0.02], [1.1, 0.45, 0.6], 10),
    cone(0.055, 0.3, PALETTE.parrotWing, [-0.33, 0.56, 0], [0, 0, -0.42], [1, 1, 0.4]),
    cone(0.05, 0.26, PALETTE.parrotBody, [-0.24, 0.55, 0.03], [0, 0, -0.2], [1, 1, 0.4]),
  ])
}

/** Cockatoo: pale cream plumage, a big fanned crest and a blushing cheek. */
function cockatooBody(d: 1 | -1): ClayPart[] {
  const crest: ClayPart[] = []
  for (let i = 0; i < 5; i++) {
    const f = i / 4
    crest.push(
      cone(0.036 - f * 0.008, 0.26 - f * 0.06, i % 2 === 0 ? PALETTE.petal : PALETTE.honey, [
        0.08 - f * 0.24,
        0.38 + (1 - Math.abs(f - 0.35) * 1.6) * 0.06,
        0.02 - f * 0.02,
      ], [0, 0, 0.15 + f * 0.85])
    )
  }
  return facing(d, [
    sph(0.24, PALETTE.sky, [-0.1, -0.16, -0.02], [1, 1.15, 0.95], 12),
    // soft under-tail wisps
    cone(0.05, 0.3, PALETTE.sky, [-0.22, -0.4, -0.02], [0, 0, 0.5], [1, 1, 0.5]),
    cone(0.04, 0.24, PALETTE.honey, [-0.29, -0.35, 0.03], [0, 0, 0.7], [1, 1, 0.5]),
    sph(0.185, PALETTE.sky, [0.09, 0.2, 0], [1, 1.04, 0.98], 12),
    // blushing cheek + wide dark eye
    sph(0.085, PALETTE.petal, [0.19, 0.15, 0.11], [0.9, 1, 0.4], 8),
    sph(0.048, PALETTE.ink, [0.19, 0.23, 0.135], undefined, 8),
    sph(0.016, PALETTE.sky, [0.21, 0.255, 0.16], undefined, 6),
    // stubby hooked bill
    cone(0.085, 0.19, PALETTE.stone, [0.24, 0.13, 0.02], [0, 0, -2.5], [1, 1, 0.85]),
    ...crest,
  ])
}

function cockatooWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.19, PALETTE.sky, [-0.08, 0.08, 0], [1.1, 0.66, 0.8], 10),
    sph(0.17, PALETTE.petal, [-0.18, 0.23, 0.01], [1.2, 0.5, 0.7], 10),
    sph(0.14, PALETTE.bluebell, [-0.26, 0.38, 0.02], [1.1, 0.44, 0.6], 10),
    cone(0.052, 0.28, PALETTE.honey, [-0.31, 0.54, 0], [0, 0, -0.45], [1, 1, 0.4]),
    cone(0.046, 0.24, PALETTE.petal, [-0.22, 0.53, 0.03], [0, 0, -0.22], [1, 1, 0.4]),
  ])
}

// --- delta: crocodiles ------------------------------------------------------

/** Ridge of scutes marching along a snout. */
function scutes(d: 1 | -1, from: number, to: number, n: number, y: number, color: string): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const x = from + (to - from) * f
    const s = 0.05 - f * 0.016
    out.push(cone(s, s * 1.5, color, [x * d, y - f * 0.012, 0.05], undefined, [1, 1, 0.7]))
    out.push(cone(s, s * 1.5, color, [x * d, y - f * 0.012, -0.05], undefined, [1, 1, 0.7]))
  }
  return out
}

/** A row of little snow teeth along a jaw line. */
function teeth(d: 1 | -1, from: number, to: number, n: number, y: number, down: boolean): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const x = (from + (to - from) * f) * d
    const s = 0.026 - f * 0.008
    const rot: V3 = down ? [Math.PI, 0, 0] : [0, 0, 0]
    out.push(cone(s, s * 2.4, PALETTE.snow, [x, y, 0.062], rot, undefined, 6))
    out.push(cone(s, s * 2.4, PALETTE.snow, [x, y, -0.062], rot, undefined, 6))
  }
  return out
}

/** The big croc: a long snout hooked over the corner with its jaws hanging open. */
function crocSkull(d: 1 | -1, big: boolean): ClayPart[] {
  const k = big ? 1 : 0.86
  return [
    ...facing(d, [
      // cranial dome + brow
      sph(0.2 * k, PALETTE.crocHide, [-0.16, 0.04, 0], [1.05, 0.8, 1.05], 12),
      // long upper snout
      sph(0.155 * k, PALETTE.crocHide, [0.14, 0.03, 0], [2.35, 0.62, 0.86], 12),
      sph(0.1 * k, PALETTE.crocHide, [0.4, 0.015, 0], [1.1, 0.62, 0.82], 10),
      // nostril bumps at the tip
      sph(0.03, PALETTE.crocRidge, [0.46, 0.06, 0.04], undefined, 6),
      sph(0.03, PALETTE.crocRidge, [0.46, 0.06, -0.04], undefined, 6),
      // periscope eye turrets
      sph(0.075 * k, PALETTE.crocHide, [-0.16, 0.16, 0.1], undefined, 10),
      sph(0.075 * k, PALETTE.crocHide, [-0.16, 0.16, -0.1], undefined, 10),
      sph(0.05, PALETTE.honey, [-0.15, 0.21, 0.105], [1, 0.85, 1], 8),
      sph(0.05, PALETTE.honey, [-0.15, 0.21, -0.105], [1, 0.85, 1], 8),
      sph(0.028, PALETTE.ink, [-0.13, 0.24, 0.115], [0.55, 1.5, 0.55], 6),
      sph(0.028, PALETTE.ink, [-0.13, 0.24, -0.115], [0.55, 1.5, 0.55], 6),
      // heavy shoulders trailing off the outer edge
      sph(0.26 * k, PALETTE.crocHide, [-0.38, -0.14, 0], [1.05, 0.85, 1.05], 12),
    ]),
    ...scutes(d, -0.34, 0.34, 6, 0.16, PALETTE.crocRidge),
    ...teeth(d, 0.0, 0.42, 5, -0.035, true),
  ]
}

/** The matching lower jaw, authored about the hinge so the rig can work the gape. */
function crocJaw(d: 1 | -1, big: boolean): ClayPart[] {
  const k = big ? 1 : 0.86
  return [
    ...facing(d, [
      sph(0.14 * k, PALETTE.crocHide, [0.3, -0.03, 0], [2.2, 0.5, 0.8], 12),
      sph(0.11 * k, PALETTE.crocBelly, [0.3, -0.07, 0], [2.1, 0.34, 0.62], 10),
      sph(0.09 * k, PALETTE.crocHide, [0.56, -0.035, 0], [1.1, 0.5, 0.75], 10),
    ]),
    ...teeth(d, 0.16, 0.56, 5, 0.02, false),
  ]
}

/**
 * A clawed forefoot slung across the small croc's chest. Kept short and tucked against the
 * jaw: an earlier version reached down past the frame's visible band and read as a green post
 * rather than a foot.
 */
function crocClaw(d: 1 | -1): ClayPart[] {
  return facing(d, [
    cyl(0.05, 0.062, 0.14, PALETTE.crocHide, [-0.02, -0.02, 0], [0, 0, 0.9]),
    sph(0.075, PALETTE.crocHide, [0.06, -0.08, 0.02], [1.25, 0.65, 1], 10),
    cone(0.02, 0.075, PALETTE.snow, [0.12, -0.1, 0.05], [0, 0, -2.1], undefined, 6),
    cone(0.02, 0.075, PALETTE.snow, [0.13, -0.11, 0], [0, 0, -2.1], undefined, 6),
    cone(0.02, 0.075, PALETTE.snow, [0.12, -0.1, -0.05], [0, 0, -2.1], undefined, 6),
  ])
}

// --- desert: camels ---------------------------------------------------------

/** Camel head on a long neck rising from the corner; the calf is the same build, rounder. */
function camelHead(d: 1 | -1, calf: boolean): ClayPart[] {
  const k = calf ? 0.86 : 1
  const parts: ClayPart[] = [
    // neck sweeping down and out of frame — the axis runs from the base UP to the jaw, so the
    // z rotation is negative; the positive tilt read as a detached bar leaning the wrong way
    cyl(0.11 * k, 0.17 * k, 0.62, PALETTE.camelHide, [-0.11, -0.16, -0.01], [0, 0, -0.5]),
    // head + long muzzle
    sph(0.16 * k, PALETTE.camelHide, [0.06, 0.16, 0], [1.35, 1, 0.95], 12),
    sph(0.105 * k, PALETTE.camelHideDeep, [calf ? 0.24 : 0.29, 0.1, 0], [1.25, 0.9, 0.88], 10),
    // a terracotta halter strap across the muzzle — the family's one warm accent, and the
    // only place on a peeking camel where a saddle blanket would actually be in frame
    cyl(0.115 * k, 0.115 * k, 0.05, PALETTE.camelSaddle, [calf ? 0.22 : 0.27, 0.11, 0], [0, 0, -1.45]),
    sph(0.022, PALETTE.ink, [calf ? 0.31 : 0.36, 0.15, 0.045], undefined, 6),
    sph(0.022, PALETTE.ink, [calf ? 0.31 : 0.36, 0.15, -0.045], undefined, 6),
    // heavy-lidded eyes with lashes
    sph(0.055 * k, PALETTE.camelHide, [0.13, 0.26, 0.1], [1, 0.9, 0.75], 8),
    sph(0.055 * k, PALETTE.camelHide, [0.13, 0.26, -0.1], [1, 0.9, 0.75], 8),
    sph(0.04, PALETTE.ink, [0.16, 0.26, 0.115], undefined, 8),
    sph(0.04, PALETTE.ink, [0.16, 0.26, -0.115], undefined, 8),
    sph(0.014, PALETTE.sky, [0.19, 0.29, 0.13], undefined, 6),
    sph(0.014, PALETTE.sky, [0.19, 0.29, -0.1], undefined, 6),
    cone(0.014, 0.07, PALETTE.ink, [0.18, 0.32, 0.115], [0, 0, -0.7], undefined, 5),
    cone(0.014, 0.07, PALETTE.ink, [0.18, 0.32, -0.115], [0, 0, -0.7], undefined, 5),
    // ears
    cone(0.035, 0.09, PALETTE.camelHide, [-0.04, 0.32, 0.09], [0.4, 0, -0.25], undefined, 6),
    cone(0.035, 0.09, PALETTE.camelHide, [-0.04, 0.32, -0.09], [-0.4, 0, -0.25], undefined, 6),
  ]
  // the calf keeps a scruffy forelock; the adult gets a smooth crown
  if (calf) {
    parts.push(
      cone(0.03, 0.11, PALETTE.camelHideDeep, [0.04, 0.33, 0.03], [0, 0, -0.3], undefined, 6),
      cone(0.028, 0.1, PALETTE.camelHideDeep, [-0.01, 0.34, -0.02], [0, 0, 0.25], undefined, 6),
      cone(0.026, 0.09, PALETTE.camelHideDeep, [0.09, 0.31, -0.04], [0, 0, -0.6], undefined, 6)
    )
  }
  return facing(d, parts)
}

/** Lower jaw, hinged at the back of the head so it can work side to side as a chew. */
function camelJaw(d: 1 | -1, calf: boolean): ClayPart[] {
  const k = calf ? 0.86 : 1
  return facing(d, [
    sph(0.09 * k, PALETTE.camelHide, [0.14, -0.02, 0], [1.9, 0.62, 0.85], 10),
    sph(0.075 * k, PALETTE.camelHideDeep, [calf ? 0.26 : 0.31, -0.03, 0], [1.15, 0.6, 0.8], 10),
  ])
}

// --- canyon: pangolins ------------------------------------------------------

/**
 * An armoured ball: a core sphere under a golden-angle spiral of big overlapping scale plates.
 * Plate count stays low and plate size high so the silhouette reads as ARMOUR at corner scale —
 * a fine spiral just turns into fuzz.
 */
function pangolinShell(r: number, n: number): ClayPart[] {
  const parts: ClayPart[] = [sph(r * 0.9, PALETTE.pangolinScaleDeep, [0, 0, 0], undefined, 14)]
  const dir = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = i * 2.399963229728653
    dir.set(ring * Math.cos(phi), y, ring * Math.sin(phi))
    const shade = i % 3 === 0 ? PALETTE.pangolinScaleDeep : PALETTE.pangolinScale
    parts.push(
      cone(r * 0.56, r * 0.46, shade, [dir.x * r * 0.82, dir.y * r * 0.82, dir.z * r * 0.82], alignY(dir), [1, 1, 0.68], 5)
    )
  }
  return parts
}

/** Head + forelimb, authored about the neck joint: tucked inside the ball, out when unrolled. */
function pangolinHead(d: 1 | -1, k: number): ClayPart[] {
  return facing(d, [
    cyl(0.09 * k, 0.12 * k, 0.18 * k, PALETTE.pangolinScale, [0.05 * k, 0.02 * k, 0], [0, 0, -1.15]),
    // long wedge head — the snout is the whole silhouette read
    sph(0.1 * k, PALETTE.clayPath, [0.2 * k, 0.05 * k, 0], [1.6, 0.85, 0.9], 10),
    cone(0.06 * k, 0.2 * k, PALETTE.clayPath, [0.36 * k, 0.0 * k, 0], [0, 0, -1.72], undefined, 7),
    sph(0.028, PALETTE.ink, [0.19 * k, 0.11 * k, 0.07 * k], undefined, 7),
    sph(0.028, PALETTE.ink, [0.19 * k, 0.11 * k, -0.07 * k], undefined, 7),
    sph(0.01, PALETTE.sky, [0.21 * k, 0.13 * k, 0.1 * k], undefined, 6),
    // little ear flaps + a clawed forefoot slung underneath
    sph(0.034, PALETTE.pangolinScaleDeep, [0.09 * k, 0.13 * k, 0.08 * k], [0.6, 1, 1], 6),
    sph(0.034, PALETTE.pangolinScaleDeep, [0.09 * k, 0.13 * k, -0.08 * k], [0.6, 1, 1], 6),
    cyl(0.045 * k, 0.055 * k, 0.17 * k, PALETTE.pangolinScale, [0.08 * k, -0.15 * k, 0.06 * k], [0, 0, 0.5]),
    cone(0.024, 0.1, PALETTE.sinter, [0.16 * k, -0.23 * k, 0.06 * k], [0, 0, -2.2], undefined, 5),
    cone(0.024, 0.1, PALETTE.sinter, [0.15 * k, -0.24 * k, 0.11 * k], [0, 0, -2.2], undefined, 5),
  ])
}

/** Plated tail, authored about its root: curled over the ball, trailing out when unrolled. */
function pangolinTail(d: 1 | -1, k: number): ClayPart[] {
  const parts: ClayPart[] = []
  for (let i = 0; i < 5; i++) {
    const f = i / 4
    const s = (0.11 - f * 0.055) * k
    parts.push(sph(s, i % 2 === 0 ? PALETTE.pangolinScale : PALETTE.pangolinScaleDeep, [-(0.08 + f * 0.34) * k, -f * 0.06 * k, 0], [1, 0.72, 0.85], 8))
  }
  return facing(d, parts)
}

// --- winter: yetis ----------------------------------------------------------

/**
 * Shaggy fur silhouette: a ring of big tufts breaking the outline of a head/shoulder mass.
 * Few and large on purpose — at corner scale a fine fringe turns to noise, while half a dozen
 * chunky spikes read as fur from across the room.
 */
function shag(r: number, center: V3, n: number, color: string, from = 0.15, to = 1.0): ClayPart[] {
  const parts: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (from + (to - from) * (i / (n - 1)))
    const len = r * (0.52 + 0.18 * Math.sin(i * 2.1))
    parts.push(
      cone(r * 0.34, len, color, [center[0] + Math.cos(a) * r * 0.98, center[1] + Math.sin(a) * r * 0.98, center[2] - 0.02], [0, 0, a - Math.PI / 2], [1, 1, 0.72], 6)
    )
  }
  return parts
}

/**
 * The yeti: the face is the whole job at this size, so it is built like a mask — a wide pale
 * muzzle plate, a heavy brow, and eyes big enough to read as eyes rather than as two dots.
 */
function yetiBody(d: 1 | -1, big: boolean): ClayPart[] {
  const k = big ? 1 : 0.85
  const fur = big ? PALETTE.yetiFur : PALETTE.hareFur
  return facing(d, [
    // shoulder mass sinking off the outer edge
    sph(0.29 * k, fur, [-0.26, -0.3, -0.04], [1.2, 0.95, 1], 12),
    ...shag(0.29 * k, [-0.26, -0.3, -0.04], 5, fur, 0.95, 1.8),
    // head, slightly narrow so the shag reads as an outline rather than a fringe on a ball.
    // The face is built SYMMETRICALLY about the head's x centre and pushed forward in +Z: the
    // rig's inward yaw then turns the whole mask toward the middle of the frame.
    sph(0.27 * k, fur, [0.05, 0.18, 0], [1, 1.04, 0.92], 14),
    ...shag(0.28 * k, [0.05, 0.18, 0], 8, fur, 0.04, 1.22),
    // two big ear tufts hooking off the sides — the silhouette's signature
    cone(0.075 * k, 0.2 * k, fur, [-0.14, 0.35, 0.02], [0, 0, 0.6], undefined, 6),
    cone(0.07 * k, 0.18 * k, fur, [0.24, 0.33, 0.02], [0, 0, -0.55], undefined, 6),
    // wide cool muzzle plate across the lower face
    sph(0.21 * k, PALETTE.yetiMuzzle, [0.05, 0.07, 0.14], [1.05, 0.85, 0.62], 12),
    // heavy brow shelf over the eyes
    sph(0.23 * k, fur, [0.05, 0.31, 0.08], [1, 0.44, 0.62], 10),
    sph(0.05 * k, PALETTE.frostShadow, [-0.05, 0.26, 0.17], [1.6, 0.5, 0.6], 8),
    sph(0.05 * k, PALETTE.frostShadow, [0.15, 0.26, 0.17], [1.6, 0.5, 0.6], 8),
    // big dark eyes with a glint
    sph(0.075 * k, PALETTE.ink, [-0.05, 0.19, 0.2], [0.9, 1, 0.85], 10),
    sph(0.075 * k, PALETTE.ink, [0.15, 0.19, 0.2], [0.9, 1, 0.85], 10),
    sph(0.026, PALETTE.sky, [-0.02, 0.23, 0.24], undefined, 6),
    sph(0.026, PALETTE.sky, [0.18, 0.23, 0.24], undefined, 6),
    // broad open grin with two blunt tusks
    sph(0.11 * k, PALETTE.ink, [0.05, 0.0, 0.2], [1.2, 0.5, 0.45], 10),
    cone(0.032, 0.09, PALETTE.snow, [-0.02, 0.04, 0.23], undefined, undefined, 6),
    cone(0.032, 0.09, PALETTE.snow, [0.12, 0.04, 0.23], undefined, undefined, 6),
    // snow crusted on the crown
    sph(0.12 * k, PALETTE.snow, [0.05, 0.39, 0.03], [1.35, 0.4, 0.9], 10),
  ])
}

/** A shaggy arm hooked over the frame edge, authored about the shoulder. */
function yetiArm(d: 1 | -1, big: boolean): ClayPart[] {
  const k = big ? 1 : 0.85
  const fur = big ? PALETTE.yetiFur : PALETTE.hareFur
  return facing(d, [
    cyl(0.1 * k, 0.12 * k, 0.3 * k, fur, [0.03, -0.1, 0], [0, 0, -0.4]),
    ...shag(0.13 * k, [0.06, -0.16, 0], 4, fur, 1.2, 2.0),
    sph(0.13 * k, fur, [0.14, -0.26, 0.02], [1.05, 0.9, 1], 10),
    sph(0.1 * k, PALETTE.yetiMuzzle, [0.18, -0.28, 0.08], [0.9, 0.9, 0.7], 8),
    sph(0.04 * k, PALETTE.yetiMuzzle, [0.22, -0.19, 0.09], undefined, 6),
    sph(0.04 * k, PALETTE.yetiMuzzle, [0.25, -0.25, 0.07], undefined, 6),
    sph(0.04 * k, PALETTE.yetiMuzzle, [0.25, -0.32, 0.05], undefined, 6),
  ])
}

// --- figure assembly --------------------------------------------------------

/** `a` and `b` are the hinged pieces (wing/jaw/head, tail/claw); `c` is a whole-body deformer
 *  (only the pangolins use it, to swell their ball out into a body as they unfurl). */
export type PeekerLimbs = { a: THREE.Group | null; b: THREE.Group | null; c?: THREE.Group | null }
export type PeekerDrive = { idle: number; unroll: number }

type FigureProps = { limbs: MutableRefObject<PeekerLimbs>; dir: 1 | -1 }

/** Builds a merged geometry once per (dir, kind) and disposes it when the figure goes away. */
function useClayGeo(build: () => ClayPart[], deps: readonly unknown[]): THREE.BufferGeometry {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => buildMergedClay(build()), deps)
  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

function ClayPiece({ geo }: { geo: THREE.BufferGeometry }) {
  const ramp = useClayRamp()
  return (
    <mesh geometry={geo}>
      <meshToonMaterial vertexColors gradientMap={ramp} />
    </mesh>
  )
}

/** Two-piece figure: a static body plus one hinged limb the rig animates. */
function HingedFigure({
  limbs,
  body,
  limb,
  limbAt,
}: {
  limbs: MutableRefObject<PeekerLimbs>
  body: THREE.BufferGeometry
  limb: THREE.BufferGeometry
  limbAt: V3
}) {
  return (
    <group>
      <ClayPiece geo={body} />
      <group
        position={limbAt}
        ref={(g) => {
          limbs.current.a = g
        }}
      >
        <ClayPiece geo={limb} />
      </group>
    </group>
  )
}

/**
 * Per-figure LIFT (in figure-heights). The frame's visible band for a peeker runs from roughly
 * its own mid-height to a little past its crown, so every character is trimmed upward until its
 * face is inside that band. Tuned by capture — the camels needed none, the crocodiles most.
 */
const LIFT = { macaw: 0.07, cockatoo: 0.05, croc: 0.11, camel: 0.02, pangolin: 0.06, yeti: -0.05 }

function Macaw({ limbs, dir }: FigureProps) {
  const body = useClayGeo(() => raise(LIFT.macaw, macawBody(dir)), [dir])
  const wing = useClayGeo(() => macawWing(dir), [dir])
  return <HingedFigure limbs={limbs} body={body} limb={wing} limbAt={[-0.12 * dir, 0.08 + LIFT.macaw, 0.06]} />
}

function Cockatoo({ limbs, dir }: FigureProps) {
  const body = useClayGeo(() => raise(LIFT.cockatoo, cockatooBody(dir)), [dir])
  const wing = useClayGeo(() => cockatooWing(dir), [dir])
  return <HingedFigure limbs={limbs} body={body} limb={wing} limbAt={[-0.11 * dir, 0.06 + LIFT.cockatoo, 0.06]} />
}

function Croc({ limbs, dir, big }: FigureProps & { big: boolean }) {
  const skull = useClayGeo(() => raise(LIFT.croc, crocSkull(dir, big)), [dir, big])
  const jaw = useClayGeo(() => crocJaw(dir, big), [dir, big])
  const claw = useClayGeo(() => crocClaw(dir), [dir])
  // The little one cocks its head — the two crocodiles share a build, so the tilt (plus the
  // barely-there chomp and the forefoot) is what keeps the pair from reading as a mirror.
  return (
    <group rotation={[0, 0, big ? 0 : -0.26 * dir]}>
      <ClayPiece geo={skull} />
      <group
        position={[-0.18 * dir, -0.02 + LIFT.croc, 0]}
        ref={(g) => {
          limbs.current.a = g
        }}
      >
        <ClayPiece geo={jaw} />
      </group>
      {!big && (
        <group
          position={[0.1 * dir, -0.12 + LIFT.croc, 0.14]}
          ref={(g) => {
            limbs.current.b = g
          }}
        >
          <ClayPiece geo={claw} />
        </group>
      )}
    </group>
  )
}

function Camel({ limbs, dir, calf }: FigureProps & { calf: boolean }) {
  const head = useClayGeo(() => raise(LIFT.camel, camelHead(dir, calf)), [dir, calf])
  const jaw = useClayGeo(() => camelJaw(dir, calf), [dir, calf])
  return <HingedFigure limbs={limbs} body={head} limb={jaw} limbAt={[-0.02 * dir, 0.1 + LIFT.camel, 0]} />
}

function Pangolin({ limbs, dir, big }: FigureProps & { big: boolean }) {
  const k = big ? 1 : 0.82
  // The shell stays centred on the figure's origin so the roll-in spins about the ball's own
  // middle; the lift rides on the whole figure via the ball, and the joints sit on its equator
  // so the head and tail unfurl into the band the frame actually shows.
  const shell = useClayGeo(() => raise(LIFT.pangolin, pangolinShell(0.36 * k, big ? 15 : 12)), [k, big])
  const head = useClayGeo(() => pangolinHead(dir, k), [dir, k])
  const tail = useClayGeo(() => pangolinTail(dir, k), [dir, k])
  return (
    <group>
      <group
        ref={(g) => {
          limbs.current.c = g
        }}
      >
        <ClayPiece geo={shell} />
      </group>
      <group
        position={[0.25 * k * dir, 0.03 * k + LIFT.pangolin, 0.08]}
        ref={(g) => {
          limbs.current.a = g
        }}
      >
        <ClayPiece geo={head} />
      </group>
      <group
        position={[-0.25 * k * dir, 0.02 * k + LIFT.pangolin, -0.02]}
        ref={(g) => {
          limbs.current.b = g
        }}
      >
        <ClayPiece geo={tail} />
      </group>
    </group>
  )
}

function Yeti({ limbs, dir, big }: FigureProps & { big: boolean }) {
  const body = useClayGeo(() => raise(LIFT.yeti, yetiBody(dir, big)), [dir, big])
  const arm = useClayGeo(() => yetiArm(dir, big), [dir, big])
  return <HingedFigure limbs={limbs} body={body} limb={arm} limbAt={[-0.18 * dir, -0.1 + LIFT.yeti, 0.14]} />
}

// --- per-kind gesture + spec ------------------------------------------------

/**
 * Every character owns exactly ONE idle gesture, driven by the dwell fraction (see
 * peeker-stage.ts) and scaled by presence so it eases in with the entrance and out with the
 * exit — smooth, continuous, and nothing in the flicker family.
 *
 * `dir` is threaded in because a hinge that swings a jaw open for a left-hand figure has to
 * swing the other way once the figure is reflected: rotations about Y and Z flip sign.
 */
export type PeekerSpec = {
  Figure: (props: FigureProps) => ReactElement
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
  if (limbs.a) limbs.a.rotation.z = dir * (0.12 + 0.34 * drive.idle)
}

/** A slow gape: the jaw hangs open and eases shut, never snapping. */
function applyJaw(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = dir * (0.16 + 0.15 * drive.idle)
  if (limbs.b) limbs.b.rotation.z = dir * 0.12 * drive.idle
}

/** The small croc barely opens — it just works its jaw and taps a claw. */
function applyChomp(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = dir * (0.06 + 0.07 * drive.idle)
  if (limbs.b) limbs.b.rotation.z = dir * (-0.1 + 0.18 * drive.idle)
}

/** Camels chew sideways — a yaw on the jaw reads far more camel than a hinge. */
function applyChew(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (!limbs.a) return
  limbs.a.rotation.z = dir * 0.05 * (0.5 + 0.5 * drive.idle)
  limbs.a.rotation.y = 0.09 * drive.idle
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
    // once out, the snout noses gently up and down
    limbs.a.rotation.y = 0.22 * drive.idle * u
  }
  if (limbs.b) {
    limbs.b.rotation.z = dir * (-2.5 + 2.1 * u)
    const s = 0.55 + 0.45 * u
    limbs.b.scale.set(s, s, s)
  }
  if (limbs.c) limbs.c.scale.set(1 + 0.34 * u, 1 - 0.22 * u, 1 - 0.06 * u)
}

/** The yeti's arm rocks slowly where it grips the edge. */
function applyArm(limbs: PeekerLimbs, drive: PeekerDrive, dir: 1 | -1): void {
  if (limbs.a) limbs.a.rotation.z = dir * (-0.08 + 0.22 * drive.idle)
}

export const PEEKER_SPECS: Record<PeekerKind, PeekerSpec> = {
  macaw: { Figure: Macaw, apply: applyWing, cycles: 6, sway: 0.05 },
  cockatoo: { Figure: Cockatoo, apply: applyWing, cycles: 5, sway: 0.055 },
  crocGape: { Figure: (p) => <Croc {...p} big />, apply: applyJaw, cycles: 2, sway: 0.03 },
  crocPeek: { Figure: (p) => <Croc {...p} big={false} />, apply: applyChomp, cycles: 2.5, sway: 0.035 },
  camelAdult: { Figure: (p) => <Camel {...p} calf={false} />, apply: applyChew, cycles: 4, sway: 0.04 },
  camelCalf: { Figure: (p) => <Camel {...p} calf />, apply: applyChew, cycles: 5, sway: 0.05 },
  pangolinBig: { Figure: (p) => <Pangolin {...p} big />, apply: applyUnroll, cycles: 2.5, sway: 0.05, rolls: true },
  pangolinSmall: { Figure: (p) => <Pangolin {...p} big={false} />, apply: applyUnroll, cycles: 3, sway: 0.06, rolls: true },
  yetiBig: { Figure: (p) => <Yeti {...p} big />, apply: applyArm, cycles: 2, sway: 0.045 },
  yetiSmall: { Figure: (p) => <Yeti {...p} big={false} />, apply: applyArm, cycles: 2.5, sway: 0.06 },
}
