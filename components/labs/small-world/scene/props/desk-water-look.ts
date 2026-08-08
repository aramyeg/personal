import { KEY_LIGHT_POSITION } from '../biome-atmosphere'

/**
 * THE WATERING'S LOOK (T100) — the shading the pour was missing, as a pure module.
 *
 * ============================================================================
 * THE DIAGNOSIS, AS A PICTURE (headed captures, iso production build, 1440×900)
 * ============================================================================
 * Three failures, named off `scratchpad/t100/before/pour/`:
 *
 * 1. THE BEADS ARE STICKERS. `dropMaterial` shipped a flat `MeshBasicMaterial` — one constant
 *    RGB, unlit, `toneMapped: false` — on seven convex teardrops. A convex body with a single
 *    colour has no interior at all: what renders is its SILHOUETTE, filled. And because all seven
 *    carry the SAME fill, wherever two overlap the boundary between them vanishes and the cluster
 *    reads as one amorphous blob, which is exactly what the capture shows hanging under the spout.
 *    Every other object in this room is a baked, banded, warm-lit surface; the beads were the one
 *    flat cartoon fill in it, so they read as pasted on rather than present.
 *
 * 2. THE CAN'S SPOUT IS CRUSHED. Its Cycles bake stores real geometry — a narrow bore and the
 *    concave neck under it — and a concave cavity bakes to near-black. On the shipped frame the
 *    spout runs from the body's white down to a muddy olive and a black rim at the mouth: the
 *    SAME failure class T90 named for the casters ("a zero in a multiplier atlas is a hole") and
 *    T97 named for the roll's underside. Honest bytes, wrong read.
 *
 * 3. THE CAN DOES NOT SIT ANYWHERE. It has no contact shadow, so at rest it floats over a white
 *    desk against a white paper stack — pale mint on pale everything, with nothing under it to
 *    say which of those surfaces it is standing on.
 *
 * ============================================================================
 * WHY THE FIXES ARE RUNTIME AND NOT A RE-BAKE
 * ============================================================================
 * A re-bake would spend GLB bytes to move numbers a shader can move for free, and — the deciding
 * argument — the bake is not WRONG, it is out of range at both ends for a prop this small on a
 * white desk. Remapping a range is a shading decision, and shading decisions belong where the
 * lights are. The precedent is already in this codebase: `BIRD_LIFT` (T97 P6) does exactly this
 * to the roll's baked underside, for exactly this reason.
 *
 * THE ONE THING THIS COSTS, stated plainly: unlike every other change in the T100 round, the can
 * grade and the contact shadow CHANGE THE RESTING FRAME. That is the point — the client's note is
 * about how the can looks, and it looks wrong standing still. So the rest pixel-diff gate is not
 * expected to be zero here; it is expected to be confined to the can's own footprint and the
 * shadow ellipse, and that containment is what gets measured.
 */

const f = (v: number): string => v.toFixed(5)

/** The studio key, as a unit direction TOWARD the light — the same one the scene's own
 *  `directionalLight` is placed on, read from the constant rather than re-guessed. */
const KEY = (() => {
  const [x, y, z] = KEY_LIGHT_POSITION
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l] as const
})()

// --- the beads ---------------------------------------------------------------

export const BEAD = {
  /** The three tones a clay-room water bead is made of: a lit crown, the body, and the turned-away
   *  side. Banded, not blended — this room quantises its lighting into steps everywhere else, and
   *  a smoothly-shaded bead would be the foreign object instead. */
  crown: [0.86, 0.95, 1.0],
  body: [0.44, 0.72, 0.88],
  shade: [0.2, 0.44, 0.63],
  /** Where the bands break, in N·L. */
  bandHi: 0.55,
  bandLo: 0.02,
  /** THE SEPARATOR. The silhouette sinks toward this tone, so two overlapping beads always have a
   *  dark seam between them and never fuse into one blob — the single failure the capture made
   *  loudest. It is also just true: a water bead is darkest where you look through the most of it. */
  edge: [0.15, 0.36, 0.56],
  edgeLo: 0.5,
  edgeHi: 1.0,
  edgeK: 0.8,
  /** The wet dot: a small near-white specular where the key hits square on. A bead without one
   *  is a pebble. */
  specLo: 0.9,
  specHi: 0.995,
  specK: 0.85,
  /** The teardrop is taller than it is wide (local bounds −0.057..0.088 in y against ±0.057 in
   *  xz), so the direction that behaves like its normal is the position squashed back toward a
   *  sphere. The mesh ships POSITION only — no normals — which is why the normal is derived at
   *  all, and why deriving it this way is honest rather than a trick.
   */
  ySquash: 0.66,
  /** The beads answer the studio like every other prop: dark before the lights come up. They can
   *  only fly while the desk is armed, so this is a consistency clause, not a visible one. */
  dim: 0.45,
} as const

