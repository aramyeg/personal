#!/usr/bin/env node
/**
 * rebind-girl.mjs — the weight-rebind stage of the girl.glb asset chain.
 *
 *   girl-v2.glb (raw Meshy export, UNTRACKED)
 *     → THIS SCRIPT  (headless Blender solve + accessor transplant)
 *     → girl-v2-rebound.glb (UNTRACKED, gitignored beside the source)
 *     → canonicalize-girl.mjs --self-test   (prefers the rebound file when present)
 *     → compress-girl.mjs                   (R4z rung, unchanged)
 *     → public/labs/small-world/girl.glb + GIRL_GLB_BYTES
 *
 * WHAT IT REPLACES
 *
 * Meshy's auto-weights are the whole cause of the "jelly" (T115): `neck` drives
 * 54% of all skin vertices and reaches 11.0 cm past its own 10.8 cm bone, the two
 * forearm bones drive 240 of 49,265 triangles between them, shoulder weight mass
 * is 1.86× asymmetric, and the median dominant weight is 0.588 — half the skin
 * has no joint owning even 60% of it. The damage scales with joint angle, so it
 * is worst exactly where the character is most expressive.
 *
 * WHY THE WORK IS SPLIT ACROSS TWO FILES
 *
 * `rebind-girl.py` runs the heat-diffusion solve, which only Blender can do. It
 * emits a weight TABLE, not a GLB, because a Blender glTF round-trip re-samples
 * every animation curve, re-encodes the atlas and re-orders primitives — and the
 * contract for this stage is that it changes the JOINTS_0/WEIGHTS_0 accessors and
 * NOTHING else. This script does that edit on the original document, then proves
 * it: `verifyTransplant()` re-reads both files and asserts every animation
 * sampler, every other vertex attribute, the index buffer, the inverse-bind
 * matrices, the node transforms, the materials and the texture bytes are
 * identical. A regression there fails here rather than at an eye-test.
 *
 * DETERMINISM: the Blender stage has no RNG and no wall-clock; the transplant is
 * a pure function of (source, table). Same input → identical output bytes.
 *
 * USAGE
 *   node scripts/small-world/rebind-girl.mjs
 *       Solve + transplant with the shipped knobs; writes girl-v2-rebound.glb.
 *   node scripts/small-world/rebind-girl.mjs --table <stem>
 *       Reuse an existing <stem>.json/.bin instead of re-running Blender.
 *   node scripts/small-world/rebind-girl.mjs --src A.glb --out B.glb
 *   node scripts/small-world/rebind-girl.mjs --self-test
 *       Transplant to a temp file and assert the whole contract. Touches no
 *       committed file; skips silently if the raw source is absent.
 *
 * THE FULL CHAIN, for a re-export:
 *   node scripts/small-world/rebind-girl.mjs
 *   node scripts/small-world/canonicalize-girl.mjs --self-test
 *   node scripts/small-world/canonicalize-girl.mjs
 *   node scripts/small-world/compress-girl.mjs
 *   # then re-pin GIRL_GLB_BYTES in components/labs/small-world/scene/girl-url.ts
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { shirtMask } from './shirt-region.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..', '..')

export const RAW_SRC = path.join(WORKTREE, 'public/labs/small-world/girl-v2.glb')
export const REBOUND_OUT = path.join(WORKTREE, 'public/labs/small-world/girl-v2-rebound.glb')
const SOLVER = path.join(HERE, 'rebind-girl.py')
const INFLUENCES = 4

/**
 * Where Blender lives. Env var first so a machine with a different install can
 * run the chain without editing the pipeline; the Windows default is the lab's.
 */
function blenderExe() {
  if (process.env.BLENDER) return process.env.BLENDER
  const guesses = [
    'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe',
    'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/usr/bin/blender',
  ]
  return guesses.find((p) => existsSync(p)) ?? 'blender'
}

