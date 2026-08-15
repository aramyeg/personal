/**
 * WILD lane — THE BRASS KEY'S PHYSICS CORE.
 *
 * PURE. No three, no react, no DOM, no imports at all. Points in, turn out. That is the whole
 * reason the file exists: the owner's verdict on the E4 key was *"not reliable … the valve should
 * be turning maybe with clicks … right now the interaction looks very clanky if I am not super
 * careful with the handling"*, and a mechanism that only misbehaves under CARELESS input cannot be
 * fixed by looking at it. It has to be driven by deliberately bad input, thousands of frames at a
 * time, with the answer measured rather than eyeballed. That harness is
 * `scripts/storybook/bench/e5-keyfeel.mjs`, and it can only exist because nothing below needs a
 * GPU, a page, or a pointer.
 *
 * The shell (`the-key.tsx`) keeps everything that needs a scene: ray/plane projection, the grab
 * gate, geometry, materials, feedback rendering. It hands this module hub hits — a pointer
 * position in the escutcheon's own polar coordinates — and reads back a turn.
 *
 * WHAT MAKES IT FEEL LIKE BRASS (five things, in the order the signal travels):
 *
 *  1. TANGENTIAL MAPPING, not the atan2 sweep. The honest quantity is how far the hand dragged
 *     the paper AROUND the hub, over a fixed reference radius — the argument written out at
 *     length in `book/handle-projection.ts` CLASS B2-T (`crankTangentialDelta`), which this repo
 *     already adopted for the keep winch after a blind reader found the same defect there. The
 *     key never got the fix; it accumulated raw `atan2` and therefore had UNBOUNDED GAIN AT THE
 *     CENTRE, so a stroke passing near the escutcheon slammed the turn 0->1 in one frame. That is
 *     defect number one behind "clanky unless I am careful".
 *
 *     `tangentialTurn()` below is the point-space twin of `crankTangentialDelta`; it takes plain
 *     xy instead of a `HubHit` so this file can stay import-free. The two are asserted equal on
 *     random input in `__tests__/labs/storybook/wild/key-crank-parity.test.ts` — the duplication
 *     is deliberate and gated, not accidental.
 *
 *  2. LEVERAGE. A finger on the keyhole turns nothing; a finger on the bow turns everything.
 *     Frictional Games' post-mortem of Penumbra's crank is exactly this: *"interacting at center
 *     zero leverage and made it impossible to turn"*. See `LEVER_R0/R1` for why this is a FADE and
 *     emphatically not the spec's upward clamp of r.
 *
 *  3. A 1€ FILTER on the hit point. The reading camera leans, so the pointer ray grazes the page
 *     and one pixel of hand is centimetres of paving along the shallow axis. Casiez/Roussel/Vogel:
 *     adapt the cutoff to speed — low cutoff kills jitter at rest, high cutoff kills lag when
 *     moving. Filtering the POINT and never the angle, so there is no wrap discontinuity.
 *
 *  4. A ROTOR, not a position. `turn` has mass, viscous friction, a dry-stop term, and is dragged
 *     by a spring to where the hand asks. So it can overshoot, wobble, coast, and be flicked —
 *     and none of that is scripted.
 *
 *  5. DETENTS AS FORCE. A mechanical detent's torque is zero at the seat, zero at the saddle, and
 *     maximum between; SmartKnob adds a flat dead zone so the knob rests dead still in a notch.
 *     The E4 key had this exactly inverted (strongest at dead centre, zero at the lip), which is
 *     why it stuck and then broke free. Clicks fire off a per-detent latch with a hysteresis band,
 *     so jitter on a lip cannot machine-gun them.
 *
 * MUTABILITY NOTE. `KeyPhysicsState` is mutated in place and its event array is reused. This is a
 * per-frame hot path inside a WebGL render loop where the house rule is "no allocations"; the
 * house immutability rule is about shared application state, which this is not. Nothing outside
 * the module may write the fields — use the exported functions.
 */

// ------------------------------------------------------------------------------------------
// THE TUNING TABLE — every number the feel depends on, in one place, with its units.
// ------------------------------------------------------------------------------------------

