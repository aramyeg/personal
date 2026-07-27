/**
 * IDLE LIFE — the draught in the room.
 *
 * BW-2, reported independently by all five blind readers of the E3 spreads:
 * "Two screenshots 4s apart with the pointer parked differ by 0; 8s apart by
 * 1"; "Nine seconds of idle produced 0.06% pixel change — literally nothing
 * moves"; "A spread titled 'The Carrier Swarm' containing ~30 bees in which
 * no bee ever moves is a dead diorama". Every moving pixel in the lab was
 * welded to the pointer: the whole book is posed by closed-form solvers of
 * ONE driving dihedral, which is exactly why it is honest paper — and exactly
 * why it freezes the instant the reader's hand stops.
 *
 * This module adds the ONLY motion in the book that is not a function of the
 * dihedral. It is therefore fenced by four laws, and every one of them is
 * gated by __tests__/labs/storybook/idle-life.test.ts:
 *
 *  1. PAPER TRUTH. A die-cut is RIGID. The legal excursions are a tiny rigid
 *     rotation of the WHOLE piece about its own crease/glue axis (a shop sign
 *     swivelling on its tabs), a sub-millimetre rigid slide along that axis,
 *     or a change in how much light the print catches. Nothing here deforms a
 *     quad, bends a panel or re-solves a mechanism — the solvers are not
 *     touched at all, so every containment/collision/fold-flat bench proof in
 *     the book remains valid as measured.
 *  2. FOLD-FLAT SUPREMACY. The excursion is multiplied by the same page-
 *     openness envelope shape the mechanisms use (cf. `liftFlapEnvelope`,
 *     `swarmArcEnvelope`): E(0) = 0 EXACTLY, so a closed book is dead still,
 *     and a turn in flight suppresses idle outright — the reader's page turn
 *     is never garnished with a wobble it did not ask for.
 *  3. ZERO ALLOCATION. Pure functions of numbers only. No objects in the
 *     signature, no vectors returned, nothing for the GC to collect at 60fps
 *     across ~40 tagged-and-untagged pieces. Callers keep their own scratch.
 *  4. DETERMINISM. Amplitude is a pure function of (elapsed seconds, an id
 *     hash, a peak). No springs, no per-piece mutable state, no integration —
 *     so a piece cannot drift out of budget over a long session, and two
 *     neighbours cannot lock into step.
 *
 * The bar is "did the room breathe", not "did something animate": if a reader
 * can name the motion, it is too big.
 */

/** What a tagged accent does when the reader is still.
 *   - 'sway': rigid rotation about the piece's own crease axis through its
 *     apex — the hanging sign, the bee twitching on its glue tab.
 *   - 'drift': sub-millimetre rigid slide ALONG that axis — reserved for
 *     pieces the art shows as airborne, where the eye reads a slide as hover
 *     rather than as glue creep.
 *   - 'glint': no motion at all, only light — a multiplicative brightness
 *     modulation of the print (brass catching the lamp, gold in a hoard). */
export type IdleKind = 'sway' | 'glint' | 'drift'

/** An accent piece's idle tag, authored in content.ts. `amp` is a MULTIPLIER
 *  on the kind's default peak (1 = default), clamped to the budget below —
 *  authors can calm a piece down but cannot break the ceiling. */
export type IdleTag = { readonly kind: IdleKind; readonly amp?: number }

/** BUDGET CEILINGS — the hard boundary of "a draught, not an animation".
 *  Sway is capped at 1.5deg, which on the largest tagged accent (the 0.22-wide
 *  ch2 courier) moves its outermost corner 0.003 world units; drift is capped
 *  at 0.004 world = 0.27% of PAGE_H, i.e. well under a millimetre once the
 *  1.5-unit page is printed at any plausible trim size. Glint is capped at
 *  +-12% of the print's own brightness: enough to register in a screenshot
 *  diff, far too little to read as a light being switched. */
