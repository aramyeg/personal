import * as THREE from 'three'
import { easeOutBack, revealPhase, smoothstep } from '../../journey-timeline'

/**
 * Task 56 — staging math for the CHECKPOINT MASCOTS: a per-biome set-dressing frame with its
 * characters, held in a clear corner of the screen while a chapter's panel is up.
 *
 * The Round-14 version put small heads in the top corners with their bodies BEHIND the comic
 * cards. That was rejected: too small, and covered. This module's whole job is to answer, from
 * measured facts rather than tuning, the question that replaces it —
 *
 *     WHERE IS THE LARGEST PIECE OF CLEAR SKY, and how big a character fits in it?
 *
 * Three keep-outs define "clear", and every one of them is measured, not assumed:
 *
 *  1. THE WORLD. `WORLD_TOP`/`WORLD_BOT` are the planet's real on-screen silhouette — terrain,
 *     trees, spires, the girl — sampled off rendered frames by `bench/task56-silhouette.mjs`
 *     over all six chapters and five viewports. A sphere of radius 2.2 (what the R14 bench used)
 *     understates it by a third; the bake's 1.35·R ceiling budget is the wrong shape. Because
 *     both profile axes are in units of the frustum HALF-HEIGHT, the table is a property of the
 *     world and the camera alone and holds at every viewport.
 *  2. THE COMIC CARDS. `overlayBoxes` reproduces their CSS box exactly (the art card) or
 *     conservatively (the data card, whose height is content-driven), pinned in the tests against
 *     `bench/out-task56-boxes.json` — the real `getBoundingClientRect` of both cards at every
 *     chapter and eleven device frames.
 *  3. THE FRAME EDGES. A composition is anchored to a corner and may crop against its own two
 *     edges; the character's face may not.
 *
 * `peekerAnchor` then does the only honest thing available: it tries both the top and the bottom
 * corner on each side and BISECTS for the largest character that still fits, so a viewport where
 * the world swells to fill the frame gets a smaller mascot rather than an occluded one. Nothing
 * about the placement is hardcoded for one aspect.
 *
 * What is unchanged from R14, deliberately: the whole rig lives at PEEKER_DEPTH in camera space,
 * behind the planet's entire ceiling budget, so "the planet is never covered" remains true by the
 * depth buffer rather than by placement. The keep-outs above are about the MASCOT never being
 * eaten by the world — the failure the depth guarantee cannot prevent.
 */

const TAU = Math.PI * 2
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

// --- depth ------------------------------------------------------------------
//
// Camera-space depth of every mascot fragment. Farther from the camera than the planet's whole
// ceiling budget (camera distance 12.1 + 1.35·R = 15.07), so the depth buffer alone forbids a
// mascot drawing over the world; also far in front of the sky plane (world z = −20).
//
// Raised from R14's 17.5 because these compositions are roughly twice the size: a bigger figure
// swings more of its own depth toward the camera under the rig's yaw and roll, and at 17.5 the
// margin had shrunk to 0.10 world units. Depth costs nothing on screen — every placement below is
// expressed in frustum-relative units, so moving the whole rig back rescales it identically.
export const PEEKER_DEPTH = 18.6

// --- the world's measured silhouette ----------------------------------------

/** Horizontal span of the sampled profile, in frustum half-heights. */
export const WORLD_U0 = -0.88
export const WORLD_U1 = 0.88

/**
 * The world's upper and lower silhouette, in frustum half-heights, sampled at 33 columns across
 * `WORLD_U0..WORLD_U1`. UNION over all six chapters and five viewports — so a single table is
 * safe for every biome, and the canyon's spires protect the delta's flat horizon too.
 *
 * Bins with no world in them are 0 (the world spans u ≈ −0.55…+0.66; it sits slightly right of
 * centre because the camera's pitch and the girl's stance are not symmetric).
 *
 * Re-measure with `node bench/task56-silhouette.mjs` if the terrain, the props or the camera
 * change; `peeker-stage.test.ts` pins the table's shape and the margin that rides on top of it.
 */