export const KEY_FEEL = {
  /** Full sweep of the key, radians. `turn` 0..1 spans it. */
  turnRad: (100 * Math.PI) / 180,
  /** Where the notches sit, as fractions of the sweep. */
  detents: [0, 0.34, 0.68, 1] as const,

  // --- mapping -----------------------------------------------------------------------------
  /** Reference radius: shaftLength (0.11) + bowRadius (0.072). A hand circling AT the bow turns
   *  the key 1:1 with its own sweep. */
  refR: 0.182,
  /** LEVERAGE FADE, in multiples of refR. Zero purchase at the keyhole, full purchase out at the
   *  bow, smooth between.
   *
   *  THIS IS A DELIBERATE DIVERGENCE from the feel-spec, which asked for `r` to be CLAMPED UP to
   *  0.4*refR "because below R_MIN the gain would blow up". That is true of the atan2 mapping and
   *  false of the tangential one: tangential gain goes to ZERO at the hub, so clamping r upward
   *  re-manufactures precisely the centre gain this mapping exists to remove — a scribble on the
   *  keyhole would be re-inflated to 40% of its atan2 sweep. A fade is the same intent, applied
   *  the right way round. */
  leverR0: 0.5,
  leverR1: 1.0,
  /** Upper clamp on the hit radius (multiples of refR). A grazing ray far off the plate projects
   *  wildly; past here the extra distance buys no extra authority. */
  rMax: 2.2,
  /** Turn per unit of hand sweep. 1.0 = a full wrist arc at the bow is the whole sweep. */
  gain: 1.0,

  // --- sample hygiene ----------------------------------------------------------------------
  /** Largest turn rate a single sample may integrate, turn/s. Fastest credible human ~2.9. */
  rateCap: 4.0,
  /** A sample implying more than this is projection noise, not a hand: integrate nothing and
   *  RESYNC the reference to it (discarding without resyncing kills the grab forever). */
  teleport: 12.0,
  /** |ray . pageNormal| below this and the intersection is ill-conditioned — handled by the
   *  shell, which then passes `null` and we hold position. Kept here so the number lives with
   *  its siblings. */
  rayMinDot: 0.1,

  // --- 1€ filter ---------------------------------------------------------------------------
  /** Hz. Low enough that a stationary hand is dead still. */
  euroMinCutoff: 1.2,
  /** Hz per (page-unit/second).
   *
   *  The feel-spec quotes 0.06, which is the 1€ paper's figure in SCREEN PIXELS. One page unit is
   *  ~200 px here, so the same behaviour in page units is ~200x that; 12 keeps a 1 unit/s drag at
   *  ~13 Hz cutoff (≈12 ms of lag) instead of 1.26 Hz (≈126 ms, a visible beat behind the hand). */
  euroBeta: 12,
  /** Hz. Cutoff of the derivative's own lowpass. */
  euroDCutoff: 1.0,

  // --- rotor -------------------------------------------------------------------------------
  /** Fixed integration substep, seconds, and the cap on how many run per frame. */
  substep: 1 / 240,
  maxSubsteps: 8,
  /** Hand spring: rad/s and damping ratio. Closed-loop halflife ~37 ms — the key trails the hand
   *  by a hair, never by a beat. */
  handOmega: 22,
  handZeta: 0.85,
  /** Viscous friction, 1/s, in free sweep and at a seat. The seat value is what turns the well
   *  from a bell into one visible bounce (zeta ~ 0.5 => ~16% overshoot). */
  frictionFree: 3.0,
  frictionSeat: 21,
  /** Dry friction, turn/s^2. Guarantees the rotor STOPS rather than creeping forever. */
  coulomb: 0.35,
  /** Release momentum: the hand's mean velocity over this window, blended in at this weight. */
  flickWindow: 0.08,
  flickWeight: 0.85,

  // --- detents -----------------------------------------------------------------------------
  /** Well half-width, in turn. ~29% of the 0.34 spacing, so free sweep survives between notches
   *  and they stay punctuation rather than a quantiser. */
  wTurn: 0.1,
  /** Flat-bottomed dead zone as a fraction of the well (SmartKnob's DEAD_ZONE_DETENT_PERCENT),
   *  so the key rests dead still in a notch instead of buzzing against the ramp.
   *
   *  0.08, not the spec's 0.2. A dead zone is also the width of the band the key may COME TO REST
   *  IN, and the spec's own acceptance is that a release settles inside 0.01 of a notch: 0.2 gives
   *  a 0.02 resting band, so the key legitimately parks twice as far out as the test allows and
   *  T8 fails on physics that are working. 0.08 = 0.008 turn = 0.8 degrees of key, which is
   *  SmartKnob's own DEAD_ZONE_RAD (1 degree) in this mechanism's units. */
  deadzonePct: 0.08,
  /** Peak well acceleration, turn/s^2. A hand pushing firmly delivers ~48, so wells are felt and
   *  escapable. */
  detentA: 14,
  /** SADDLE BIAS, turn/s^2 — a constant, gentle lean toward the nearest notch everywhere OUTSIDE
   *  a well.
   *
   *  DELIBERATE ADDITION, and the one that kills the worst bug in the old key: with wells only
   *  0.10 wide and notches 0.34 apart there is a 0.14-wide band where NO force exists, so a hand
   *  that let go at turn 0.50 left the inn permanently half lit. The feel-spec asserts "the well
   *  physics resolves it, always" and then specifies wells that cannot. At 1/6 of the well peak
   *  this is inaudible under the hand (the hand spring answers a 0.005 lag with more force than
   *  this) and decisive once the hand is gone. Zero exactly at a saddle, which is where an
   *  unstable equilibrium belongs. */
  saddleBias: 2.2,
  /** How far past the lip the saddle bias ramps in, in turn — keeps the force continuous. */
  saddleRamp: 0.02,
  /** Click re-arm distance as a multiple of the well width. 1.6 => a 0.06 turn (6 degree) band of
   *  jitter immunity per notch. */
  rearm: 1.6,
  /** Where `seatedIndex` flips, as a fraction of the gap (SmartKnob's snap_point). */
  snapPoint: 0.62,

  // --- end stops ---------------------------------------------------------------------------
  /** One-sided spring beyond 0 and 1. zeta = 60/(2*sqrt(900)) = 1.0 — critically damped, so the
   *  key thuds into the stop and never bounces off it. */
  endK: 900,
  endC: 60,
  /** Hard rail on how far past a bound the rotor may travel, in turn (~2 degrees of key). */
  endSlop: 0.02,

  // --- feedback (all decays are halflives in seconds) --------------------------------------
  /** Wobble spring, visual only: omega ~22.8, zeta ~0.58 — one visible bounce, then gone. */
  wobbleK: 520,
  wobbleC: 27,
  wobbleKick: 1.25,
  /** Key dip along its lift axis, page units, and its spring-back halflife. */
  dipAmount: 0.006,
  dipHalflife: 0.07,
  /** Emissive pulse added to the brass, and its decay. */
  pulseAmount: 0.55,
  pulseHalflife: 0.09,
  /** Halo pulse: extra scale and extra opacity, and its decay. */
  haloScale: 0.1,
  haloOpacity: 0.18,
  haloHalflife: 0.12,
  /** Camera roll impulse, radians, and its decay. Inside the 0.1-0.3 s juice window. */
  camRoll: 0.0035,
  camHalflife: 0.18,

  // --- grab (consumed by the shell; parked here so the table is complete) -------------------
  /** Page-plane radius within which a press takes the key. */
  grabRPage: 0.34,
  /** Screen-space fallback radius, px, for when the lean makes the page test noisy. */
  grabRPx: 64,
  /** Invisible hit disc radius — strictly larger than the page gate. */
  hitDiscR: 0.46,
} as const

