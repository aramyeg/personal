import * as THREE from 'three'
import type { EndingState } from '../../ending-timeline'
import { studioLightsFor } from '../desk-studio'
import { COFFEE_ANCHOR } from './desk-glb-contract'

/**
 * THE COFFEE STEAM, as arithmetic (Task 72) — every number the plume is made of, and none of the
 * three.js or React it eventually reaches the screen through.
 *
 * It is split out for the same reason `globe-stand.ts` is split from `globe-stand.tsx`: the shape
 * of the thing is an argument, the mounting of it is plumbing, and only the first one is worth
 * holding to a unit test. `desk-steam.test.ts` drives THIS module — the envelope, the clock and the
 * anchor read — without a canvas.
 *
 * ============================================================================
 * EVERY LENGTH HERE IS IN COFFEE RADII
 * ============================================================================
 * Not in world units, and that is the whole reason `desk-glb-contract.ts` bothered to say that the
 * anchor is SCALED as well as positioned. A plume authored in world units is a plume that has to be
 * re-tuned by hand the next time the mug is remodelled a little larger; a plume authored in radii
 * follows the cup it comes out of. The one multiplication by the anchor's radius happens in the
 * vertex shader (`uR`), so the constants below stay readable as ratios: 4.4 means "four and a bit
 * cup-radii tall", which is a sentence about a picture rather than about a coordinate system.
 */

/**
 * WHERE THE STEAM IS, AND HOW BIG THE CUP IS — read out of the asset, never typed in.
 *
 * `CoffeeAnchor` is an EMPTY node: no mesh, no vertices, no draw call. T71 put it in the export
 * precisely so this round would not have to guess, and the transform is the whole contract — its
 * translation is the centre of the liquid's top surface and its uniform scale is the liquid's
 * radius. Both are read off the one accumulated matrix, so a future re-bake that moves or resizes
 * the mug moves and resizes the steam with it and nothing here has to be edited.
 *
 * ============================================================================
 * WHY THE WALK STOPS AT THE ROOT RATHER THAN INCLUDING IT
 * ============================================================================
 * `desk-glb.tsx` mounts the four meshes with `<primitive object={mesh} />`, which REPARENTS each
 * mesh out of the loaded glTF scene and into an r3f group — so a mesh keeps its own local transform
 * and the glTF root's transform is dropped on the floor. The steam has to land in the same frame as
 * the meshes or a root transform would move one and not the other, so this accumulates from the
 * anchor UP TO but NOT INCLUDING `root`. On the shipped file the anchor is a root-level node and the
 * loop runs exactly once, which is why this is cheap; it is written as a loop anyway because "the
 * exporter currently flattens the hierarchy" is not a property anyone should have to preserve.
 *
 * Returns null rather than throwing for a missing or degenerate anchor. The load is async and can
 * fail forever (`useDeskAssets` resolves to null and stays there), so every step of this path has to
 * degrade to NO STEAM rather than to an exception inside a render tree.
 */
export type CoffeeAnchor = {
  /** The centre of the liquid's top surface, in the frame `desk-glb.tsx` mounts its meshes into. */
  x: number
  y: number
  z: number
  /** The liquid's radius — the unit every constant in this file is written in. */
  radius: number
}

