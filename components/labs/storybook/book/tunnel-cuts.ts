/**
 * THE CUT VOCABULARY — every piece of paper in the chapter-1 tunnel, authored as
 * 2D contours with holes. No three-scene knowledge lives here: this module says
 * WHAT is cut, `popup-tunnel.ts` says where each plane stands, and
 * `popup-tunnel-layer.tsx` extrudes and lights it.
 *
 * WHY SHAPES AND NOT TEXTURED QUADS. E3's spread was alpha-cut billboards, and at
 * the reading camera's 26.1 deg depression a billboard has no edge — the silhouette
 * ends in a hard alpha step with nothing to catch light. Extruding a real contour
 * gives every cut a side wall, and that bright rim along the cut line is the entire
 * reason a tunnel book reads as stacked paper rather than as a printed picture.
 *
 * LOCAL COORDS. Each piece is authored in its own plane's 2D frame:
 *   x — across the plane, and it is the DIORAMA's world x (0 = the gutter),
 *       so a piece at x -0.29 lines up with the arch at x -0.29 on every plane.
 *   y — height ABOVE that plane's deck line. y=0 sits exactly on the raked deck,
 *       so a piece never has to know how high its own deck line is.
 * Extrusion runs along the plane normal, toward the reader.
 *
 * The deck is the one exception: it is authored in PLAN view (x = world x,
 * y = world z) because it lies down.
 */

import * as THREE from 'three'

export type PlaneKey = 'proscenium' | 'jamb' | 'yard' | 'gallery' | 'backwall' | 'sky'

/**
 * How a piece takes light. The layer maps each tone to a material; keeping the
 * vocabulary symbolic means the whole diorama can be re-graded from one table
 * without touching a single contour.
 */
export type CutTone =
  | 'timber' // dark warm structural wood — the inn's frame
  | 'plaster' // pale warm wall between the timbers
  | 'stone' // cool grey masonry, arch voussoirs, cobbles
  | 'slate' // dark roof
  | 'silhouette' // near-black cut figure, reads only as shape
  | 'glass' // emissive warm window pane behind a die-cut
  | 'brass' // warm metal — lantern, ring, weathervane
  | 'foliage'
  | 'iron' // cold dark metal — the yard gates
  | 'hearth' // the strongest warm source: the destination doorway, the kitchen fire
  | 'night' // deep blue-slate: the sky plate, and only that
  | 'moon' // pale cool emissive — moon and stars
  | 'ink' // zero albedo: a cut-out that stays black under a point-blank light

/**
 * Pieces carrying a `slideKey` are posed by the engine rather than sitting still:
 * the two yard gate leaves part sideways, and the coach travels up the tunnel.
 */
export type SlideKey = 'gate-l' | 'gate-r'

export type CutPiece = {
  readonly id: string
  /** Outer contours. Anything in `shape.holes` is a die-cut you can see through. */
  readonly shapes: readonly THREE.Shape[]
  /** Paper thickness in world units. 0.010 for leaves, up to 0.020 for the facade. */
  readonly thickness: number
  readonly tone: CutTone
  readonly slideKey?: SlideKey
}

// ---------------------------------------------------------------------------
// contour helpers
// ---------------------------------------------------------------------------

/** An axis-aligned rectangle as a closed contour. */
export function rect(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(x0, y0)
  s.lineTo(x1, y0)
  s.lineTo(x1, y1)
  s.lineTo(x0, y1)
  s.closePath()
  return s
}

/** The same rectangle as a hole path, ready to push into `shape.holes`. */
export function rectHole(x0: number, y0: number, x1: number, y1: number): THREE.Path {
  const p = new THREE.Path()
  p.moveTo(x0, y0)
  p.lineTo(x1, y0)
  p.lineTo(x1, y1)
  p.lineTo(x0, y1)
  p.closePath()
  return p
}

/**
 * A round-headed opening: vertical jambs to `springY`, then a semicircular head
 * to `apexY`. The carriage arch, every window head, the gallery openings.
 */
export function archHole(cx: number, halfW: number, baseY: number, springY: number, apexY: number): THREE.Path {
  const p = new THREE.Path()
  p.moveTo(cx - halfW, baseY)
  p.lineTo(cx - halfW, springY)
  // ellipse so the head can be taller or flatter than a true semicircle
  p.absellipse(cx, springY, halfW, Math.max(1e-4, apexY - springY), Math.PI, 0, true, 0)
  p.lineTo(cx + halfW, baseY)
  p.closePath()
  return p
}

