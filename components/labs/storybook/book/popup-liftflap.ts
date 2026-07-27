/**
 * LIFT-THE-FLAP — Birmingham mech 94/95 "the lifted flap" + the reader-direct
 * variant. The book's first numbered DOOR-FLAPS the reader lifts to find keys:
 * the whole conceit of Chapter I, "The Inn of a Hundred Keys" (spread 2), and
 * its playable (charter gate G4). Proven numerically in
 * .superpowers/sdd/bench/derive-liftflap.mjs (E2.2 Batch B, gates L1-L9).
 *
 * PAGE-ROOTED like the knob tower / volvelle (popup-knobtower.ts /
 * popup-volvelle.ts: side + page coordinates, riding the page's own moving
 * frame P(d, lift, z) — d along the page gutter->fore, lift the page normal
 * into the wedge, z along the spine). A KEY-BOARD plaque riveted coplanar into
 * the RIGHT page (BOARD_LIFT proud) carries a row of numbered door leaves; each
 * leaf is HINGED along its SPINE-WARD edge (d = hingeD), the hinge axis running
 * along the spine. At rest (shut) a leaf lies coplanar one paper thickness above
 * the board (FLAP_LIFT), covering its painted recess (a hanging brass key, or —
 * behind one door — the innkeeper's cat, the non-key surprise). The reader grabs
 * the fore (near) edge and lifts it through a capped arc a in [0, LIFT_MAX]; the
 * leaf swings UP and toward the spine (away from the reader), uncovering the
 * recess toward the camera — a door opening onto its key. The doors share the
 * hinge line in DISJOINT z-bands, so their standing leaves are parallel walls
 * that never meet (no neighbour interpenetration by construction).
 *
 * PERSISTENCE + FOLD-FLAT (the winch/knobtower master law — the codebase
 * convention for a held user state at book close). Each flap HOLDS its own
 * reader angle a_user (H4 — the book remembers which doors are open through page
 * turns), but the SHOWN lift is a_shown = a_user * E(beta), the shared
 * page-openness envelope (knobTowerTierLift / tabPieceLift / rotorSpin). E(0) = 0
 * flattens every leaf EXACTLY at book close for ANY held a_user, so the open
 * state cannot survive the close — the page drives the doors shut. Stateless: a
 * pure function of a_user and beta, no autonomous animation.
 */

import type { LiftFlapGeom, PanelQuad, Vec3 } from './popup-mechanics'
import { ROTOR_LIFT } from './popup-rotor'

export type { LiftFlapGeom }

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_LIFT_MAX_DEG = 95
const DEFAULT_OPEN_DEG = 70
const DEFAULT_REST_DEG = 176

/** The plaque rides one glue layer proud (the rotor/dress lift); a shut door
 *  leaf rides a second glue layer above it — one paper thickness apart (bench L1). */
export const LIFTFLAP_BOARD_LIFT = ROTOR_LIFT
export const LIFTFLAP_FLAP_LIFT = 2 * ROTOR_LIFT

/** The anti-flip ceiling (radians): past this a leaf would fall backward. */
export const liftFlapMax = (geom: LiftFlapGeom): number => rad(geom.liftMaxDeg ?? DEFAULT_LIFT_MAX_DEG)

/** The angle (radians) past which a door reads OPEN — the reveal threshold; the
 *  key art lives in the aperture fore-half so this lift uncovers it (bench L6). */
export const liftFlapOpenAngle = (geom: LiftFlapGeom): number => rad(geom.regOpenDeg ?? DEFAULT_OPEN_DEG)

/** Coarse-pointer slop for a door leaf, before the per-door z cap below. */
export const LIFTFLAP_TOUCH_SLOP = 1.4

/**
 * Per-door slop factors: TOUCH_SLOP, but never wide enough in z for one leaf's
 * pad to overlap the next leaf's.
 *
 * WHY IT MATTERS (s2 finding 4: "row 1 always falls shut on release while rows
 * 2, 3 and 4 swing up and stay up"). The doors sit on a 0.105 pitch with 0.085
 * leaves — a flat 1.4x pad spans 0.119 and so pokes into both neighbours. r3f
 * calls this ONE handler once per intersected surface, so a press inside an
 * overlap ran onPointerDown twice with two different door indices and the
 * second call overwrote the first's grab record: the reader dragged one leaf
 * and either a different leaf answered or the grab pointed at a door the
 * pointer was never on. Disjoint pads make that ambiguity unrepresentable; the
 * re-entrant guard in onPointerDown makes it unreachable even if some future
 * geometry reintroduces an overlap.
 *
 * A gap g between neighbouring bands allows f <= 1 + g/h, since enlarging a
 * band of height h about its centre grows each side by (f - 1)h/2.
 */
