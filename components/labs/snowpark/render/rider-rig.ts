/**
 * Powder Lines rider rig (M4, Task 9): the placeholder rect becomes a figure.
 *
 * A procedural jointed snowboarder posed per frame from `RiderState` alone —
 * no assets, no persistent state, fully deterministic (same state → same
 * pose). Two exports drive the render layer:
 *
 *   - `computePose` / `drawRider` — the kinematic chain (board → legs → hips →
 *     torso → neck → head + two arms) drawn as filled ink volume — a parka
 *     mass, tapered limbs, a board slab — with the fx squash/stretch spring
 *     applied around the board contact point.
 *   - `riderJoints(state)` — the pure joint contract the scarf (and future
 *     needs) consume: the neck anchor and board center in WORLD units. Pure,
 *     no canvas; during a bail it tracks the tumbling torso piece.
 *
 * DRAW SPACE: everything here is in WORLD units. The renderer calls `drawRider`
 * inside the same local camera transform `drawParticleLayer` uses (translate
 * ox/oy · scale zoom · translate -cam), so the figure scales with zoom exactly
 * like the spray and trail. `drawRider` only lays down the board-local
 * transform (translate to the rider, rotate to the board, squash) on top.
 *
 * BAIL: the rig decomposes into five pieces (board, legs, torso, arms, head)
 * that tumble with per-piece linear + angular velocity seeded deterministically
 * from the bail-start time (`time - (BAIL_TIME - bailTimer)`, constant across
 * the whole bail). Pieces stay ink — they scatter, they do not fade.
 */
import { PHYS, type RiderState } from '../rider'
import { slopeAngle } from '../slope'
import { palette } from '../palette'
import type { PhaseColors } from './sky'

const TAU = Math.PI * 2
const DEG2RAD = Math.PI / 180

/**
 * The single tuning surface for the figure (mirrors `PHYS` / `FX` — one place
 * the orchestrator's GATE-D tuning lives). The first block is the brief's
 * binding pose model; the rest are the pose's remaining knobs, named here so
 * every number the figure reads is tuned in exactly one file.
 */
export const RIG = {
  BOARD_LEN: 46,
  LEG: 16,
  TORSO: 20,
  ARM: 14,
  HEAD_R: 5.5,
  /** crouch01 depth: hips drop up to this fraction of leg length */
  CROUCH_MAX: 0.45,
  /** torso lean per radian of slope */
  LEAN_GAIN: 0.5,
  // --- pose knobs (additions, tuned the same way) ---
  /** feet at ±this fraction of board length from center */
  FOOT_SPREAD: 0.3,
  /** feet rest this far above the contact line (½ the pre-slab board thickness) */
  FOOT_REST: 2.5,
  /** hips biased slightly back of board center (world −x) */
  HIP_BACK: -2,
  /** forward knee jut (grows with crouch) and its small downward droop */
  KNEE_BULGE: 6,
  KNEE_DROP: 2,
  /** the brief's 0.3·speed01 lean term */
  LEAN_SPEED: 0.3,
  /** airborne forward curl (rad) — the torso balls toward the board */
  AIR_CURL: 0.85,
  /** airborne knee tuck: baseline + extra while flipping / grabbing */
  AIR_TUCK: 0.35,
  AIR_TUCK_FLIP: 0.35,
  AIR_TUCK_GRAB: 0.2,
  /** shoulders sit this far down the torso from the neck top */
  SHOULDER_DROP: 4,
  /** gap between the neck top and the head disc */
  NECK_GAP: 1.5,
  /** elbow bulge perpendicular to the arm */
  ELBOW_BULGE: 4,
  /** grab: the reaching hand travels to this fraction of the nose/tail foot x, on the deck */
  GRAB_REACH: 0.7,
  /** flat-spin render: the figure squashes to |cos(spin)| in x, never thinner than this */
  SPIN_SQUASH_MIN: 0.25,
  // --- fill dimensions (silhouette volume; draw-only, no pose effect) ---
  /** board slab thickness — a filled rounded slab along the board axis */
  BOARD_THICK: 7,
  /** thin snow-deck highlight line laid along the board top */
  DECK_W: 1,
  /** parka mass: shoulder width tapering to the hips, plus a back drape */
  TORSO_W: 10,
  TORSO_HIP_W: 7,
  TORSO_BACK_CURVE: 2,
  /** collar: the parka rises this far past the neck so the head seams in */
  COLLAR: 1.5,
  /** legs: full width at the hip tapering to the ankle */
  LIMB_W: 4.5,
  LIMB_ANKLE_W: 3,
  /** arms: full width at the shoulder tapering to the wrist */
  ARM_W: 4,
  ARM_WRIST_W: 2.5,
  /** head: a filled disc (a touch larger than HEAD_R) under a beanie cap */
  HEAD_DRAW_R: 6.2,
  BEANIE_R: 7,
  /** half-arc (rad) of the beanie cap segment seated on the crown */
  BEANIE_ARC: 1.25,
  // --- bail tumble ---
  BAIL_GRAV: 500,
  BAIL_POP: 170,
  BAIL_SPREAD: 130,
  BAIL_SPIN: 7,
} as const