/** The arch as a solid contour rather than a hole — for the jamb ring's inner face. */
export function archShape(cx: number, halfW: number, baseY: number, springY: number, apexY: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(cx - halfW, baseY)
  s.lineTo(cx - halfW, springY)
  s.absellipse(cx, springY, halfW, Math.max(1e-4, apexY - springY), Math.PI, 0, true, 0)
  s.lineTo(cx + halfW, baseY)
  s.closePath()
  return s
}

type Pt = readonly [number, number]

/** A closed polygon. The workhorse: roofs, gables, horses, barrels. */
export function poly(points: readonly Pt[]): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1])
  s.closePath()
  return s
}

/** A filled circle — moons, wheels, pots, heads. */
export function disc(cx: number, cy: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  s.absarc(cx, cy, r, 0, Math.PI * 2, false)
  return s
}

export function discHole(cx: number, cy: number, r: number): THREE.Path {
  const p = new THREE.Path()
  p.absarc(cx, cy, r, 0, Math.PI * 2, true)
  return p
}

/** A ring: the bow of a key, a cartwheel. */
export function annulus(cx: number, cy: number, rOuter: number, rInner: number): THREE.Shape {
  const s = disc(cx, cy, rOuter)
  s.holes.push(discHole(cx, cy, rInner))
  return s
}

/**
 * A crescent as ONE contour: the left limb of circle A, closed by the left limb
 * of a slightly smaller circle B pushed right into it. Written out rather than
 * faked with an overlapping dark disc because the moon is a DIE-CUT — the glow
 * behind it has to show through a real hole.
 */
export function crescentHole(cx: number, cy: number, r: number): THREE.Path {
  const d = 0.28 * r
  const rB = 0.86 * r
  const a = 0.92 // where the two circles cross, measured on A
  const b = 1.183 // ...and on B
  const p = new THREE.Path()
  p.absarc(cx, cy, r, a, Math.PI * 2 - a, false)
  p.absarc(cx + d, cy, rB, -b, b, true)
  p.closePath()
  return p
}

/**
 * A key, as the 3-4 non-overlapping contours one piece needs: bow, shaft, bit.
 * Non-overlapping matters — two coplanar extrusions of the same tone z-fight,
 * so every composite in this file is built to TOUCH and never to lap.
 */
export function keyShapes(cx: number, yTop: number, len: number, bowR: number): THREE.Shape[] {
  const w = bowR * 0.54
  const cy = yTop - bowR
  const shaftTop = cy - bowR
  const yB = yTop - len
  const tw = bowR * 0.95
  const th = bowR * 0.44
  return [
    annulus(cx, cy, bowR, bowR * 0.46),
    rect(cx - w / 2, yB, cx + w / 2, shaftTop),
    rect(cx + w / 2, yB, cx + w / 2 + tw, yB + th),
    rect(cx + w / 2, yB + th * 1.8, cx + w / 2 + tw * 0.62, yB + th * 2.8),
  ]
}

/** The same key as a die-cut. The bow goes solid: a hole cannot carry an island,
 *  and a keyhole-shaped patch of light reads as a key either way. */
export function keyHoles(cx: number, yTop: number, len: number, bowR: number): THREE.Path[] {
  const w = bowR * 0.54
  const cy = yTop - bowR
  const yB = yTop - len
  const tw = bowR * 0.95
  const th = bowR * 0.44
  return [
    discHole(cx, cy, bowR),
    rectHole(cx - w / 2, yB, cx + w / 2, cy),
    rectHole(cx + w / 2, yB, cx + w / 2 + tw, yB + th),
    rectHole(cx + w / 2, yB + th * 1.8, cx + w / 2 + tw * 0.62, yB + th * 2.8),
  ]
}

/**
 * An arch whose outer edge steps in and out per voussoir, with a taller
 * keystone at the crown. A smooth ring reads as a printed outline at the
 * reading camera; a serrated one throws a row of little side-wall highlights,
 * which is the only thing that says "cut stone" from two feet away.
 */
