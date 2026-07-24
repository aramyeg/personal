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
 *       019f93e1-…-d204da   → Jump_A         (small clean hop, lands home)
 *       019f93e2-…-9b734b   → Jump_B         (big leap, ends slightly elevated)
 *  2. STRIP every other clip (Running / Walking / Walking_Woman — payload hygiene).
 *  3. DE-DRIFT the locomotion clips flagged in DEDRIFT: freeze the root (Hips)
 *     translation to its bind value. Walk_Backward is a TRAVELLING clip — its root
 *     translates ~1.22u backward across the cycle (and snaps back at the loop
 *     seam). Our girl is fixed in place (the planet spins beneath her, her feet
 *     never travel), so that root motion would slide/snap her off her stance;
 *     zeroing it makes a clean in-place backward step. Its stride lives in the
 *     leg/spine rotations, untouched. Jump clips are NOT de-drifted: their
 *     vertical IS the hop.
 *  4. STAND UPRIGHT: v1's export was Y-up; the v2 Meshy export is Z-up, so with
 *     the world's fixed camera the 1.7u character renders lying down and reads as
 *     tiny collapsed fragments. When the tallest axis is Z, prepend a +90° X
 *     rotation to the scene root so she stands ~1.7u tall on +Y like v1 (rotates
 *     rig + skinned mesh together; the clips animate bones underneath and still
 *     play). Auto-detected + idempotent.
 *  5. prune() the accessors orphaned by the stripped clips, then write girl.glb.
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
import * as THREE from 'three'
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

/** The scene's top-level nodes (the rig lives under the first one). */
function sceneRoots(doc) {
  return doc.getRoot().listScenes().flatMap((s) => s.listChildren())
}

/** World-space bind-pose extent of the skinned mesh under the current root
 *  rotation. glTF places bind vertices in scene space (the inverse-bind cancels
 *  the joints' world matrices), so a vertex's rendered position is the accessor
 *  value rotated by the root — apply that rotation to read the TRUE standing box. */
function worldBindExtent(doc) {
  const roots = sceneRoots(doc)
  const q = new THREE.Quaternion(...(roots[0] ? roots[0].getRotation() : [0, 0, 0, 1]))
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const v = new THREE.Vector3()
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const a = pos.getArray()
      for (let i = 0; i < a.length; i += 3) {
        v.set(a[i], a[i + 1], a[i + 2]).applyQuaternion(q)
        for (const [k, c] of [v.x, v.y, v.z].entries()) {
          min[k] = Math.min(min[k], c)
          max[k] = Math.max(max[k], c)
        }
      }
    }
  }
  return { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] }
}

/**
 * Stand the character up along +Y. v1's export was Y-up (height on Y); the v2
 * Meshy export is Z-up — its 1.7u height lies along Z, so with the world's
 * fixed camera she renders lying down and reads as tiny collapsed fragments.
 * When the tallest axis is Z (not Y), prepend a +90° X rotation to the scene
 * root(s) — this rotates the rig AND the skinned mesh together (the clips animate
 * bones underneath, so they still play correctly). Idempotent: once Y is the
 * tallest axis the check skips. Returns whether it rotated + the standing box.
 */
function standUpright(doc) {
  const before = worldBindExtent(doc)
  if (before.y >= before.z && before.y >= before.x) return { applied: false, extent: before }
  const q90 = new THREE.Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2) // +90° about X
  for (const node of sceneRoots(doc)) {
    const r = new THREE.Quaternion(...node.getRotation()).premultiply(q90)
    const t = new THREE.Vector3(...node.getTranslation()).applyQuaternion(q90)
    node.setRotation([r.x, r.y, r.z, r.w])
    node.setTranslation([t.x, t.y, t.z])
  }
  return { applied: true, extent: worldBindExtent(doc) }
}

/**
 * @param {object} opts
 * @param {string} opts.src  raw multi-clip export (girl-v2.glb)
 * @param {string} opts.out  shipping girl.glb to write
 * @returns {Promise<{out:string, animations:string[], stripped:string[], dedrifted:string[], oriented:boolean, height:number, meshes:number}>}
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

  const orient = standUpright(doc)

  await doc.transform(prune())
  await io.write(out, doc)

  const reloaded = await new NodeIO().read(out)
  const rRoot = reloaded.getRoot()
  return {
    out,
    animations: rRoot.listAnimations().map((a) => a.getName()),
    stripped,
    dedrifted,
    oriented: orient.applied,
    height: worldBindExtent(reloaded).y,
    meshes: rRoot.listMeshes().length,
  }
}

/** Largest world-space travel of the root joint across a clip (max of the three
 *  axis spans) — the orientation-independent metric that exposes the Walk_Backward
 *  root motion (huge before, ~0 after the freeze). */
async function rootTravelSpan(path, clipName) {
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
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    const p = new THREE.Vector3()
    for (let i = 0; i < v.length; i += 3) {
      p.set(v[i], v[i + 1], v[i + 2]).applyMatrix4(arm)
      for (const [k, c] of [p.x, p.y, p.z].entries()) {
        min[k] = Math.min(min[k], c)
        max[k] = Math.max(max[k], c)
      }
    }
    return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
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

  // Orientation: the v2 export is Z-up; output must stand ~1.7u tall on +Y.
  assert(`stood upright (Z-up export corrected)`, result.oriented === true)
  assert(
    `standing height ~1.7u on +Y (${result.height.toFixed(3)}u)`,
    Math.abs(result.height - 1.7) < 0.05
  )

  const beforeSpan = await rootTravelSpan(DEFAULT_SRC, 'Walk_Backward')
  const afterSpan = await rootTravelSpan(out, 'Walk_Backward')
  assert(
    `Walk_Backward root motion neutralized (${beforeSpan.toFixed(3)}u → ${afterSpan.toFixed(3)}u)`,
    beforeSpan > 0.5 && afterSpan < 1e-6
  )

  // Idempotency: re-running over the canonical output changes nothing (slots
  // stable, no extra rotation — height stays ~1.7u, not re-tipped).
  const rerun = await canonicalizeGirl({ src: out, out })
  assert(
    `idempotent re-run keeps slots + stays upright (${rerun.height.toFixed(3)}u, oriented=${rerun.oriented})`,
    set(rerun.animations) === set(SHIPPED_SLOTS) &&
      rerun.stripped.length === 0 &&
      rerun.oriented === false &&
      Math.abs(rerun.height - 1.7) < 0.05
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
    console.log(`stood upright: ${result.oriented}  standing height: ${result.height.toFixed(3)}u`)
  }
}
