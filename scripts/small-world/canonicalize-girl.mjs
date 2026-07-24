#!/usr/bin/env node
/**
 * canonicalize-girl.mjs — turn Aram's raw Meshy multi-clip export (girl-v2.glb)
 * into the shipping girl.glb the animation machine expects.
 *
 * Aram now exports every clip on ONE rigged asset in a SINGLE GLB (unlike the
 * per-clip workflow merge-clips.mjs handles). girl-v2.glb carries 8 clips on the
 * shared 24-joint rig; this script produces girl.glb by:
 *
 *  1. RENAME each wanted clip to its canonical slot (girl-anim.ts names):
 *       Skip_Forward        → Skip_Forward   (forward travel; already canonical)
 *       Happy_Sway_Standing → Idle           (his "idle happy sway")
 *       Walk_Backward       → Walk_Backward  (already canonical)
 *       019f93e1-…-d204da   → Jump_A         (small clean hop, apex +0.06u, lands home)
 *       019f93e2-…-9b734b   → Jump_B         (big leap, apex +0.16u, ends +0.07u up)
 *  2. STRIP every other clip (Running / Walking / Walking_Woman — payload hygiene).
 *  3. DE-DRIFT the locomotion clips flagged in DEDRIFT: freeze the root (Hips)
 *     translation to its bind value. Walk_Backward shipped with a broken 1.22u
 *     monotone vertical root drift (hips sink straight through the floor, hard
 *     non-looping seam) — zeroing the root translation makes it a clean in-place
 *     backward cycle for our fixed-in-place girl (the planet, not her feet,
 *     provides travel). Its step motion lives in the leg/spine rotations, which
 *     are untouched. Jump clips are NOT de-drifted: their vertical IS the hop.
 *  4. prune() the accessors orphaned by the stripped clips, then write girl.glb.
 *
 * The mesh / material / skin / texture are the same restyled character and pass
 * straight through — toonifyGirl re-materials them at load, unchanged.
 *
 * USAGE
 *   node scripts/small-world/canonicalize-girl.mjs
 *       Reads public/labs/small-world/girl-v2.glb, writes girl.glb (the sanctioned
 *       action). Does NOT stage anything; commit girl.glb yourself.
 *
 *   node scripts/small-world/canonicalize-girl.mjs --src X.glb --out Y.glb
 *       Override the source/destination paths.
 *
 *   node scripts/small-world/canonicalize-girl.mjs --self-test
 *       Canonicalize girl-v2.glb into a temp file, assert the contract, then
 *       re-run over the output and assert it is idempotent. Touches no committed
 *       file. Skips silently if the v2 source is absent.
 *
 * Determinism: read / rename / dispose / constant-fill / prune / write are pure
 * functions of the input (no wall-clock, no RNG). Same GLB in → identical out.
 */
import { NodeIO } from '@gltf-transform/core'
import { prune } from '@gltf-transform/functions'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Source clip name → canonical slot. Canonical names map to themselves so a
 *  re-run over an already-canonical girl.glb is a no-op (idempotency). */
export const CANONICAL = {
  Skip_Forward: 'Skip_Forward',
  Happy_Sway_Standing: 'Idle',
  Idle: 'Idle',
  Walk_Backward: 'Walk_Backward',
  '019f93e1-9b5a-770c-8e20-0e3ad4d204da': 'Jump_A',
  Jump_A: 'Jump_A',
  '019f93e2-9461-703f-988c-ec193d9b734b': 'Jump_B',
  Jump_B: 'Jump_B',
}

/** Canonical clips whose root (Hips) translation is frozen to bind — see step 3.
 *  Keyed by the CANONICAL slot name so it survives the rename. */
export const DEDRIFT = new Set(['Walk_Backward'])

/** The clips girl.glb must end up with, as a set (order-independent). */
export const SHIPPED_SLOTS = ['Skip_Forward', 'Idle', 'Walk_Backward', 'Jump_A', 'Jump_B']

const DEFAULT_SRC = 'public/labs/small-world/girl-v2.glb'
const DEFAULT_OUT = 'public/labs/small-world/girl.glb'

/** The root joint of a skin (the one whose parent is not itself a joint). */
function rootJoint(doc) {
  const skin = doc.getRoot().listSkins()[0]
  if (!skin) return null
  const joints = new Set(skin.listJoints())
  for (const j of skin.listJoints()) {
    const parent = j.listParents().find((p) => p.propertyType === 'Node')
    if (!parent || !joints.has(parent)) return j
  }
  return skin.listJoints()[0] ?? null
}

/** Overwrite a clip's root-translation samplers with the bind translation, so
 *  the root pumps in place instead of drifting. Fresh accessor per channel keeps
 *  us from mutating anything shared; the old outputs prune away. */
function freezeRootTranslation(doc, anim, root) {
  if (!root) return
  const bind = root.getTranslation()
  for (const channel of anim.listChannels()) {
    if (channel.getTargetNode() !== root || channel.getTargetPath() !== 'translation') continue
    const sampler = channel.getSampler()
    const input = sampler.getInput()
    const keys = input ? input.getArray().length : 0
    const flat = new Float32Array(keys * 3)
    for (let i = 0; i < keys; i++) {
      flat[i * 3] = bind[0]
      flat[i * 3 + 1] = bind[1]
      flat[i * 3 + 2] = bind[2]
    }
    const frozen = doc
      .createAccessor(`${anim.getName()}_root_frozen`)
      .setType('VEC3')
      .setArray(flat)
    sampler.setOutput(frozen)
  }
}