export const IDLE_SWAY_MAX_DEG = 1.5
export const IDLE_DRIFT_MAX = 0.004
export const IDLE_GLINT_MAX = 0.12

/** Default peaks, deliberately a step inside the ceilings so an authored
 *  `amp` of 1.2 on a stubborn piece is still legal. */
const SWAY_DEG = 1.2
const DRIFT_UNITS = 0.003
const GLINT_FRACTION = 0.09

/** Two SUMMED incommensurate terms, both in the 0.15-0.6 Hz "breath" band.
 *  One term alone reads as a metronome the moment a reader parks for twenty
 *  seconds — the ratio 0.41/0.17 is deliberately not a small rational, so the
 *  pair's beat is longer than anyone's attention span. Weights sum to 1, which
 *  is what makes the peak a hard bound rather than an estimate. */
export const IDLE_HZ_SLOW = 0.17
export const IDLE_HZ_FAST = 0.41
const SLOW_WEIGHT = 0.62
const FAST_WEIGHT = 0.38

/** Per-piece DETUNE (fraction), also forced by the lockstep gate. Phase scatter
 *  alone cannot guarantee separation: two ids may hash to nearly the same phase
 *  in both terms purely by luck, and with a dozen tagged pieces that happens
 *  about one time in a hundred — it happened on the first run of this table
 *  (worst pair separated by 0.02 of full scale, i.e. visually identical). Two
 *  scraps of paper in the same draught do not share a period either, so each
 *  piece stretches its own clock by up to +-6%: pieces that start together come
 *  apart within seconds and never resynchronise inside a reading. Keeps both
 *  terms inside the 0.15-0.6 Hz breath band at either extreme. */
export const IDLE_DETUNE = 0.06

/** The book's rest dihedral (deg) — the tilted open pose, same constant the
 *  liftflap/swarmarc/skyline envelopes use, so idle reaches full amplitude at
 *  exactly the pose the mechanisms call "fully deployed". */
export const IDLE_REST_DEG = 176

const TAU = Math.PI * 2
const SIN_HALF_REST = Math.sin((IDLE_REST_DEG * Math.PI) / 360)

/**
 * The phase seed for a piece: paper-stock.ts's `hashLayerId` (djb2) followed by
 * a 32-bit avalanche finalizer.
 *
 * The finalizer is not decoration — the lockstep gate caught its absence. djb2
 * on two ids differing only in their LAST character (`ch2-bee-b` vs
 * `ch2-bee-c`) returns two hashes one apart, so slicing bit-fields off it gave
 * those two bees phases 1/1024 of a cycle apart in one term and IDENTICAL in
 * the other: the two neighbours a reader is most likely to compare moved as one
 * piece (measured wave separation 0.004 of full scale). paper-stock survives
 * raw djb2 because it only takes the hash modulo a 7-member family; a phase
 * needs the low bits to be uncorrelated, and this is what makes them so.
 */
export function idleSeed(id: string): number {
  let hash = 5381
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x21f0aaad)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x735a2d97)
  hash ^= hash >>> 15
  return hash >>> 0
}

/**
 * The shared breath, in [-1, 1]: two incommensurate sines whose phases come
 * from two INDEPENDENT bit-fields of the seed (low 10 bits and next 10) and
 * whose shared clock is stretched by a third field, so pieces scatter in phase
 * AND in period. Pure numbers in, one number out — no allocation, safe to call
 * once per piece per frame for every tagged piece on the spread.
 */
export function idleWave(seed: number, t: number): number {
  const slowPhase = ((seed & 1023) / 1024) * TAU
  const fastPhase = (((seed >>> 10) & 1023) / 1024) * TAU
  const detuned = t * (1 + (((seed >>> 20) & 31) / 31 - 0.5) * 2 * IDLE_DETUNE)
  return (
    SLOW_WEIGHT * Math.sin(TAU * IDLE_HZ_SLOW * detuned + slowPhase) +
    FAST_WEIGHT * Math.sin(TAU * IDLE_HZ_FAST * detuned + fastPhase)
  )
}

