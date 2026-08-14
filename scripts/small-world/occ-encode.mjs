/**
 * THE OCCLUSION ATLAS ENCODER — turns a raw float32 occlusion bake into the two shipping WebPs.
 *
 *   node scripts/small-world/occ-encode.mjs --in <bakeDir> --variant A --out <file.webp>
 *   node scripts/small-world/occ-encode.mjs --self-test
 *
 * Built in T128 as a look-dev encoder; promoted in T130 with the step that matters — THE FOLD.
 *
 * ── WHAT THE FOLD IS, AND WHY IT HAPPENS HERE ─────────────────────────────────────────────────
 *
 * The bake stores raw sky visibility in [0,1]. What the shader multiplies by is that value shaped:
 *
 *     texel = floor + occ^pow · (1 − floor)
 *
 * T128 ran that as three `pow`s and two mixes per land fragment per frame, behind live uniforms,
 * because it was fitting the two constants. They are fitted. Folding them into the image leaves the
 * fragment stage with one multiply and no shaping uniforms at all, and it is not merely cheaper —
 * it is more correct in two ways the self-test below asserts rather than asserts in prose:
 *
 *  1. **Quantisation.** Shaping AFTER the 8-bit quantisation takes a 1/255 step in the raw texel
 *     through a curve whose derivative near the open field is `pow`, then compresses it by
 *     (1 − floor): at pow 3 / floor 0.5 that is a 1.5/255 step in the delivered multiplier. Folding
 *     first stores the delivered value directly, at a flat 1/255. The bake's median is 0.993, so
 *     nearly every texel on the sheet lives in exactly that region.
 *  2. **Mip filtering.** `pow` is convex on [0,1], so by Jensen's inequality averaging raw texels
 *     and then shaping them is not the same as averaging shaped ones — the old order darkened the
 *     minified planet. The mip chain should average the number that is actually multiplied in.
 *
 * ── ONE OWNER FOR THE CONSTANTS ───────────────────────────────────────────────────────────────
 *
 * `pow` and `floor` are read out of `components/labs/small-world/scene/planet-occ-contract.ts`,
 * not restated here. That module is where they are documented, where the unit gate reads them from
 * to hold the shipped file's histogram to the floor, and where a reader looking at the runtime
 * would go — so it is the one place they may live. A drifted or deleted constant fails the parse
 * loudly instead of silently shipping an atlas shaped to something else.
 *
 * ── THE ENCODING ──────────────────────────────────────────────────────────────────────────────
 *
 * 8-bit NON-COLOR, like the desk atlas: the numbers are a lighting multiplier, not a colour, and
 * the runtime loads them as `NoColorSpace`. sharp is handed the raw bytes we want with no transfer
 * function applied on either side.
 *
 * RGB rather than grey, and q85 rather than q90, both measured rather than chosen. The fold spends
 * bytes: `pow` stretches the open field's near-1.0 texels apart, so the folded sheet carries more
 * visible structure than the raw one and the pair encodes at 24,178 B at q90 — over the 22,104 B
 * this feature is allowed. Two ladders were run against the FOLDED reference (T130 report §3):
 *
 *   pair bytes   mean err   p99      what it is
 *   36,900       0.0027     0.0139   rgb q95
 *   24,178       0.0034     0.0189   rgb q90 — over budget
 *   21,264       0.0054     0.0321   grey q90 — bigger AND less accurate than rgb q85
 *   17,980       0.0040     0.0233   rgb q85 — SHIPPED
 *   14,538       0.0045     0.0274   rgb q80
 *
 * Grey loses on both axes at once because the "saving" is the coloured bounce itself, so it is not
 * a cheaper encode of the same picture — it is a worse picture that also did not get much smaller.
 * q85 is the pick because its error in the DELIVERED multiplier (mean 0.0040 / 0.0036 per variant)
 * matches what T128's approved captures were actually rendered through — a q90 RAW sheet shaped by
 * three `pow`s at runtime, which measured 0.0040 / 0.0035 — while costing 15% fewer bytes. The
 * fold buys back at q85 exactly what the extra structure costs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSharp } from './load-sharp.mjs'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
/** The WebP quality the shipped pair is encoded at — see the ladder in the header. */
const SHIPPED_QUALITY = 85

const CONTRACT = path.join(
  REPO_ROOT,
  'components/labs/small-world/scene/planet-occ-contract.ts'
)

/**
 * The three numbers the shipped image is defined by, read from the module that owns them.
 *
 * A regex over TypeScript source is a blunt instrument and it is the right one here: the
 * alternative is a build step (tsx/esbuild) to import one file of constants into a script that has
 * no other TypeScript in it, and the failure mode of the regex — a constant renamed or removed —
 * is a hard throw, not a wrong number.
 */
export function readOccContract(source = fs.readFileSync(CONTRACT, 'utf8')) {
  const num = (name) => {
    const m = source.match(new RegExp(`export const ${name}\\s*=\\s*([0-9_.]+)`))
    if (!m) throw new Error(`${name} not found in planet-occ-contract.ts`)
    const v = Number(m[1].replace(/_/g, ''))
    if (!Number.isFinite(v)) throw new Error(`${name} is not a finite number: ${m[1]}`)
    return v
  }
  return { pow: num('PLANET_OCC_POW'), floor: num('PLANET_OCC_FLOOR'), size: num('PLANET_OCC_SIZE') }
}