export function voussoirArch(
  cx: number,
  halfW: number,
  baseY: number,
  springY: number,
  apexY: number,
  bump: number,
  n: number
): THREE.Shape {
  const pts: Pt[] = []
  const rise = apexY - springY
  const at = (t: number, r: number): Pt => [
    cx + r * Math.cos(t),
    springY + ((rise * r) / halfW) * Math.sin(t),
  ]
  const jSteps = 3
  const jy = (i: number): number => baseY + ((springY - baseY) * i) / jSteps
  for (let i = 0; i < jSteps; i++) {
    const r = halfW + (i % 2 === 0 ? bump : 0)
    pts.push([cx - r, jy(i)], [cx - r, jy(i + 1)])
  }
  const key = (n - 1) / 2
  for (let i = 0; i < n; i++) {
    const r = halfW + (i === key ? bump * 2.1 : i % 2 === 1 ? bump : 0)
    pts.push(at(Math.PI * (1 - i / n), r), at(Math.PI * (1 - (i + 1) / n), r))
  }
  for (let i = jSteps - 1; i >= 0; i--) {
    const r = halfW + (i % 2 === 0 ? bump : 0)
    pts.push([cx + r, jy(i + 1)], [cx + r, jy(i)])
  }
  return poly(pts)
}

// ---------------------------------------------------------------------------
// THE STAGE — pinned in NOTES.md, validated by the rake probe.
// ---------------------------------------------------------------------------

export const STAGE = {
  deck: { x0: -1.04, x1: 1.04, zFront: 0.32, zBack: -0.72, frontY: 0.22, rake: 0.38, slab: 0.05 },
  /** Trap door in the deck floor: the inn's kitchen, glowing from below. */
  well: { x0: -0.96, x1: -0.42, z0: 0.02, z1: 0.32, depth: 0.17 },
  arch: { cx: -0.29, halfW: 0.36, springY: 0.22, apexY: 0.8 },
  /** The low right wing that lets the deeper planes spill over the facade. */
  wing: { x0: 0.22, x1: 0.8, top: 0.46 },
  planes: {
    proscenium: { z: 0.24, halfW: 0.74, height: 1.02 },
    jamb: { z: 0.12, halfW: 0.46, height: 0.74 },
    yard: { z: -0.08, halfW: 0.62, height: 0.56 },
    gallery: { z: -0.3, halfW: 0.78, height: 0.54 },
    backwall: { z: -0.52, halfW: 0.9, height: 0.5 },
    sky: { z: -0.68, halfW: 1.06, height: 0.52 },
  },
} as const

/** Deck top surface height at a given world z. The rake, in one place. */
export function deckY(z: number): number {
  const { zFront, frontY, rake } = STAGE.deck
  return frontY + (zFront - z) * rake
}

// ---------------------------------------------------------------------------
// the pieces
// ---------------------------------------------------------------------------

/**
 * DEPTH SEPARATION IS A THICKNESS PROBLEM. Every piece on a plane is extruded
 * about the SAME station, so two pieces that overlap in x/y and share a
 * thickness present coplanar faces and z-fight. The rule used throughout: a
 * piece that should sit IN FRONT of another gets a larger thickness (timber
 * over plaster, cauldron over fire), a piece that should sit BEHIND gets a
 * smaller one (every glass pane is thinner than the wall it glows through).
 * That is also why glass reads as glazing set back in its reveal.
 */
const ARCH = STAGE.arch

/** Window openings in the inn's front, and the panes that glow behind them. */
const FACADE_WINDOWS: readonly (readonly [number, number, number, number])[] = [
  [0.32, 0.1, 0.46, 0.26], // wing, left bay
  [0.56, 0.1, 0.7, 0.26], // wing, right bay
  [0.09, 0.48, 0.21, 0.64], // pier right of the arch
  // Upper storey, flanking the crown. Both sit OUTSIDE the timber arch band's
  // outer sweep at their own height — the band is 0.40 half-width at the
  // springing and swallows anything cut lower on the left.
  [-0.72, 0.66, -0.6, 0.8],
  [-0.02, 0.64, 0.12, 0.8],
  [0.001, 0.916, 0.139, 0.984], // the dormer
]

/** A slanted timber, as a parallelogram of the given width. */
function brace(x0: number, y0: number, x1: number, y1: number, w: number): THREE.Shape {
  return poly([
    [x0, y0],
    [x0 + w, y0],
    [x1 + w, y1],
    [x1, y1],
  ])
}

/** PLANE 0 — the inn's street front: plaster body, timber frame over it, an
 *  irregular slate roofline with chimney and dormer, and the key sign. */
