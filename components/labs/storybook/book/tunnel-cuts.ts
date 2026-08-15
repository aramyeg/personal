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
 * PLACEHOLDER BODIES. These are deliberately crude — flat plates with the arch
 * cut — so the engine has something real to extrude and light while the cut
 * vocabulary is authored properly. Replacing these bodies must not change any
 * signature above.
 */
export function tunnelPieces(plane: PlaneKey): readonly CutPiece[] {
  const p = STAGE.planes[plane]
  const body = rect(-p.halfW, 0, p.halfW, p.height)
  if (plane === 'proscenium') {
    body.holes.push(archHole(STAGE.arch.cx, STAGE.arch.halfW, 0, STAGE.arch.springY, STAGE.arch.apexY))
    return [{ id: 'proscenium-facade', shapes: [body], thickness: 0.02, tone: 'timber' }]
  }
  if (plane === 'jamb') {
    const ring = rect(-p.halfW, 0, p.halfW, p.height)
    ring.holes.push(archHole(STAGE.arch.cx, STAGE.arch.halfW - 0.05, 0, STAGE.arch.springY, STAGE.arch.apexY - 0.05))
    return [{ id: 'jamb-ring', shapes: [ring], thickness: 0.016, tone: 'stone' }]
  }
  const tone: CutTone = plane === 'sky' ? 'glass' : plane === 'backwall' ? 'stone' : 'timber'
  return [{ id: `${plane}-plate`, shapes: [body], thickness: 0.012, tone }]
}

/** The deck outline in plan view (x = world x, y = world z), trap cut out. */
export function deckPlan(): THREE.Shape {
  const d = STAGE.deck
  const s = rect(d.x0, d.zBack, d.x1, d.zFront)
  const w = STAGE.well
  s.holes.push(rectHole(w.x0, w.z0, w.x1, w.z1))
  return s
}

/** What lives down the trap: the far wall of the pit and its kitchen silhouettes. */
export function wellPieces(): readonly CutPiece[] {
  const w = STAGE.well
  return [{ id: 'well-farwall', shapes: [rect(w.x0, 0, w.x1, w.depth)], thickness: 0.012, tone: 'stone' }]
}

/** The coach that travels up the tunnel on the reader's pull. Authored about
 *  its own origin at ground level, x centred. */
export function coachPiece(): CutPiece {
  return { id: 'coach', shapes: [rect(-0.16, 0, 0.16, 0.2)], thickness: 0.014, tone: 'silhouette' }
}