const LN2 = Math.log(2)
const HAND_K = KEY_FEEL.handOmega * KEY_FEEL.handOmega
const HAND_C = 2 * KEY_FEEL.handZeta * KEY_FEEL.handOmega
const DEADZONE = KEY_FEEL.deadzonePct * KEY_FEEL.wTurn
const LEVER_R0 = KEY_FEEL.leverR0 * KEY_FEEL.refR
const LEVER_R1 = KEY_FEEL.leverR1 * KEY_FEEL.refR
const R_MAX = KEY_FEEL.rMax * KEY_FEEL.refR
const FLICK_SLOTS = 24

// ------------------------------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------------------------------

/** A pointer landing on the escutcheon, in the plate's own polar coordinates. Identical shape to
 *  `book/handle-projection.ts`'s `HubHit`, restated so this file imports nothing. */
export type HubPoint = { angle: number; r: number }

/** What a notch emits when the ball drops onto its ramp. */
export type KeyClick = {
  index: number
  turn: number
  dir: 1 | -1
  /** 0.25 .. 1 — how hard it landed. Drives every feedback channel's amplitude. */
  strength: number
}

type EuroChannel = { x: number; dx: number; ready: boolean }

export type KeyPhysicsState = {
  /** The turn the world sees, 0..1 (may sit up to `endSlop` outside while thudding into a stop). */
  turn: number
  /** Rotor velocity, turn/s. */
  vel: number
  /** Where the hand has asked the key to be. */
  target: number
  held: boolean
  /** Which notch we are semantically in, by the snap-point rule. */
  seatedIndex: number

  /** Per-notch click latch. */
  armed: boolean[]
  /** Clicks emitted by the last `keyTick`. Reused array — read it, do not keep it. */
  events: KeyClick[]

  /** Last accepted hit, filtered, in plate-plane xy. */
  px: number
  py: number
  hasPrev: boolean
  /** Last raw hit, for teleport detection. */
  rawX: number
  rawY: number
  euroX: EuroChannel
  euroY: EuroChannel
  lastSampleT: number

  /** Ring of (time, target) for the release flick. */
  flickT: Float64Array
  flickV: Float64Array
  flickAt: number
  flickN: number

  /** Feedback channels, all read by the shell and written only here. */
  wobble: number
  wobbleV: number
  dip: number
  pulse: number
  halo: number
  roll: number

  /** Telemetry. Every one of these is a defect counter the supervisor's real-pointer review reads
   *  straight off `window.__wildKey`. */
  clicks: number
  samplesDiscarded: number
  samplesDegenerate: number
  samplesRateCapped: number
  droppedGrabs: number
  time: number
}