export const WORLD_TOP: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0.37, 0.549, 0.636, 0.666, 0.692, 0.722, 0.732, 0.732, 0.714, 0.783, 0.793,
  0.78, 0.714, 0.719, 0.717, 0.702, 0.652, 0.647, 0.642, 0.609, 0.557, 0.346, 0.234, 0, 0, 0, 0,
]
export const WORLD_BOT: readonly number[] = [
  0, 0, 0, 0, 0, 0, -0.414, -0.522, -0.567, -0.614, -0.651, -0.667, -0.674, -0.678, -0.676, -0.554,
  -0.537, -0.582, -0.616, -0.627, -0.627, -0.619, -0.596, -0.587, -0.552, -0.544, -0.506, -0.43,
  -0.346, 0, 0, 0, 0,
]

/**
 * Breathing room kept between a composition and the world, in half-heights. The profile is a
 * union of still frames; this covers the girl's animation, the props' idle motion and the
 * sampling grid's own coarseness.
 */
export const WORLD_MARGIN = 0.045

/**
 * The world's blocked vertical interval across a column of screen, in half-heights. Returns null
 * when the world does not reach that column at all (the corners of a wide frame).
 *
 * Conservative on purpose: it takes the extreme of EVERY sampled bin the column touches, so a
 * column that only clips the edge of a tall bin is treated as if it contained all of it.
 */
export function worldBlocked(u0: number, u1: number): { top: number; bot: number } | null {
  const n = WORLD_TOP.length
  const step = (WORLD_U1 - WORLD_U0) / (n - 1)
  const lo = Math.max(0, Math.floor((Math.min(u0, u1) - WORLD_U0) / step))
  const hi = Math.min(n - 1, Math.ceil((Math.max(u0, u1) - WORLD_U0) / step))
  let top = -Infinity
  let bot = Infinity
  for (let i = lo; i <= hi; i++) {
    if (WORLD_TOP[i] === 0 && WORLD_BOT[i] === 0) continue
    top = Math.max(top, WORLD_TOP[i])
    bot = Math.min(bot, WORLD_BOT[i])
  }
  if (top === -Infinity) return null
  return { top: top + WORLD_MARGIN, bot: bot - WORLD_MARGIN }
}

// --- the comic cards --------------------------------------------------------

export type PxBox = { x0: number; y0: number; x1: number; y1: number }

/** Below this viewport width `chapter-panels.tsx` hides the art card and centres the data card. */
export const CARD_MOBILE_MAX = 900
/** Both cards are vertically centred on this fraction of the viewport height (`top: 34vh`). */
export const CARD_CENTRE_VH = 0.34
/** Below the breakpoint the data card instead HANGS from this fraction (`top: 6vh`, no centring). */
export const CARD_MOBILE_TOP_VH = 0.06

const DEG = Math.PI / 180
const ART_TILT = 3 * DEG
const DATA_TILT = 2 * DEG

/** Axis-aligned bounds of a `w × h` rectangle rotated by `tilt` — what the browser lays out. */
function tiltedBounds(w: number, h: number, tilt: number): { w: number; h: number } {
  const c = Math.abs(Math.cos(tilt))
  const s = Math.abs(Math.sin(tilt))
  return { w: w * c + h * s, h: w * s + h * c }
}

/**
 * The data card's CSS height. Content-driven — the copy, the highlight list and the tech chips
 * all vary by chapter — so this is a conservative UPPER bound fitted to the measured set: 492px
 * at the card's full 340px width, growing as the card narrows and the text wraps harder. The
 * tests assert it covers every real measurement in `bench/out-task56-boxes.json` (11 frames x 6
 * chapters) with margin to spare, and being too tall only ever costs a mascot a little size.
 */
export function dataCardHeight(cardWidth: number): number {
  return 492 + Math.max(0, 340 - cardWidth) * 1.75
}