export function readCoffeeAnchor(root: THREE.Object3D): CoffeeAnchor | null {
  const node = root.getObjectByName(COFFEE_ANCHOR)
  if (!node) return null
  const m = new THREE.Matrix4()
  for (let o: THREE.Object3D | null = node; o && o !== root; o = o.parent) {
    // recomposes `o.matrix` from its own position/quaternion/scale, which is exactly what three
    // would do on the next render anyway — it reads the node, it does not change what it means
    o.updateMatrix()
    m.premultiply(o.matrix)
  }
  // Read straight off the matrix rather than through `Matrix4.decompose`, and that is a bug fix
  // rather than a micro-optimisation. three 0.185's `decompose` guards its own division by the axis
  // lengths, so a matrix whose 3x3 is entirely ZERO comes back with a scale of (1, 1, 1) — measured,
  // not assumed. The `radius > 0` check below was therefore unreachable through that path, and a
  // re-bake that ever shipped a zero-scaled anchor would have grown a full-size plume out of a cup
  // the file was trying to say had none. The basis lengths cannot lie about it. The rotation is not
  // read at all: a billboard has no orientation to inherit.
  const e = m.elements
  const sx = Math.hypot(e[0], e[1], e[2])
  const sy = Math.hypot(e[4], e[5], e[6])
  const sz = Math.hypot(e[8], e[9], e[10])
  // The contract says uniform, and `desk-glb.test.ts` gates that on the shipped bytes. Averaging the
  // three rather than taking `sx` means a file that ever broke the promise degrades to a slightly
  // wrong size instead of silently honouring one axis.
  const radius = (sx + sy + sz) / 3
  if (!(radius > 0) || !Number.isFinite(radius)) return null
  const [x, y, z] = [e[12], e[13], e[14]]
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x, y, z, radius }
}

/**
 * HOW MANY PUFFS THE PLUME IS MADE OF.
 *
 * Eighteen, and it is a resolution rather than a budget: they are quads in ONE BufferGeometry drawn
 * by ONE material, so the nineteenth would cost four vertices and no draw call at all. The number is
 * set by what the column has to look like instead.
 *
 * Too few and the eye resolves the individuals — the plume reads as a string of beads climbing,
 * because between one puff dying at the top and the next being born at the bottom there is a
 * visible hole. Too many and the overlapping alphas stack into a solid cone, which is fog and not
 * steam.
 *
 * The count is therefore not free to choose on its own: what has to stay constant is the BIRTH
 * SPACING, the distance up the column between one puff and the next. Eighteen puffs over a 3.6 s
 * life is one born every 200 ms, which at the shipped rise is a new puff every 0.244 radii — dense
 * enough to be continuous, sparse enough that the wisps still separate as they climb and drift
 * apart. It started at fourteen and rose with STEAM_RISE, because holding the count while the
 * column got a third taller is exactly how a plume thins into a haze; the two numbers move together.
 */
export const STEAM_PUFFS = 18

/**
 * HOW LONG A PUFF LIVES, in seconds.
 *
 * Steam is slow, and the failure mode of getting this wrong is not subtle: at 1.2 s the plume reads
 * as something venting, which belongs to a kettle and not to a cup that has been sitting on a desk
 * long enough for someone to have written a note beside it. 3.6 s over 4.4 radii is a rise of 0.366
 * world units per second, which at the money shot's measured vertical scale (125 px per unit, see
 * STEAM_RISE) is 46 screen pixels a second on a 1440-wide frame — slow enough to read as drift
 * rather than as travel, fast enough that four captures a second apart are visibly four different
 * pictures (which is the evidence this file's one deviation has to earn; see `desk-steam.tsx`).
 */
export const STEAM_LIFE = 3.6

/** How much the per-puff rate is allowed to differ from that, as a fraction. Without it every puff
 *  keeps its birth spacing forever and the column climbs like a conveyor; with it they overtake. */
export const STEAM_RATE_SPREAD = 0.34

