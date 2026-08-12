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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
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
  // T113's export names the backward cycle `Walk_Backward_inplace` and ships it
  // with the root motion already baked out (per-axis Hips span 2.8/3.6/3.2 cm —
  // all bounce, no travel), where the previous export travelled 1.22 u. Same
  // slot, so the rename absorbs it and DEDRIFT no longer has anything to do.
  Walk_Backward_inplace: 'Walk_Backward',
  // T110 shipped the source's spare Walking/Running clips as a slow and a fast
  // gear either side of the skip; T112 removed the gears on Aram's verdict that
  // he preferred the always-skipping version. A clip nothing can select is
  // weight on the wire and nothing else, so the two slots are gone from this
  // table rather than kept "in case" — the source still carries them, and
  // re-adding two lines is the whole cost of changing our mind. Note that
  // stripping them is not free of consequence for the OTHER clips: they shared
  // sampler accessors, so `prune()` now reclaims that data too.
  '019f93e1-9b5a-770c-8e20-0e3ad4d204da': 'Jump_A',
  Jump_A: 'Jump_A',
  '019f93e2-9461-703f-988c-ec193d9b734b': 'Jump_B',
  Jump_B: 'Jump_B',
  // The standing broad jump Aram exported for the planet exit. Identified by
  // trajectory, not by name (the name is a bare UUID): crouch to 0.570 u, apex
  // 1.1024 u at clip fraction 0.528, 71 of 90 frames airborne-or-rising, and
  // +0.266 u of forward travel — a jump that goes SOMEWHERE, unlike Jump_B's
  // near-vertical celebrate leap. See girl-exit.ts.
  '019ff2cd-967b-79e7-9ae0-0f0a73ae3227': 'Jump_Off',
  Jump_Off: 'Jump_Off',
}

/** Canonical clips whose root (Hips) translation is frozen to bind — see step 3.
 *  Keyed by the CANONICAL slot name so it survives the rename.
 *
 *  Only Walk_Backward travels. Measured per-axis Hips spans over the whole cycle
 *  (armature space, cm): Walk_Backward X 3.2 / Y 121.8 / Z 3.3 — the Y is a
 *  metre of real travel. Walking 6.2/5.1/7.1, Walking_Woman 5.3/3.9/4.6 and
 *  Running 2.1/5.8/7.1 are in-place cycles whose largest span is the vertical
 *  bounce (Z is up in the Z-up source), the same shape as Skip_Forward's
 *  6.0/3.7/25.3 hop — which has never been de-drifted. So the three new
 *  locomotion clips keep their root exactly as authored: freezing them would
 *  flatten the bounce that IS the gait.
 *
 *  T113 EMPTIES THIS SET, and the reason is a property of the source, not a
 *  change of mind. Aram's new export ships the backward cycle as
 *  `Walk_Backward_inplace` with the travel already baked out: per-axis Hips
 *  spans 2.8 / 3.6 / 3.2 cm, no axis anywhere near the 121.8 cm that made the
 *  freeze necessary. Every one of those spans is bounce. Freezing it now would
 *  do to the backward walk exactly what the note above refuses to do to the
 *  other cycles — flatten the gait — so nothing is de-drifted. The machinery
 *  stays because the next export may travel again; the LAW that Walk_Backward
 *  must not travel in the shipped file is asserted in selfTest() against the
 *  OUTPUT, which holds whether the source arrives travelling or in place. */
export const DEDRIFT = new Set()