/**
 * The overlay boxes a mascot must stay clear of, in CSS pixels — derived from the panel CSS, not
 * from a screenshot, so they follow a resize. The art card's box is exact (it reproduces the
 * measured rects to within a pixel); the data card's is conservative in height only.
 */
export function overlayBoxes(viewport: { width: number; height: number }): PxBox[] {
  const { width: W, height: H } = viewport
  const cy = CARD_CENTRE_VH * H
  const out: PxBox[] = []

  if (W > CARD_MOBILE_MAX) {
    const w = Math.min(0.24 * W, 300)
    const b = tiltedBounds(w, w * 1.5, ART_TILT)
    const left = Math.min(0.04 * W, 48) - (b.w - w) / 2
    out.push({ x0: left, y0: cy - b.h / 2, x1: left + b.w, y1: cy + b.h / 2 })
  }

  // Below the breakpoint the panel's mobile rules re-anchor the data card entirely: it centres
  // horizontally and hangs from `top: 6vh` with no vertical centring at all. Modelling it as
  // 34vh-centred there put it ~85px too low at 820x1180 and would have let a mascot sit under a
  // card that is actually still above it.
  const mobile = W <= CARD_MOBILE_MAX
  const dw = mobile ? Math.min(0.84 * W, 340) : Math.min(0.27 * W, 340)
  const db = tiltedBounds(dw, dataCardHeight(dw), DATA_TILT)
  const dx0 = mobile ? (W - db.w) / 2 : W - Math.min(0.04 * W, 48) - dw - (db.w - dw) / 2
  const dy0 = mobile ? CARD_MOBILE_TOP_VH * H - (db.h - dataCardHeight(dw)) / 2 : cy - db.h / 2
  out.push({ x0: dx0, y0: dy0, x1: dx0 + db.w, y1: dy0 + db.h })

  return out
}

/**
 * The labs chrome's fixed-pixel "← GALLERY" pill, measured at 16..115 x 16..44 on every viewport
 * from 390 to 1920 wide. Shared UI this lab does not own; a mascot's face must not land behind it.
 */
export const NAV_PILL: PxBox = { x0: 16, y0: 16, x1: 115, y1: 44 }

// --- placement --------------------------------------------------------------

/**
 * Envelopes, in figure-heights, around a mascot's own origin. All four reaches are SCREEN
 * oriented — `up`/`down` are up and down on screen, `out` is toward the nearer vertical frame
 * edge and `in` toward the middle — because a character stands upright whichever corner its
 * composition is anchored to. Only the DRESSING flips with the anchor (see `DRESS_REACH`).
 *
 * MEASURED, not assumed — `peeker-cast.test.ts` builds the real merged geometry for every kind,
 * reproduces the scene graph, sweeps the poses and pins these tight in both directions. Every
 * clearance decision below rests on them, so a piece that quietly outgrew one would silently
 * make the staging optimistic.
 */
export const MASCOT_BOX = { out: 0.68, in: 0.46, up: 0.87, down: 0.86 } as const

/**
 * The head-and-face sub-box. This is the part that must be wholly ON FRAME: a body may crop
 * against the frame edge — that is the peeking language — but a cropped face is the defect the
 * whole rework exists to remove.
 */
export const FACE_BOX = { out: 0.2, in: 0.46, up: 0.84, down: 0.04 } as const

/** How far the set dressing reaches past the mascot, toward and beyond its anchored edge. */
export const DRESS_REACH = { far: 0.34, out: 0.7, in: 0.76, near: 0.34 } as const

/** Half-depth of the whole composition, for the depth-margin bench. */
export const PEEKER_ABS_Z = 0.42

/**
 * How far past its anchored horizontal edge a composition's dressing crops, in figure-heights.
 * The dressing is what touches the edge; the character never does.
 */
export const PEEKER_CROP = 0.26
/** Clear pixels kept between a character and any card or chrome box. */
export const CARD_PAD = 10

/** Inset of the mascot's centre from the nearer vertical frame edge, in figure-heights. */
export const PEEKER_INSET_X = 0.64