/**
 * Run the solve headlessly. `-b` is not optional: the standing rule for this lab
 * is that no agent ever occupies the GUI Blender the user may have open.
 */
export function solve(src, stem, shirt) {
  mkdirSync(path.dirname(stem), { recursive: true })
  const exe = blenderExe()
  const extra = shirt ? ['--shirt', shirt] : []
  const r = spawnSync(exe, ['-b', '--python', SOLVER, '--', src, stem, ...extra], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.status !== 0 || !existsSync(`${stem}.bin`)) {
    throw new Error(`rebind-girl.py failed (exit ${r.status}) using ${exe}\n${out.slice(-4000)}`)
  }
  for (const line of out.split(/\r?\n/)) if (line.startsWith('[rebind]')) console.log(line)
  return stem
}

/**
 * The table: metadata + a flat binary of joint indices, weights and the solver's
 * own copy of the positions.
 *
 * The positions are the point of the third block. Every number in the table is
 * addressed by the export's vertex index, which is only meaningful if Blender's
 * importer kept that order — so the solver ships what it saw, in glTF's frame,
 * and the transplant re-derives the correspondence over EVERY vertex instead of
 * trusting a property of an importer version.
 */
export function readTable(stem) {
  const meta = JSON.parse(readFileSync(`${stem}.json`, 'utf8'))
  if (meta.format !== 't117-weights/1') throw new Error(`unknown table format ${meta.format}`)
  const buf = readFileSync(`${stem}.bin`)
  const n = meta.verts
  const k = meta.influences ?? INFLUENCES
  const need = n * k + n * k * 4 + n * 3 * 4
  if (buf.length !== need) throw new Error(`table is ${buf.length} B, expected ${need} B`)
  let o = 0
  const idx = new Uint8Array(buf.buffer, buf.byteOffset + o, n * k)
  o += n * k
  const wgt = new Float32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + n * k * 4))
  o += n * k * 4
  const pos = new Float32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + n * 3 * 4))
  return { meta, idx, wgt, pos, n, k }
}

/** The single skinned primitive, asserted to be single. */
function skinnedPrimitive(doc) {
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  const skinned = prims.filter((p) => p.getAttribute('JOINTS_0'))
  if (skinned.length !== 1) throw new Error(`expected one skinned primitive, found ${skinned.length}`)
  return skinned[0]
}

/**
 * Transplant the table into a copy of `src`, writing `out`.
 *
 * Only two accessors are replaced, and their component types are preserved
 * exactly as the export wrote them (JOINTS_0 unsigned byte, WEIGHTS_0 float) so
 * nothing downstream — meshopt's filters least of all — sees a different shape of
 * data than it did before.
 */
