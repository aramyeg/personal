/**
 * THE JOURNEY TERRAIN'S OCCLUSION ATLASES — the numbers the Blender bake, the encoder, the shader
 * and the byte gate all have to agree on, in a module none of them owns. Same arrangement as
 * `planet-atlas-contract.ts` (which owns the ENDING's atlas); deliberately free of three.js and
 * React so the gate can hold the shipped files to it in a plain unit test.
 *
 * ── WHAT THESE ARE, AND HOW THEY DIFFER FROM THE ENDING'S ATLAS ────────────────────────────────
 *
 * `planet-light.webp` is a Cycles bake of the T71 STUDIO rig — a key light fixed in WORLD space —
 * over ONE pose of the planet and ONE terrain variant. The planet group spins under that key
 * (`planet.tsx`, `group.rotation.set(-j.rotation, 0, 0)`) while the atlas is sampled in planet-
 * LOCAL uv, so outside the parked money shot it paints light onto the wrong side of the world.
 * T127 §3 L2 measured the result and it is not a tuning problem.
 *
 * These two atlases are baked under a UNIFORM WHITE SKY with no light source of any kind. Under a
 * uniform dome an unoccluded lambertian point receives the same irradiance whichever way it faces,
 * so the entire structure recorded here is SELF-OCCLUSION — how much sky each point of the terrain
 * can see, plus the coloured light its own neighbours bounce back. Both are properties of the
 * terrain in its own frame, so they are rotation-invariant BY CONSTRUCTION rather than by tuning,
 * and they are valid at every checkpoint AND on every travel leg between them.
 *
 * ── WHY THERE ARE TWO ─────────────────────────────────────────────────────────────────────────
 *
 * The journey stands on two different worlds: chapters 0-2 on variant A's relief, 3-5 on variant
 * B's, with the renewal front flipping each vertex once as it passes through the hidden band
 * (`renewal.ts`). Occlusion follows relief, so one atlas would paint variant A's valleys onto
 * variant B's dunes. The shader blends them by the SAME `renewalGate` the geometry morph uses,
 * recomputed in the vertex stage — see `boil-material.ts`.
 *
 * ── WHY THERE IS NO K AND NO MEDIAN ───────────────────────────────────────────────────────────
 *
 * A point on a convex sphere with nothing above it sees an unobstructed hemisphere of a
 * unit-radiance dome and nothing else, so its raw baked value is EXACTLY 1.0. Measured, not
 * assumed: both bakes read p95 = 1.0000000 and max = 1.0000003 over the whole sheet. The texel is
 * therefore already the multiplier — no normalisation divisor, no fitted runtime constant, and
 * nothing that can silently drift out of date the way `PLANET_ATLAS_K` can if the toon rig moves.
 *
 * ── THE SHAPING IS FOLDED IN (T130) ───────────────────────────────────────────────────────────
 *
 * T128 shipped its look-dev harness with the exponent and the floor as live uniforms, and closed
 * by recommending they be folded into the atlas. They are, and the file stores
 *
 *     texel = PLANET_OCC_FLOOR + occ^PLANET_OCC_POW · (1 − PLANET_OCC_FLOOR)
 *
 * so the fragment stage pays ONE multiply — `outgoingLight *= mix(vec3(1.0), texel, mix)` — where
 * the harness paid three `pow`s and two mixes, on every land fragment of every journey frame.
 * Three consequences, in the order they matter:
 *
 *  1. **The uniforms are gone**, so the two constants below cannot drift out of agreement with the
 *     shipped image at runtime. They are provenance and a gate, not state. `planet-occ.test.ts`
 *     decodes the shipped files and holds their histogram to the floor, so a re-encode that forgot
 *     to fold fails the suite rather than shipping a stain.
 *  2. **Quantisation improves where it is read.** Folding after quantisation would take the 1/255
 *     step of a raw texel through a p=3 curve whose derivative near the open field is 3, then
 *     compress it by (1 − floor) — a 1.5/255 step in the delivered multiplier. Folding first
 *     stores the delivered value directly, at a flat 1/255. The bake's median is 0.993, so almost
 *     every texel on the sheet lives in exactly that region.
 *  3. **Mip filtering lands in the right space.** `pow` is convex on [0,1], so averaging raw texels
 *     and then shaping them is not the same as averaging shaped ones — the old order darkened the
 *     distant planet by Jensen's inequality. The filter should average the multiplier that is
 *     actually multiplied in, and after the fold it does.
 */