/** Largest mascot, as a fraction of the frustum half-height. */
export const PEEKER_SIZE_FRAC = 0.46
/** Below this the corner cannot hold a character worth showing, and the pair stands down. */
export const PEEKER_MIN_SIZE_FRAC = 0.22
/**
 * ...and when it does, the corner falls back to DRESSING ONLY, down to this much smaller floor.
 *
 * Portrait frames are the case: the world swells to fill the width, leaving roughly a third of the
 * height clear above and below it, which is not enough for a character that would survive Aram's
 * "very low quality, unclear" verdict. Foliage has no such threshold — a small leafy corner still
 * reads as foliage and still carries the biome — and dressing is allowed to pass behind the cards,
 * so it fits where a character cannot. An honest small treatment beats a shrunken smear.
 */
export const DRESS_MIN_SIZE_FRAC = 0.13

/** Parked inward lean (rad) and the extra tilt carried while still off-frame. */
export const PEEKER_LEAN = 0.11
export const PEEKER_LEAN_EXTRA = 0.3
/** Yaw so each figure turns its face toward the middle of the frame. */
export const PEEKER_FACE_IN = 0.34
/** How far past its edge a composition waits before entering, in figure-heights. */
export const PEEKER_HIDE_RISE = 1.3
/** Largest whole-figure sway any cast member asks for (pinned against PEEKER_SPECS). */
export const PEEKER_MAX_SWAY = 0.055

/** How much roomier the top corner must be before a composition abandons the bottom one. */
export const BOTTOM_BIAS = 1.15

/** Which corner a side is anchored to: +1 = the top edge, −1 = the bottom edge. */
export type Vdir = 1 | -1
export type Side = -1 | 1

/** What a corner has room for: a character in its dressing, its dressing alone, or nothing. */
export type PeekerMode = 'pair' | 'dressing' | 'none'

export type PeekerAnchor = {
  /** Whether this side shows anything at all. */
  visible: boolean
  /** Whether the character shows, or only its set dressing (see DRESS_MIN_SIZE_FRAC). */
  mode: PeekerMode
  /** World height of the mascot (figures are authored ~1 unit tall, so this IS the scale). */
  size: number
  /** Mascot centre, in camera-space frustum coordinates. */
  x: number
  y: number
  /** The frame edge the composition hangs from. */
  vdir: Vdir
  /** Height the composition waits at while off-frame. */
  hiddenY: number
}

/** Frustum half-height at the mascot depth for a vertical fov in degrees. */
export function peekerHalfHeight(fovDeg: number): number {
  return PEEKER_DEPTH * Math.tan((fovDeg * Math.PI) / 360)
}

/** A pixel box in viewport space → a rect in camera-space frustum coordinates. */
export function boxToFrustum(
  box: PxBox,
  viewport: { width: number; height: number },
  halfW: number,
  halfH: number
): { x0: number; y0: number; x1: number; y1: number } {
  return {
    x0: ((2 * box.x0) / viewport.width - 1) * halfW,
    x1: ((2 * box.x1) / viewport.width - 1) * halfW,
    y0: (1 - (2 * box.y1) / viewport.height) * halfH,
    y1: (1 - (2 * box.y0) / viewport.height) * halfH,
  }
}

type ScreenBox = { out: number; in: number; up: number; down: number }

/**
 * Where a mascot's origin lands for a candidate size, side and anchored edge.
 *
 * The DRESSING is what crops against the anchored horizontal edge; the character is pushed clear
 * of that edge by the dressing's own reach, which is what makes it read as a creature sitting IN
 * the foliage rather than as a head sliding in from off-screen.
 */
function mascotCentre(size: number, side: Side, vdir: Vdir, halfW: number, halfH: number) {
  const cx = side * (halfW - PEEKER_INSET_X * size)
  const edge = vdir * (halfH + PEEKER_CROP * size)
  const cy = edge - vdir * (DRESS_REACH.far + (vdir === 1 ? MASCOT_BOX.up : MASCOT_BOX.down)) * size
  return { cx, cy }
}