/**
 * CORRECTIVE LEG OFFSETS — the T110 fix for the interpenetration census (T107).
 *
 * Three of the five shipped clips drove the legs through each other on nearly
 * every frame: Idle 301/301 (worst depth 6.02 cm), Skip_Forward 71/87 (8.39 cm),
 * Walk_Backward 28/28 (6.33 cm). The rig and the mesh are NOT at fault — the
 * bind pose has zero leg-vs-leg intersection and the library's `Walking` clip is
 * clean on this same skeleton — so the defect is per-clip keyframes, and the
 * cheapest correct fix is an additive offset rather than 416 hand-keyed frames.
 *
 * The offset is stated as a DISTANCE, not an angle, and that is the whole
 * design. A constant-angle abduction about a fixed hip axis was tried first and
 * is provably the wrong instrument: rotating a leg by θ about the pelvis's
 * fore-aft axis displaces the ankle by θ·L·cos(swing), so it separates a leg
 * that hangs down and does almost NOTHING for a leg swung far forward — which
 * is exactly the pose a skip spends its time in. Measured: a constant 5°
 * abduction improved Idle but drove Skip_Forward's deepest shin×foot hit from
 * 5.34 cm to 11.06 cm.
 *
 * So the axis is recomputed per frame. For a leg whose current hip→ankle vector
 * in Hips space is p, the rotation that displaces the ankle along the lateral
 * direction t̂ is about û = normalize(p̂ × t̂), and the angle that buys exactly
 * `splayCm` of that displacement is θ = d / (|p|·√(1−(p̂·t̂)²)). It reduces to
 * the plain abduction when the leg hangs, and it keeps its full effect when the
 * leg is swung — the ankle moves `splayCm` outward in every pose. Hips-local
 * axes come from the bind offsets (LeftUpLeg at +11.31 cm on Y, RightUpLeg at
 * −9.20 cm), so +Y is the character's left and t̂ is +Y for the left leg, −Y for
 * the right.
 *
 * Constant splay, not ramped: the offending ranges are 100% / 82% / 100% of
 * their clips, so a windowed offset would buy nothing and would pop at the
 * window edges.
 *
 * THE DISTANCES ARE LARGER THAN THE DEPTHS THEY CLEAR, and that is a finding
 * rather than a slack safety margin. The response is a threshold, not a slope:
 * Idle's deepest hit is 6.02 cm and moves only to 5.74 cm under 3.4 cm of
 * splay, sits at 2.15 cm under 6 cm, and reaches zero at 9 cm. The reason is
 * that these overlaps are trouser volume, not limb volume — the trousers are
 * very baggy and are modelled to just clear at the BIND stance, whose ankles
 * are 28.6 cm apart, while the stock Idle brings them to 10.4 cm. So the splay
 * that fixes a clip is the one that restores roughly the stance the garment was
 * built for, and the per-clip values below are each the measured minimum that
 * reaches zero (Skip_Forward's 12 cm leaves one frame of zero-depth contact —
 * surfaces touching, nothing inside anything).
 *
 * That is a real stance change up close, and it was gated at the size that
 * matters instead of being argued about: rendered at the lab's own framing
 * (1.198 units tall, 9.9 units away, 38° FOV → 158 px in a 900 px frame) the
 * corrected and uncorrected figures are indistinguishable, while the close-up
 * goes from two trouser legs fused into one pink mass with the shoes merged
 * into a single white blob, to two legs and two shoes. Because the correction
 * rotates the leg about the hip socket the sole also rises by L(1−cos θ), which
 * the foot-plant check measures rather than assumes.
 *
 * Keyed by CANONICAL slot, applied after the rename. Gated by `bl_census2.py`
 * (zero overlaps) and by the foot-plant diff — see task-110-report.md.
 *
 * T113 EMPTIES THIS TABLE, and empty is a derived answer here rather than a
 * deferral. The values above (9 / 12 / 10 cm) are stated against the convention
 * that +Y in Hips space is the character's LEFT. This export's skeleton family
 * INVERTS that: the old rig put LeftUpLeg at +11.31 on Y, this one puts it at
 * −5.02 (T112, rigdiff.mjs). Carried over unchanged, every value would pull the
 * legs INTO each other — strictly worse than no correction at all. So the
 * choice is not "correct vs uncorrected", it is "uncorrected vs miscorrected",
 * and uncorrected wins until a census on THIS rig says otherwise.
 *
 * The census is owed, and T112 recorded the reason to expect a small answer:
 * at the bind pose the old trousers read as one fused pink mass with no gap
 * between the legs, while this body's read as two separate legs with daylight
 * between them. A garment whose rest stance already clears is a garment whose
 * clips have less to clear. Derive it; do not assume either way, and do not
 * re-use a single digit from the block above.
 */
