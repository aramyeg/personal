/**
 * WILD lane — the page-surface floor.
 *
 * This plane used to BE the curtain-up: the whole mass translated up from -MASS_APEX_Y and the
 * plane hid whatever was still buried, so the inn grew out of the paper. The inn now ERECTS
 * instead (wild/fold-birth.ts) and nothing is ever buried — but the plane stays, doing the job
 * it was always quietly doing as well: it is the hard floor that guarantees no fold, no barge
 * board and no shadow can ever show BENEATH the page it is folding on.
 *
 * The plane is a module singleton on purpose: three compares clipping planes by identity when
 * it builds programs, so every material sharing this one instance shares a shader variant.
 * Set its height once from the diorama's world transform; never allocate a second plane.
 */
import * as THREE from 'three'

/** Keeps the half-space above the page surface (normal.dot(p) + constant > 0). */
export const RISE_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/**
 * THE LEAF PLANE — the second half of the floor, and the one that keeps this spread off the
 * spread the reader is still looking at.
 *
 * A turning book has TWO wedges, and the flying leaf is the wall between them: the outgoing
 * spread's content lives between its static page and the leaf, the incoming spread's between the
 * leaf and ITS static page. They never meet. This lane bypasses the page solver (D1) — the inn
 * stands in the spread's flat local frame instead of being glued to the two page planes — so
 * nothing was enforcing that law, and mid-turn the inn's mass (high-LEFT, by composition) stood
 * exactly where the outgoing title spread still owns the table. Captured at t 0.45-0.55: the hall
 * wall and the jetty joists cutting straight through the title's page print and through its own
 * still-folding pop-ups.
 *
 * So the diorama is clipped to the half-space the leaf has ALREADY SWEPT. For a leaf at thetaL
 * the swept side is sin(thetaL) * x - cos(thetaL) * y >= 0, which is the book's own wedge law
 * written as a plane. It costs nothing at rest: the leaf has landed, the plane IS the left page,
 * and it sits below RISE_CLIP everywhere on the sheet.
 *
 * The bias keeps the plane a hair BELOW the leaf, so a piece lying exactly on the paper (or the
 * cobble half that rides thetaL by construction) is never sliced by its own supporting surface.
 */
const LEAF_BIAS = 0.03

export const LEAF_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), LEAF_BIAS)

/** Both planes, as ONE array whose LENGTH never changes — a clipping-plane count change
 *  re-links every program that uses it, which is the stall this lane already paid for once. */
export const RISE_CLIP_PLANES = [RISE_CLIP, LEAF_CLIP]

/**
 * Point the clip at the real page surface. Called once by the diorama root with the world y of
 * its own group, because <PopupSpread> sits at POPUP_Y and clipping planes are world-space.
 */
export function setRiseClipHeight(worldY: number): void {
  RISE_CLIP.constant = -worldY
}

const leafNormal = new THREE.Vector3()

/**
 * Swing the leaf plane to the live page angle. `worldMatrix` is the diorama root's, because the
 * plane is authored in the spread's own frame (spine at the origin) and clipping planes are
 * world-space — and the desk's parallax rig both lifts AND tilts the book, so a hand-built
 * world plane would drift the moment the reader moved the pointer.
 */
export function setLeafClipAngle(thetaL: number, worldMatrix: THREE.Matrix4): void {
  leafNormal.set(Math.sin(thetaL), -Math.cos(thetaL), 0)
  LEAF_CLIP.set(leafNormal, LEAF_BIAS)
  LEAF_CLIP.applyMatrix4(worldMatrix)
}

/**
 * Opt a material into the reveal. Also enables `clipShadows` so the moon's shadow of the
 * still-buried part of the building does not appear on the cobbles before the building does.
 */
export function applyRiseClip<T extends THREE.Material>(material: T): T {
  material.clippingPlanes = RISE_CLIP_PLANES
  material.clipShadows = true
  return material
}