/**
 * Page-openness envelope, law 2. Shape is verbatim the mechanisms' E(beta):
 * u = sin(beta/2) / sin(rest/2), eased by sin(u*PI/2). Two things it
 * guarantees, both asserted with `toBe(0)`:
 *  - a closed or nearly-closed book (beta -> 0) has EXACTLY zero idle, so the
 *    "nothing sticks out" containment proof for the closed page is untouched;
 *  - `turning` short-circuits to 0, because a page turn already moves every
 *    piece on the spread and a tremor added on top of it reads as a glitch,
 *    not as air. (It also keeps the physics-bench frozen-turn captures
 *    bit-reproducible — those hold a turn frame forever.)
 */
export function idleGate(beta: number, turning: boolean): number {
  if (turning) return 0
  const u = Math.min(1, Math.max(0, Math.sin(beta / 2) / SIN_HALF_REST))
  return Math.sin((u * Math.PI) / 2)
}

/** The peak excursion a tag is allowed: the kind's default scaled by the
 *  authored multiplier and clamped to the budget. Resolved ONCE per piece when
 *  it mounts, never inside the frame loop — which is why the frame loop's own
 *  entry point (`idleOffset`) takes a plain number instead of the tag. */
export function idlePeak(kind: IdleKind, amp: number | undefined): number {
  const scale = amp === undefined ? 1 : Math.max(0, amp)
  if (kind === 'sway') {
    return Math.min(IDLE_SWAY_MAX_DEG, SWAY_DEG * scale) * (Math.PI / 180)
  }
  if (kind === 'drift') return Math.min(IDLE_DRIFT_MAX, DRIFT_UNITS * scale)
  return Math.min(IDLE_GLINT_MAX, GLINT_FRACTION * scale)
}

/**
 * A tagged piece's signed excursion this frame — radians for 'sway', world
 * units for 'drift', a fraction of the print's own brightness for 'glint'.
 * The unit is the tag's kind; the caller already knows which one it asked for,
 * so nothing is boxed to carry it.
 */
export function idleOffset(
  peak: number,
  seed: number,
  t: number,
  beta: number,
  turning: boolean
): number {
  const gate = idleGate(beta, turning)
  // The early exit is the law, not an optimisation: `peak * wave * 0` yields
  // NEGATIVE zero on every frame the wave is below the axis, and a -0 leaking
  // into a position or an axis-angle is a signed zero nobody downstream asked
  // to reason about. A closed book returns literal +0.
  if (gate === 0) return 0
  return peak * idleWave(seed, t) * gate
}

/** The idle kinds that MOVE paper, as opposed to the one that only changes how
 *  much light it catches. The distinction is the whole of the handle law below
 *  (E3 WAVE-2 s7): a grab handle must never twitch, but there is nothing wrong
 *  with a handle catching the lamp. */
export const IDLE_MOTION_KINDS: readonly IdleKind[] = ['sway', 'drift']

/**
 * IS THE IDLE CLOCK FROZEN? — the one owner of that question (E3 s2 round-2,
 * S2R2-4). Both renderers that implement idle life asked it privately, in
 * duplicate, and both answered "yes whenever `?sbpose` is present".
 *
 * WHY THAT MATTERED FAR MORE THAN IT LOOKS. `?sbpose=<spread>` is how the
 * physics bench pins a deterministic pose — and it is also how every blind
 * reviewer in this round is sent to a spread. So each of them read a book with
 * ITS ENTIRE IDLE LIFE SWITCHED OFF and then reported, correctly and uselessly,
 * that nothing on the page ever moves. s2's re-reviewer: "over 8 frames at rest
 * the only motion in the entire spread is drifting dust motes... no smoke, no
 * flame flicker, no bird flight. The scene is a still life." Both of that
 * spread's glints were tagged, wired and live; neither could ever have fired at
 * that URL. A measurement instrument that removes the property being measured
 * is worse than no measurement.
 *
 * The freeze itself is right and stays: a rest override leaves the turn frame
 * null, so a ticking clock would make every golden capture differ run to run,
 * which is the one thing those captures exist to rule out. What it needed was a
 * way OUT. `?sbidle=1` re-starts the clock under a pinned pose. The capture
 * bench passes no such flag, so every golden is byte-identical to before; a
 * human (or a reviewer's browser) reading a pinned spread asks for it and sees
 * the book the production reader sees.
 */