// ------------------------------------------------------------------------------------------
// SMALL PURE HELPERS
// ------------------------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Hermite ramp — the stage's only interpolator, restated locally to keep this file import-free. */
function smoothstep(v: number, edge0: number, edge1: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0 || 1e-6))
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent decay toward zero by halflife. */
function decay(v: number, halflife: number, dt: number): number {
  return v * Math.exp((-LN2 * dt) / halflife)
}

/**
 * HOW FAR A HAND CRANKED THE PLATE, between two points in its plane — the point-space form of
 * `book/handle-projection.ts` CLASS B2-T. Returns radians of plate rotation.
 *
 * Take the tangential component of the displacement at the MIDPOINT radial direction and divide
 * by a FIXED reference radius (never the instantaneous one, which is what reintroduces the 1/r
 * blow-up). A stroke straight through the hub returns ~0 by construction: the two unit radials
 * point opposite ways and their sum collapses.
 */
export function tangentialTurn(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  refR: number,
): number {
  const r = Math.max(refR, 1e-6)
  const n0 = Math.hypot(p0x, p0y)
  const n1 = Math.hypot(p1x, p1y)
  if (n0 < 1e-9 || n1 < 1e-9) return 0
  const mx = p0x / n0 + p1x / n1
  const my = p0y / n0 + p1y / n1
  const m = Math.hypot(mx, my)
  if (m < 1e-6) return 0
  const tx = -my / m
  const ty = mx / m
  return ((p1x - p0x) * tx + (p1y - p0y) * ty) / r
}

/** Index of the notch nearest a turn. */
export function nearestDetentIndex(turn: number): number {
  const d = KEY_FEEL.detents
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < d.length; i++) {
    const dist = Math.abs(d[i] - turn)
    if (dist < bestD) {
      bestD = dist
      best = i
    }
  }
  return best
}

