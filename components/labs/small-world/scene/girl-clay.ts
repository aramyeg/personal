import * as THREE from 'three'

/**
 * Load-time blend of the generated girl GLB into the generated clay world.
 * Two deterministic, per-mount operations (no random/time, no per-frame cost):
 *
 *  1. gradeGirlTexture — compress her generated-vivid baked texture toward the
 *     world's pastel daylight (pure function of the source pixels).
 *  2. toonifyGirl — swap her PBR materials for the world's shared 4-step
 *     meshToonMaterial ramp, DROPPING the fullbright emissive the exporter
 *     baked in (Meshy writes the base color as emissive at factor 1 — that
 *     fullbright is precisely why she ignores the scene light and reads as a
 *     different rendering family). Once she is lit by the same raking key +
 *     ambient through the same ramp, she snaps into the clay family.
 *
 * We do NOT touch girl.glb on disk; every change is in-memory at load.
 */

/**
 * Name the asset chain gives the shirt's material — the shipped file's own label
 * for the garment primitive. It is `GARMENT_MATERIAL` in
 * scripts/small-world/detach-girl.mjs, and girl-clay.test.ts asserts the two
 * still agree rather than trusting a copied string.
 */
export const GARMENT_MATERIAL = 'girl_garment'

/** Keep this fraction of the texture's chroma — compresses generated vividness. */
const GRADE_SAT = 0.72
/** Lift toward white for pastel airiness (0..1). */
const GRADE_LIFT = 0.08
/** Warm daylight shift toward PALETTE.sky (#FFF3D6) — per-channel multiply. */
const GRADE_WARM: readonly [number, number, number] = [1.0, 0.985, 0.945]
/** Fallback tint applied to material.color when the texture can't be graded
 *  (e.g. a tainted canvas) — a warm pastel multiply, the weaker of the two levers. */
const GRADE_FALLBACK_TINT = 0xf3ede0

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Deterministic one-time pastel grade of the girl's baked texture. Compresses
 * saturation toward luminance, lifts slightly toward white, and warm-shifts
 * toward the world's daylight so her skin/clothes sit in the same pastel family
 * as the clay terrain. Pure function of the source pixels. Returns null if the
 * source image can't be read (caller falls back to a color multiplier).
 */
export function gradeGirlTexture(src: THREE.Texture): THREE.Texture | null {
  const img = src.image as CanvasImageSource & { width?: number; height?: number }
  const w = img?.width ?? 0
  const h = img?.height ?? 0
  if (!w || !h) return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const image = ctx.getImageData(0, 0, w, h)
    const px = image.data
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      let nr = lum + (r - lum) * GRADE_SAT
      let ng = lum + (g - lum) * GRADE_SAT
      let nb = lum + (b - lum) * GRADE_SAT
      nr = (nr + (255 - nr) * GRADE_LIFT) * GRADE_WARM[0]
      ng = (ng + (255 - ng) * GRADE_LIFT) * GRADE_WARM[1]
      nb = (nb + (255 - nb) * GRADE_LIFT) * GRADE_WARM[2]
      px[i] = clamp255(nr)
      px[i + 1] = clamp255(ng)
      px[i + 2] = clamp255(nb)
    }
    ctx.putImageData(image, 0, 0)
    const graded = new THREE.CanvasTexture(canvas)
    graded.colorSpace = src.colorSpace
    graded.flipY = src.flipY
    graded.wrapS = src.wrapS
    graded.wrapT = src.wrapT
    graded.needsUpdate = true
    return graded
  } catch {
    return null
  }
}

/**
 * Convert the girl GLB's materials to the world's shared toon ramp, in place.
 * Preserves her double-sided flag and alpha handling; skinning is driven by the
 * SkinnedMesh itself so the skip clip keeps animating. Disposes the replaced
 * materials (and the source texture when a graded copy supersedes it).
 * Idempotent: meshes already converted are skipped, so a remount is safe.
 */