export function doorSlopFactors(doors: LiftFlapGeom['doors']): number[] {
  return doors.map((door, k) => {
    const h = Math.abs(door.z1 - door.z0)
    if (h <= 0) return 1
    let gap = Infinity
    for (let j = 0; j < doors.length; j++) {
      if (j === k) continue
      const other = doors[j]
      const d = Math.max(
        Math.min(door.z0, door.z1) - Math.max(other.z0, other.z1),
        Math.min(other.z0, other.z1) - Math.max(door.z0, door.z1)
      )
      if (d < gap) gap = d
    }
    if (!Number.isFinite(gap)) return LIFTFLAP_TOUCH_SLOP
    return Math.max(1, Math.min(LIFTFLAP_TOUCH_SLOP, 1 + Math.max(0, gap) / h))
  })
}


/** Page-openness envelope E(beta) — the shared fold-flat cam (knobTowerTierLift).
 *  E(0) = 0 exactly, so every leaf flattens at book-closed regardless of a_user. */
export function liftFlapEnvelope(geom: LiftFlapGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

/** A door's shown lift (radians) at held reader angle a_user and dihedral beta:
 *  a_shown = clamp(a_user, 0, LIFT_MAX) * E(beta). */
export function liftFlapShownLift(geom: LiftFlapGeom, aUser: number, beta: number): number {
  return clamp(aUser, 0, liftFlapMax(geom)) * liftFlapEnvelope(geom, beta)
}

/** The page's own moving frame at the current dihedral, packaged for the board
 *  and leaves: u along the page surface (gutter -> fore), n the page normal into
 *  the wedge, and P(d, lift, z) the page point. The whole assembly rides ONE
 *  page (side). Shared by the pose (below) and the grab handler in the layer,
 *  which measures the pointer's angle about a door hinge on u/n. */
export function liftFlapPageFrame(
  geom: LiftFlapGeom,
  thetaL: number,
  thetaR: number
): { u: Vec3; n: Vec3; P: (d: number, lift: number, z: number) => Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, n, P: (d, lift, z) => [d * u[0] + lift * n[0], d * u[1] + lift * n[1], z] }
}

/** Side-aware z winding so identity uvs print upright (knob-tower convention):
 *  the left page flips za/zb to keep FrontSide = outside. */
function zEnds(geom: LiftFlapGeom, z0: number, z1: number): [number, number] {
  return geom.side === 'left' ? [z1, z0] : [z0, z1]
}

/** A quad from two (d, lift) endpoints across a z-band — [bl, br, tr, tl]. */
function panel(
  P: (d: number, lift: number, z: number) => Vec3,
  dA: number,
  hA: number,
  dB: number,
  hB: number,
  za: number,
  zb: number
): PanelQuad {
  return [P(dA, hA, za), P(dA, hA, zb), P(dB, hB, zb), P(dB, hB, za)]
}

/** The static key-board plaque quad, coplanar at BOARD_LIFT. */
export function liftFlapBoardQuad(geom: LiftFlapGeom, thetaL: number, thetaR: number): PanelQuad {
  const { P } = liftFlapPageFrame(geom, thetaL, thetaR)
  const [za, zb] = zEnds(geom, geom.boardZ0, geom.boardZ1)
  return panel(P, geom.boardD0, LIFTFLAP_BOARD_LIFT, geom.boardD1, LIFTFLAP_BOARD_LIFT, za, zb)
}

/** The kth door leaf quad at held reader angle a_user and pages (thetaL, thetaR).
 *  Hinged at (hingeD, FLAP_LIFT); free edge at (hingeD + L cos a, FLAP_LIFT +
 *  L sin a), a = a_shown. Corner order [bl, br, tr, tl] prints the door front
 *  upright (FrontSide toward the reader when shut). */