type Pt = { x: number; y: number }

/** All joint positions in the board-local frame (origin = contact point at the
 * board center, +x forward/downhill, −y up), before rotation and squash. */
type Pose = {
  boardBack: Pt
  boardFront: Pt
  backFoot: Pt
  frontFoot: Pt
  backKnee: Pt
  frontKnee: Pt
  hip: Pt
  neck: Pt
  shoulder: Pt
  head: Pt
  backElbow: Pt
  backHand: Pt
  frontElbow: Pt
  frontHand: Pt
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** 0..1 along-slope speed — the same normalization the renderer uses. */
function speed01(state: RiderState): number {
  return clamp((state.speed - PHYS.MIN_SPEED) / (PHYS.MAX_SPEED - PHYS.MIN_SPEED), 0, 1)
}

/** Board orientation: on snow/grind the slope tangent; airborne the physics
 * truth `launchAngle + flip` (the flip IS the board pitching over — spins turn
 * the figure in the flat and never touch the board angle). */
export function boardAngle(s: RiderState): number {
  if (s.mode === 'air') return (s.launchAngleDeg + s.flipDeg) * DEG2RAD
  return slopeAngle(s.x)
}

/** Flat-spin foreshortening: the whole figure squashes in x by |cos(spinDeg)|
 * as it turns through profile, floored so it never vanishes edge-on. Only while
 * airborne — a spin only accumulates in the air. Draw-only (see `drawRider`). */
function spinSquashX(s: RiderState): number {
  if (s.mode !== 'air' || s.spinDeg === 0) return 1
  return Math.max(Math.abs(Math.cos(s.spinDeg * DEG2RAD)), RIG.SPIN_SQUASH_MIN)
}

/** Knee/hip compression 0..1. On snow: the held charge while tucking. Airborne:
 * a baseline tuck the flip/grab deepen (the figure balls up through rotations).
 * The landing squash is delivered by the fx scale transform, not re-counted
 * here — that keeps `riderJoints` a pure function of state (see module head). */
function crouch01(state: RiderState): number {
  if (state.mode === 'air' || state.mode === 'bail') {
    return clamp(
      RIG.AIR_TUCK +
        (state.tucking ? RIG.AIR_TUCK_FLIP : 0) +
        (state.grab !== 'none' ? RIG.AIR_TUCK_GRAB : 0),
      0,
      1
    )
  }
  return clamp(state.tucking ? state.charge : 0, 0, 1)
}

/** Forward torso lean (rad). On snow: slope + speed. Airborne: a fixed curl
 * toward the board so the figure reads as tucked through the flip. */
function torsoLean(state: RiderState): number {
  if (state.mode === 'air' || state.mode === 'bail') return RIG.AIR_CURL
  return RIG.LEAN_GAIN * slopeAngle(state.x) + RIG.LEAN_SPEED * speed01(state)
}

/** Elbow for a two-segment arm: the chord midpoint pushed along the downward
 * perpendicular so the joint always droops naturally, whatever the hand pose. */
function elbowOf(shoulder: Pt, hand: Pt, bulge: number): Pt {
  const mx = (shoulder.x + hand.x) / 2
  const my = (shoulder.y + hand.y) / 2
  const dx = hand.x - shoulder.x
  const dy = hand.y - shoulder.y
  const len = Math.hypot(dx, dy) || 1
  let nx = -dy / len
  let ny = dx / len
  if (ny < 0) {
    nx = -nx
    ny = -ny
  }
  return { x: mx + nx * bulge, y: my + ny * bulge }
}

/**
 * Pose the figure from state alone — pure, deterministic, board-local frame.
 * Not called during a bail (pieces tumble instead); see `drawRider`.
 */
export function computePose(state: RiderState): Pose {
  const crouch = crouch01(state)
  const lean = torsoLean(state)
  const s01 = speed01(state)
  const airborne = state.mode === 'air' || state.mode === 'bail'

  const footX = RIG.BOARD_LEN * RIG.FOOT_SPREAD
  const footY = -RIG.FOOT_REST
  const backFoot = { x: -footX, y: footY }
  const frontFoot = { x: footX, y: footY }

  const hipHeight = RIG.LEG * (1 - RIG.CROUCH_MAX * crouch)
  const hip = { x: RIG.HIP_BACK, y: footY - hipHeight }

  const kneeBulge = RIG.KNEE_BULGE * (0.4 + crouch)
  const backKnee = {
    x: (backFoot.x + hip.x) / 2 + kneeBulge,
    y: (backFoot.y + hip.y) / 2 + RIG.KNEE_DROP,
  }
  const frontKnee = {
    x: (frontFoot.x + hip.x) / 2 + kneeBulge,
    y: (frontFoot.y + hip.y) / 2 + RIG.KNEE_DROP,
  }

  // Torso axis: up (−y) tilted forward (+x) by the lean.
  const ux = Math.sin(lean)
  const uy = -Math.cos(lean)
  const neck = { x: hip.x + ux * RIG.TORSO, y: hip.y + uy * RIG.TORSO }
  const shoulder = {
    x: hip.x + ux * (RIG.TORSO - RIG.SHOULDER_DROP),
    y: hip.y + uy * (RIG.TORSO - RIG.SHOULDER_DROP),
  }
  const head = {
    x: neck.x + ux * (RIG.HEAD_R + RIG.NECK_GAP),
    y: neck.y + uy * (RIG.HEAD_R + RIG.NECK_GAP),
  }

  // Arms: the trailing arm reaches to the deck when grabbing — forward to the
  // nose (front foot) or back over the tail (back foot), two distinct poses —
  // else both trail down-and-back, trailing harder with speed.
  const armS01 = airborne ? 0.4 : s01
  const frontHand =
    state.grab === 'nose'
      ? { x: frontFoot.x * RIG.GRAB_REACH, y: footY }
      : state.grab === 'tail'
        ? { x: backFoot.x * RIG.GRAB_REACH, y: footY }
        : { x: shoulder.x + RIG.ARM * (0.35 - 0.45 * armS01), y: shoulder.y + RIG.ARM * 0.55 }
  const backHand = {
    x: shoulder.x - RIG.ARM * (0.45 + 0.4 * armS01),
    y: shoulder.y + RIG.ARM * 0.5,
  }

  return {
    boardBack: { x: -RIG.BOARD_LEN / 2, y: 0 },
    boardFront: { x: RIG.BOARD_LEN / 2, y: 0 },
    backFoot,
    frontFoot,
    backKnee,
    frontKnee,
    hip,
    neck,
    shoulder,
    head,
    backElbow: elbowOf(shoulder, backHand, RIG.ELBOW_BULGE),
    backHand,
    frontElbow: elbowOf(shoulder, frontHand, RIG.ELBOW_BULGE),
    frontHand,
  }
}

// --- world-space joint contract --------------------------------------------

function localToWorld(p: Pt, origin: Pt, angle: number): Pt {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: origin.x + p.x * c - p.y * s, y: origin.y + p.x * s + p.y * c }
}