/** A screen-oriented envelope, placed and scaled, as a world-space rect. */
function rectFor(size: number, side: Side, cx: number, cy: number, box: ScreenBox) {
  const xa = cx + side * box.out * size
  const xb = cx - side * box.in * size
  return {
    x0: Math.min(xa, xb),
    x1: Math.max(xa, xb),
    y0: cy - box.down * size,
    y1: cy + box.up * size,
  }
}

/** The whole composition — mascot plus the dressing, which hangs toward the anchored edge. */
function compositionBox(vdir: Vdir): ScreenBox {
  return {
    out: DRESS_REACH.out,
    in: DRESS_REACH.in,
    up: vdir === 1 ? MASCOT_BOX.up + DRESS_REACH.far : MASCOT_BOX.up + DRESS_REACH.near,
    down: vdir === 1 ? MASCOT_BOX.down + DRESS_REACH.near : MASCOT_BOX.down + DRESS_REACH.far,
  }
}

/** Does a candidate composition sit in clear sky? */
function fits(
  size: number,
  side: Side,
  vdir: Vdir,
  halfW: number,
  halfH: number,
  viewport: { width: number; height: number },
  cards: PxBox[],
  mode: 'pair' | 'dressing'
): boolean {
  const { cx, cy } = mascotCentre(size, side, vdir, halfW, halfH)
  const whole = rectFor(size, side, cx, cy, compositionBox(vdir))

  // 1. the world's measured silhouette — no part of the composition may be eaten by the planet.
  //    This one binds in BOTH modes: foliage sliced off by the planet's limb reads as broken.
  const blocked = worldBlocked(whole.x0 / halfH, whole.x1 / halfH)
  if (blocked && whole.y0 / halfH < blocked.top && whole.y1 / halfH > blocked.bot) return false

  // Dressing alone answers to nothing else: it is allowed to pass behind the cards and to crop
  // against any frame edge, which is exactly why it still fits where a character cannot.
  if (mode === 'dressing') return true

  const mascot = rectFor(size, side, cx, cy, MASCOT_BOX)
  const face = rectFor(size, side, cx, cy, FACE_BOX)

  // 2. the comic cards and the navigation pill — the CHARACTER stays clear of both, face and body
  //    alike. This is the rework's headline requirement.
  for (const px of [...cards, NAV_PILL]) {
    const p = CARD_PAD
    const r = boxToFrustum({ x0: px.x0 - p, y0: px.y0 - p, x1: px.x1 + p, y1: px.y1 + p }, viewport, halfW, halfH)
    if (mascot.x0 < r.x1 && mascot.x1 > r.x0 && mascot.y0 < r.y1 && mascot.y1 > r.y0) return false
  }

  // 3. the frame — the whole FACE stays on screen; the body may crop against its own edges
  if (face.x0 < -halfW || face.x1 > halfW) return false
  if (face.y0 < -halfH || face.y1 > halfH) return false

  return true
}

/**
 * The staging decision for one side: which corner, how big, and whether a character fits at all.
 *
 * Tries the top and the bottom corner, bisecting each for the largest composition that clears the
 * world, the cards and the frame, and keeps the roomier one. A viewport whose world swells to fill
 * the frame therefore yields a smaller mascot — never an occluded one — and when even the floor
 * will not fit, the corner falls back to dressing alone rather than to a shrunken smear.
 */