function prosceniumPieces(): CutPiece[] {
  const plaster = poly([
    [-0.74, 0],
    [0.8, 0],
    [0.8, 0.42],
    [0.24, 0.42],
    [0.24, 0.92],
    [-0.74, 0.92],
  ])
  plaster.holes.push(archHole(ARCH.cx, ARCH.halfW, 0, ARCH.springY, ARCH.apexY))
  for (const [x0, y0, x1, y1] of FACADE_WINDOWS.slice(0, -1)) {
    plaster.holes.push(rectHole(x0, y0, x1, y1))
  }

  // The frame. One tone, many contours, none of them lapping: an arched
  // surround, corner posts, the bressumer over the arch, and the wing's
  // studs, rails and braces.
  const archBand = archShape(ARCH.cx, 0.4, 0, ARCH.springY, 0.838)
  archBand.holes.push(archHole(ARCH.cx, ARCH.halfW, 0, ARCH.springY, ARCH.apexY))
  const timber: THREE.Shape[] = [
    archBand,
    rect(-0.74, 0, -0.706, 0.838),
    rect(0.206, 0, 0.24, 0.838),
    rect(-0.74, 0.842, 0.24, 0.874),
    rect(-0.74, 0.44, -0.63, 0.472),
    rect(0.05, 0.44, 0.24, 0.472),
    rect(0.24, 0, 0.8, 0.035), // wing sill
    rect(0.24, 0.385, 0.8, 0.42), // wing wall plate
    rect(0.24, 0.035, 0.272, 0.385), // wing studs
    rect(0.5, 0.035, 0.532, 0.385),
    rect(0.768, 0.035, 0.8, 0.385),
    rect(0.272, 0.28, 0.5, 0.312), // wing mid rails
    rect(0.532, 0.28, 0.768, 0.312),
    brace(0.28, 0.312, 0.464, 0.385, 0.026), // and the braces above them
    brace(0.762, 0.312, 0.578, 0.385, -0.026),
  ]

  const roof = poly([
    [-0.82, 0.878],
    [-0.34, 0.878],
    [-0.34, 0.9],
    [0.06, 0.9],
    [0.06, 0.882],
    [0.3, 0.882],
    [0.3, 0.915],
    [-0.18, 1.0],
    [-0.62, 1.0],
    [-0.82, 0.945],
  ])

  const chimney: THREE.Shape[] = [
    rect(-0.72, 0.876, -0.6, 0.985),
    rect(-0.75, 0.985, -0.57, 1.02),
  ]

  const dormer = poly([
    [-0.02, 0.9],
    [0.16, 0.9],
    [0.16, 0.99],
    [0.07, 1.025],
    [-0.02, 0.99],
  ])
  dormer.holes.push(rectHole(0.005, 0.916, 0.135, 0.984))

  const glass = FACADE_WINDOWS.map(([x0, y0, x1, y1]) =>
    rect(x0 - 0.004, y0 - 0.004, x1 + 0.004, y1 + 0.004)
  )

  // The sign: a wrought bracket reaching out over the arch mouth with a key
  // hung off it, so the inn's name is a SILHOUETTE against the lit tunnel
  // rather than lettering nobody can read at this camera.
  const sign: THREE.Shape[] = [
    rect(-0.11, 0.712, 0.075, 0.738),
    rect(-0.102, 0.676, -0.082, 0.712),
    ...keyShapes(-0.092, 0.676, 0.19, 0.04),
  ]

  return [
    { id: 'proscenium-plaster', shapes: [plaster], thickness: 0.012, tone: 'plaster' },
    { id: 'proscenium-timber', shapes: timber, thickness: 0.018, tone: 'timber' },
    { id: 'proscenium-roof', shapes: [roof], thickness: 0.015, tone: 'slate' },
    { id: 'proscenium-chimney', shapes: chimney, thickness: 0.02, tone: 'stone' },
    { id: 'proscenium-dormer', shapes: [dormer], thickness: 0.02, tone: 'slate' },
    { id: 'proscenium-glass', shapes: glass, thickness: 0.008, tone: 'glass' },
    { id: 'proscenium-keysign', shapes: sign, thickness: 0.02, tone: 'brass' },
  ]
}

/** A bracket, hanger and tapered lantern hung off the arch reveal. */
function lantern(cx: number, yTop: number, dir: number): { body: THREE.Shape[]; pane: THREE.Shape } {
  const y = yTop
  const arm = dir > 0 ? rect(cx - 0.008, y, cx + 0.098, y + 0.02) : rect(cx - 0.098, y, cx + 0.008, y + 0.02)
  const bodyTop = y - 0.055
  const box = poly([
    [cx - 0.046, bodyTop - 0.09],
    [cx + 0.046, bodyTop - 0.09],
    [cx + 0.034, bodyTop],
    [cx - 0.034, bodyTop],
  ])
  box.holes.push(rectHole(cx - 0.032, bodyTop - 0.075, cx + 0.032, bodyTop - 0.012))
  return {
    body: [arm, rect(cx - 0.011, bodyTop, cx + 0.011, y), box, rect(cx - 0.056, bodyTop, cx + 0.056, bodyTop + 0.018)],
    pane: rect(cx - 0.036, bodyTop - 0.079, cx + 0.036, bodyTop - 0.008),
  }
}