/**
 * The neck (scarf anchor) and board center in WORLD units. Pure — no canvas,
 * no fx scale (that stays a draw concern). During a bail the neck rides the
 * tumbling torso piece so the scarf stays attached to the body, not the ground.
 */
export function riderJoints(state: RiderState): { neck: Pt; boardCenter: Pt } {
  if (state.mode === 'bail') {
    return {
      neck: bailPiecePos(state, PIECE_TORSO),
      boardCenter: bailPiecePos(state, PIECE_BOARD),
    }
  }
  const pose = computePose(state)
  const origin = { x: state.x, y: state.y }
  const angle = boardAngle(state)
  return { neck: localToWorld(pose.neck, origin, angle), boardCenter: origin }
}

// --- draw -------------------------------------------------------------------

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}

/** Filled disc — a rounded joint, or the head. */
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

/**
 * A tapered filled limb between two joints: a quad with a round cap at each
 * end, so consecutive segments overlap without cracking open at the bend.
 * `wA`/`wB` are full widths (diameters) at the endpoints.
 */
function limb(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, wA: number, wB: number): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const hA = wA / 2
  const hB = wB / 2
  ctx.beginPath()
  ctx.moveTo(a.x + nx * hA, a.y + ny * hA)
  ctx.lineTo(b.x + nx * hB, b.y + ny * hB)
  ctx.lineTo(b.x - nx * hB, b.y - ny * hB)
  ctx.lineTo(a.x - nx * hA, a.y - ny * hA)
  ctx.closePath()
  ctx.fill()
  disc(ctx, a.x, a.y, hA)
  disc(ctx, b.x, b.y, hB)
}