export function peekerAnchor(
  halfH: number,
  halfW: number,
  viewport: { width: number; height: number },
  side: Side
): PeekerAnchor {
  const cards = overlayBoxes(viewport)
  const cap = PEEKER_SIZE_FRAC * halfH

  const search = (mode: 'pair' | 'dressing', floor: number) => {
    let best: { size: number; vdir: Vdir } = { size: 0, vdir: -1 }
    // The bottom corner is tried first and defended by BOTTOM_BIAS, so a marginally roomier top
    // corner cannot flip one side of a pair while the other stays low — which reads as a mistake
    // rather than as a composition. The art is authored hanging from the bottom edge too.
    for (const vdir of [-1, 1] as const) {
      if (!fits(floor, side, vdir, halfW, halfH, viewport, cards, mode)) continue
      let lo = floor
      let hi = cap
      if (fits(cap, side, vdir, halfW, halfH, viewport, cards, mode)) lo = cap
      else
        for (let i = 0; i < 22; i++) {
          const mid = (lo + hi) / 2
          if (fits(mid, side, vdir, halfW, halfH, viewport, cards, mode)) lo = mid
          else hi = mid
        }
      if (lo > best.size * (vdir === 1 ? BOTTOM_BIAS : 1)) best = { size: lo, vdir }
    }
    return best
  }

  let mode: PeekerMode = 'pair'
  let best = search('pair', PEEKER_MIN_SIZE_FRAC * halfH)
  if (best.size <= 0) {
    mode = 'dressing'
    best = search('dressing', DRESS_MIN_SIZE_FRAC * halfH)
  }
  if (best.size <= 0) {
    return {
      visible: false,
      mode: 'none',
      size: PEEKER_MIN_SIZE_FRAC * halfH,
      x: side * halfW,
      y: 0,
      vdir: -1,
      hiddenY: 0,
    }
  }

  const { cx, cy } = mascotCentre(best.size, side, best.vdir, halfW, halfH)
  return {
    visible: true,
    mode,
    size: best.size,
    x: cx,
    y: cy,
    vdir: best.vdir,
    hiddenY: best.vdir * (halfH + PEEKER_HIDE_RISE * best.size),
  }
}

// --- arrival clock ----------------------------------------------------------
//
// Task 54 publishes `JourneyState.reveal` — the one wall-clock signal in the journey, sanctioned
// so a checkpoint plays its entrance with the visitor's hands off the wheel. Mascots consume it
// for the ROLL-OUT only. The idle gestures stay on the scroll-scrubbed panel dwell, so what a
// character does while you read is still a pure function of scroll position.

/** Reveal-clock window the set dressing occupies — it leads, per T54's contract. */
export const DRESS_PHASE: readonly [number, number] = [0.3, 0.85]
/** Reveal-clock window the characters occupy — they follow the dressing in. */
export const FIGURE_PHASE: readonly [number, number] = [0.45, 1]
/** The right-hand side trails its partner by this much of the reveal clock — a beat, not a mirror. */
export const PEEK_SIDE_STAGGER = 0.08

/**
 * The reveal fraction driving this chapter's mascots, or null when they should not be on frame.
 *
 * Prefers T54's arrival clock. Falls back to the panel's scroll dwell — mapped through the R14
 * entrance/exit windows — so the mascots still animate if no driver supplies a clock (a bare
 * `journeyStateAt` call, or any consumer that predates the arrival work).
 */
export function peekerClock(
  state: {
    panel: { chapter: number; t: number } | null
    reveal?: { chapter: number; t: number } | null
  },
  chapter: number
): number | null {
  const reveal = state.reveal
  if (reveal) return reveal.chapter === chapter ? reveal.t : null
  const panel = state.panel
  if (!panel || panel.chapter !== chapter) return null
  const rise = clamp01((panel.t - 0.06) / 0.3)
  const fall = clamp01((panel.t - 0.84) / 0.16)
  return rise * (1 - fall)
}

/**
 * Presence 0 → 1 for one element of the composition: 0 while parked off-frame, 1 (with an
 * easeOutBack overshoot past the parked pose) once in. Used directly as the hidden→parked lerp,
 * so the overshoot IS the settle. Reduced motion swaps the springy ramp for a plain smoothstep.
 */
export function peekerPresence(
  clock: number,
  phase: readonly [number, number],
  reduced = false,
  stagger = 0
): number {
  const t = revealPhase(clock, phase[0] + stagger, phase[1])
  return reduced ? smoothstep(t) : easeOutBack(t)
}