export function idleClockPinned(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (typeof window === 'undefined') return false
  const q = new URLSearchParams(window.location.search)
  if (!q.has('sbpose')) return false
  return q.get('sbidle') !== '1'
}

/** Grab-handle mechanism families. A handle that SWAYS or DRIFTS would tremble
 *  under the reader's hand and fight the drive it is being dragged by, so
 *  content.ts may not give one a motion tag (gated in idle-life.test.ts).
 *
 *  E3 WAVE-2 s7 narrowed this from "no tag at all" to "no MOTION tag". The
 *  original list was belt-and-braces: at the time it was written, idle life was
 *  wired into the generic two-quad layer only, so every family named here was
 *  already unreachable and the rule cost nothing to state at full strength. It
 *  started costing something when the s7 clerk needed his candle to flicker —
 *  a blind reader's sharpest idle finding on that spread was "a lit candle with
 *  a painted halo that never flickers" — and he is a strip flap. A `glint` is
 *  light, not motion: it moves no vertex, cannot fight a drive, and the strip
 *  flap layer additionally yields it to the hover glow while the reader's hand
 *  is on the piece, so the two never write the same tint in one frame.
 *
 *  Exported so the gate and this module cannot disagree about the list. */
export const IDLE_FORBIDDEN_MECHS: readonly string[] = [
  'tabpiece',
  'dissolve',
  'keepsake',
  'liftflap',
  'stripflap',
  'knobtower',
  'keepwinch',
  'volvelle',
  'swarmarc',
  // E3 s4 round-3: the dispatch line joins the list for the same reason as the
  // rest — the reader's hand is on its trolley — and joins the glint-only list
  // below for the same reason as the strip flap.
  'dispatchline',
]

/** Mechanism families that actually route through popup-spread.tsx's generic
 *  two-quad `PopupLayer`, which is where the offset is applied. A tag on any
 *  other family would be silently dead paperwork — including 'fan', whose
 *  members are SYNTHESIZED v-fold layers (`fanMemberLayers`) that do not
 *  inherit the parent's fields. Gated, so a future tag cannot go nowhere. */
export const IDLE_SUPPORTED_MECHS: readonly string[] = [
  'vfold',
  'child',
  'parallel',
  'rider',
  'kinetic',
]

/** Families whose OWN renderer implements the glint (and only the glint), so a
 *  `glint` tag on them is live paperwork even though they never reach the
 *  generic layer. Kept separate from IDLE_SUPPORTED_MECHS rather than merged
 *  into it, because the two lists mean different things: that one says "the
 *  generic layer poses this", this one says "this renderer honours light only".
 *  A motion tag on a family listed here is still dead, and still gated.
 *
 *  E3 s4 ROUND-3 adds 'dispatchline' on exactly the same argument, and it is
 *  what closed the book's one remaining idle gap. Spread 4 had no eligible
 *  piece: showpieces that pose themselves, grab handles, and masonry. What it
 *  DID have was a sheet die-cut down to a wire, its masts and its hanging
 *  lanterns — so a glint on that print lands on the lamps and on nothing else,
 *  which is the accent the census asked for ("a small loose, lit or airborne
 *  thing that the art puts there on purpose"). The renderer applies it to the
 *  PANEL only; the trolley keeps the hover glow, so the two can never write the
 *  same tint in one frame. */
export const IDLE_GLINT_ONLY_MECHS: readonly string[] = ['stripflap', 'dispatchline']