/**
 * HOW FAR THE COLUMN CLIMBS, in coffee radii, at the end of a puff's life.
 *
 * 4.4 radii is 1.318 world units, and it is solved against the FRAME rather than against physics:
 * the plume should dissolve just as it reaches the desk's back edge, so that it never becomes a
 * white shape hanging in the empty air beside the globe, and never stops short enough to read as a
 * smudge sitting on the coffee.
 *
 * ============================================================================
 * THE ARITHMETIC THAT WAS WRONG, AND THE MEASUREMENT THAT CORRECTED IT
 * ============================================================================
 * This was first derived from the cup's own apparent size: the coffee's 0.599-unit diameter
 * measures 110 px across on a 1440-wide money shot, so one world unit is 184 px, so 3.4 radii would
 * stand 187 px tall. Rendered, it stood 110. The scale is right and the AXIS is wrong — 184 px per
 * unit is a HORIZONTAL measurement, and the ending's camera looks DOWN at the desk, so a vertical
 * world offset is foreshortened by the cosine of that tilt before it reaches the frame. Measured off
 * the render rather than re-derived from the camera: the shipped 1.318-unit rise spans from the
 * liquid at y≈700 to the last pixel above two levels at y≈535, i.e. 165 px, or 125 px per world
 * unit — 68% of the horizontal scale.
 *
 * That correction is the whole reason this constant is 4.4 and not 3.4. It is recorded rather than
 * quietly fixed because the mistake is reusable: anything else in this ending sized against the
 * cup's apparent width will be a third too short in the vertical.
 *
 * A much taller plume was tried early and rejected on composition: at 5.2 radii under the original
 * (uncorrected) reading it would have run past the desk edge and up beside the globe on its stand,
 * which is a second vertical object in a frame that has exactly one.
 */
export const STEAM_RISE = 4.4

/** A puff's radius at birth, in coffee radii. Just under half the cup, so the column starts as
 *  something the width of the liquid rather than as a point that has to grow into one. */
export const STEAM_BIRTH_R = 0.42

/**
 * ...and at death. It expands by 3.6x over its life, which is what makes a plume a plume: a column
 * of same-sized blobs reads as a chain, a column that opens out reads as something dispersing.
 *
 * 1.5 radii is a HALF-extent, so a dying puff is three cup-radii across — visibly wider than the mug
 * it came out of. That looked wrong written down and it was narrowed on exactly that reasoning, to
 * 0.95 and then to 1.15, with the stretch and drift raised to compensate. Both were worse, and
 * measurably: the peak departure from the baseline over the column fell from 55 levels to 46 and
 * then 51, and at 0.95 the plume stopped reading as anything at all in a 4x crop.
 *
 * The reason is that this plume gets almost none of its legibility from any single puff. Against a
 * money shot whose pad measures sRGB 218,204,206 there is no headroom for one; what makes the column
 * visible is puffs OVERLAPPING, and overlap is the first thing narrowing them destroys. So the width
 * went back to what the render preferred, and this paragraph stands as the record that the number
 * that looked indefensible was the one that worked.
 */
export const STEAM_DEATH_R = 1.5

/**
 * HOW MUCH TALLER THAN WIDE A PUFF GETS BY THE END, as a multiplier on its vertical half-extent.
 *
 * Puffs are round at birth and 1.9x taller than wide at death. This is the cheapest wisp there is:
 * the blob is radially symmetric in its own square, so stretching the square vertically stretches
 * the falloff with it and a disc becomes a lozenge without a single extra instruction in the
 * fragment shader. It matters more than its size suggests — round blobs at any count read as
 * bubbles, and the difference between "bubbles rising" and "steam" is almost entirely that steam is
 * smeared along the direction it is travelling.
 */
export const STEAM_STRETCH = 1.9

/**
 * HOW FAR A PUFF WANDERS SIDEWAYS by the end of its life, in coffee radii.
 *
 * The amplitude is multiplied by the puff's own phase, so every puff leaves the liquid dead centre
 * and only earns its wander as it climbs. That ordering is doing real work: air over a hot surface
 * is a coherent column for the first centimetre and turbulent after it, and a plume whose puffs are
 * already scattered at birth reads as a spray rather than as something rising off a disc.
 *
 * 0.7 radii is 0.21 units, about 38 px at the money shot — a lean the eye reads as air moving, well
 * short of the point where a puff clears the cup's footprint and looks detached from it.
 */
export const STEAM_DRIFT = 0.7

/** The wander's z share of that. Under one, so the plume leans across the frame more than into it:
 *  motion the camera can actually see is worth more than motion that is mostly foreshortened. */
export const STEAM_DRIFT_Z = 0.62