export function toonifyGirl(
  scene: THREE.Object3D,
  ramp: THREE.Texture,
  flatShading: boolean
): void {
  // The girl is TWO meshes since T121 cut the shirt into its own primitive, and
  // both reference the same atlas. gradeGirlTexture reads a 1024² image into a
  // canvas and walks every pixel, so without this cache it runs twice per mount
  // and uploads a second identical texture. Keyed on the SOURCE texture rather
  // than the material because GLTFLoader may hand out cloned materials for
  // primitives with different attributes while still sharing one texture.
  const graded = new Map<THREE.Texture, THREE.Texture | null>()
  const gradeOnce = (src: THREE.Texture): THREE.Texture | null => {
    if (graded.has(src)) return graded.get(src) ?? null
    const out = gradeGirlTexture(src)
    graded.set(src, out)
    // The source map is superseded for every mesh at once, so it is released
    // once here rather than once per material.
    if (out) src.dispose()
    return out
  }

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const src = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (src.every((m) => (m as THREE.MeshToonMaterial).isMeshToonMaterial)) return

    const next = src.map((m) => {
      const std = m as THREE.MeshStandardMaterial
      const graded = std.map ? gradeOnce(std.map) : null
      const toon = new THREE.MeshToonMaterial({
        map: graded ?? std.map ?? undefined,
        color: graded || !std.map ? 0xffffff : GRADE_FALLBACK_TINT,
        gradientMap: ramp,
        // THE SHIRT IS THE ONE DOUBLE-SIDED SURFACE ON THE FIGURE, and it earns
        // the exception by measurement rather than by taste. The garment is an
        // OPEN SHEET — a shirt with a hem, two cuffs and a placket — and once the
        // cloth sim lets its panels swing, the camera looks into the sleeves and
        // at the inside of the open front. A single-sided material culls those
        // faces and draws whatever is behind them, which is either the tank or
        // NOTHING: measured across all six clips at 16 views, 45.2 px/view where
        // the culled inner face is the nearest surface and the pixel falls
        // through to the background, and another 45.5 px/view where it falls
        // through to the body — up to 322 void pixels in one 384² view, with the
        // culled face 10–20 cm in front of what gets drawn instead
        // (scratchpad/t124/backface.mjs). That is what "torn" looks like, and it
        // is worst exactly where a sleeve becomes a tube seen end-on
        // (scratchpad/t124/sheets/innerzoom-JumpB-{single,double}.png).
        //
        // Deliberately scoped to the garment. The body is a closed shell, so a
        // back face of it reaching the camera would be a real defect and must
        // keep failing loudly — canonicalize-girl's "all materials OPAQUE +
        // single-sided" self-test still holds on the ASSET, and this exception
        // lives in the renderer beside renderOrder rather than weakening it.
        side: m.name === GARMENT_MATERIAL ? THREE.DoubleSide : std.side,
        transparent: std.transparent,
        alphaTest: std.alphaTest,
      })
      // flatShading is supported by MeshToonMaterial at runtime but missing
      // from its three typings — cast to reach it.
      ;(toon as unknown as { flatShading: boolean }).flatShading = flatShading
      toon.name = std.name
      // Free what we replaced. The source map is disposed by gradeOnce, once,
      // when a graded copy takes over — otherwise the toon material still
      // points at it.
      std.dispose()
      return toon
    })

    mesh.material = Array.isArray(mesh.material) ? next : next[0]

    // The shirt draws LAST, and this is a correctness fix rather than a
    // preference (T121b). The lining is the garment patch offset inward along a
    // field that tapers to zero at the garment outline, so the 72 lining
    // triangles whose three vertices all sit on that outline are bit-exact
    // copies of the garment triangles above them — 43 cm² of two surfaces in
    // one place. Every fragment there is a depth TIE, and three sorts opaque
    // objects by distance, so which surface won depended on the camera: the
    // shirt from one angle, the tank-coloured lining from another. renderOrder
    // puts the garment after everything else, and the default LessEqual depth
    // test lets an equal fragment overwrite, so the shirt wins every tie from
    // every angle. Measured: 21.7 of the bind pose's 28.4 px/view of "lining in
    // front of shirt" are these ties (scratchpad/t121b/{pokemargin,coincident}.mjs).
    if (next.some((m) => m.name === GARMENT_MATERIAL)) mesh.renderOrder = 1
  })
}