export const LEG_CORRECTIONS = {}

/** The clips girl.glb must end up with, as a set (order-independent). */
export const SHIPPED_SLOTS = ['Skip_Forward', 'Idle', 'Walk_Backward', 'Jump_A', 'Jump_B', 'Jump_Off']

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
 * Pre-multiply a constant rotation onto every rotation key of one bone in one
 * clip — the additive corrective layer described at LEG_CORRECTIONS.
 *
 * Pre- rather than post-multiplication is what makes the offset a hip-socket
 * abduction: `q_offset ⊗ q_key` rotates the bone (and its whole subtree — shin,
 * foot, toe) about the joint origin in the PARENT's frame, which is the frame
 * the axis was derived in. Post-multiplying would instead twist the leg about
 * its own already-animated axis, which changes meaning frame to frame.
 *
 * A fresh accessor per channel: sampler outputs can be shared between clips, so
 * writing in place would silently corrupt a clip that is meant to stay untouched
 * (Jump_A/Jump_B are clean and must remain bit-identical). The old outputs prune
 * away. Throws rather than skipping when a bone or channel is missing, or when
 * the interpolation is CUBICSPLINE (whose output is tangent-triples, not plain
 * rotations) — a silent no-op here would ship the defect while the report
 * claimed a fix.
 */
/** Largest corrective angle the splay is ever allowed to ask for. Only reachable
 *  when a leg points nearly straight out sideways (√(1−(p̂·t̂)²) → 0), a pose none
 *  of these clips contains; the clamp is there so a future clip cannot turn a
 *  3 cm request into a cartwheel. */
const MAX_SPLAY_RAD = (14 * Math.PI) / 180

/** The rotation channel targeting `node` in `anim`, or null. */
function rotationChannel(anim, node) {
  return (
    anim
      .listChannels()
      .find((c) => c.getTargetNode() === node && c.getTargetPath() === 'rotation') ?? null
  )
}

/**
 * A `time → local rotation` reader for one bone in one clip: the keyed rotation
 * where the bone is animated, its static node rotation where it is not. Linear
 * between keys, matching glTF LINEAR sampling, so the forward kinematics below
 * see the same pose the runtime will.
 */
function rotationReaderFor(anim, node) {
  const channel = rotationChannel(anim, node)
  if (!channel) {
    const fixed = new THREE.Quaternion(...node.getRotation())
    return { times: null, at: () => fixed.clone() }
  }
  const sampler = channel.getSampler()
  if (sampler.getInterpolation() === 'CUBICSPLINE') {
    throw new Error(
      `${anim.getName()}/${node.getName()}: CUBICSPLINE rotation cannot take a corrective offset`
    )
  }
  const times = sampler.getInput().getArray()
  const values = sampler.getOutput().getArray()
  const step = sampler.getInterpolation() === 'STEP'
  const get = (i) =>
    new THREE.Quaternion(values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3])
  const at = (t) => {
    if (t <= times[0]) return get(0)
    const last = times.length - 1
    if (t >= times[last]) return get(last)
    let hi = 1
    while (hi < last && times[hi] < t) hi++
    if (step) return get(hi - 1)
    const span = times[hi] - times[hi - 1]
    return get(hi - 1).slerp(get(hi), span > 0 ? (t - times[hi - 1]) / span : 0)
  }
  return { times, values, channel, sampler, at }
}

/** Local TRS of a node with its rotation overridden by the sampled one. */
function localMatrix(node, rotation) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...node.getTranslation()),
    rotation,
    new THREE.Vector3(...node.getScale())
  )
}