/** PLANE 1 — the measured aperture's stone reveal, plus two hanging lanterns
 *  that put warm metal INSIDE the arch where the money light can catch it. */
function jambPieces(): CutPiece[] {
  const ring = voussoirArch(ARCH.cx, 0.395, 0, ARCH.springY, 0.78, 0.045, 9)
  ring.holes.push(archHole(ARCH.cx, 0.285, 0, ARCH.springY, 0.66))
  const l = lantern(-0.489, 0.635, -1)
  const r = lantern(-0.091, 0.5, 1)
  return [
    { id: 'jamb-voussoirs', shapes: [ring], thickness: 0.016, tone: 'stone' },
    { id: 'jamb-lanterns', shapes: [...l.body, ...r.body], thickness: 0.02, tone: 'brass' },
    { id: 'jamb-lantern-glass', shapes: [l.pane, r.pane], thickness: 0.009, tone: 'hearth' },
  ]
}

/**
 * One wrought leaf, authored about the arch's centre line so the pair meets on
 * it exactly. `side` -1 is the left leaf. Bars are 0.020 with 0.033 air between
 * them: wide enough to survive the reading camera, open enough that the
 * destination's glow comes THROUGH a shut gate — which is the whole reason the
 * reader wants to pull it apart.
 */
function gateLeaf(side: number): THREE.Shape {
  const at = (u: number): number => ARCH.cx + side * u // u runs 0 (meeting stile) -> 0.18 (hinge)
  const spike = (u: number, h: number): Pt[] => [
    [at(u + 0.0125), 0.27],
    [at(u), 0.27 + h],
    [at(u - 0.0125), 0.27],
  ]
  const leaf = poly([
    [at(0), 0],
    [at(0.18), 0],
    [at(0.18), 0.262],
    ...spike(0.1525, 0.022),
    ...spike(0.0975, 0.032),
    ...spike(0.0425, 0.04),
    [at(0), 0.27],
  ])
  for (const [y0, y1] of [
    [0.028, 0.152],
    [0.18, 0.244],
  ] as const) {
    for (const u of [0.022, 0.076, 0.13]) {
      const a = at(u)
      const b = at(u + 0.032)
      leaf.holes.push(rectHole(Math.min(a, b), y0, Math.max(a, b), y1))
    }
  }
  return leaf
}

/** PLANE 2 — the courtyard mouth: two gate leaves the reader parts, the piers
 *  they hang from, an outside stair, and clutter at its foot. */
function yardPieces(): CutPiece[] {
  const piers: THREE.Shape[] = [
    rect(-0.62, 0, -0.47, 0.34),
    rect(-0.64, 0.34, -0.45, 0.37),
    rect(-0.11, 0, 0.06, 0.34),
    rect(-0.13, 0.34, 0.08, 0.37),
    disc(-0.545, 0.398, 0.028),
    disc(-0.025, 0.398, 0.028),
    rect(0.06, 0, 0.62, 0.17), // the yard wall running off behind the wing
  ]
  // A doorway at the head of the stair, so the steps go somewhere.
  piers[0].holes.push(rectHole(-0.57, 0.166, -0.49, 0.3))

  const stair = poly([
    [-0.6, 0],
    [-0.47, 0],
    [-0.47, 0.166],
    [-0.502, 0.166],
    [-0.502, 0.16],
    [-0.534, 0.16],
    [-0.534, 0.12],
    [-0.566, 0.12],
    [-0.566, 0.08],
    [-0.598, 0.08],
    [-0.598, 0.04],
    [-0.6, 0.04],
  ])

  const barrel = (cx: number, w: number, h: number): THREE.Shape =>
    poly([
      [cx - w * 0.38, 0],
      [cx + w * 0.38, 0],
      [cx + w * 0.5, h * 0.45],
      [cx + w * 0.38, h],
      [cx - w * 0.38, h],
      [cx - w * 0.5, h * 0.45],
    ])
  const clutter: THREE.Shape[] = [
    barrel(-0.03, 0.1, 0.125),
    rect(0.05, 0, 0.13, 0.075),
    rect(0.145, 0, 0.2, 0.055),
  ]

  return [
    { id: 'yard-piers', shapes: piers, thickness: 0.012, tone: 'timber' },
    { id: 'yard-lit-door', shapes: [rect(-0.566, 0.17, -0.494, 0.304)], thickness: 0.008, tone: 'hearth' },
    { id: 'yard-stair', shapes: [stair], thickness: 0.016, tone: 'timber' },
    { id: 'yard-gate-l', shapes: [gateLeaf(-1)], thickness: 0.014, tone: 'iron', slideKey: 'gate-l' },
    { id: 'yard-gate-r', shapes: [gateLeaf(1)], thickness: 0.014, tone: 'iron', slideKey: 'gate-r' },
    { id: 'yard-clutter', shapes: clutter, thickness: 0.018, tone: 'silhouette' },
  ]
}