export async function transplant({ src, out, stem }) {
  const table = readTable(stem)
  const io = new NodeIO()
  const doc = await io.read(src)
  const prim = skinnedPrimitive(doc)
  const skin = doc.getRoot().listSkins()[0]
  if (!skin) throw new Error('source has no skin')

  const position = prim.getAttribute('POSITION')
  if (position.getCount() !== table.n) {
    throw new Error(`table is for ${table.n} vertices, source has ${position.getCount()}`)
  }

  // Vertex-order proof, over every vertex rather than a sample.
  const pa = position.getArray()
  let maxErr = 0
  for (let i = 0; i < table.n * 3; i++) maxErr = Math.max(maxErr, Math.abs(pa[i] - table.pos[i]))
  if (!(maxErr < 1e-5)) {
    throw new Error(
      `vertex order differs between the solver and the source: max position error ` +
        `${(maxErr * 1000).toFixed(4)} mm. The table cannot be applied.`
    )
  }

  const jointNames = skin.listJoints().map((j) => j.getName())
  const slot = new Map(jointNames.map((n, i) => [n, i]))
  const missing = table.meta.bones.filter((b) => !slot.has(b))
  if (missing.length) throw new Error(`table names joints the skin does not have: ${missing.join(', ')}`)
  const remap = table.meta.bones.map((b) => slot.get(b))

  const nk = table.n * table.k
  const joints = new Uint8Array(nk)
  const weights = new Float32Array(nk)
  for (let i = 0; i < nk; i++) {
    const j = remap[table.idx[i]]
    if (j === undefined) throw new Error(`table row ${i} names bone slot ${table.idx[i]}, which is out of range`)
    if (j > 255) throw new Error(`joint index ${j} does not fit the export's unsigned-byte JOINTS_0`)
    joints[i] = j
    weights[i] = table.wgt[i]
  }

  // Contract on the table itself, before it reaches a file: normalised, capped,
  // no negative or NaN weight, no influence naming a joint twice.
  let worstSum = 0
  for (let v = 0; v < table.n; v++) {
    let s = 0
    const seen = new Set()
    for (let k = 0; k < table.k; k++) {
      const w = weights[v * table.k + k]
      if (!Number.isFinite(w) || w < 0) throw new Error(`vertex ${v} influence ${k} is ${w}`)
      s += w
      if (w > 0) {
        const j = joints[v * table.k + k]
        if (seen.has(j)) throw new Error(`vertex ${v} names joint ${j} twice with nonzero weight`)
        seen.add(j)
      }
    }
    worstSum = Math.max(worstSum, Math.abs(s - 1))
  }
  if (!(worstSum < 1e-5)) throw new Error(`weights are not normalised: worst |sum-1| = ${worstSum}`)

  // Dispose the accessors being replaced. gltf-transform writes every accessor
  // the root still lists, referenced or not, so leaving them orphaned ships the
  // old weights as 2.13 MB of dead payload inside the new file.
  const oldJoints = prim.getAttribute('JOINTS_0')
  const oldWeights = prim.getAttribute('WEIGHTS_0')
  prim.setAttribute(
    'JOINTS_0',
    doc.createAccessor('JOINTS_0').setType('VEC4').setArray(joints)
  )
  prim.setAttribute(
    'WEIGHTS_0',
    doc.createAccessor('WEIGHTS_0').setType('VEC4').setArray(weights)
  )
  oldJoints?.dispose()
  oldWeights?.dispose()

  mkdirSync(path.dirname(out), { recursive: true })
  await io.write(out, doc)
  return { out, table, worstSum, maxPosErr: maxErr, bytes: statSync(out).size }
}