/** Where the two occlusion atlases live, relative to the site root. */
export const PLANET_OCC_A_URL = '/labs/small-world/planet-occ-a.webp'
export const PLANET_OCC_B_URL = '/labs/small-world/planet-occ-b.webp'

/** The sheet's edge length. Same reasoning as the ending's atlas: at the journey's framing the
 *  planet is ~600 px across a 1440 px viewport, and the occlusion field is low-frequency data —
 *  512² already resolves every valley the terrain has. */
export const PLANET_OCC_SIZE = 512

/**
 * THE OPEN-SKY VALUE, before and after the fold. `1^p = 1` for every exponent and the remap pins
 * its top end, so terrain that sees the whole sky stores exactly 1.0 either way — which is what
 * makes `mix(vec3(1.0), texel, m)` a no-op over the open field at any strength.
 */
export const PLANET_OCC_OPEN = 1.0

/**
 * THE SHAPING EXPONENT folded into the atlas (`occ^p`), fitted by the T128 ladder.
 *
 * The raw bake is honest and SUBTLE — median 0.993, mean 0.958 — because a clay planet of rolling
 * relief really does see most of the sky from most of its surface. At p = 1 it reads as a faint
 * dirtying rather than as the modelled form Aram is asking for. The exponent deepens the pockets
 * while leaving the open field pinned at exactly 1.0, which is the property a linear strength dial
 * does not have: a linear dial lifts nothing and just makes the planet dimmer.
 */
export const PLANET_OCC_POW = 3

/**
 * THE FLOOR the shaped term is remapped into — how dark the modulation is allowed to get.
 *
 * The terrain carries features that are genuinely near-enclosed: the river channels the bridges
 * cross, the canyon strata steps, the pond basins' banks. Cycles shades their walls down toward
 * 0.2 and it is not wrong to. But those features are one or two texels wide on a 512² sheet and
 * several hundred pixels wide on screen, so what the eye receives is not a gorge — it is a dark
 * blotch with the bilinear filter's soft edge, sitting on a flat-shaded clay meadow. T128's
 * `zoom-girlskip.jpg` is the evidence: the channel bank below the bridge reads as a stain.
 *
 * A REMAP (`floor + occ^p·(1 − floor)`), never a clamp. A clamp flattens every feature past the
 * threshold to one value and puts a hard contour exactly where it starts biting, trading a stain
 * for a band. The remap keeps every gradient the bake found and only compresses its range.
 *
 * It is also why the shipped files' decoded minimum is ~0.5 rather than ~0.18, which is the gate
 * `planet-occ.test.ts` uses to prove the fold happened.
 */
export const PLANET_OCC_FLOOR = 0.5

/**
 * THE WIRE BUDGET FOR THE PAIR, in bytes — one pin, gating the two files on disk.
 *
 * Not a number this feature chose: it is what was left of the atlas round's headroom. The ending's
 * budget (`PLANET_ATLAS_BYTE_BUDGET`, 37,666 B) was argued as the round's remaining payload, and
 * the shipped `planet-light.webp` spends 15,562 B of it. 37,666 − 15,562 = 22,104 B is therefore
 * the whole of what a new journey atlas may cost without re-opening a payload decision, and the
 * pair fits inside it.
 *
 * Measured on the RAW file lengths, summed — WebP is already entropy-coded, so the raw length is
 * the wire length, and the gate reads the files on disk rather than an encoder's buffer.
 */
export const PLANET_OCC_BYTE_BUDGET = 22_104
