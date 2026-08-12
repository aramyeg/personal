#!/usr/bin/env node
/**
 * compress-girl.mjs — the second half of the girl.glb asset chain.
 *
 *   girl-v2.glb (raw Meshy export, UNTRACKED)
 *     → canonicalize-girl.mjs   (clips / orientation / material contract)
 *     → THIS SCRIPT             (simplify + texture + wire compression)
 *     → public/labs/small-world/girl.glb   (tracked, shipped)
 *
 * T96 built this step and left it in scratchpad, which was fine while it only
 * re-encoded bytes. T113 added SIMPLIFICATION, whose parameters are a product
 * decision about how her face looks, so the whole step moves into the repo:
 * an asset nobody can regenerate is an asset nobody can correct.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE NUMBERS (T113, measured — the full rung table is in
 * .superpowers/sdd/task-113-report.md)
 *
 * SIMPLIFY_ERROR = 0.001. The export arrives at 103,994 triangles, ×10.5 the
 * asset it replaces. meshoptimizer's error budget is a fraction of mesh radius,
 * so on a 1.7 u figure 0.001 is about 1.5 mm and 0.01 is about 9 mm. The budget,
 * not the ratio, is what binds: at 0.001 the mesh lands at 49,278 triangles and
 * at 0.01 it lands at 28,063, and past 0.05 it stops moving at all (~27,900).
 *
 * T112 saw that last floor and attributed it to hair strands the simplifier
 * could not collapse. That was wrong and the correction matters, because it is
 * what let the number move: 96.9% of this mesh is ONE connected component
 * (scratchpad/t113/segment-pos.mjs). The real floor is the UV atlas — 66.5% of
 * positions carry two or more UVs, up to nine, and the simplifier will not
 * collapse across an atlas island boundary at any error budget. Breaking that
 * floor needs a re-unwrap and a re-bake, not a parameter.
 *
 * The budget is spent on the FACE first, which is where a viewer reads shape.
 * Rendered against the un-simplified body at a head-and-shoulders framing, the
 * coarser rungs put a flat slab on the nose bridge, a plate on the philtrum and
 * a hard chevron on the chin; at 0.01 the throat grows a flat pentagon (neck
 * max edge 60 mm un-simplified → 80 mm at 0.0015 → 120 mm at 0.01). 0.001 is
 * the coarsest setting at which no facet reads as a plate. It is not identical
 * to the un-simplified body — face triangles halve, 9,976 → 5,002 — but the two
 * places it shows are findable only with the un-simplified render beside it.
 *
 * NONE of this is visible at the lab's own camera, where she is 160 px tall and
 * her face is about ten. This setting buys a body that survives a close-up the
 * lab does not have yet, for +7% on the wire.
 *
 * TEXTURE_SIZE = 1024. At the reading camera the 2048² and 1024² atlases are
 * indistinguishable — measured, not assumed: six rungs rendered at the true
 * 160 px framing were identical at 3× nearest-neighbour zoom. The drop first
 * shows at close-up, on the shirt print's fine speckle and hair strand
 * striping; skin, lips and brows are low-frequency and survive intact. Halving
 * the atlas is what pays for the geometry above.
 *
 * TEXTURE_QUALITY = 95, not lower. q85 saves a further ~147 KB gz but puts
 * chroma fringing along the sunglasses edges — a coloured edge catches the eye
 * more readily than a slightly softer weave, so it is a worse picture for less
 * money than the geometry rungs cost.
 *
 * NOT KTX2, deliberately, and this is a hard constraint rather than a
 * preference: girl-clay.ts's gradeGirlTexture() draws the decoded image onto a
 * 2D canvas to pastel-grade it. A KTX2 CompressedTexture is not canvas-drawable,
 * so KTX2 would silently drop her to the flat fallback tint — a visible material
 * change — and drei's useGLTF wires no KTX2 transcoder. WebP decodes to a plain
 * ImageBitmap and the grade path stays byte-for-byte the same code.
 *
 * Geometry and animation go out under EXT_meshopt_compression, decoded
 * transparently by three's GLTFLoader via drei's default MeshoptDecoder.
 * ---------------------------------------------------------------------------
 *
 * After accepting an output, re-pin GIRL_GLB_BYTES in scene/girl-url.ts —
 * girl-url.test.ts asserts it against the file on disk.
 *
 * USAGE
 *   node scripts/small-world/compress-girl.mjs --src A.glb --out B.glb
 *   node scripts/small-world/compress-girl.mjs            # in-place girl.glb
 *   node scripts/small-world/compress-girl.mjs --error 0.0015 --texture 1536
 *
 * Deterministic: same input + same tool versions → same output bytes.
 */
