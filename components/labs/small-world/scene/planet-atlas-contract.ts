/**
 * THE JOURNEY PLANET'S LIGHTING ATLAS — the handful of numbers the bake, the shader and the gate
 * all have to agree on, in a module none of them owns.
 *
 * Deliberately free of three.js and of React (the `desk-glb-contract.ts` pattern), so the byte
 * gate can hold the shipped file to it in a plain unit test with no canvas, and so the runtime
 * mount cannot drift from the numbers the Blender side was normalised against.
 *
 * ── WHAT THE ATLAS IS ─────────────────────────────────────────────────────────────────────────
 *
 * A Cycles bake of the T71 studio rig over the parked planet, with the ALBEDO DIVIDED OUT. It is
 * a LIGHTING MULTIPLIER, not a colour. That choice is the whole design (T90 spike §5b): the
 * runtime keeps its own vertex colours, so the ending's crossfade is
 *
 *     colour = vertexColour * mix(toonLighting, texel * K, bakeMix)
 *
 * which is exposure-agnostic — nothing in it depends on how bright the toon pass happens to be —
 * and which is bit-identical to today at `bakeMix = 0` because the whole term is branched out.
 */

/** Where the baked lighting atlas lives, relative to the site root. */
export const PLANET_ATLAS_URL = '/labs/small-world/planet-light.webp'

/**
 * THE NORMALISATION DIVISOR the Blender side stored the atlas with: each texel is
 * `baked / (PLANET_ATLAS_MEDIAN * 4)`, so the whole dynamic range of the bake lands inside [0,1]
 * with room above the median for the highlight.
 *
 * Recorded here only so the runtime multiplier below is readable as a ratio rather than as a
 * magic number — the shader never uses it directly. If the atlas is ever re-baked, this and K
 * move together or the mount is silently mis-exposed.
 *
 * 12.3886 is the CASTER-FREE bake's median on the shipped 512² downsample. The shipping atlas
 * (`soft42`) carries the 97 prop contact shadows with their depth remapped (0.42 + 0.58·ratio),
 * and it deliberately keeps the caster-free normalisation: the floored atlas is never brighter
 * than the caster-free one, so nothing new clips.
 */
export const PLANET_ATLAS_MEDIAN = 12.3886

/**
 * THE RUNTIME MULTIPLIER — and the load-bearing decision of the whole task.
 *
 * K normalises the baked term to the toon pass's **HIGHLIGHT (p95)**, NOT to its median. Median
 * matching was tried first and is wrong: the bake's p95 sits at 2.94× its own median, so putting
 * the medians together lands that p95 on top of a 0.85 snow albedo and CLIPPED 57.8% OF THE
 * PLANET TO WHITE. Matching the p95 instead leaves the lit side where it already is and spends
 * the bake's extra range DOWNWARD — into the shaded side, which is the form being bought.
 *
 * PROVENANCE: 1.1003 is the atlas lane's fit against the SHIPPED atlas — the softened-caster
 * (`soft42`) 2048²-baked, 512²-downsampled file this contract's median belongs to — matching the
 * decoded texel's p95 to the toon rebuild's p95 the same way the spike's 1.504 was fitted against
 * the flat-normal 1024² bake.
 *
 * CONVENTION, verified on a GPU rather than assumed (T90 close-out): K assumes the shader's toon
 * term (`outgoingLight / diffuseColor.rgb`) is MEDIAN-NORMALISED — scale ≈ 1. The browser term
 * really is: the rig's (1.55 key + 1.62 ambient) / π ≈ 1.0, and an instrumented frame (uBakeMix
 * forced to 1 with K forced to 1, money-shot pose) measured the needed multiplier at 1.1105 —
 * 0.9% from this constant, against 3.1536 (K × 2.866078) had the term been raw. If the toon rig's
 * intensities ever move, this constant silently mis-exposes the ending — re-run the probe.
 */
export const PLANET_ATLAS_K = 1.1003

/**
 * The wire budget for the atlas, in bytes.
 *
 * This is not a number the atlas chose — it is the ROUND'S REMAINING HEADROOM (~37,666 B) that the
 * atlas had to fit inside, and it did: the shipped `soft42` 512² q90 measures 15,562 B (the
 * softened contact shadows compress better than the caster-free bake's 25,768 B).
 * That is the entire reason no payload budget was raised for this feature. 1024² q90 measures
 * 73,132 B and does not fit, which is why the sheet is 512² even though bigger measures better —
 * at the money shot the planet is ~320 px wide, so 512² already gives ≥1.6 texels per pixel there
 * and the next rung buys resolution nobody can resolve.
 *
 * Measured on the RAW file length, not a gzipped one: WebP is already entropy-coded and gzip
 * returns it within a few dozen bytes, so the raw length IS the wire length here (unlike the GLB,
 * whose gate has to gzip to measure what a browser downloads).
 */
export const PLANET_ATLAS_BYTE_BUDGET = 37_666

/**
 * The sheet's edge length. Asserted by the gate so a re-bake at a different resolution cannot slip
 * in under the byte budget — a 1024² q60 would fit the bytes and lose the form.
 */
export const PLANET_ATLAS_SIZE = 512