const v3 = (c: readonly number[]): string => `vec3( ${f(c[0]!)}, ${f(c[1]!)}, ${f(c[2]!)} )`

/**
 * The bead's vertex half: a derived world-space normal and the view direction. `modelMatrix` and
 * `cameraPosition` are three's own built-ins, so this needs no new uniform; the drop nodes carry
 * translation and a uniform scale only (the clip animates scale 0 → 1), so `mat3(modelMatrix)`
 * is a positive diagonal and normalising after it is exact.
 */
export const BEAD_VERTEX_DECL = 'varying vec3 vBeadN;\nvarying vec3 vBeadV;'
export const BEAD_VERTEX_BODY = `vec3 bdN = normalize( position * vec3( 1.0, ${f(BEAD.ySquash)}, 1.0 ) );
vBeadN = normalize( mat3( modelMatrix ) * bdN );
vBeadV = normalize( cameraPosition - ( modelMatrix * vec4( position, 1.0 ) ).xyz );`

export const BEAD_FRAGMENT_DECL = 'uniform float uLights;\nvarying vec3 vBeadN;\nvarying vec3 vBeadV;'
export const BEAD_FRAGMENT_BODY = `float bdK = dot( normalize( vBeadN ), vec3( ${f(KEY[0])}, ${f(KEY[1])}, ${f(KEY[2])} ) );
vec3 bdC = bdK > ${f(BEAD.bandHi)} ? ${v3(BEAD.crown)} : ( bdK > ${f(BEAD.bandLo)} ? ${v3(BEAD.body)} : ${v3(BEAD.shade)} );
float bdE = smoothstep( ${f(BEAD.edgeLo)}, ${f(BEAD.edgeHi)}, 1.0 - abs( dot( normalize( vBeadN ), normalize( vBeadV ) ) ) );
bdC = mix( bdC, ${v3(BEAD.edge)}, bdE * ${f(BEAD.edgeK)} );
bdC = mix( bdC, vec3( 1.0 ), smoothstep( ${f(BEAD.specLo)}, ${f(BEAD.specHi)}, bdK ) * ${f(BEAD.specK)} );
diffuseColor.rgb = bdC * mix( ${f(BEAD.dim)}, 1.0, uLights );`

// --- the can's grade ---------------------------------------------------------

export const CAN_GRADE = {
  /** The floor the crushed spout is lifted off. Measured on the shipped frame: the spout's throat
   *  and mouth run under luminance 0.16 while the can's own body sits near 0.95 — a 6:1 range on
   *  an object 66 px wide. Everything under `lumLo` is pulled fully toward the family tone;
   *  everything over `lumHi` keeps its bake exactly. */
  lumLo: 0.1,
  lumHi: 0.42,
  /** Where the crushed darks head: the can's own sage, dark enough to still read as the shaded
   *  side of a spout rather than a repaint. */
  floor: [0.42, 0.5, 0.45],
  liftK: 0.85,
  /** ...and the other end. The bake blew the body to near-white against a white desk and a white
   *  paper stack, which is why the can has no silhouette. This pulls the LIGHT end down toward the
   *  authored sage-mint (T92's 0.42/0.63/0.50) — a tint, applied hardest where the bake is
   *  brightest, so the form the bake found is kept and only its exposure moves. */
  tint: [0.72, 0.85, 0.78],
  tintFrom: 0.6,
  tintK: 0.55,
} as const