/** How far round the wander turns over one life, in radians — per puff, between these two. Both
 *  under a full turn (2π), so a puff leans and comes back rather than corkscrewing. */
export const STEAM_WOBBLE_MIN = 2.0
export const STEAM_WOBBLE_MAX = 4.2

/** A puff is fully faded in by this fraction of its life. Smooth, not instant: a puff that pops on
 *  at the liquid's surface is an EVENT, and eighteen of them is a flicker. */
export const STEAM_BIRTH_FADE = 0.22

/** ...and starts fading out here, reaching nothing at 1. The long tail is deliberate — over half a
 *  puff's life is spent dissolving, which is what stops the top of the column having an edge. */
export const STEAM_DEATH_FADE = 0.38

/**
 * THE MOST OPACITY ANY SINGLE PUFF CONTRIBUTES, at its brightest pixel, at full studio.
 *
 * This is the one constant that had to be solved against the render rather than reasoned to, because
 * the answer depends entirely on what the plume stands in front of — and at the money shot that is
 * almost the brightest thing in the frame. Measured on the approved capture: the pad above the mug
 * is sRGB 218,204,206 and the backdrop behind the desk's edge is 206,197,198. Steam is a scattering
 * medium, so it can only ever LIGHTEN what is behind it, and against a background already at 80% of
 * white there is very little headroom to lighten into.
 *
 * 0.27 is what came back from the sweep, and what it buys was measured rather than judged. Against
 * the HEAD baseline at the money shot, the largest channel departure along each scanline runs: 24
 * levels on the liquid itself, 36 across the mug's shadowed inner rim, 49 just above the rim where
 * the column crosses the white desk band, 40 over the book stack, 13 at y560 and 6 at the desk's
 * back edge, where it is gone.
 *
 * That PROFILE is the thing worth reading, not any one of its numbers. The alpha is constant up the
 * whole column; the visibility is not, because the background is not. The plume is a plain, obvious
 * wisp where it leaves the liquid — dark coffee and a shadowed rim behind it, plenty of headroom —
 * and a barely-there haze by the time it reaches the pad, which is already at 80% of white and has
 * almost none. Steam looks exactly like that, and here it falls out of a constant alpha over a
 * varying background instead of having to be authored as a gradient.
 *
 * Additive blending was tried and rejected. It reads as GLOW, which is exactly the gloss this round
 * is not allowed: over the dark coffee it makes a lamp of the cup, and over the pale backdrop it
 * clips to nothing at all because there is no headroom above 206 to add into. Normal blending
 * toward an off-white is the matte answer and it is also the physical one.
 */
export const STEAM_PEAK = 0.27

/**
 * THE COLOUR — off-white, warm, and NOT taken from the palette.
 *
 * Every other colour in this lab is a `PALETTE` entry because it is a decision about the little
 * world. This one is not a pigment at all; it is what the studio's own key light looks like coming
 * back off a cloud of water, so it is authored here against the render's white balance and belongs
 * with the rest of the plume's arithmetic. Very slightly warm and very slightly desaturated from
 * pure white: against the pad's 218,204,206 a neutral white steam picks up a faint blue cast by
 * contrast, which is the one thing that would make it read as smoke instead.
 *
 * It is a `THREE.Color`, so `ColorManagement` decodes it from sRGB into the renderer's linear
 * working space exactly like every other authored colour in the lab. The fragment shader re-encodes
 * on the way out (`colorspace_fragment`) — a raw ShaderMaterial gets neither for free.
 */
export const STEAM_COLOR = '#F7F3ED'