/**
 * The detent cam, in turn/s^2. Zero at the seat (flat dead zone), rising to `detentA` at a
 * quarter width, back to zero at the lip, then a constant gentle lean home across the free band,
 * vanishing at the saddle. The E4 key had the first half of this curve exactly inverted.
 */
function detentAccel(turn: number): number {
  const d = KEY_FEEL.detents
  const i = nearestDetentIndex(turn)
  const gap = turn - d[i]
  const ad = Math.abs(gap)
  if (ad < DEADZONE) return 0

  const w = KEY_FEEL.wTurn
  if (ad < w) return -KEY_FEEL.detentA * Math.sin((Math.PI * gap) / w)

  // Outside the well: how far is the saddle on this side? (No neighbour => the end stop's job.)
  const j = gap > 0 ? i + 1 : i - 1
  if (j < 0 || j >= d.length) return 0
  const half = Math.abs(d[j] - d[i]) * 0.5
  if (ad >= half) return 0
  const lipIn = clamp((ad - w) / KEY_FEEL.saddleRamp, 0, 1)
  const saddleOut = clamp((half - ad) / KEY_FEEL.saddleRamp, 0, 1)
  return -Math.sign(gap) * KEY_FEEL.saddleBias * lipIn * saddleOut
}

// ------------------------------------------------------------------------------------------
// LIFECYCLE
// ------------------------------------------------------------------------------------------

export function createKeyPhysics(): KeyPhysicsState {
  const s: KeyPhysicsState = {
    turn: 0,
    vel: 0,
    target: 0,
    held: false,
    seatedIndex: 0,
    armed: KEY_FEEL.detents.map(() => true),
    events: [],
    px: 0,
    py: 0,
    hasPrev: false,
    rawX: 0,
    rawY: 0,
    euroX: { x: 0, dx: 0, ready: false },
    euroY: { x: 0, dx: 0, ready: false },
    lastSampleT: 0,
    flickT: new Float64Array(FLICK_SLOTS),
    flickV: new Float64Array(FLICK_SLOTS),
    flickAt: 0,
    flickN: 0,
    wobble: 0,
    wobbleV: 0,
    dip: 0,
    pulse: 0,
    halo: 0,
    roll: 0,
    clicks: 0,
    samplesDiscarded: 0,
    samplesDegenerate: 0,
    samplesRateCapped: 0,
    droppedGrabs: 0,
    time: 0,
  }
  keySeed(s, 0)
  return s
}

/**
 * Put the key somewhere, at rest, with no click. Used by `?wildwake=` (the capture harness seeds
 * the KEY, not the wake channel — the key re-stamps wake from its own turn every frame, so
 * seeding anything else is overwritten within a tick).
 */
export function keySeed(s: KeyPhysicsState, turn: number): void {
  const v = clamp01(turn)
  s.turn = v
  s.target = v
  s.vel = 0
  s.seatedIndex = nearestDetentIndex(v)
  // Latch every notch we are ALREADY inside, so seeding never fires a phantom click.
  for (let i = 0; i < KEY_FEEL.detents.length; i++) {
    s.armed[i] = Math.abs(v - KEY_FEEL.detents[i]) >= KEY_FEEL.wTurn * KEY_FEEL.rearm
  }
  s.events.length = 0
  s.wobble = 0
  s.wobbleV = 0
  s.dip = 0
  s.pulse = 0
  s.halo = 0
  s.roll = 0
}

/**
 * The hand takes hold. `hit` may be null (degenerate ray) — the grab still starts; the mapping
 * simply has nothing to measure from until a usable sample arrives. The target is re-seeded to
 * wherever the key actually IS, so taking hold never snaps it.
 */
export function keyGrabBegin(s: KeyPhysicsState, hit: HubPoint | null, time: number): void {
  s.held = true
  s.target = clamp01(s.turn)
  s.hasPrev = false
  s.euroX.ready = false
  s.euroY.ready = false
  s.lastSampleT = time
  s.flickAt = 0
  s.flickN = 0
  pushFlick(s, time, s.target)
  if (hit) keySample(s, hit, time)
}