/**
 * Splay ONE leg outward by a fixed lateral distance across a whole clip — the
 * per-frame corrective described at LEG_CORRECTIONS.
 *
 * Per key: run forward kinematics down UpLeg → Leg → Foot with the clip's own
 * rotations to find where the ankle currently sits relative to the hip socket
 * (all in Hips space, the UpLeg's parent frame), solve for the rotation that
 * slides that ankle `splayCm` along the outward lateral direction, and
 * PRE-multiply it onto the UpLeg's key. Pre- rather than post-multiplication is
 * what makes it a hip-socket rotation of the whole leg — shin, foot and toe ride
 * along, so the limb stays rigid and only its plane moves.
 *
 * A fresh accessor: sampler outputs can be shared between clips, so writing in
 * place would corrupt a clip meant to stay untouched (Jump_A/Jump_B are already
 * clean and must stay bit-identical). The old outputs prune away.
 */
/**
 * How many WORLD units one unit of a bone's local space is worth — the factor
 * that turns a splay stated in centimetres into the rig's own numbers.
 *
 * It is not 1 and it is not guessable: this export nests the rig under an
 * armature scaled by 0.01, so bone coordinates are centimetres while the scene
 * is metres (the character measures 170 bone units and renders 1.70 world units
 * tall). Deriving it from the chain rather than hardcoding 0.01 means a
 * re-export in different units corrects by the same distance instead of
 * silently by 100× too little — which is exactly the bug this replaced, caught
 * only because the ankles moved 0.34 mm instead of 3.4 cm.
 */
function boneUnitInWorld(node) {
  const s = new THREE.Vector3(1, 1, 1)
  for (let n = node; n; n = n.listParents().find((p) => p.propertyType === 'Node') ?? null) {
    s.multiply(new THREE.Vector3(...n.getScale()))
  }
  const avg = (s.x + s.y + s.z) / 3
  if (Math.abs(s.x - avg) > 1e-6 || Math.abs(s.y - avg) > 1e-6 || Math.abs(s.z - avg) > 1e-6) {
    throw new Error(`non-uniform rig scale ${s.toArray()} — a splay distance is meaningless`)
  }
  return avg
}

function splayLeg(doc, anim, joints, side, splayCm) {
  const upLeg = joints.get(`${side}UpLeg`)
  const shin = joints.get(`${side}Leg`)
  const foot = joints.get(`${side}Foot`)
  for (const [name, n] of [[`${side}UpLeg`, upLeg], [`${side}Leg`, shin], [`${side}Foot`, foot]]) {
    if (!n) throw new Error(`rig has no joint named ${name}`)
  }
  const up = rotationReaderFor(anim, upLeg)
  if (!up.times) throw new Error(`${anim.getName()}: no rotation channel targets ${side}UpLeg`)
  const readShin = rotationReaderFor(anim, shin)
  const readFoot = rotationReaderFor(anim, foot)

  // Outward lateral direction in Hips space: +Y is the character's left.
  const outward = new THREE.Vector3(0, side === 'Left' ? 1 : -1, 0)
  // splayCm is a real-world distance; the rig thinks in its own units.
  const d = splayCm / 100 / boneUnitInWorld(upLeg)
  const out = new Float32Array(up.values.length)
  const stats = { maxDeg: 0, minReach: Infinity }

  for (let i = 0; i < up.times.length; i++) {
    const t = up.times[i]
    const qUp = new THREE.Quaternion(
      up.values[i * 4],
      up.values[i * 4 + 1],
      up.values[i * 4 + 2],
      up.values[i * 4 + 3]
    )
    // Ankle position in Hips space, then the hip→ankle vector.
    const m = localMatrix(upLeg, qUp)
      .multiply(localMatrix(shin, readShin.at(t)))
      .multiply(localMatrix(foot, readFoot.at(t)))
    const ankle = new THREE.Vector3().setFromMatrixPosition(m)
    const hip = new THREE.Vector3(...upLeg.getTranslation())
    const p = ankle.sub(hip)
    const len = p.length()
    const dir = p.clone().divideScalar(len)
    // Displacement per radian along t̂ is |p|·√(1−(p̂·t̂)²) — zero only for a leg
    // pointing straight out sideways, which the clamp below covers.
    const reach = len * Math.sqrt(Math.max(0, 1 - dir.dot(outward) ** 2))
    const theta = Math.min(MAX_SPLAY_RAD, reach > 1e-6 ? d / reach : MAX_SPLAY_RAD)
    const axis = new THREE.Vector3().crossVectors(dir, outward)
    const q =
      axis.lengthSq() > 1e-12
        ? new THREE.Quaternion().setFromAxisAngle(axis.normalize(), theta)
        : new THREE.Quaternion()
    qUp.premultiply(q)
    out[i * 4] = qUp.x
    out[i * 4 + 1] = qUp.y
    out[i * 4 + 2] = qUp.z
    out[i * 4 + 3] = qUp.w
    stats.maxDeg = Math.max(stats.maxDeg, (theta * 180) / Math.PI)
    stats.minReach = Math.min(stats.minReach, reach)
  }

  up.sampler.setOutput(
    doc
      .createAccessor(`${anim.getName()}_${side}UpLeg_splayed`)
      .setType('VEC4')
      .setArray(out)
  )
  return stats
}