/** PLANE 3 — the inn's inner gallery. The chapter is called The Inn of a
 *  Hundred Keys, and this is where it earns the name: a rack of keys hung in
 *  the corridor arch, backlit by the destination, plus key-shaped die-cuts in
 *  the spandrels that read as little glowing keys. */
function galleryPieces(): CutPiece[] {
  // THE APERTURE IS THE DESTINATION. The warm key light stands 0.18 in front of
  // the backwall, which means the backwall is not a lit surface at this camera
  // — it is a blown sheet of light. So the doorway the reader sees at the end
  // of the tunnel is CUT HERE, one plane nearer, and the backwall is what
  // shines through it. A wide arcade opening would only read as a white blob.
  const wall = rect(-0.78, 0, 0.2, 0.46)
  wall.holes.push(archHole(-0.29, 0.115, 0, 0.22, 0.42))
  for (const [x, yTop] of [
    [-0.49, 0.36],
    [-0.57, 0.3],
    [-0.13, 0.34],
    [-0.05, 0.28],
  ] as const) {
    wall.holes.push(...keyHoles(x, yTop, 0.13, 0.028))
  }

  // The rack overhangs the doorway on both sides: the middle keys go black
  // against the light, the outer two stay brass against the dark wall. One
  // motif, two readings, which is what stops a row of keys looking like a comb.
  const keys: THREE.Shape[] = [rect(-0.46, 0.365, -0.12, 0.388)]
  for (const [x, len] of [
    [-0.44, 0.1],
    [-0.365, 0.135],
    [-0.29, 0.115],
    [-0.215, 0.13],
    [-0.14, 0.105],
  ] as const) {
    keys.push(rect(x - 0.006, 0.351, x + 0.006, 0.365))
    keys.push(...keyShapes(x, 0.351, len, 0.026))
  }

  const roof: THREE.Shape[] = [
    poly([
      [0.16, 0],
      [0.82, 0],
      [0.82, 0.115],
      [0.52, 0.115],
      [0.52, 0.155],
      [0.16, 0.155],
    ]),
    rect(0.3, 0.155, 0.36, 0.215),
    rect(0.63, 0.115, 0.69, 0.165),
  ]

  // THE DOOR, STANDING AJAR — and the reason it is cut on THIS plane. The haze
  // ramp lerps every rank-4 albedo 52% toward the blue haze, so a backwall pane
  // cannot be dark no matter what tone it carries; multiplied by the key
  // light's ~280 irradiance it renders blue-white whatever we ask for. The
  // gallery's FRONT faces are turned away from that light, so they are the
  // deepest surfaces in the diorama that can still hold a colour. The leaf
  // glows warm here; the slit beside it shows the backwall's white-hot core,
  // which is exactly the value the eye wants at the far end of a tunnel.
  const glow = archShape(-0.29, 0.13, 0, 0.22, 0.437)
  glow.holes.push(rectHole(-0.352, 0, -0.302, 0.352))

  return [
    { id: 'gallery-arcade', shapes: [wall], thickness: 0.012, tone: 'silhouette' },
    { id: 'gallery-doorglow', shapes: [glow], thickness: 0.016, tone: 'hearth' },
    { id: 'gallery-keys', shapes: keys, thickness: 0.018, tone: 'brass' },
    { id: 'gallery-roof', shapes: roof, thickness: 0.014, tone: 'slate' },
  ]
}

/** PLANE 4 — where the eye lands. The warm key light stands just in front of
 *  this plate, so the doorway is not merely emissive: it is genuinely the
 *  brightest thing in the box, and the two figures in it give the glow a scale. */