/** The hand lets go. Whatever the rotor is carrying, plus the hand's own recent speed. */
export function keyGrabEnd(s: KeyPhysicsState, time: number): void {
  if (!s.held) return
  s.held = false
  const hand = handVelocity(s, time)
  s.vel = s.vel * (1 - KEY_FEEL.flickWeight) + hand * KEY_FEEL.flickWeight
  s.hasPrev = false
  s.flickN = 0
}

/**
 * The shell noticing that something OUTSIDE it took the grab away (the book's own window backstop
 * clearing the store). Counted, because "the key went dead in my hand" is exactly the complaint
 * this whole rebuild answers and the number has to be visible in telemetry.
 */
export function keyNoteDroppedGrab(s: KeyPhysicsState, time: number): void {
  if (!s.held) return
  s.droppedGrabs++
  keyGrabEnd(s, time)
}

/** The keyboard clutch: step one notch, the one path that needs no pixel precision at all. */
export function keyStepDetent(s: KeyPhysicsState, dir: 1 | -1): void {
  const d = KEY_FEEL.detents
  const next = clamp(nearestDetentIndex(s.turn) + dir, 0, d.length - 1)
  s.target = d[next]
  s.seatedIndex = next
}

// ------------------------------------------------------------------------------------------
// POINTER
// ------------------------------------------------------------------------------------------

function euroAlpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

function pushFlick(s: KeyPhysicsState, t: number, v: number): void {
  s.flickT[s.flickAt] = t
  s.flickV[s.flickAt] = v
  s.flickAt = (s.flickAt + 1) % FLICK_SLOTS
  if (s.flickN < FLICK_SLOTS) s.flickN++
}

/** Mean hand velocity over the flick window, turn/s. Zero if the hand was not moving. */
function handVelocity(s: KeyPhysicsState, now: number): number {
  if (s.flickN < 2) return 0
  const cutoff = now - KEY_FEEL.flickWindow
  let oldestT = 0
  let oldestV = 0
  let found = false
  // Walk backwards to the first sample at or before the window edge.
  for (let k = 1; k <= s.flickN; k++) {
    const i = (s.flickAt - k + FLICK_SLOTS * 2) % FLICK_SLOTS
    oldestT = s.flickT[i]
    oldestV = s.flickV[i]
    found = true
    if (oldestT <= cutoff) break
  }
  if (!found) return 0
  const newest = (s.flickAt - 1 + FLICK_SLOTS) % FLICK_SLOTS
  const dt = s.flickT[newest] - oldestT
  if (dt < 1e-4) return 0
  return clamp((s.flickV[newest] - oldestV) / dt, -KEY_FEEL.rateCap, KEY_FEEL.rateCap)
}

/**
 * ONE POINTER SAMPLE. `hit` null means the shell could not condition an intersection (the ray has
 * gone nearly parallel to the page): hold everything, integrate nothing, and — this is the whole
 * point — DO NOT DROP THE GRAB.
 *
 * The old key handled a lost intersection by doing nothing at all, which sounds identical and is
 * not: r3f re-injects the CAPTURE-TIME intersection whenever a captured pointer misses the mesh,
 * so the key went dead the moment the hand left the disc and then jumped when it came back. The
 * shell now rays from window clientX/Y and never asks r3f, so `null` here is rare and honest.
 */