/** Horizontal filled slab (a stadium) from x0..x1 at y=0 — the board. */
function slab(ctx: CanvasRenderingContext2D, x0: number, x1: number, halfThick: number): void {
  ctx.beginPath()
  ctx.moveTo(x0, -halfThick)
  ctx.lineTo(x1, -halfThick)
  ctx.arc(x1, 0, halfThick, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(x0, halfThick)
  ctx.arc(x0, 0, halfThick, Math.PI / 2, (3 * Math.PI) / 2)
  ctx.closePath()
  ctx.fill()
}

/**
 * The parka: a filled quad from wide shoulders down to narrower hips, its back
 * edge drawn with a slight outward drape (an Alto-style poncho mass). `ux`/`uy`
 * is the torso up-vector; the collar rises past the neck so the head seams in.
 */
function parka(ctx: CanvasRenderingContext2D, hip: Pt, neck: Pt, ux: number, uy: number): void {
  const px = -uy // front perpendicular (world +x / downhill at zero lean)
  const py = ux
  const halfTop = RIG.TORSO_W / 2
  const halfBot = RIG.TORSO_HIP_W / 2
  const collarX = neck.x + ux * RIG.COLLAR
  const collarY = neck.y + uy * RIG.COLLAR
  const frontTop = { x: collarX + px * halfTop, y: collarY + py * halfTop }
  const backTop = { x: collarX - px * halfTop, y: collarY - py * halfTop }
  const frontBot = { x: hip.x + px * halfBot, y: hip.y + py * halfBot }
  const backBot = { x: hip.x - px * halfBot, y: hip.y - py * halfBot }
  const backMidX = (backTop.x + backBot.x) / 2 - px * RIG.TORSO_BACK_CURVE
  const backMidY = (backTop.y + backBot.y) / 2 - py * RIG.TORSO_BACK_CURVE
  ctx.beginPath()
  ctx.moveTo(frontTop.x, frontTop.y)
  ctx.lineTo(frontBot.x, frontBot.y)
  ctx.lineTo(backBot.x, backBot.y)
  ctx.quadraticCurveTo(backMidX, backMidY, backTop.x, backTop.y)
  ctx.closePath()
  ctx.fill()
}

/** Head disc plus a beanie cap segment seated on the crown (up = ux,uy). */
function drawHead(ctx: CanvasRenderingContext2D, c: Pt, ux: number, uy: number): void {
  disc(ctx, c.x, c.y, RIG.HEAD_DRAW_R)
  const up = Math.atan2(uy, ux)
  ctx.beginPath()
  ctx.arc(c.x, c.y, RIG.BEANIE_R, up - RIG.BEANIE_ARC, up + RIG.BEANIE_ARC)
  ctx.closePath()
  ctx.fill()
}

/** Lay the posed fills at the board-local origin (caller owns the transform). */
function drawPose(ctx: CanvasRenderingContext2D, pose: Pose, colors: PhaseColors): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.fillStyle = palette.ink

  // Board slab, then a thin snow-colored deck highlight along its top.
  slab(ctx, pose.boardBack.x, pose.boardFront.x, RIG.BOARD_THICK / 2)
  ctx.strokeStyle = colors.snow
  ctx.lineWidth = RIG.DECK_W
  const deckY = -RIG.BOARD_THICK * 0.3
  seg(ctx, pose.boardBack.x * 0.82, deckY, pose.boardFront.x * 0.82, deckY)

  // Legs — tapered ankle → knee → hip (drawn under the parka so the hip seams).
  const kneeW = (RIG.LIMB_W + RIG.LIMB_ANKLE_W) / 2
  limb(ctx, pose.backFoot, pose.backKnee, RIG.LIMB_ANKLE_W, kneeW)
  limb(ctx, pose.backKnee, pose.hip, kneeW, RIG.LIMB_W)
  limb(ctx, pose.frontFoot, pose.frontKnee, RIG.LIMB_ANKLE_W, kneeW)
  limb(ctx, pose.frontKnee, pose.hip, kneeW, RIG.LIMB_W)

  // Torso parka mass — the up-vector is the (hip → neck) axis.
  const tdx = pose.neck.x - pose.hip.x
  const tdy = pose.neck.y - pose.hip.y
  const tlen = Math.hypot(tdx, tdy) || 1
  const tux = tdx / tlen
  const tuy = tdy / tlen
  parka(ctx, pose.hip, pose.neck, tux, tuy)

  // Arms — tapered shoulder → elbow → wrist, over the parka so the shoulder seams.
  const elbowW = (RIG.ARM_W + RIG.ARM_WRIST_W) / 2
  limb(ctx, pose.shoulder, pose.backElbow, RIG.ARM_W, elbowW)
  limb(ctx, pose.backElbow, pose.backHand, elbowW, RIG.ARM_WRIST_W)
  limb(ctx, pose.shoulder, pose.frontElbow, RIG.ARM_W, elbowW)
  limb(ctx, pose.frontElbow, pose.frontHand, elbowW, RIG.ARM_WRIST_W)

  // Head + beanie, seated in the parka collar.
  drawHead(ctx, pose.head, tux, tuy)
}