export function liftFlapDoorQuad(
  geom: LiftFlapGeom,
  doorIndex: number,
  aUser: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const { P } = liftFlapPageFrame(geom, thetaL, thetaR)
  const door = geom.doors[doorIndex]
  const L = geom.leafLen
  const a = liftFlapShownLift(geom, aUser, thetaL - thetaR)
  const freeD = geom.hingeD + L * Math.cos(a)
  const freeH = LIFTFLAP_FLAP_LIFT + L * Math.sin(a)
  const [za, zb] = zEnds(geom, door.z0, door.z1)
  return panel(P, geom.hingeD, LIFTFLAP_FLAP_LIFT, freeD, freeH, za, zb)
}

/**
 * THE HAND'S FOOTPRINT ON A DOOR — the quad the layer actually raycasts (E3 s7
 * round-2, S7R2-3: "the card flap is one-way. Once lifted it never closes").
 *
 * THE DEFECT, measured live (bench/s7r2-drag-live.mjs). With the coffer lid held
 * open at 95 deg, a press anywhere in the piece's hover region returned
 * `hover=ch6-coffer, grab=null` — every direction, every time. The lid was not
 * unhittable in the sense the latch gate measures (its screen floor was doing
 * its job on a 19 px sliver); it had simply SWUNG OFF the pixels the reader is
 * looking at. What fills that region once a lid opens is the BOARD, which lights
 * the whole piece's hover glow and carries no door index at all — so the reader
 * sees the coffer answer their pointer and gets nothing when they press.
 *
 * The fix is the paper one: the surface a hand can put a lid back by is the lid
 * AND the mouth it uncovered. So the hit quad LAGS the leaf — it is the door
 * solved at a fraction of its shown angle, which spans the open aperture and the
 * standing leaf together. A SHUT door is untouched (lag of 0 is 0), so every
 * closed-state hit box, gate and golden is bit-identical; only a door a reader
 * has actually opened grows a way back.
 */
export const LIFTFLAP_HIT_LAG = 0.45

/** The hit-surface quad for door `doorIndex` at held angle `aUser`: the leaf,
 *  dragged back down toward the aperture it opened (see LIFTFLAP_HIT_LAG). */
export function liftFlapGrabQuad(
  geom: LiftFlapGeom,
  doorIndex: number,
  aUser: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  return liftFlapDoorQuad(geom, doorIndex, clamp(aUser, 0, liftFlapMax(geom)) * LIFTFLAP_HIT_LAG, thetaL, thetaR)
}

/** The hinge frame for door `doorIndex`: the hinge centre (mid of the spine-ward
 *  edge), the flat direction `flat` (page-fore u — where the shut leaf lies) and
 *  the swing-up direction `n` (page normal). The reader's angle about the hinge
 *  is atan2(rel.n, rel.flat) — the stripflap H3 idiom. `axis` is the hinge line
 *  direction (the spine). */
export function liftFlapHingeFrame(
  geom: LiftFlapGeom,
  doorIndex: number,
  thetaL: number,
  thetaR: number
): { center: Vec3; flat: Vec3; n: Vec3; axis: Vec3 } {
  const { u, n, P } = liftFlapPageFrame(geom, thetaL, thetaR)
  const door = geom.doors[doorIndex]
  const center = P(geom.hingeD, LIFTFLAP_FLAP_LIFT, (door.z0 + door.z1) / 2)
  return { center, flat: u, n, axis: [0, 0, 1] }
}

export type LiftFlapPose = {
  /** The static key-board plaque (with painted recesses). */
  board: PanelQuad
  /** One quad per door leaf, in door order. */
  doors: PanelQuad[]
}

/**
 * Solves the lift-flap world pose for pages at (thetaL, thetaR) and per-door
 * held reader angles `aUser` (radians; index-aligned with geom.doors, missing/
 * undefined entries default to 0 = shut). The board is static coplanar; each
 * leaf lifts by a_user * E(beta). Both ride the page, so the whole piece folds
 * flat with the page at book close.
 */
export function solveLiftFlapPose(
  geom: LiftFlapGeom,
  aUser: readonly number[],
  thetaL: number,
  thetaR: number
): LiftFlapPose {
  return {
    board: liftFlapBoardQuad(geom, thetaL, thetaR),
    doors: geom.doors.map((_, k) => liftFlapDoorQuad(geom, k, aUser[k] ?? 0, thetaL, thetaR)),
  }
}