/**
 * HOW VISIBLE THE STEAM IS — a pure function of scroll, and the same clock as everything else.
 *
 * The ending has spent three rounds getting down to ONE number: the desk's two bakes, the metal's
 * environment, the backdrop's studio mix, the DOM lens and the winter grade's release all read
 * `studioLightsAt(zoom)`. The steam reads it too, unshaped, and the argument for that is the same
 * one `gradeHoldFor` makes one file over: anything else would be a second curve in an ending that
 * only has room for one, and the whole reason to key on `zoom` (the desk does not exist, as far as
 * anyone can see, until the camera withdraws) applies to what is rising off the desk's mug at least
 * as strongly as it applies to the desk.
 *
 * It inherits the determinism with the arithmetic. `smootherstep(0)` is exactly 0, and `ending.zoom`
 * is exactly 0 for the whole journey AND the whole still beat, so this is a hard +0 across every
 * frame the journey owns — which is what lets `desk-steam.tsx` skip the mesh entirely there and
 * contribute literally no draw call, no pixel and no advancing clock. Scrubbing backwards runs the
 * identical arithmetic. `desk-steam.test.ts` pins both with `Object.is` rather than a tolerance,
 * because "close to invisible" is what a value that has quietly started rendering looks like.
 */
export const steamGateFor = (ending: EndingState): number => studioLightsFor(ending)

/**
 * THE ONE NUMBER THAT IS NOT A FUNCTION OF SCROLL, and the two things that keep it contained.
 *
 * `desk-steam.tsx`'s header argues the deviation. This is where it is enforced, and it is enforced
 * as ARITHMETIC so a test can hold it rather than a reviewer having to read the frame loop:
 *
 *  - REDUCED MOTION short-circuits everything and returns a constant, so the plume is a still
 *    photograph of itself. Not zero — see STEAM_STILL_T for why the steam stays in the picture.
 *  - A CLOSED GATE returns the previous value UNCHANGED. Not "returns and is ignored": the
 *    accumulator does not advance, so after any amount of journey the shader's `uTime` is still
 *    whatever it was when the ending last closed. The clock does not merely have no visible effect
 *    outside the ending, it does not run outside the ending.
 *
 * `delta` rather than a wall clock, because a paused or backgrounded tab hands r3f a delta of very
 * nearly zero and a wall clock a jump of however long the visitor was away. Steam that leaps a
 * second and a half on tab focus is the one way this could produce an event the eye catches.
 */
export function steamClockAt(prev: number, delta: number, gate: number, reduced: boolean): number {
  if (reduced) return STEAM_STILL_T
  if (!(gate > 0)) return prev
  return prev + delta
}

/**
 * THE FROZEN INSTANT reduced motion holds, in seconds.
 *
 * The choice was between a STILL plume and NO plume, and it went to the still one. The steam is not
 * an animation with a resting state of nothing — it is part of the composition of the last frame of
 * the lab, the thing that says the coffee beside the note is hot and someone is about to come back
 * to it. Deleting it under the preference does not remove motion from a picture, it removes an
 * object from a picture, and a visitor who asked for less movement did not ask for a colder ending.
 * Held still it is exactly what the preference is for: a soft vertical smudge over the cup with
 * nothing in it that moves. (Reduced motion also swaps the whole 3D experience for the static
 * career timeline upstream, so this is the guarantee for the paths that can still reach a canvas —
 * the same belt-and-braces `use-reduced-motion.ts` describes.)
 *
 * 1.83 s is roughly half a puff-life, and the honest thing to record is that almost any value would
 * have done. The puff phases are spread by an additive golden-ratio recurrence, so the column is
 * well populated at EVERY instant — that property is not a happy accident of this number, it is
 * precisely what makes freezing the plume at any number safe. It was not swept: it was checked, on
 * a forced-still capture at the money shot, and the column came out full and evenly graded from a
 * tight base to a wide dissolve. A neighbouring value would look equally like steam.
 */
export const STEAM_STILL_T = 1.83