/** Peak of easeOutBack — how far past the parked pose a composition overshoots on the way in. */
export const PEEKER_PRESENCE_PEAK = 1.1

/** Signed −1…1 idle oscillation over the panel dwell — the one gesture each character owns. */
export function peekerIdle(t: number, cycles: number, phase: number): number {
  return Math.sin(TAU * (t * cycles + phase))
}

// --- pangolin roll ----------------------------------------------------------
/** Reveal window over which a pangolin unfurls from its ball, just after it parks. */
export const PEEK_UNROLL_START = 0.72
export const PEEK_UNROLL_SPAN = 0.28
/** Turns the ball spins away while rolling in. */
export const PEEK_ROLL_TURNS = 1.6

export function peekerUnroll(clock: number): number {
  return smoothstep(clamp01((clock - PEEK_UNROLL_START) / PEEK_UNROLL_SPAN))
}

/** Ball spin (rad) that unwinds to exactly 0 as the figure reaches its parked pose. */
export function peekerRollSpin(presence: number): number {
  return (1 - clamp01(presence)) * PEEK_ROLL_TURNS * TAU
}

// --- clearance benches ------------------------------------------------------

const _euler = new THREE.Euler()
const _mat = new THREE.Matrix4()
const _vec = new THREE.Vector3()

/** Poses swept by the benches: the settle window, where a composition sits deepest in frame. */
const SETTLE_HIDES = [-0.1, -0.05, 0, 0.1, 0.2, 0.35]
const SWAYS = [-PEEKER_MAX_SWAY, 0, PEEKER_MAX_SWAY]

/**
 * Nearest camera-space depth any composition fragment reaches, swept over the settle poses —
 * the rig's yaw and roll swing part of a figure's x extent into depth.
 */
export function peekerNearestDepth(anchor: PeekerAnchor, side: Side): number {
  const b = compositionBox(anchor.vdir)
  let nearest = Infinity
  for (const hide of SETTLE_HIDES) {
    for (const sway of SWAYS) {
      const yaw = -side * PEEKER_FACE_IN
      const roll = side * (PEEKER_LEAN + hide * PEEKER_LEAN_EXTRA) + sway
      _euler.set(0, yaw, roll, 'XYZ')
      _mat.makeRotationFromEuler(_euler)
      for (const x of [-b.out, b.in]) {
        for (const y of [-b.down, b.up]) {
          for (const z of [-PEEKER_ABS_Z, PEEKER_ABS_Z]) {
            _vec.set(x, y, z).applyMatrix4(_mat).multiplyScalar(anchor.size)
            // camera-space depth is −z; local +z leans toward the camera and shortens it
            nearest = Math.min(nearest, PEEKER_DEPTH - _vec.z)
          }
        }
      }
    }
  }
  return nearest
}

/**
 * Depth margin (world units) between the nearest mascot fragment and the planet's ceiling — the
 * hard guarantee that a mascot can never draw in front of the world. This, not any screen-space
 * bench, is what makes "the planet is never covered" true.
 */
export function peekerDepthMargin(
  viewport: { width: number; height: number },
  fovDeg: number,
  cameraDistance: number,
  ceiling: number
): number {
  const halfH = peekerHalfHeight(fovDeg)
  const halfW = (halfH * viewport.width) / viewport.height
  let worst = Infinity
  for (const side of [-1, 1] as const) {
    const anchor = peekerAnchor(halfH, halfW, viewport, side)
    if (!anchor.visible) continue
    worst = Math.min(worst, peekerNearestDepth(anchor, side))
  }
  return worst === Infinity ? Infinity : worst - (cameraDistance + ceiling)
}

/**
 * Separation (in frustum half-heights) between a side's whole composition and the world's
 * measured silhouette, at its parked pose. Positive means clear sky; this is the aesthetic gate
 * that the depth guarantee cannot express.
 *
 * Note the sign convention: it measures the gap on the side the composition actually sits — above
 * the world for a top anchor, below it for a bottom one.
 */