function backwallPieces(): CutPiece[] {
  const wall = poly([
    [-0.9, 0],
    [0.9, 0],
    [0.9, 0.13],
    [0.6, 0.13],
    [0.6, 0.17],
    [0.18, 0.17],
    [0.18, 0.4],
    [-0.26, 0.4],
    [-0.26, 0.45],
    [-0.9, 0.45],
  ])
  wall.holes.push(archHole(-0.29, 0.132, 0, 0.115, 0.245))
  const lit: readonly (readonly [number, number, number, number])[] = [
    [0.27, 0.05, 0.35, 0.13],
    [0.45, 0.05, 0.53, 0.13],
    [0.63, 0.04, 0.71, 0.1],
    [0.78, 0.04, 0.86, 0.1],
    [-0.62, 0.2, -0.5, 0.33],
    [0.02, 0.2, 0.14, 0.33],
  ]
  for (const [x0, y0, x1, y1] of lit) wall.holes.push(rectHole(x0, y0, x1, y1))

  const doorGlass = archShape(-0.29, 0.14, -0.006, 0.115, 0.253)
  const glass = [doorGlass, ...lit.map(([x0, y0, x1, y1]) => rect(x0 - 0.005, y0 - 0.005, x1 + 0.005, y1 + 0.005))]

  const figure = (cx: number, h: number): THREE.Shape[] => [
    poly([
      [cx - 0.026, 0],
      [cx + 0.026, 0],
      [cx + 0.018, h * 0.62],
      [cx - 0.018, h * 0.62],
    ]),
    disc(cx, h * 0.62 + h * 0.13, h * 0.14),
  ]

  return [
    { id: 'backwall-wall', shapes: [wall], thickness: 0.012, tone: 'slate' },
    { id: 'backwall-glass', shapes: glass, thickness: 0.008, tone: 'hearth' },
    { id: 'backwall-figures', shapes: [...figure(-0.34, 0.115), ...figure(-0.245, 0.1)], thickness: 0.018, tone: 'silhouette' },
  ]
}

/** PLANE 5 — night. A dark plate with a real crescent die-cut, not an emissive
 *  rectangle: the moon has to be a HOLE for the sky to read as paper. */
function skyPieces(): CutPiece[] {
  const MOON: Pt = [0.605, 0.287]
  const R = 0.1
  const body = rect(-1.06, 0, 1.06, 0.52)
  body.holes.push(crescentHole(MOON[0], MOON[1], R))

  const stars: THREE.Shape[] = (
    [
      [0.28, 0.44, 0.011],
      [0.4, 0.19, 0.009],
      [0.47, 0.36, 0.012],
      [0.55, 0.47, 0.009],
      [0.72, 0.13, 0.01],
      [0.79, 0.42, 0.012],
      [0.86, 0.24, 0.009],
      [0.94, 0.46, 0.011],
      [0.99, 0.16, 0.009],
      [1.02, 0.35, 0.01],
      [0.34, 0.28, 0.009],
    ] as const
  ).map(([x, y, r]) => disc(x, y, r))

  return [
    { id: 'sky-night', shapes: [body], thickness: 0.012, tone: 'night' },
    { id: 'sky-moon', shapes: [disc(MOON[0], MOON[1], R * 1.05)], thickness: 0.008, tone: 'moon' },
    { id: 'sky-stars', shapes: stars, thickness: 0.018, tone: 'moon' },
  ]
}

/** The cut vocabulary, one plane at a time. */
export function tunnelPieces(plane: PlaneKey): readonly CutPiece[] {
  switch (plane) {
    case 'proscenium':
      return prosceniumPieces()
    case 'jamb':
      return jambPieces()
    case 'yard':
      return yardPieces()
    case 'gallery':
      return galleryPieces()
    case 'backwall':
      return backwallPieces()
    case 'sky':
      return skyPieces()
  }
}

/** The deck outline in plan view (x = world x, y = world z), trap cut out. */
export function deckPlan(): THREE.Shape {
  const d = STAGE.deck
  const s = rect(d.x0, d.zBack, d.x1, d.zFront)
  const w = STAGE.well
  s.holes.push(rectHole(w.x0, w.z0, w.x1, w.z1))
  return s
}

/**
 * What lives down the trap: the inn's kitchen. A hearth cut through the pit's
 * far wall with the fire glowing behind it, a cauldron black against that fire,
 * a cook, and a rack of pots. The kitchen point light sits under the trap, so
 * these silhouettes are lit from below and read as shapes, never as detail.
 */