/**
 * Apply the whole corrective table to a renamed document. Returns one line per
 * corrected clip for the caller's report. Bones are found by joint name on the
 * skin, so a re-export that renamed the rig fails loudly here instead of
 * silently shipping the defect.
 */
function applyLegCorrections(doc, table) {
  const skin = doc.getRoot().listSkins()[0]
  const joints = new Map((skin?.listJoints() ?? []).map((j) => [j.getName(), j]))
  const applied = []
  for (const anim of doc.getRoot().listAnimations()) {
    const fix = table[anim.getName()]
    if (!fix || !fix.splayCm) continue
    const l = splayLeg(doc, anim, joints, 'Left', fix.splayCm)
    const r = splayLeg(doc, anim, joints, 'Right', fix.splayCm)
    applied.push(
      `${anim.getName()}: splay ${fix.splayCm}cm/leg (max ${Math.max(l.maxDeg, r.maxDeg).toFixed(2)}°)`
    )
  }
  return applied
}

/**
 * MATERIAL HYGIENE (T110 E1). The export ships one material flagged
 * `alphaMode: BLEND` + `doubleSided: true`, and neither flag is earning its
 * cost: alpha-blending puts the whole character into the transparent pass (depth
 * sorting per draw, and self-sorting artifacts where hair crosses shoulder), and
 * two-sided rendering doubles her fill.
 *
 * Measured before flipping either — `scratchpad/t110/probe.mjs` reads the 2048²
 * baseColor and histograms its alpha channel: **4,194,065 of 4,194,304 pixels
 * are alpha 255 (99.9943%)**, the remaining 239 sit between 128 and 254, and
 * **not one pixel is alpha 0**. There is no lash mask, no cutout, nothing that
 * the transparent pass exists to draw — the 239 are PNG encoder noise at atlas
 * island borders. So OPAQUE loses nothing visible, and MASK would be a cutoff
 * chosen to preserve noise.
 *
 * Re-run that probe after any re-export: a Meshy re-export that DID carry a real
 * alpha mask would need MASK with a measured cutoff instead, and this flip is
 * the one step in the pipeline whose precondition lives outside the file.
 */
function makeOpaque(doc) {
  const changed = []
  for (const mat of doc.getRoot().listMaterials()) {
    const before = `${mat.getAlphaMode()}/doubleSided=${mat.getDoubleSided()}`
    mat.setAlphaMode('OPAQUE')
    mat.setDoubleSided(false)
    changed.push(`${mat.getName()}: ${before} → OPAQUE/doubleSided=false`)
  }
  return changed
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
export async function canonicalizeGirl({ src, out, corrections = LEG_CORRECTIONS }) {
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

  const corrected = applyLegCorrections(doc, corrections)
  const opaque = makeOpaque(doc)
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
    corrected,
    opaque,
    oriented: orient.applied,
    height: worldBindExtent(reloaded).y,
    meshes: rRoot.listMeshes().length,
  }
}