export function peekerWorldClearance(
  viewport: { width: number; height: number },
  fovDeg: number,
  side: Side
): number {
  const halfH = peekerHalfHeight(fovDeg)
  const halfW = (halfH * viewport.width) / viewport.height
  const anchor = peekerAnchor(halfH, halfW, viewport, side)
  if (!anchor.visible) return Infinity
  const rect = rectFor(anchor.size, side, anchor.x, anchor.y, compositionBox(anchor.vdir))
  const blocked = worldBlocked(rect.x0 / halfH, rect.x1 / halfH)
  if (!blocked) return Infinity
  return anchor.vdir === 1 ? rect.y0 / halfH - blocked.top : blocked.bot - rect.y1 / halfH
}

/**
 * Smallest gap (CSS px) between a side's MASCOT box and any overlay card, at its parked pose.
 * Positive means the character is fully clear of both cards — the rework's headline requirement.
 */
export function peekerCardClearance(
  viewport: { width: number; height: number },
  fovDeg: number,
  side: Side,
  cards: PxBox[] = overlayBoxes(viewport)
): number {
  const halfH = peekerHalfHeight(fovDeg)
  const halfW = (halfH * viewport.width) / viewport.height
  const anchor = peekerAnchor(halfH, halfW, viewport, side)
  if (!anchor.visible) return Infinity
  const m = rectFor(anchor.size, side, anchor.x, anchor.y, MASCOT_BOX)
  // back to pixels
  const px = {
    x0: ((m.x0 / halfW + 1) / 2) * viewport.width,
    x1: ((m.x1 / halfW + 1) / 2) * viewport.width,
    y0: ((1 - m.y1 / halfH) / 2) * viewport.height,
    y1: ((1 - m.y0 / halfH) / 2) * viewport.height,
  }
  let worst = Infinity
  for (const c of cards) {
    // gap along each axis; a positive value on EITHER axis means the boxes miss each other
    const gx = Math.max(c.x0 - px.x1, px.x0 - c.x1)
    const gy = Math.max(c.y0 - px.y1, px.y0 - c.y1)
    worst = Math.min(worst, Math.max(gx, gy))
  }
  return worst
}

// --- the cast ---------------------------------------------------------------

export type PeekerKind =
  | 'bluebird'
  | 'robin'
  | 'macaw'
  | 'cockatoo'
  | 'crocGape'
  | 'crocPeek'
  | 'camelAdult'
  | 'camelCalf'
  | 'pangolinBig'
  | 'pangolinSmall'
  | 'yetiBig'
  | 'yetiSmall'

export type PeekerBiome = 'spring' | 'jungle' | 'delta' | 'desert' | 'canyon' | 'winter'

export type PeekerPair = {
  biome: PeekerBiome
  left: PeekerKind
  right: PeekerKind
}

/**
 * Journey-order cast. Chapter → wedge is fixed by the scene mounts: 0 = A0 spring, 1 = A1 jungle,
 * 2 = A2 delta, 3 = B0 desert, 4 = B1 canyon, 5 = B2 winter.
 *
 * The two sides are always DIFFERENT characters from the same family, and each pair sits inside
 * its biome's own set dressing (see `peekerDressing`).
 */
export const PEEKER_CAST: readonly PeekerPair[] = [
  { biome: 'spring', left: 'bluebird', right: 'robin' },
  { biome: 'jungle', left: 'macaw', right: 'cockatoo' },
  { biome: 'delta', left: 'crocGape', right: 'crocPeek' },
  { biome: 'desert', left: 'camelAdult', right: 'camelCalf' },
  { biome: 'canyon', left: 'pangolinBig', right: 'pangolinSmall' },
  { biome: 'winter', left: 'yetiBig', right: 'yetiSmall' },
]

export function peekerCastFor(chapter: number): PeekerPair | null {
  return PEEKER_CAST[chapter] ?? null
}