export function wellPieces(): readonly CutPiece[] {
  const w = STAGE.well
  const farwall = rect(w.x0, 0, w.x1, w.depth)
  farwall.holes.push(archHole(-0.8, 0.1, 0, 0.05, 0.115))

  const cook: THREE.Shape[] = [
    poly([
      [-0.664, 0],
      [-0.556, 0],
      [-0.581, 0.064],
      [-0.639, 0.064],
    ]),
    rect(-0.643, 0.064, -0.577, 0.1),
    disc(-0.61, 0.122, 0.024), // head
    rect(-0.638, 0.138, -0.582, 0.152), // and the cap that makes it a cook
    rect(-0.577, 0.078, -0.545, 0.092), // arm out toward the pot rack
  ]

  const pots: THREE.Shape[] = [rect(-0.542, 0.124, -0.428, 0.137)]
  for (const x of [-0.522, -0.485, -0.448]) {
    pots.push(rect(x - 0.007, 0.106, x + 0.007, 0.124))
    pots.push(disc(x, 0.089, 0.017))
  }

  return [
    { id: 'well-farwall', shapes: [farwall], thickness: 0.01, tone: 'timber' },
    { id: 'well-fire', shapes: [archShape(-0.8, 0.098, 0, 0.05, 0.112)], thickness: 0.007, tone: 'hearth' },
    { id: 'well-cook', shapes: cook, thickness: 0.016, tone: 'ink' },
    { id: 'well-pots', shapes: pots, thickness: 0.016, tone: 'ink' },
    {
      id: 'well-cauldron',
      shapes: [disc(-0.8, 0.068, 0.032), rect(-0.807, 0.1, -0.793, 0.14)],
      thickness: 0.02,
      tone: 'ink',
    },
  ]
}

/** A cartwheel: rim and a four-spoke hub, both touching, neither lapping. */
function wheel(cx: number, cy: number, r: number): THREE.Shape[] {
  const a = r * 0.16
  const s = r * 0.58
  return [
    annulus(cx, cy, r, r * 0.55),
    poly([
      [cx - s, cy - a],
      [cx - a, cy - a],
      [cx - a, cy - s],
      [cx + a, cy - s],
      [cx + a, cy - a],
      [cx + s, cy - a],
      [cx + s, cy + a],
      [cx + a, cy + a],
      [cx + a, cy + s],
      [cx - a, cy + s],
      [cx - a, cy + a],
      [cx - s, cy + a],
    ]),
  ]
}

/**
 * The coach, coming up the tunnel on the reader's pull: one horse in profile,
 * a body on two wheels with a lit window cut through it, and a driver on the
 * box. Authored about its own origin at ground level, x centred, so the layer
 * can drop it anywhere on the rake and scale it as it approaches.
 */
export function coachPiece(): CutPiece {
  const horse = poly([
    [-0.158, 0.144],
    [-0.15, 0.166],
    [-0.136, 0.18],
    [-0.112, 0.152],
    [-0.09, 0.118],
    [-0.056, 0.122],
    [-0.034, 0.114],
    [-0.026, 0.132],
    [-0.016, 0.086],
    [-0.03, 0.098],
    [-0.034, 0],
    [-0.05, 0],
    [-0.048, 0.064],
    [-0.078, 0.068],
    [-0.08, 0],
    [-0.096, 0],
    [-0.098, 0.072],
    [-0.114, 0.1],
    [-0.128, 0.12],
    [-0.148, 0.13],
  ])

  // The body must stand TALLER than its own wheels are wide, or the silhouette
  // reads as a horizontal bar on two discs instead of as a carriage.
  const body = poly([
    [-0.012, 0.08],
    [0.15, 0.08],
    [0.15, 0.174],
    [0.126, 0.19],
    [0.012, 0.19],
    [-0.012, 0.174],
  ])
  body.holes.push(rectHole(0.034, 0.104, 0.114, 0.166))

  return {
    id: 'coach',
    shapes: [
      horse,
      body,
      ...wheel(0.112, 0.04, 0.04),
      ...wheel(0.024, 0.032, 0.032),
      rect(0.016, 0.064, 0.032, 0.08),
      poly([
        [0.004, 0.19],
        [0.04, 0.19],
        [0.036, 0.202],
        [0.008, 0.202],
      ]),
      disc(0.022, 0.219, 0.018),
    ],
    thickness: 0.014,
    tone: 'silhouette',
  }
}