export const CAN_FRAGMENT_BODY = `float cnL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  ${v3(CAN_GRADE.floor)},
  ( 1.0 - smoothstep( ${f(CAN_GRADE.lumLo)}, ${f(CAN_GRADE.lumHi)}, cnL ) ) * ${f(CAN_GRADE.liftK)}
);
diffuseColor.rgb *= mix(
  vec3( 1.0 ),
  ${v3(CAN_GRADE.tint)},
  smoothstep( ${f(CAN_GRADE.tintFrom)}, 1.0, cnL ) * ${f(CAN_GRADE.tintK)} * uLights
);`

// --- the can's contact shadow ------------------------------------------------

/**
 * The seat. A soft ellipse pressed into the desk's own baked colour under the can's rest
 * footprint — the can's node sits at (−3.72, 10.03) on a `DeskSurface` whose top plane is y
 * 1.303, and the can's base rests exactly on it.
 *
 * It RIDES THE POUR: the can lifts 0.95 units off the desk mid-clip, and a contact shadow that
 * stayed put through that would be a decal. So the pool widens and fades with the lift (`uWater.y`
 * — see `canLift`), which is what a real soft shadow does when its caster rises. At `uWater.y` 0
 * the term is the resting seat; the shader is guarded so the whole block is skipped when the
 * ending is dark.
 */
export const CAN_SHADOW = {
  centre: [-3.735, 10.09],
  /** Radii, world units — the can body's own footprint, not its AABB (the spout overhangs and
   *  casts nothing worth drawing at this size). */
  rx: 0.235,
  rz: 0.265,
  /** How dark the pool goes at its centre, as a multiplier on the baked desk. */
  depth: 0.34,
  /** The soft edge: full inside this fraction of the radius, gone at 1. */
  soft: 0.55,
  /** At full lift the pool spreads by this factor... */
  spread: 1.9,
  /** ...and keeps only this share of its depth. A shadow that vanished entirely would let the can
   *  float again at the top of its own arc; a real one goes wide and faint. */
  liftKeep: 0.3,
} as const

export const SURFACE_SHADOW_DECL = 'uniform vec4 uWater;'
/** Reads `vMapUv`'s world twin — the surface is a flat slab in the desk plane, so the fragment's
 *  own world xz is what the ellipse is measured in; `vSurfXZ` is set in the vertex half. */
export const SURFACE_SHADOW_VERTEX_DECL = 'varying vec2 vSurfXZ;'
export const SURFACE_SHADOW_VERTEX_BODY = `vSurfXZ = position.xz;`
export const SURFACE_SHADOW_FRAGMENT_DECL = 'varying vec2 vSurfXZ;\nuniform vec4 uWater;'
export const SURFACE_SHADOW_FRAGMENT_BODY = `{
  float shS = 1.0 + ${f(CAN_SHADOW.spread - 1)} * uWater.y;
  vec2 shD = ( vSurfXZ - vec2( ${f(CAN_SHADOW.centre[0])}, ${f(CAN_SHADOW.centre[1])} ) )
    / ( vec2( ${f(CAN_SHADOW.rx)}, ${f(CAN_SHADOW.rz)} ) * shS );
  float shR = length( shD );
  if ( shR < 1.0 ) {
    float shA = 1.0 - smoothstep( ${f(CAN_SHADOW.soft)}, 1.0, shR );
    diffuseColor.rgb *= 1.0 - ${f(CAN_SHADOW.depth)} * shA * mix( 1.0, ${f(CAN_SHADOW.liftKeep)}, uWater.y ) * uLights;
  }
}`

/**
 * How high the can is, 0 at rest and 1 at the top of its arc — the closed form of the clip's own
 * measured translation sampler (48 LINEAR keys: y 1.300 at 0.042 s, 2.250 by 0.542, held to
 * 1.375, back to 1.300 by 2.0). Approximated by two smoothsteps rather than re-read from the
 * buffer at runtime: the shadow only needs the SHAPE, and a curve that agrees with the sampler to
 * a few percent is a shadow nobody can catch lying.
 */
export function canLift(clip: number): number {
  if (clip <= 0.042) return 0
  if (clip >= 2.0) return 0
  const up = Math.min(Math.max((clip - 0.042) / (0.542 - 0.042), 0), 1)
  const down = Math.min(Math.max((clip - 1.375) / (2.0 - 1.375), 0), 1)
  const rise = up * up * (3 - 2 * up)
  const fall = down * down * (3 - 2 * down)
  return rise * (1 - fall)
}
