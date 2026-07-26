/**
 * THE THREE POINTER PROJECTIONS every grab handle in the book uses (hand-
 * interaction-laws H3/H4), extracted out of the nine popup-*-layer files so
 * they are (a) written once and (b) testable without a WebGL context or a
 * React tree.
 *
 * WHY THIS FILE EXISTS (E3 fix lane, 2026-07-26): five blind readers found
 * handles that took a grab and then moved NOTHING. The layers each carried
 * their own copy of the same eight lines of ray/plane maths, so nothing could
 * assert — at unit-test speed — that "pointer travelled" implies "paper
 * travelled". With the projections here, `handle-drag-regression.test.ts`
 * drives the real pipeline (ray -> projector -> drive value -> solver ->
 * vertices) for every family and gates VISIBLE displacement.
 *
 * All three take a ray ALREADY in the hit object's local (solver) frame — see
 * user-drive-pointer.ts, which does the world->local transform from the hit
 * object's matrixWorld so the parallax rig's tilt is cancelled generically.
 *
 * No react, no r3f: three.js only.
 */

import * as THREE from 'three'
import type { Vec3 } from './popup-mechanics'

// One shared scratch set: pointer events are strictly one-at-a-time and every
// caller consumes the result before the next event can arrive.
const _u = new THREE.Vector3()
const _plane = new THREE.Plane()
const _hit = new THREE.Vector3()
const _rel = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _n = new THREE.Vector3()
const _center = new THREE.Vector3()

/**
 * CLASS A — the page-plane slide (pull tabs, dissolve strips, keepsake cards,
 * the swarm stir tab). Intersects the ray with the carrying page's plane
 * through the spine at dihedral half-angle `theta`, and returns the hit's
 * distance along the page's fore direction u = (cos t, sin t, 0). That scalar
 * IS the drive domain: a tab's draw is d_now - d_grab.
 */
export function projectPageD(ray: THREE.Ray, theta: number): number | null {
  _u.set(Math.cos(theta), Math.sin(theta), 0)
  _plane.setComponents(Math.sin(theta), -Math.cos(theta), 0, 0)
  if (!ray.intersectPlane(_plane, _hit)) return null
  return _hit.dot(_u)
}

/**
 * CLASS B1 — the angle about a HINGE LINE (lift flaps, strip flaps). The swing
 * plane is the plane through the hinge `center` normal to the hinge `axis`;
 * the returned angle is measured from `flat` (where a shut leaf lies) toward
 * `n` (the direction it swings up).
 */
export function projectHingeAngle(
  ray: THREE.Ray,
  center: Vec3,
  axis: Vec3,
  flat: Vec3,
  n: Vec3
): number | null {
  _center.set(center[0], center[1], center[2])
  _n.set(axis[0], axis[1], axis[2])
  _plane.setFromNormalAndCoplanarPoint(_n, _center)
  if (!ray.intersectPlane(_plane, _hit)) return null
  _rel.copy(_hit).sub(_center)
  _a.set(flat[0], flat[1], flat[2])
  _b.set(n[0], n[1], n[2])
  return Math.atan2(_rel.dot(_b), _rel.dot(_a))
}

/**
 * CLASS B1-C — the angle about a hinge line, read off the CYLINDER the flap's
 * own tip sweeps rather than off its swing plane.
 *
 * WHY IT EXISTS (E3 s2 round-2, S2R2-3). Class B1 intersects the pointer ray
 * with the swing plane. That is exact and well-behaved for a hinge whose axis
 * runs INTO the page (the lift-flap doors: their plane's normal is the spine
 * axis, and the reading camera meets it at ~64deg — a blind reader called that
 * drag "1:1, weighted, clean end-stops"). It collapses for a hinge whose axis
 * runs ACROSS the screen, which is every frontal standing figure in the book:
 * the pinned camera sits on x = 0 and the axis is +-x, so the view direction
 * LIES IN the swing plane. Measured on s2's welcome rank: |ray . planeNormal|
 * = 0.10, so ~20 px of sideways drag swept the whole 46deg window while the
 * opposite direction missed the infinite plane altogether and the handle
 * answered nothing at all. The reader's report — "any leftward drag of >= 50 px
 * produces one tiny change and then saturates; rightward does nothing".
 *
 * The cylinder of radius `radius` about the hinge axis is invariant along that
 * axis, so intersecting it is exactly a 2D ray/circle problem in the flap's own
 * (flat, n) swing basis — drop the axis component of the ray and solve. That is
 * well-conditioned precisely where the plane is not: the circle subtends a real
 * angular width from the camera, so the pointer walks around it at a rate the
 * hand can feel, and motion ALONG the axis (which the reader sees as sideways,
 * where the flap has no freedom) is discarded rather than amplified.
 *
 * A ray that misses the circle is CLAMPED TO THE SILHOUETTE (the classic arcball
 * clamp): the closest approach is pushed out to `radius` and its angle
 * returned, so a reader who drags past the end keeps a live, monotone handle
 * instead of a null. Returns null only if the ray is parallel to the hinge axis,
 * where no angle exists.
 */
export function projectHingeAngleCyl(
  ray: THREE.Ray,
  center: Vec3,
  axis: Vec3,
  flat: Vec3,
  n: Vec3,
  radius: number
): number | null {
  _center.set(center[0], center[1], center[2])
  _a.set(flat[0], flat[1], flat[2])
  _b.set(n[0], n[1], n[2])
  _rel.copy(ray.origin).sub(_center)
  // The ray, reduced to the swing basis (this IS the projection along the axis).
  const px = _rel.dot(_a)
  const py = _rel.dot(_b)
  const qx = ray.direction.dot(_a)
  const qy = ray.direction.dot(_b)
  const qq = qx * qx + qy * qy
  if (qq < 1e-12) return null // looking straight down the hinge: no angle exists
  const r = Math.max(radius, 1e-6)
  const pq = px * qx + py * qy
  const tClosest = -pq / qq
  const disc = pq * pq - qq * (px * px + py * py - r * r)
  let t = tClosest
  if (disc > 0) {
    const root = Math.sqrt(disc) / qq
    const near = tClosest - root
    // The near hit unless it is behind the reader's eye, then the far one.
    t = near > 0 ? near : tClosest + root
  }
  const hx = px + t * qx
  const hy = py + t * qy
  // Silhouette clamp: a miss (or a degenerate hit at the axis) still yields the
  // direction the reader is pointing, carried out to the tip circle.
  const h = Math.hypot(hx, hy)
  if (h < 1e-9) return null
  return Math.atan2(hy, hx)
}

/**
 * CLASS B2 — the angle about a DISC HUB (knob tower, keep winch, volvelle).
 * The seat plane is the disc's own plane (normal `n` through `center`); the
 * angle is measured on the disc's in-plane basis (e1, e2). `r` is the hit's
 * radius from the hub, which the callers use for the unstable-centre deadzone.
 */
export function projectHubAngle(
  ray: THREE.Ray,
  center: Vec3,
  e1: Vec3,
  e2: Vec3,
  n: Vec3
): { angle: number; r: number } | null {
  _center.set(center[0], center[1], center[2])
  _n.set(n[0], n[1], n[2])
  _plane.setFromNormalAndCoplanarPoint(_n, _center)
  if (!ray.intersectPlane(_plane, _hit)) return null
  _rel.copy(_hit).sub(_center)
  _a.set(e1[0], e1[1], e1[2])
  _b.set(e2[0], e2[1], e2[2])
  const along = _rel.dot(_a)
  const spin = _rel.dot(_b)
  return { angle: Math.atan2(spin, along), r: Math.hypot(along, spin) }
}