/** The fold, as one expression, so the self-test and the encode cannot diverge. */
export const fold = (occ, pow, floor) => floor + Math.pow(Math.max(occ, 0), pow) * (1 - floor)

/** 8-bit quantisation of a [0,1] multiplier. Values above 1 cannot occur (the bake's open sky is
 *  exactly 1) but are clamped rather than trusted, so a future bake under a brighter world cannot
 *  wrap to black. */
const quant = (v) => Math.max(0, Math.min(255, Math.round(v * 255)))

function parseArgs(argv) {
  const o = { in: null, variant: null, out: null, quality: SHIPPED_QUALITY, selfTest: false, stats: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--self-test') o.selfTest = true
    else if (a === '--in') o.in = argv[++i]
    else if (a === '--variant') o.variant = argv[++i]
    else if (a === '--out') o.out = argv[++i]
    else if (a === '--stats') o.stats = argv[++i]
    else if (a === '--quality') o.quality = Number(argv[++i])
    else throw new Error(`unknown argument ${a}`)
  }
  return o
}

async function encode(opts) {
  const { pow, floor, size } = readOccContract()
  const sharp = loadSharp()

  const src = path.join(opts.in, `occ${opts.variant}_${size}.f32`)
  const buf = fs.readFileSync(src)
  const raw = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  const n = size * size
  if (raw.length !== n * 3) {
    throw new Error(`${src} holds ${raw.length} floats; ${size}² RGB needs ${n * 3}`)
  }

  const bytes = Buffer.alloc(n * 3)
  let over = 0
  let zeros = 0
  for (let i = 0; i < n * 3; i++) {
    if (raw[i] > 1) over++
    bytes[i] = quant(fold(raw[i], pow, floor))
  }
  // Texels the bake left EXACTLY zero are an unrasterised gap in the sheet, not occlusion — the
  // flood in occ-bake.py exists to close them, and a nonzero count here means it did not.
  for (let i = 0; i < n; i++) {
    if (raw[i * 3] === 0 && raw[i * 3 + 1] === 0 && raw[i * 3 + 2] === 0) zeros++
  }

  fs.mkdirSync(path.dirname(opts.out), { recursive: true })
  await sharp(bytes, { raw: { width: size, height: size, channels: 3 } })
    .webp({ quality: opts.quality, effort: 6 })
    .toFile(opts.out)

  // Measured on the FILE ON DISK, never on the encoder's buffer — sharp re-encodes on toFile and a
  // buffer length is not the wire length.
  const wire = fs.statSync(opts.out).size

  // The whole point of the fold is that the DECODED file is the multiplier, so the gate on it is
  // the decode, not the input. Re-read what was just written and measure it.
  const back = await sharp(opts.out).raw().toBuffer()
  const errs = new Float64Array(n * 3)
  let minTexel = 1
  for (let i = 0; i < n * 3; i++) {
    const want = fold(raw[i], pow, floor)
    const got = back[i] / 255
    errs[i] = Math.abs(want - got)
    if (got < minTexel) minTexel = got
  }
  // The distribution, not just the worst texel. A lossy codec's max lands on the sharpest contact
  // edge in the sheet and says nothing about the picture; the mean is what the eye integrates.
  const sorted = Array.from(errs).sort((a, b) => a - b)
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length

  const report = {
    variant: opts.variant,
    size,
    pow,
    floor,
    quality: opts.quality,
    out: path.relative(REPO_ROOT, opts.out),
    wireBytes: wire,
    over,
    unrasterisedTexels: zeros,
    decode: {
      meanAbsError: +mean.toFixed(5),
      p99AbsError: +sorted[Math.floor(0.99 * sorted.length)].toFixed(5),
      maxAbsError: +sorted[sorted.length - 1].toFixed(5),
      minTexel: +minTexel.toFixed(5),
    },
  }
  if (opts.stats) fs.writeFileSync(opts.stats, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

/**
 * The self-test. No bake required and no Blender: everything below is a property of the fold and of
 * the encoder, which is precisely the part that can rot between rounds while the bake sits frozen
 * in a webp nobody re-renders.
 */
async function selfTest() {
  const fails = []
  const check = (name, ok, detail) => {
    if (ok) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
    else {
      console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
      fails.push(name)
    }
  }

  const { pow, floor, size } = readOccContract()
  check(
    'contract parses',
    Number.isFinite(pow) && Number.isFinite(floor) && size > 0,
    `pow ${pow}, floor ${floor}, size ${size}`
  )
  check('floor is a remap, not a clamp — it leaves headroom', floor >= 0 && floor < 1)
  check('exponent deepens rather than lifts', pow >= 1)

  // The two endpoints the shader's identity depends on: fully open terrain must store exactly 1, so
  // `mix(vec3(1.0), texel, m)` is a no-op over the open field at any strength; fully enclosed
  // terrain must bottom out at the floor and never below it.
  check('open sky folds to exactly 1', fold(1, pow, floor) === 1)
  check('full occlusion folds to exactly the floor', fold(0, pow, floor) === floor)

  let monotone = true
  let prev = -1
  for (let i = 0; i <= 1000; i++) {
    const v = fold(i / 1000, pow, floor)
    if (v < prev) monotone = false
    prev = v
  }
  check('monotone in the bake value — no gradient is inverted', monotone)

  // THE PRECISION CLAIM IN THE HEADER, MACHINE-CHECKED. Both paths deliver the same multiplier in
  // exact arithmetic; the question is what 8 bits does to each. Sampled over the range the bake
  // actually occupies (its p05 is 0.87, its median 0.993), the fold-first path must be strictly
  // better, or the header is wrong and the fold is not worth doing.
  let errFoldFirst = 0
  let errFoldLast = 0
  for (let i = 0; i <= 20_000; i++) {
    const occ = 0.8 + (0.2 * i) / 20_000
    const exact = fold(occ, pow, floor)
    errFoldFirst = Math.max(errFoldFirst, Math.abs(quant(exact) / 255 - exact))
    errFoldLast = Math.max(errFoldLast, Math.abs(fold(quant(occ) / 255, pow, floor) - exact))
  }
  check(
    'folding before quantisation is the more accurate order',
    errFoldFirst < errFoldLast,
    `max err ${errFoldFirst.toExponential(2)} vs ${errFoldLast.toExponential(2)}`
  )

  // ...and the mip claim: `pow` is convex, so shaping after averaging is DARKER than averaging
  // shaped texels. The fold puts the filter in the space that is multiplied in.
  const pair = [0.6, 1.0]
  const shapedMean = (fold(pair[0], pow, floor) + fold(pair[1], pow, floor)) / 2
  const meanShaped = fold((pair[0] + pair[1]) / 2, pow, floor)
  check(
    'shaping after mip-averaging would darken the minified planet',
    meanShaped < shapedMean,
    `${meanShaped.toFixed(4)} < ${shapedMean.toFixed(4)}`
  )

  // The encoder end to end, through sharp, on a synthetic sheet that spans the whole range — so a
  // sharp upgrade that changed the WebP defaults (a colour transform, a subsample) is caught here
  // rather than on a planet nobody is looking closely at.
  //
  // The synthetic is a SMOOTH 2D ramp rather than a raster-order one. That is not the encoder
  // being flattered: a raster-order ramp puts a full-range cliff at every row wrap, which is
  // exactly the content a lossy codec spends its error budget on and is nothing like an occlusion
  // sheet (low-frequency by construction — it is how much sky a point of rolling terrain sees).
  // The real sheets' decode error is measured on the real files by the encode path above and
  // printed with every atlas built, so the honest number is never only this one.
  const sharp = loadSharp()
  const W = 64
  const n = W * W
  const src = new Float32Array(n * 3)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const t = (x + y) / (2 * (W - 1))
      const i = y * W + x
      src[i * 3] = t
      src[i * 3 + 1] = t
      src[i * 3 + 2] = t
    }
  }
  const bytes = Buffer.alloc(n * 3)
  for (let i = 0; i < n * 3; i++) bytes[i] = quant(fold(src[i], pow, floor))
  const encoded = await sharp(bytes, { raw: { width: W, height: W, channels: 3 } })
    .webp({ quality: SHIPPED_QUALITY, effort: 6 })
    .toBuffer()
  const back = await sharp(encoded).raw().toBuffer()
  let maxErr = 0
  for (let i = 0; i < n * 3; i++) {
    maxErr = Math.max(maxErr, Math.abs(back[i] / 255 - fold(src[i], pow, floor)))
  }
  // 6/255 of slack, and the number is set by what this check is FOR. WebP at the shipped quality is
  // lossy, and on the real sheets it misses by up to 0.089 (23/255) at the sharpest contact edges —
  // which is fine, because the shader multiplies this into a toon term whose own banding is far
  // coarser, and because the error the eye integrates is the mean (0.004). What would NOT be fine is
  // a structural break — an sRGB transform applied to data, a channel swap, a subsampling default
  // that changed under a sharp upgrade — and every one of those misses by tens of steps everywhere
  // rather than by a few at edges. This bound sits between the two.
  check(
    `a q${SHIPPED_QUALITY} round trip preserves the multiplier`,
    maxErr <= 6 / 255,
    `max ${(maxErr * 255).toFixed(2)}/255`
  )

  console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed')
  process.exitCode = fails.length ? 1 : 0
}

const opts = parseArgs(process.argv.slice(2))
if (opts.selfTest) await selfTest()
else if (opts.in && opts.variant && opts.out) await encode(opts)
else {
  console.error(
    'usage: occ-encode.mjs --in <bakeDir> --variant A|B --out <file.webp> [--quality 90] [--stats f.json]\n' +
      '       occ-encode.mjs --self-test'
  )
  process.exitCode = 2
}