/**
 * Draw the rider in WORLD units — the caller has already applied the camera
 * transform. On snow/air the posed figure gets the board-local transform plus
 * the fx squash/stretch around the contact point (board stays planted) and,
 * mid-spin, a horizontal foreshorten around that same board-midpoint origin. On
 * a bail the pieces tumble instead.
 *
 * The spin squash is DRAW-ONLY: it lives here, inside the board-local transform,
 * and never touches `riderJoints` — the scarf anchor reads the unsquashed
 * world-space neck (Task 2's principle), so the cloth root stays put while the
 * silhouette turns through profile.
 */
export function drawRider(
  ctx: CanvasRenderingContext2D,
  state: RiderState,
  scale: { sx: number; sy: number },
  colors: PhaseColors
): void {
  if (state.mode === 'bail') {
    drawBail(ctx, state)
    return
  }
  ctx.save()
  ctx.translate(state.x, state.y)
  ctx.rotate(boardAngle(state))
  ctx.scale(scale.sx, scale.sy)
  // Board-local origin is the board midpoint, so this x-only scale foreshortens
  // the figure around its own center, composing with the fx squash above.
  ctx.scale(spinSquashX(state), 1)
  drawPose(ctx, computePose(state), colors)
  ctx.restore()
}

// --- bail tumble ------------------------------------------------------------

type PieceKind = 'board' | 'legs' | 'torso' | 'arms' | 'head'

/** The five pieces and where each sits on the neutral rig (board-local). The
 * torso and board indices are the scarf/joint anchors. */
const PIECES: readonly { kind: PieceKind; anchor: Pt }[] = [
  { kind: 'board', anchor: { x: 0, y: 0 } },
  { kind: 'legs', anchor: { x: 0, y: -RIG.LEG * 0.5 } },
  { kind: 'torso', anchor: { x: 0, y: -(RIG.LEG + RIG.TORSO * 0.5) } },
  { kind: 'arms', anchor: { x: RIG.HIP_BACK, y: -(RIG.LEG + RIG.TORSO * 0.55) } },
  { kind: 'head', anchor: { x: 0, y: -(RIG.LEG + RIG.TORSO + RIG.HEAD_R) } },
] as const
const PIECE_BOARD = 0
const PIECE_TORSO = 2