/**
 * @param {object} opts
 * @param {string} opts.src  raw multi-clip export (girl-v2.glb)
 * @param {string} opts.out  shipping girl.glb to write
 * @returns {Promise<{out:string, animations:string[], stripped:string[], dedrifted:string[], meshes:number}>}
 */
export async function canonicalizeGirl({ src, out }) {
  const io = new NodeIO()
  const doc = await io.read(src)
  const root = doc.getRoot()
  const hips = rootJoint(doc)

  const stripped = []
  const dedrifted = []

  for (const anim of root.listAnimations()) {
    const slot = CANONICAL[anim.getName()]
    if (!slot) {
      stripped.push(anim.getName())
      anim.dispose()
      continue
    }
    anim.setName(slot)
    if (DEDRIFT.has(slot)) {
      freezeRootTranslation(doc, anim, hips)
      dedrifted.push(slot)
    }
  }

  await doc.transform(prune())
  await io.write(out, doc)

  const reloaded = await new NodeIO().read(out)
  const rRoot = reloaded.getRoot()
  return {
    out,
    animations: rRoot.listAnimations().map((a) => a.getName()),
    stripped,
    dedrifted,
    meshes: rRoot.listMeshes().length,
  }
}

/** Peak-to-trough world-space vertical travel of the root joint over a clip —
 *  the metric that exposes the Walk_Backward drift (huge before, ~0 after). */
async function rootVerticalSpan(path, clipName) {
  const THREE = await import('three')
  const doc = await new NodeIO().read(path)
  const hips = rootJoint(doc)
  const anim = doc.getRoot().listAnimations().find((a) => a.getName() === clipName)
  if (!hips || !anim) return null
  // Compose the transform of every node above the root joint (the armature).
  const chain = []
  let cur = hips
  while (cur) {
    chain.push(cur)
    cur = cur.listParents().find((p) => p.propertyType === 'Node') ?? null
  }
  const arm = new THREE.Matrix4()
  for (const n of chain.slice(1).reverse()) {
    arm.multiply(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...n.getTranslation()),
        new THREE.Quaternion(...n.getRotation()),
        new THREE.Vector3(...n.getScale())
      )
    )
  }
  for (const ch of anim.listChannels()) {
    if (ch.getTargetNode() !== hips || ch.getTargetPath() !== 'translation') continue
    const v = ch.getSampler().getOutput().getArray()
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < v.length; i += 3) {
      const y = new THREE.Vector3(v[i], v[i + 1], v[i + 2]).applyMatrix4(arm).y
      min = Math.min(min, y)
      max = Math.max(max, y)
    }
    return max - min
  }
  return 0
}

/** Parse `--src`, `--out`, `--self-test` from argv. */
function parseArgs(argv) {
  const opts = { src: DEFAULT_SRC, out: DEFAULT_OUT, selfTest: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--src') opts.src = argv[++i]
    else if (a === '--out') opts.out = argv[++i]
    else if (a === '--self-test') opts.selfTest = true
  }
  return opts
}

/**
 * Self-test: canonicalize girl-v2.glb → temp, assert the shipped contract, then
 * re-run over the output and assert idempotency. Writes only to a temp file.
 */
async function selfTest() {
  if (!existsSync(DEFAULT_SRC)) {
    console.log(`SKIP  ${DEFAULT_SRC} absent — nothing to self-test.`)
    return
  }
  const out = join(tmpdir(), 'girl-canon-selftest.glb')
  const result = await canonicalizeGirl({ src: DEFAULT_SRC, out })

  const checks = []
  const assert = (label, ok) => {
    checks.push({ label, ok })
    if (!ok) process.exitCode = 1
  }
  const set = (arr) => [...arr].sort().join(',')
  assert(
    `exactly the shipped slots present [${result.animations.sort().join(', ')}]`,
    set(result.animations) === set(SHIPPED_SLOTS)
  )
  assert(`extras stripped [${result.stripped.join(', ')}]`, result.stripped.length > 0)
  assert(`Walk_Backward de-drifted`, result.dedrifted.includes('Walk_Backward'))
  assert(`single mesh (not duplicated) — ${result.meshes}`, result.meshes === 1)

  const beforeSpan = await rootVerticalSpan(DEFAULT_SRC, 'Walk_Backward')
  const afterSpan = await rootVerticalSpan(out, 'Walk_Backward')
  assert(
    `Walk_Backward root drift neutralized (${beforeSpan.toFixed(3)}u → ${afterSpan.toFixed(3)}u)`,
    beforeSpan > 0.5 && afterSpan < 1e-6
  )

  // Idempotency: re-running over the canonical output changes nothing.
  const rerun = await canonicalizeGirl({ src: out, out })
  assert(
    `idempotent re-run keeps the slot set`,
    set(rerun.animations) === set(SHIPPED_SLOTS) && rerun.stripped.length === 0
  )

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
  console.log(`\n(temp output: ${out} — not committed)`)
  console.log(process.exitCode === 1 ? '\nSELF-TEST FAILED' : '\nSELF-TEST PASSED')
}

// CLI entry — only when run directly, not when imported by a test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selfTest) {
    await selfTest()
  } else {
    const result = await canonicalizeGirl(opts)
    console.log(`wrote ${result.out}`)
    console.log(`animations: [${result.animations.join(', ')}]  meshes: ${result.meshes}`)
    console.log(`stripped: [${result.stripped.join(', ')}]`)
    console.log(`de-drifted root translation: [${result.dedrifted.join(', ')}]`)
  }
}