/**
 * NET drift of the root across a clip: how far the last key sits from the
 * first, in world units. This is the discriminator rootTravelSpan() is NOT.
 *
 * The span metric answers "how much did the root move at all", which conflates
 * a metre of walking with the vertical hop that IS a skip and the lateral
 * weight-shift that IS an idle sway — Skip_Forward spans 0.219 u and Idle
 * 0.225 u without either going anywhere. Net drift separates them cleanly,
 * because a cycle that returns to its own start closes the loop no matter how
 * far it travelled in between: measured on real exports, the travelling
 * backward walk drifts 1.219 u while Skip_Forward drifts 0.001 u and Idle
 * 0.000 u. Three orders of magnitude, not a judgement call.
 */
async function rootNetDrift(path, clipName) {
  const doc = await new NodeIO().read(path)
  const hips = rootJoint(doc)
  const anim = doc.getRoot().listAnimations().find((a) => a.getName() === clipName)
  if (!hips || !anim) return null
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
    if (v.length < 6) return 0
    const first = new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(arm)
    const last = new THREE.Vector3(v[v.length - 3], v[v.length - 2], v[v.length - 1]).applyMatrix4(arm)
    return first.distanceTo(last)
  }
  return 0
}

/**
 * Open a GLB the way the app does — three.js GLTFLoader, real skeleton — and
 * hand back a `measure(clip, timeFrac)` that returns the TRUE skinned world
 * bounding box (bones × inverse-bind × bind matrix, exactly what the GPU draws).
 *
 * This is the invariant `worldBindExtent()` cannot see. That one rotates the
 * POSITION accessor by the root quaternion — a proxy. It happens to match the
 * render for this asset, but it would still read ~1.7u for an export whose
 * skeleton was NOT carried by the rotated root (she would then render lying
 * down / collapsed, the Round-13 eye-test failure). Measuring the actual skinned
 * mesh — at rest AND across each shipped clip — is what closes that gap, so a
 * Z-up or collapsed re-export fails the self-test instead of shipping silently.
 *
 * Textures are stripped in memory first: GLTFLoader's image path needs a DOM
 * (`self`), absent in Node — geometry and skeleton do not, so dropping the
 * images lets it parse headless. Loads once; poses are cheap re-evaluations.
 */