/** Deterministic 0..1 hash — the shared v1 convention (`fract(sin·43758.5453)`),
 * the only scatter source in the bail. No RNG anywhere in this module. */
function hash(i: number, n: number): number {
  const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
  return v - Math.floor(v)
}

/** Bail-start sim time — constant across the whole bail (the v1-proven seed
 * invariant), so every frame reproduces the same tumble from the same state. */
function bailSeed(state: RiderState): number {
  return state.time - (PHYS.BAIL_TIME - state.bailTimer)
}

type PieceMotion = { vx: number; vy: number; omega: number }

function pieceMotion(i: number, seed: number): PieceMotion {
  const dir = hash(i, seed) * TAU
  const spd = RIG.BAIL_SPREAD * (0.5 + hash(i, seed + 1))
  return {
    vx: Math.cos(dir) * spd,
    vy: -RIG.BAIL_POP * (0.6 + hash(i, seed + 2) * 0.8),
    omega: (hash(i, seed + 3) - 0.5) * 2 * RIG.BAIL_SPIN,
  }
}

/** World position of piece `i` at the current bail time — a closed form of the
 * seed and elapsed time, so it is identical for a given state (pure). */
function bailPiecePos(state: RiderState, i: number): Pt {
  const seed = bailSeed(state)
  const t = PHYS.BAIL_TIME - state.bailTimer
  const m = pieceMotion(i, seed)
  const a = PIECES[i].anchor
  return {
    x: state.x + a.x + m.vx * t,
    y: state.y + a.y + m.vy * t + 0.5 * RIG.BAIL_GRAV * t * t,
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, kind: PieceKind): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.fillStyle = palette.ink
  switch (kind) {
    case 'board':
      slab(ctx, -RIG.BOARD_LEN / 2, RIG.BOARD_LEN / 2, RIG.BOARD_THICK / 2)
      break
    case 'legs': {
      const fx = RIG.BOARD_LEN * RIG.FOOT_SPREAD * 0.4
      const footY = RIG.LEG * 0.5
      const hipY = -RIG.LEG * 0.5
      limb(ctx, { x: -fx, y: footY }, { x: 0, y: hipY }, RIG.LIMB_ANKLE_W, RIG.LIMB_W)
      limb(ctx, { x: fx, y: footY }, { x: 0, y: hipY }, RIG.LIMB_ANKLE_W, RIG.LIMB_W)
      break
    }
    case 'torso':
      limb(ctx, { x: 0, y: RIG.TORSO * 0.5 }, { x: 0, y: -RIG.TORSO * 0.5 }, RIG.TORSO_HIP_W, RIG.TORSO_W)
      break
    case 'arms':
      limb(
        ctx,
        { x: -RIG.ARM * 0.5, y: -RIG.ARM * 0.35 },
        { x: RIG.ARM * 0.5, y: RIG.ARM * 0.35 },
        RIG.ARM_W,
        RIG.ARM_WRIST_W
      )
      limb(
        ctx,
        { x: -RIG.ARM * 0.5, y: RIG.ARM * 0.35 },
        { x: RIG.ARM * 0.5, y: -RIG.ARM * 0.35 },
        RIG.ARM_W,
        RIG.ARM_WRIST_W
      )
      break
    case 'head':
      drawHead(ctx, { x: 0, y: 0 }, 0, -1)
      break
  }
}

/** Scatter the five pieces from the bail point, each spinning on its own seed. */
function drawBail(ctx: CanvasRenderingContext2D, state: RiderState): void {
  const seed = bailSeed(state)
  const t = PHYS.BAIL_TIME - state.bailTimer
  for (let i = 0; i < PIECES.length; i++) {
    const m = pieceMotion(i, seed)
    const pos = bailPiecePos(state, i)
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.rotate(m.omega * t)
    drawPiece(ctx, PIECES[i].kind)
    ctx.restore()
  }
}