export function keySample(s: KeyPhysicsState, hit: HubPoint | null, time: number): void {
  if (!s.held) return
  const dt = clamp(time - s.lastSampleT, 1 / 1000, 1 / 15)
  s.lastSampleT = time

  if (!hit) {
    s.samplesDegenerate++
    return
  }

  const r = Math.min(hit.r, R_MAX)
  const rawX = r * Math.cos(hit.angle)
  const rawY = r * Math.sin(hit.angle)

  // TELEPORT REJECTION, on the raw point, BEFORE the filter — a projection glitch smeared through
  // a lowpass becomes a slow drift the rate cap cannot tell from a real drag. Resync rather than
  // simply discard: discarding without moving the reference leaves every subsequent sample
  // looking like the same teleport, i.e. a permanently dead key.
  if (s.hasPrev) {
    const jump = Math.hypot(rawX - s.rawX, rawY - s.rawY) / (KEY_FEEL.refR * KEY_FEEL.turnRad)
    if (jump / dt > KEY_FEEL.teleport) {
      s.samplesDiscarded++
      s.rawX = rawX
      s.rawY = rawY
      s.euroX.x = rawX
      s.euroY.x = rawY
      s.euroX.dx = 0
      s.euroY.dx = 0
      s.px = rawX
      s.py = rawY
      return
    }
  }
  s.rawX = rawX
  s.rawY = rawY

  // 1€ FILTER on the point. One shared speed magnitude for both channels, so the cutoff is
  // rotation-invariant and a diagonal drag is not filtered differently from an axial one.
  let fx = rawX
  let fy = rawY
  if (!s.euroX.ready) {
    s.euroX.x = rawX
    s.euroY.x = rawY
    s.euroX.dx = 0
    s.euroY.dx = 0
    s.euroX.ready = true
    s.euroY.ready = true
  } else {
    const ad = euroAlpha(KEY_FEEL.euroDCutoff, dt)
    const rawDx = (rawX - s.euroX.x) / dt
    const rawDy = (rawY - s.euroY.x) / dt
    s.euroX.dx += ad * (rawDx - s.euroX.dx)
    s.euroY.dx += ad * (rawDy - s.euroY.dx)
    const speed = Math.hypot(s.euroX.dx, s.euroY.dx)
    const a = euroAlpha(KEY_FEEL.euroMinCutoff + KEY_FEEL.euroBeta * speed, dt)
    s.euroX.x += a * (rawX - s.euroX.x)
    s.euroY.x += a * (rawY - s.euroY.x)
  }
  fx = s.euroX.x
  fy = s.euroY.x

  if (!s.hasPrev) {
    s.px = fx
    s.py = fy
    s.hasPrev = true
    return
  }

  // LEVERAGE. Weighted at the midpoint radius: a stroke that dives through the keyhole gets no
  // purchase there, exactly as a finger on a real keyhole gets none.
  const rMid = 0.5 * (Math.hypot(s.px, s.py) + Math.hypot(fx, fy))
  const lever = smoothstep(rMid, LEVER_R0, LEVER_R1)

  let dTurn =
    (tangentialTurn(s.px, s.py, fx, fy, KEY_FEEL.refR) / KEY_FEEL.turnRad) * KEY_FEEL.gain * lever

  const cap = KEY_FEEL.rateCap * dt
  if (Math.abs(dTurn) > cap) {
    s.samplesRateCapped++
    dTurn = Math.sign(dTurn) * cap
  }

  s.px = fx
  s.py = fy
  s.target = clamp01(s.target + dTurn)
  pushFlick(s, time, s.target)
}

// ------------------------------------------------------------------------------------------
// THE ROTOR
// ------------------------------------------------------------------------------------------

function substep(s: KeyPhysicsState, h: number): void {
  let a = detentAccel(s.turn)
  if (s.held) a += HAND_K * (s.target - s.turn) - HAND_C * s.vel

  // End stops: one-sided, critically damped, so the key thuds and does not bounce.
  if (s.turn < 0) a += -KEY_FEEL.endK * s.turn - KEY_FEEL.endC * s.vel
  else if (s.turn > 1) a += -KEY_FEEL.endK * (s.turn - 1) - KEY_FEEL.endC * s.vel

  const gap = Math.abs(s.turn - KEY_FEEL.detents[nearestDetentIndex(s.turn)])
  const inWell = clamp(1 - gap / KEY_FEEL.wTurn, 0, 1)
  a -= (KEY_FEEL.frictionFree + (KEY_FEEL.frictionSeat - KEY_FEEL.frictionFree) * inWell) * s.vel

  s.vel += a * h

  // Dry stop. Never allowed to reverse the rotor, only to arrest it.
  const dry = KEY_FEEL.coulomb * h
  if (Math.abs(s.vel) <= dry) s.vel = 0
  else s.vel -= Math.sign(s.vel) * dry

  s.turn += s.vel * h

  // Hard rail a hair outside the bounds, so nothing can integrate away into nonsense.
  const lo = -KEY_FEEL.endSlop
  const hi = 1 + KEY_FEEL.endSlop
  if (s.turn < lo) {
    s.turn = lo
    if (s.vel < 0) s.vel = 0
  } else if (s.turn > hi) {
    s.turn = hi
    if (s.vel > 0) s.vel = 0
  }
}