import { statSync, readFileSync } from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'

/** The shipped rung. Every one of these is justified in the block above. */
export const SIMPLIFY_ERROR = 0.001
/** Ratio is deliberately far below what is reachable: the error budget is the
 *  binding constraint, and asking for 6% makes that explicit rather than
 *  letting a ratio silently become the thing that stops the simplifier. */
export const SIMPLIFY_RATIO = 0.06
export const TEXTURE_SIZE = 1024
export const TEXTURE_QUALITY = 95

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..', '..')

/**
 * Resolve the encoders FROM the realpathed @gltf-transform/functions package,
 * which pins the exact versions functions was built against (extensions 4.4.1,
 * meshoptimizer 1.1.1, sharp 0.34.5). They are transitive deps, not direct ones
 * — no install, no version drift, the shared node_modules untouched.
 */
async function loadDeps() {
  const fnDir = realpathSync(path.join(WORKTREE, 'node_modules', '@gltf-transform', 'functions'))
  const req = createRequire(path.join(fnDir, 'noop.js'))
  const core = await import('@gltf-transform/core')
  const functions = await import('@gltf-transform/functions')
  const extensions = await import(pathToFileURL(req.resolve('@gltf-transform/extensions')).href)
  const meshopt = await import(pathToFileURL(req.resolve('meshoptimizer')).href)
  const sharpMod = await import(pathToFileURL(req.resolve('sharp')).href)
  return {
    core,
    functions,
    extensions,
    MeshoptEncoder: meshopt.MeshoptEncoder,
    MeshoptDecoder: meshopt.MeshoptDecoder,
    MeshoptSimplifier: meshopt.MeshoptSimplifier,
    sharp: sharpMod.default ?? sharpMod,
  }
}

/** A NodeIO that can read AND write meshopt/webp GLBs. */
async function makeIO(deps) {
  const { core, extensions, MeshoptEncoder, MeshoptDecoder } = deps
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  return new core.NodeIO()
    .registerExtensions(extensions.ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
}

/** Largest bounding-box dimension over a set of POSITION arrays — the same
 *  quantity meshoptimizer normalises its target_error by. */
const extent = (arrays) => {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const a of arrays)
    for (let i = 0; i < a.length; i += 3)
      for (let k = 0; k < 3; k++) {
        if (a[i + k] < min[k]) min[k] = a[i + k]
        if (a[i + k] > max[k]) max[k] = a[i + k]
      }
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
}

const triangles = (doc) =>
  Math.round(
    doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0)
  )