/**
 * THE PER-PUFF SEEDS, as one interleaved vec4 per puff: phase offset, rate, wander phase, wobble.
 *
 * ============================================================================
 * WHY IRRATIONAL INCREMENTS AND NOT A HASH
 * ============================================================================
 * The obvious way to vary eighteen puffs is a cheap hash of the index, and the obvious way to space
 * them is `i / 18`. Both are wrong here for the same reason from opposite directions. Even spacing
 * makes the column a conveyor — eighteen identical events at a metronome's interval, which the eye
 * locks onto in about two seconds. A hash removes that but gives no guarantee at all that the column
 * is EVENLY POPULATED: three puffs can land in the same tenth of the cycle and leave a hole
 * elsewhere, and because the whole thing loops, that hole is there every 3.6 s forever.
 *
 * An additive recurrence with an irrational increment is the thing that is both. `frac(i·φ⁻¹)` is
 * the classic low-discrepancy sequence in one dimension: every prefix of it is about as evenly
 * spread over [0,1) as N points can be, and no two terms ever coincide. So the column is uniformly
 * populated by construction, and it is uniformly populated WITHOUT being regular.
 *
 * The other three channels use different irrationals for the same reason a texture atlas uses
 * different offsets — sharing one increment would correlate a puff's rate with its wander phase, and
 * eighteen puffs whose lean is a function of their speed is a pattern, however irrational.
 */
/** φ⁻¹ — the optimal one-dimensional low-discrepancy increment, spent on the channel that most
 *  needs it (when each puff is born). */
const SEED_PHASE = 0.6180339887498949
/** frac(√2), frac(√3), frac(√5) — irrational, and unrelated to φ and to each other. */
const SEED_SWIRL = 0.4142135623730951
const SEED_RATE = 0.7320508075688772
const SEED_WOBBLE = 0.2360679774997898

const frac = (v: number): number => v - Math.floor(v)

/** Four floats per puff, in the order the vertex shader reads them out of `aSeed`. Pure and
 *  deterministic — the same eighteen puffs on every machine, every mount and every reload. */
export function steamPuffSeeds(count: number = STEAM_PUFFS): Float32Array {
  const out = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const n = i + 1
    // rate in CYCLES PER SECOND, so the shader's `fract(phase + t·rate)` needs no division
    const rate = (1 + (frac(n * SEED_RATE) - 0.5) * STEAM_RATE_SPREAD) / STEAM_LIFE
    out[i * 4] = frac(n * SEED_PHASE)
    out[i * 4 + 1] = rate
    out[i * 4 + 2] = frac(n * SEED_SWIRL) * Math.PI * 2
    out[i * 4 + 3] = STEAM_WOBBLE_MIN + frac(n * SEED_WOBBLE) * (STEAM_WOBBLE_MAX - STEAM_WOBBLE_MIN)
  }
  return out
}

/**
 * THE BOUNDING SPHERE THREE IS NOT ALLOWED TO COMPUTE, in coffee radii.
 *
 * The geometry declares its own bounds because it has to: the puffs are expanded in VIEW space —
 * that is what makes them billboards — and their `position` attribute is all zeros, so anything
 * three derived from the buffer would be a sphere of radius 0 at the plume's base. A plume that
 * culls itself the instant its base leaves the frame is the bug that would follow.
 *
 * It is CENTRED HALF WAY UP rather than at the base, and that is not tidiness. The plume only grows
 * upward, so a sphere anchored at the liquid has to reach the top of the column in every direction
 * including downward, and comes out at 7.58 radii — 2.27 world units, about four mug-widths of empty
 * space in front of and behind a wisp. That was measured to cost something real: at 390x844 the mug
 * is off the left edge of the frame entirely and the plume is invisible, yet the fat sphere still
 * clipped the frustum and three still issued the draw. Centring it at RISE/2 takes the radius to
 * 5.51 radii (1.65 units), which is the smallest sphere that honestly contains the worst case — a
 * puff at full height, at full drift, at full size, stretched.
 */
/** How far up the column the sphere's centre sits, in radii. */
export const steamBoundsCenterY = (): number => STEAM_RISE / 2

export const steamBoundsRadius = (): number =>
  Math.hypot(STEAM_RISE / 2 + STEAM_DEATH_R * STEAM_STRETCH, STEAM_DRIFT + STEAM_DEATH_R)