/** Advance `seatedIndex` by SmartKnob's snap-point rule: a notch keeps the reader until they are
 *  62% of the way to the next one, which leaves an 8.2% hysteresis band around each boundary. */
function updateSeated(s: KeyPhysicsState): void {
  const d = KEY_FEEL.detents
  let i = s.seatedIndex
  for (let guard = 0; guard < d.length; guard++) {
    if (i < d.length - 1 && s.turn > d[i] + KEY_FEEL.snapPoint * (d[i + 1] - d[i])) i++
    else if (i > 0 && s.turn < d[i] - KEY_FEEL.snapPoint * (d[i] - d[i - 1])) i--
    else break
  }
  s.seatedIndex = i
}

/**
 * THE CLICK. Per-notch latch with a re-arm band, matching the winch's `seated` pattern.
 *
 * The E4 key clicked on a nearest-cell change, i.e. at the Voronoi MIDPOINT between notches — the
 * point farthest from any notch, and one that re-fires forever if the hand jitters across it.
 * This fires the moment the ball drops onto the ramp, which is the moment the detent force takes
 * over, and cannot fire again until the key has left by 1.6 well-widths.
 */
function updateClicks(s: KeyPhysicsState, dir: 1 | -1): void {
  const d = KEY_FEEL.detents
  const w = KEY_FEEL.wTurn
  for (let i = 0; i < d.length; i++) {
    const dist = Math.abs(s.turn - d[i])
    if (s.armed[i]) {
      if (dist <= w) {
        s.armed[i] = false
        s.clicks++
        const strength = clamp(Math.abs(s.vel) / 2.5, 0.25, 1)
        s.events.push({ index: i, turn: s.turn, dir, strength })
        s.wobbleV += dir * KEY_FEEL.wobbleKick * strength
        s.dip = KEY_FEEL.dipAmount * strength
        s.pulse = KEY_FEEL.pulseAmount * strength
        s.halo = strength
        s.roll = KEY_FEEL.camRoll * strength * dir
      }
    } else if (dist >= w * KEY_FEEL.rearm) {
      s.armed[i] = true
    }
  }
}

/**
 * ONE FRAME. Integrates the rotor at a fixed substep (so the feel does not change with the frame
 * rate), resolves notches and clicks, and decays every feedback channel. Read `s.events` after.
 */
export function keyTick(s: KeyPhysicsState, rawDt: number): void {
  const dt = clamp(rawDt, 0, 1 / 30)
  s.events.length = 0
  s.time += dt
  if (dt <= 0) return

  const n = Math.min(KEY_FEEL.maxSubsteps, Math.max(1, Math.ceil(dt / KEY_FEEL.substep)))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    substep(s, h)
    updateClicks(s, s.vel >= 0 ? 1 : -1)
  }
  updateSeated(s)

  // Wobble lives ONLY in the drawn angle. A wobbling `wake` would strobe thirty windows.
  s.wobbleV += (-KEY_FEEL.wobbleK * s.wobble - KEY_FEEL.wobbleC * s.wobbleV) * dt
  s.wobble += s.wobbleV * dt
  s.dip = decay(s.dip, KEY_FEEL.dipHalflife, dt)
  s.pulse = decay(s.pulse, KEY_FEEL.pulseHalflife, dt)
  s.halo = decay(s.halo, KEY_FEEL.haloHalflife, dt)
  s.roll = decay(s.roll, KEY_FEEL.camHalflife, dt)
}

/** What the diorama's `wake` channel should read this frame — the settled turn, never the wobble. */
export function keyWake(s: KeyPhysicsState): number {
  return clamp01(s.turn)
}