const eqArray = (a, b) => {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * GATE 2, asserted rather than assumed: the rebind changed the weights and
 * nothing else.
 *
 * Animation is checked on ACCESSOR CONTENT — every sampler's input and output
 * array, its interpolation, and the (node, path) each channel targets — because
 * that is what the runtime plays. Comparing clip names or counts would pass a
 * file whose curves had been re-sampled.
 */
export async function verifyTransplant(srcPath, outPath) {
  const io = new NodeIO()
  const [a, b] = await Promise.all([io.read(srcPath), io.read(outPath)])
  const checks = []
  const assert = (label, ok) => checks.push({ label, ok })

  const pa = skinnedPrimitive(a)
  const pb = skinnedPrimitive(b)
  for (const sem of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TANGENT', 'COLOR_0', 'TEXCOORD_1']) {
    const x = pa.getAttribute(sem)
    const y = pb.getAttribute(sem)
    if (!x && !y) continue
    assert(`${sem} identical`, !!x && !!y && eqArray(x.getArray(), y.getArray()))
  }
  assert('indices identical', eqArray(pa.getIndices()?.getArray(), pb.getIndices()?.getArray()))
  assert('mode identical', pa.getMode() === pb.getMode())

  const sa = a.getRoot().listSkins()[0]
  const sb = b.getRoot().listSkins()[0]
  assert(
    'skin joint list identical',
    sa.listJoints().map((j) => j.getName()).join(',') === sb.listJoints().map((j) => j.getName()).join(',')
  )
  assert(
    'inverse bind matrices identical',
    eqArray(sa.getInverseBindMatrices()?.getArray(), sb.getInverseBindMatrices()?.getArray())
  )

  // Node transforms — the rest pose the curves are played against.
  //
  // A component must be EXACTLY equal, or be a case of the one lossy step this
  // library performs on every write: gltf-transform omits a node's translation /
  // rotation / scale when `MathUtils.eq(value, default)` holds at its own 1e-5
  // tolerance, so a float32 near-identity is rewritten as the exact default. On
  // this rig that is 21 nodes carrying scales like [1, 0.99999988, 1.00000012]
  // and `Spine01`'s rotation [2.6e-8, 1.4e-7, 7.1e-8, 1] — a 2e-7 scale is 0.2
  // microns on a metre, and the rotation is 1.6e-5 of a degree.
  //
  // It is NOT this stage's doing: canonicalize-girl.mjs writes through the same
  // library and has always collapsed them, which is why the BEFORE build still
  // reproduces the shipped girl.glb byte for byte. Allowing exactly that pattern
  // — and nothing wider — keeps the assertion able to catch a real change.
  const DEFAULTS = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
  const nodesA = a.getRoot().listNodes()
  const nodesB = b.getRoot().listNodes()
  assert('node count identical', nodesA.length === nodesB.length)
  const byName = new Map(nodesB.map((n) => [n.getName(), n]))
  let nodeOk = nodesA.length === nodesB.length
  let collapsed = 0
  for (const x of nodesA) {
    const y = byName.get(x.getName())
    if (!y) {
      nodeOk = false
      continue
    }
    for (const [prop, def] of Object.entries(DEFAULTS)) {
      const get = { translation: 'getTranslation', rotation: 'getRotation', scale: 'getScale' }[prop]
      const s = x[get]()
      const t = y[get]()
      if (eqArray(s, t)) continue
      const isCollapse =
        eqArray(t, def) && s.every((v, i) => Math.abs(v - def[i]) <= 1e-5)
      if (isCollapse) collapsed++
      else nodeOk = false
    }
  }
  assert(
    `node names + TRS identical (${collapsed} near-default components collapsed by the writer)`,
    nodeOk
  )

  const animA = a.getRoot().listAnimations()
  const animB = b.getRoot().listAnimations()
  assert('animation count identical', animA.length === animB.length)
  let curves = 0
  let animOk = animA.length === animB.length
  for (let i = 0; i < Math.min(animA.length, animB.length); i++) {
    const x = animA[i]
    const y = animB[i]
    if (x.getName() !== y.getName()) {
      animOk = false
      continue
    }
    const cx = x.listChannels()
    const cy = y.listChannels()
    if (cx.length !== cy.length) {
      animOk = false
      continue
    }
    for (let c = 0; c < cx.length; c++) {
      const sx = cx[c].getSampler()
      const sy = cy[c].getSampler()
      const same =
        cx[c].getTargetPath() === cy[c].getTargetPath() &&
        cx[c].getTargetNode()?.getName() === cy[c].getTargetNode()?.getName() &&
        sx.getInterpolation() === sy.getInterpolation() &&
        eqArray(sx.getInput()?.getArray(), sy.getInput()?.getArray()) &&
        eqArray(sx.getOutput()?.getArray(), sy.getOutput()?.getArray())
      if (!same) animOk = false
      curves++
    }
  }
  assert(`animation curves byte-identical (${curves} channels)`, animOk)

  const matA = a.getRoot().listMaterials()
  const matB = b.getRoot().listMaterials()
  assert(
    'materials identical',
    matA.length === matB.length &&
      matA.every((m, i) => {
        const o = matB[i]
        return (
          m.getName() === o.getName() &&
          m.getAlphaMode() === o.getAlphaMode() &&
          m.getDoubleSided() === o.getDoubleSided() &&
          eqArray(m.getBaseColorFactor(), o.getBaseColorFactor()) &&
          m.getRoughnessFactor() === o.getRoughnessFactor() &&
          m.getMetallicFactor() === o.getMetallicFactor()
        )
      })
  )
  const texA = a.getRoot().listTextures()
  const texB = b.getRoot().listTextures()
  assert(
    'texture bytes identical',
    texA.length === texB.length && texA.every((t, i) => eqArray(t.getImage(), texB[i].getImage()))
  )

  // And the thing that MUST have changed, or the stage did nothing.
  assert('WEIGHTS_0 actually changed', !eqArray(pa.getAttribute('WEIGHTS_0').getArray(), pb.getAttribute('WEIGHTS_0').getArray()))

  return checks
}

function parseArgs(argv) {
  const opts = { src: RAW_SRC, out: REBOUND_OUT, stem: null, shirt: false, selfTest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--src') opts.src = path.resolve(argv[++i])
    else if (a === '--out') opts.out = path.resolve(argv[++i])
    else if (a === '--table') opts.stem = path.resolve(argv[++i])
    else if (a === '--shirt') opts.shirt = true
    else if (a === '--self-test') opts.selfTest = true
  }
  return opts
}

/**
 * T118 — write the garment mask the solver holds out of the body solve.
 *
 * It lives beside the weight table rather than in the tree: it is a pure
 * function of the source (shirt-region.mjs is seed-driven and has no RNG), so
 * caching it would only create a second thing that can go stale.
 */
async function writeShirtMask(src, stem) {
  const doc = await new NodeIO().read(src)
  const { mask, report } = await shirtMask(doc)
  const file = `${stem}-shirt.bin`
  writeFileSync(file, Buffer.from(mask))
  console.log(
    `garment mask: ${report.triangles.toLocaleString()} of ${report.triangleTotal.toLocaleString()} triangles ` +
      `(${((100 * report.triangles) / report.triangleTotal).toFixed(2)}%), ${report.vertices.toLocaleString()} vertices, ` +
      `one component of ${report.shirtComponents[0].toLocaleString()}`
  )
  return file
}

async function run(opts) {
  const tableStem = path.join(tmpdir(), 'girl-rebind-table')
  const mask = opts.stem || !opts.shirt ? null : await writeShirtMask(opts.src, tableStem)
  const stem = opts.stem ?? solve(opts.src, tableStem, mask)
  const r = await transplant({ src: opts.src, out: opts.out, stem })
  const d = r.table.meta.diagnostics
  console.log(`wrote ${r.out}  (${r.bytes.toLocaleString()} B)`)
  console.log(
    `vertex-order proof: max position error ${(r.maxPosErr * 1000).toFixed(5)} mm over ${r.table.n.toLocaleString()} vertices`
  )
  console.log(
    `median dominant weight ${d.raw.median_dominant.toFixed(4)} (raw heat) → ${d.final.median_dominant.toFixed(4)} (final)`
  )
  console.log(`symmetry pass: ${d.symmetry.applied ? 'applied' : 'declined'} at ${d.symmetry.matched_pct}% matched`)
  const checks = await verifyTransplant(opts.src, r.out)
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
  if (checks.some((c) => !c.ok)) {
    process.exitCode = 1
    console.log('\nTRANSPLANT VERIFICATION FAILED — do not ship this file')
  }
  return r
}

async function selfTest() {
  if (!existsSync(RAW_SRC)) {
    console.log(`SKIP  ${RAW_SRC} absent — nothing to self-test.`)
    return
  }
  const out = path.join(tmpdir(), 'girl-v2-rebound-selftest.glb')
  await run({ src: RAW_SRC, out, stem: null, shirt: false })
  console.log(`\n(temp output: ${out} — not committed)`)
  console.log(process.exitCode === 1 ? 'SELF-TEST FAILED' : 'SELF-TEST PASSED')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selfTest) await selfTest()
  else await run(opts)
}