async function openSkinned(path) {
  const doc = await new NodeIO().read(path)
  for (const tex of doc.getRoot().listTextures()) tex.dispose()
  const bin = await new NodeIO().writeBinary(doc)
  const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej))
  const scene = gltf.scene
  const skinned = []
  scene.traverse((o) => {
    if (o.isSkinnedMesh) skinned.push(o)
  })
  const mixer = new THREE.AnimationMixer(scene)
  const axes = ['X', 'Y', 'Z']
  const v = new THREE.Vector3()
  const size = new THREE.Vector3()
  /** @param {string|null} clip  @param {number} timeFrac 0..1 of the clip */
  const measure = (clip, timeFrac) => {
    mixer.stopAllAction()
    if (clip) {
      const a = gltf.animations.find((c) => c.name === clip)
      if (a) {
        const action = mixer.clipAction(a)
        action.reset().play()
        action.time = a.duration * timeFrac
        mixer.update(0)
      }
    }
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().makeEmpty()
    for (const sm of skinned) {
      sm.skeleton.update()
      const pos = sm.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i)
        sm.applyBoneTransform(i, v)
        v.applyMatrix4(sm.matrixWorld)
        box.expandByPoint(v)
      }
    }
    box.getSize(size)
    const tallest = axes[[size.x, size.y, size.z].indexOf(Math.max(size.x, size.y, size.z))]
    return { y: size.y, minY: box.min.y, tallest }
  }
  return { measure, animations: gltf.animations.map((a) => a.name) }
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
  assert(`single mesh (not duplicated) — ${result.meshes}`, result.meshes === 1)

  // T110 A: every clip the census found broken carries its corrective splay.
  // Named individually rather than counted, so deleting one entry from the
  // table fails here instead of quietly re-shipping that clip's interpenetration.
  for (const slot of Object.keys(LEG_CORRECTIONS)) {
    assert(
      `${slot} leg-splayed [${result.corrected.find((c) => c.startsWith(`${slot}:`)) ?? 'MISSING'}]`,
      result.corrected.some((c) => c.startsWith(`${slot}:`))
    )
  }

  // T110 E1: the material flip actually landed in the written file.
  {
    const doc = await new NodeIO().read(out)
    const bad = doc
      .getRoot()
      .listMaterials()
      .filter((m) => m.getAlphaMode() !== 'OPAQUE' || m.getDoubleSided())
    assert(`all materials OPAQUE + single-sided (${bad.length} offenders)`, bad.length === 0)
  }

  // Orientation: the v2 export is Z-up; output must stand ~1.7u tall on +Y.
  assert(`stood upright (Z-up export corrected)`, result.oriented === true)
  assert(
    `standing height ~1.7u on +Y (${result.height.toFixed(3)}u)`,
    Math.abs(result.height - 1.7) < 0.05
  )

  // The girl is fixed in place and the planet spins beneath her, so every
  // shipped CYCLE must close its own loop. Asserted on the OUTPUT only: a source
  // that travels must be de-drifted to get here, and a source that arrives in
  // place passes untouched, so the law holds across both export generations.
  //
  // Net drift, NOT span — the distinction cost a red self-test on the way in.
  // Span conflates travel with the hop that IS a skip (0.219 u) and the sway
  // that IS an idle (0.225 u); both of those return to where they started and
  // neither goes anywhere. The jumps are excluded because they are one-shots
  // that legitimately land somewhere else: Jump_Off carries her 0.266 u forward
  // off the planet, which is the whole point of it.
  for (const clip of ['Skip_Forward', 'Idle', 'Walk_Backward']) {
    const drift = await rootNetDrift(out, clip)
    assert(`${clip} closes its loop (net root drift ${drift.toFixed(4)}u < 0.05u)`, drift < 0.05)
  }

  // TRUE-SKINNED RENDER INVARIANT — the gap the accessor proxy leaves open.
  // worldBindExtent() (above) rotates the POSITION accessor by the root
  // quaternion; that matched the render here, but only the actual skinned mesh
  // — bones × inverse-bind × bind matrix, exactly what the GPU draws — proves
  // she stands. Measure it at rest and across every shipped clip so a Z-up or
  // collapsed re-export fails HERE instead of at a human eye-test (Round 13).
  const rig = await openSkinned(out)
  const rest = rig.measure(null, 0)
  assert(
    `RENDER rest upright ~1.7u on +Y, feet grounded (${rest.y.toFixed(3)}u, tallest ${rest.tallest}, feet ${rest.minY.toFixed(3)})`,
    rest.tallest === 'Y' && Math.abs(rest.y - 1.7) < 0.05 && Math.abs(rest.minY) < 0.02
  )
  for (const clip of SHIPPED_SLOTS) {
    let uprightEveryFrame = true
    let minH = Infinity
    let maxH = -Infinity
    for (const f of [0, 0.25, 0.5, 0.75]) {
      const e = rig.measure(clip, f)
      if (e.tallest !== 'Y') uprightEveryFrame = false
      minH = Math.min(minH, e.y)
      maxH = Math.max(maxH, e.y)
    }
    // Upright (tallest axis Y) every sampled frame, height never collapsing
    // (<1.2u = lying/tiny) nor exploding (>2.4u); jump apex legitimately stretches.
    assert(
      `RENDER ${clip} upright every frame (tallest Y, height ${minH.toFixed(2)}–${maxH.toFixed(2)}u)`,
      uprightEveryFrame && minH >= 1.2 && maxH <= 2.4
    )
  }

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