export async function compressGirl({
  src,
  out,
  error = SIMPLIFY_ERROR,
  ratio = SIMPLIFY_RATIO,
  textureSize = TEXTURE_SIZE,
  quality = TEXTURE_QUALITY,
}) {
  const deps = await loadDeps()
  const { functions, MeshoptEncoder, MeshoptSimplifier, sharp } = deps
  await MeshoptEncoder.ready
  await MeshoptSimplifier.ready
  const io = await makeIO(deps)

  const before = statSync(src).size
  const doc = await io.read(src)
  const trisBefore = triangles(doc)

  // weld() first: it is bitwise-identical merging only, so it costs nothing here
  // (this export's vertices are split by UV at every island edge and almost none
  // of them are bitwise equal) but simplify() expects a welded input.
  //
  // THE ERROR BUDGET IS PER PRIMITIVE, AND THAT MATTERS SINCE T121 CUT THE SHIRT
  // OUT. meshoptimizer normalises target_error by the extent of the positions it
  // is handed, and gltf-transform hands it one primitive at a time. While this
  // asset was a single primitive that extent was the whole 1.7 u figure and the
  // block above ("0.001 is about 1.5 mm") was true. The moment the garment became
  // its own 0.58 u shell the same number bought it ~0.5 mm — three times finer
  // than the body, by accident, and it kept 87% of its triangles for +4.8% on the
  // wire (measured: scratchpad/t121/simsweep.mjs, 13,894 tri / gz 1,641,087
  // against 7,920 tri / gz 1,569,049 scaled).
  //
  // So the error is scaled per primitive by the whole mesh's extent over that
  // primitive's, which makes SIMPLIFY_ERROR mean one absolute distance on the
  // figure again — the thing it was always documented to mean. A single-primitive
  // asset scales by exactly 1 and is untouched.
  const wholeExtent = extent(
    doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).map((p) => p.getAttribute('POSITION').getArray())
  )
  await doc.transform(functions.weld())
  const budgets = []
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const scale = wholeExtent / extent([prim.getAttribute('POSITION').getArray()])
    budgets.push({ material: prim.getMaterial()?.getName() ?? null, scale, error: error * scale })
    functions.simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: error * scale })
  }
  const trisAfter = triangles(doc)

  await doc.transform(
    functions.textureCompress({ encoder: sharp, targetFormat: 'webp', quality }),
    functions.reorder({ encoder: MeshoptEncoder }),
    functions.meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    functions.prune()
  )

  // Re-encode the atlas directly. textureCompress cannot pass smartSubsample
  // (measured +0.65 dB over its default 4:2:0 at the same quality — the PSNR
  // ceiling here is chroma subsampling, not quality) nor a resize, so the
  // source image is re-read and encoded in one pass. The texture object keeps
  // the image/webp mime + extension that textureCompress set up.
  let texBytes = 0
  {
    const srcDoc = await io.read(src)
    const srcTex = srcDoc.getRoot().listTextures()[0]
    const tex = doc.getRoot().listTextures()[0]
    if (srcTex && tex) {
      let pipe = sharp(Buffer.from(srcTex.getImage()))
      if (textureSize) pipe = pipe.resize(textureSize, textureSize, { fit: 'fill', kernel: 'lanczos3' })
      const webp = await pipe.webp({ quality, effort: 6, smartSubsample: true }).toBuffer()
      tex.setImage(new Uint8Array(webp)).setMimeType('image/webp')
      texBytes = webp.length
    }
  }

  await io.write(out, doc)
  const raw = statSync(out).size
  const buf = readFileSync(out)
  return {
    out,
    before,
    raw,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    brotli: zlib.brotliCompressSync(buf).length,
    trisBefore,
    trisAfter,
    texBytes,
    textureSize,
    quality,
    error,
    budgets,
  }
}

const DEFAULT = path.join(WORKTREE, 'public', 'labs', 'small-world', 'girl.glb')

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`)
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
  }
  const r = await compressGirl({
    src: arg('src', DEFAULT),
    out: arg('out', DEFAULT),
    error: Number(arg('error', SIMPLIFY_ERROR)),
    ratio: Number(arg('ratio', SIMPLIFY_RATIO)),
    textureSize: Number(arg('texture', TEXTURE_SIZE)),
    quality: Number(arg('quality', TEXTURE_QUALITY)),
  })
  console.log(`wrote ${r.out}`)
  console.log(`triangles ${r.trisBefore.toLocaleString()} → ${r.trisAfter.toLocaleString()}  (error ${r.error})`)
  console.log(`texture   ${r.textureSize}² q${r.quality} → ${r.texBytes.toLocaleString()} B`)
  console.log(`bytes     ${r.before.toLocaleString()} → ${r.raw.toLocaleString()} raw`)
  console.log(`wire      gzip ${r.gzip.toLocaleString()}  brotli ${r.brotli.toLocaleString()}`)
  console.log(`\nGIRL_GLB_BYTES must be ${r.raw}`)
}
