#!/usr/bin/env node
/**
 * bake-cloth-girl.mjs — run the cloth sim and turn it into ordinary skeletal
 * animation on the cloth bones.
 *
 *   … → detach-girl.mjs → canonicalize-girl.mjs → THIS SCRIPT → compress-girl.mjs
 *
 * Aram approved a BAKED shirt, not a runtime solver, so what ships is bone
 * curves: the browser does the same linear blend skinning it already does and
 * never knows a simulation happened.
 *
 * HOW THE TARGET IS BUILT, and why it is a difference rather than a position.
 * cloth-sim.py records the garment twice per frame — once armature-only (`base`)
 * and once with the cloth solver (`sim`). Blender's armature evaluation and the
 * exact LBS the browser does are not the same arithmetic, so baking Blender's
 * absolute positions would bake that disagreement in as if it were cloth. The
 * target is
 *
 *     target(v, f) = LBS(v, f)  +  ( sim(v, f) − base(v, f) )
 *
 * so only what the solver did survives, and `--check` asserts the two agree
 * before any of it is believed.
 *
 * HOW THE FIT WORKS. A garment vertex is skinned to up to four bones, some of
 * which are now cloth bones (cloth-zone.mjs). Its rendered position is a WEIGHTED
 * SUM of their skin matrices, so no single bone can be fitted in isolation. The
 * solve is block coordinate descent: hold every bone but one fixed, and the
 * remaining problem is a weighted Umeyama fit of that bone against the residual
 * the others left. A few sweeps converge because the bones barely overlap.
 *
 * Rotation and translation only, no scale: a glTF node could carry scale, but
 * uniform scale on a cloth bone is a stretch the shipped LBS reproduces badly and
 * it costs a third channel per bone.
 *
 * USAGE
 *   node scripts/small-world/bake-cloth-girl.mjs --src canon.glb --out canon.glb
 *   node scripts/small-world/bake-cloth-girl.mjs --only Skip_Forward --sim-only
 *   node scripts/small-world/bake-cloth-girl.mjs --no-sim      # reuse sim output
 */
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { loadRig, mMul, mFromTRS } from '../../scratchpad/t115/skin.mjs'
import { umeyama, applyM, selfTest as fitSelfTest } from '../../scratchpad/t121/fit.mjs'
import { GARMENT_MATERIAL, CLOTH_PREFIX } from './detach-girl.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..', '..')
const WORK = path.join(WORKTREE, 'scratchpad/t121/out')
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe'

/** Frames of held first pose before each clip, so the sim records a settled
 *  shirt instead of one falling into place. */
export const PREROLL = 30
/** Block coordinate descent sweeps. The bones barely overlap, so this converges
 *  fast; --check reports the residual per sweep. */
export const SWEEPS = 4
/** A key is dropped when linear interpolation from its neighbours is within this
 *  of it (metres of bone origin / radians of bone rotation). */
/** Binomial taps of temporal smoothing over the baked curves. */
export const SMOOTH_TAPS = 7
export const KEY_TOL_POS = 0.005
export const KEY_TOL_ROT = 0.020

const inv = (m) => {
  // General 4x4 inverse (column-major). These are rigid-ish but the fit can
  // return a similarity, so do not assume orthonormal.
  const a = m
  const s0 = a[0] * a[5] - a[4] * a[1], s1 = a[0] * a[9] - a[8] * a[1], s2 = a[0] * a[13] - a[12] * a[1]
  const s3 = a[4] * a[9] - a[8] * a[5], s4 = a[4] * a[13] - a[12] * a[5], s5 = a[8] * a[13] - a[12] * a[9]
  const c5 = a[10] * a[15] - a[14] * a[11], c4 = a[6] * a[15] - a[14] * a[7], c3 = a[6] * a[11] - a[10] * a[7]
  const c2 = a[2] * a[15] - a[14] * a[3], c1 = a[2] * a[11] - a[10] * a[3], c0 = a[2] * a[7] - a[6] * a[3]
  const det = s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0
  const d = 1 / det
  const o = new Float64Array(16)
  o[0] = (a[5] * c5 - a[9] * c4 + a[13] * c3) * d
  o[4] = (-a[4] * c5 + a[8] * c4 - a[12] * c3) * d
  o[8] = (a[7] * s5 - a[11] * s4 + a[15] * s3) * d
  o[12] = (-a[6] * s5 + a[10] * s4 - a[14] * s3) * d
  o[1] = (-a[1] * c5 + a[9] * c2 - a[13] * c1) * d
  o[5] = (a[0] * c5 - a[8] * c2 + a[12] * c1) * d
  o[9] = (-a[3] * s5 + a[11] * s2 - a[15] * s1) * d
  o[13] = (a[2] * s5 - a[10] * s2 + a[14] * s1) * d
  o[2] = (a[1] * c4 - a[5] * c2 + a[13] * c0) * d
  o[6] = (-a[0] * c4 + a[4] * c2 - a[12] * c0) * d
  o[10] = (a[3] * s4 - a[7] * s2 + a[15] * s0) * d
  o[14] = (-a[2] * s4 + a[6] * s2 - a[14] * s0) * d
  o[3] = (-a[1] * c3 + a[5] * c1 - a[9] * c0) * d
  o[7] = (a[0] * c3 - a[4] * c1 + a[8] * c0) * d
  o[11] = (-a[3] * s3 + a[7] * s1 - a[11] * s0) * d
  o[15] = (a[2] * s3 - a[6] * s1 + a[10] * s0) * d
  return o
}

/** Column-major 4x4 → {t, q} (rotation as a unit quaternion, scale discarded). */
function decompose(m) {
  const sx = Math.hypot(m[0], m[1], m[2]) || 1
  const sy = Math.hypot(m[4], m[5], m[6]) || 1
  const sz = Math.hypot(m[8], m[9], m[10]) || 1
  const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz]
  const tr = r[0] + r[4] + r[8]
  let q
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2
    q = [(r[5] - r[7]) / s, (r[6] - r[2]) / s, (r[1] - r[3]) / s, s / 4]
  } else if (r[0] > r[4] && r[0] > r[8]) {
    const s = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2
    q = [s / 4, (r[3] + r[1]) / s, (r[6] + r[2]) / s, (r[5] - r[7]) / s]
  } else if (r[4] > r[8]) {
    const s = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2
    q = [(r[3] + r[1]) / s, s / 4, (r[7] + r[5]) / s, (r[6] - r[2]) / s]
  } else {
    const s = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2
    q = [(r[6] + r[2]) / s, (r[7] + r[5]) / s, s / 4, (r[1] - r[3]) / s]
  }
  const L = Math.hypot(...q) || 1
  return { t: [m[12], m[13], m[14]], q: q.map((v) => v / L) }
}

/** Garment vertices of a loaded rig, with their influences. */
function garmentOf(rig) {
  const range = rig.primRanges.find((p) => p.name === GARMENT_MATERIAL)
  if (!range) throw new Error(`bake-cloth: no ${GARMENT_MATERIAL} primitive — the source has not been detached`)
  return { from: range.vertex[0], to: range.vertex[1], n: range.vertex[1] - range.vertex[0] }
}

/** Bind-pose rendered positions (root rotation applied — what Blender shows). */
function bindRendered(rig) {
  const mats = rig.pose(null, 0)
  const out = new Float64Array(rig.nv * 3)
  rig.skinAll(mats, out)
  return out
}

export async function bakeCloth(srcPath, {
  only = null, runSim = true, check = false, preroll = PREROLL, sweeps = SWEEPS,
  simArgs = [], maxFrames = 0,
} = {}) {
  fitSelfTest()
  mkdirSync(WORK, { recursive: true })
  const rig = await loadRig(srcPath)
  const G = garmentOf(rig)
  const clothJoints = rig.jointNames.map((n, i) => (n.startsWith(CLOTH_PREFIX) ? i : -1)).filter((i) => i >= 0)
  if (!clothJoints.length) throw new Error('bake-cloth: no cloth bones in this source')
  const parentOfCloth = new Map()
  for (const j of clothJoints) {
    const node = rig.joints[j]
    const p = rig.parent[node]
    const jp = rig.joints.indexOf(p)
    if (jp < 0) throw new Error(`bake-cloth: ${rig.jointNames[j]} has no joint parent`)
    parentOfCloth.set(j, jp)
  }

  // ---- the map Blender needs: rendered bind position + cloth fraction ----
  const bind = bindRendered(rig)
  const alphaPath = path.join(WORK, 'clothalpha.bin')
  if (!existsSync(alphaPath)) throw new Error(`bake-cloth: ${alphaPath} missing — run detach-girl.mjs first`)
  const alpha = new Float32Array(readFileSync(alphaPath).buffer.slice(0))
  if (alpha.length !== G.n) throw new Error(`bake-cloth: alpha map is ${alpha.length}, garment is ${G.n}`)
  {
    const map = new Float32Array(G.n * 4)
    for (let i = 0; i < G.n; i++) {
      for (let k = 0; k < 3; k++) map[i * 4 + k] = bind[(G.from + i) * 3 + k]
      map[i * 4 + 3] = alpha[i]
    }
    writeFileSync(path.join(WORK, 'clothmap.bin'), Buffer.from(map.buffer))
  }

  // A rotation tolerance is only meaningful with a lever arm: a cloth bone sits at
  // its PARENT joint's origin (its local transform is identity), which can be
  // 20 cm from the hem it drives. This is what turns KEY_TOL_ROT into millimetres
  // of surface, and it is the number the key-reduction budget should be read in.
  const lever = new Map()
  {
    const bindRend = bind
    for (const j of clothJoints) {
      let s = 0, n = 0
      for (let i = 0; i < G.n; i++) {
        const v = G.from + i
        for (let k = 0; k < 4; k++) {
          if (rig.jnt[v * 4 + k] !== j || rig.wgt[v * 4 + k] <= 0) continue
          const o = rig.jointOrigin(j)
          s += Math.hypot(bindRend[v * 3] - o[0], bindRend[v * 3 + 1] - o[1], bindRend[v * 3 + 2] - o[2])
          n++
        }
      }
      lever.set(j, n ? s / n : 0)
    }
  }
  const clips = rig.clips.filter((c) => !only || c.name === only)
  const report = {
    clips: [], bones: clothJoints.map((j) => rig.jointNames[j]), preroll, sweeps,
    leverMm: Object.fromEntries([...lever].map(([j, l]) => [rig.jointNames[j], l * 1000])),
  }
  const baked = new Map() // clip -> Map(jointIndex -> {t:[], q:[]}) per frame

  for (const clip of clips) {
    const frames = maxFrames ? Math.min(maxFrames, clip.channels[0].track.times.length) : clip.channels[0].track.times.length
    const simPath = path.join(WORK, `sim-${clip.name}.bin`)
    if (runSim) {
      const t0 = Date.now()
      const r = spawnSync(BLENDER, [
        '-b', '--factory-startup', '--python', path.join(WORKTREE, 'scripts/small-world/cloth-sim.py'), '--',
        '--src', srcPath, '--map', path.join(WORK, 'clothmap.bin'), '--clip', clip.name,
        '--fps', '30', '--frames', String(frames), '--preroll', String(preroll), '--out', simPath,
        '--span', String(clip.channels[0].track.times.length - 1),
        ...simArgs,
      ], { encoding: 'utf8', maxBuffer: 1 << 28 })
      const tail = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('cloth-sim')).join(' | ')
      if (r.status !== 0 || !existsSync(simPath))
        throw new Error(`bake-cloth: Blender failed on ${clip.name}\n${(r.stdout ?? '').slice(-2000)}\n${(r.stderr ?? '').slice(-2000)}`)
      console.log(`  sim ${clip.name}: ${((Date.now() - t0) / 1000).toFixed(1)} s  ${tail}`)
    }
    if (!existsSync(simPath)) throw new Error(`bake-cloth: ${simPath} missing (use --sim)`)

    const buf = readFileSync(simPath)
    const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    const per = frames * G.n * 3
    if (f32.length !== per * 2) throw new Error(`bake-cloth: ${simPath} is ${f32.length} floats, expected ${per * 2}`)
    const simBase = f32.subarray(0, per)
    const simCloth = f32.subarray(per, per * 2)

    // ---- targets, and the harness check ----
    const times = clip.channels[0].track.times
    const target = new Float64Array(per)
    const lbs = new Float64Array(rig.nv * 3)
    let worstBase = 0
    let maxDev = 0
    const devs = []
    const skinPerFrame = []
    for (let f = 0; f < frames; f++) {
      const mats = rig.pose(clip, times[f])
      rig.skinAll(mats, lbs)
      skinPerFrame.push({ mats: mats.map((m) => Float64Array.from(m)), world: rig.world.map((m) => Float64Array.from(m)) })
      for (let i = 0; i < G.n; i++) {
        for (let k = 0; k < 3; k++) {
          const o = (f * G.n + i) * 3 + k
          const d = simCloth[o] - simBase[o]
          target[o] = lbs[(G.from + i) * 3 + k] + d
        }
        const b = Math.hypot(
          simBase[(f * G.n + i) * 3] - lbs[(G.from + i) * 3],
          simBase[(f * G.n + i) * 3 + 1] - lbs[(G.from + i) * 3 + 1],
          simBase[(f * G.n + i) * 3 + 2] - lbs[(G.from + i) * 3 + 2]
        )
        if (b > worstBase) worstBase = b
        const dv = Math.hypot(
          simCloth[(f * G.n + i) * 3] - simBase[(f * G.n + i) * 3],
          simCloth[(f * G.n + i) * 3 + 1] - simBase[(f * G.n + i) * 3 + 1],
          simCloth[(f * G.n + i) * 3 + 2] - simBase[(f * G.n + i) * 3 + 2]
        )
        devs.push(dv)
        if (dv > maxDev) maxDev = dv
      }
    }
    devs.sort((a, b) => a - b)

    // ---- fit ----
    const infl = []
    for (let i = 0; i < G.n; i++) {
      const v = G.from + i
      const list = []
      for (let k = 0; k < 4; k++) {
        const w = rig.wgt[v * 4 + k]
        if (w > 0) list.push({ j: rig.jnt[v * 4 + k], w })
      }
      infl.push(list)
    }
    const byBone = new Map(clothJoints.map((j) => [j, []]))
    infl.forEach((list, i) => {
      for (const { j, w } of list) if (byBone.has(j)) byBone.get(j).push({ i, w })
    })

    const curves = new Map(clothJoints.map((j) => [j, { t: [], q: [] }]))
    const residual = []
    /** Previous frame's LOCAL offsets, as a warm start. Starting every frame from
     *  the parent's matrix instead let the block descent settle into a different
     *  split of the same deviation between overlapping bones on each frame — the
     *  curves jittered, which is a shirt that buzzes AND a key-reduction pass that
     *  cannot drop anything (80% of keys survived a 3 mm tolerance). */
    let warm = null
    for (let f = 0; f < frames; f++) {
      const { mats, world } = skinPerFrame[f]
      const S = new Map(clothJoints.map((j) => {
        if (!warm) return [j, Float64Array.from(mats[j])]
        // carry the previous frame's local offset onto this frame's parent pose
        const bindWorld = inv(rig.IBM[j])
        const nodeWorld = mMul(world[rig.joints[parentOfCloth.get(j)]], warm.get(j))
        return [j, mMul(nodeWorld, rig.IBM[j])]
      }))
      const rendered = new Float64Array(G.n * 3)
      const recompute = () => {
        rendered.fill(0)
        infl.forEach((list, i) => {
          const p = [rig.pos[(G.from + i) * 3], rig.pos[(G.from + i) * 3 + 1], rig.pos[(G.from + i) * 3 + 2]]
          for (const { j, w } of list) {
            const m = S.get(j) ?? mats[j]
            rendered[i * 3] += w * (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12])
            rendered[i * 3 + 1] += w * (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13])
            rendered[i * 3 + 2] += w * (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14])
          }
        })
      }
      recompute()
      for (let sweep = 0; sweep < sweeps; sweep++) {
        for (const j of clothJoints) {
          const list = byBone.get(j)
          if (list.length < 4) continue
          const A = new Float64Array(list.length * 3)
          const B = new Float64Array(list.length * 3)
          const W = new Float64Array(list.length)
          const cur = S.get(j)
          list.forEach(({ i, w }, n) => {
            const p = [rig.pos[(G.from + i) * 3], rig.pos[(G.from + i) * 3 + 1], rig.pos[(G.from + i) * 3 + 2]]
            const mine = applyM(cur, p)
            for (let k = 0; k < 3; k++) {
              A[n * 3 + k] = p[k]
              // what this bone must produce so the weighted sum hits the target
              B[n * 3 + k] = mine[k] + (target[(f * G.n + i) * 3 + k] - rendered[i * 3 + k]) / w
            }
            W[n] = w * w
          })
          const next = umeyama(A, B, W, false)
          S.set(j, next)
          // Incremental: only this bone's own vertices moved, and only by
          // w * (next - cur) * p. A full recompute here is 80 passes over 17,534
          // vertices per frame for nothing.
          list.forEach(({ i, w }) => {
            const p = [rig.pos[(G.from + i) * 3], rig.pos[(G.from + i) * 3 + 1], rig.pos[(G.from + i) * 3 + 2]]
            const a = applyM(cur, p)
            const b = applyM(next, p)
            for (let k = 0; k < 3; k++) rendered[i * 3 + k] += w * (b[k] - a[k])
          })
        }
      }
      // PER VERTEX, in the same units as the deviation it is compared against.
      // The first version of this recorded the worst vertex per FRAME and put it
      // beside a p99 over vertices, which made a working fit look like a broken
      // one and a broken one look like a tuning problem.
      for (let i = 0; i < G.n; i++)
        residual.push(Math.hypot(
          rendered[i * 3] - target[(f * G.n + i) * 3],
          rendered[i * 3 + 1] - target[(f * G.n + i) * 3 + 1],
          rendered[i * 3 + 2] - target[(f * G.n + i) * 3 + 2]
        ))

      // skin matrix -> node local TRS:  local = parentWorld⁻¹ · S · bindWorld
      const locals = new Map()
      for (const j of clothJoints) {
        const bindWorld = inv(rig.IBM[j])
        const nodeWorld = mMul(S.get(j), bindWorld)
        const parentWorld = world[rig.joints[parentOfCloth.get(j)]]
        const local = mMul(inv(parentWorld), nodeWorld)
        locals.set(j, local)
        const { t, q } = decompose(local)
        curves.get(j).t.push(t)
        curves.get(j).q.push(q)
      }
      warm = locals
    }
    for (const j of clothJoints) smoothCurve(curves.get(j), SMOOTH_TAPS)
    baked.set(clip.name, { curves, times })
    const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))]
    const rs = residual.sort((a, b) => a - b)
    report.clips.push({
      clip: clip.name,
      frames,
      blenderVsLbsMm: worstBase * 1000,
      deviationMm: { median: q(devs, 0.5) * 1000, p99: q(devs, 0.99) * 1000, max: maxDev * 1000 },
      fitResidualMm: { median: q(rs, 0.5) * 1000, p99: q(rs, 0.99) * 1000, max: rs[rs.length - 1] * 1000 },
    })
    console.log(
      `  ${clip.name.padEnd(14)} ${String(frames).padStart(3)}f  blender-vs-LBS ${(worstBase * 1000).toFixed(3)} mm  ` +
        `deviation med ${(q(devs, 0.5) * 1000).toFixed(2)} p99 ${(q(devs, 0.99) * 1000).toFixed(2)} max ${(maxDev * 1000).toFixed(2)} mm  ` +
        `fit residual med ${(q(rs, 0.5) * 1000).toFixed(2)} p99 ${(q(rs, 0.99) * 1000).toFixed(2)} max ${(rs[rs.length - 1] * 1000).toFixed(2)} mm`
    )
  }
  return { rig, baked, report, clothJoints }
}

/**
 * Low-pass the baked curves along time.
 *
 * The cloth solver is smooth; the FIT is not necessarily, because several cloth
 * bones can explain the same displacement and the descent need not split it the
 * same way twice. That difference is invisible in the residual and very visible
 * on screen as a buzz, so it is removed here rather than tuned around. A binomial
 * kernel, applied to translation directly and to rotation after sign-aligning the
 * quaternions (a quaternion and its negation are the same rotation, and averaging
 * across a sign flip gives garbage).
 */
export function smoothCurve(curve, taps) {
  if (taps < 3 || curve.t.length < taps) return curve
  const half = (taps - 1) / 2
  const w = []
  for (let i = 0; i < taps; i++) {
    let c = 1
    for (let k = 0; k < i; k++) c = (c * (taps - 1 - k)) / (k + 1)
    w.push(c)
  }
  const wsum = w.reduce((a, b) => a + b, 0)
  const n = curve.t.length
  // sign-align the quaternion track first
  for (let i = 1; i < n; i++) {
    let dot = 0
    for (let d = 0; d < 4; d++) dot += curve.q[i][d] * curve.q[i - 1][d]
    if (dot < 0) curve.q[i] = curve.q[i].map((v) => -v)
  }
  const smooth = (track, dim, normalise) => {
    const out = track.map((_, i) => {
      const acc = new Array(dim).fill(0)
      for (let k = -half; k <= half; k++) {
        const s = Math.min(n - 1, Math.max(0, i + k))
        for (let d = 0; d < dim; d++) acc[d] += (w[k + half] / wsum) * track[s][d]
      }
      if (normalise) {
        const L = Math.hypot(...acc) || 1
        for (let d = 0; d < dim; d++) acc[d] /= L
      }
      return acc
    })
    return out
  }
  curve.t = smooth(curve.t, 3, false)
  curve.q = smooth(curve.q, 4, true)
  return curve
}

/** Drop keys a linear neighbour reproduces. Returns kept indices. */
function reduceKeys(times, values, tol, dim) {
  const keep = [0]
  let anchor = 0
  for (let i = 1; i < times.length - 1; i++) {
    let worst = 0
    for (let k = anchor + 1; k <= i; k++) {
      const u = (times[k] - times[anchor]) / (times[i + 1] - times[anchor])
      for (let d = 0; d < dim; d++) {
        const lin = values[anchor][d] * (1 - u) + values[i + 1][d] * u
        worst = Math.max(worst, Math.abs(lin - values[k][d]))
      }
    }
    if (worst > tol) { keep.push(i); anchor = i }
  }
  keep.push(times.length - 1)
  return keep
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => {
    const i = process.argv.indexOf(`--${n}`)
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
  }
  const src = arg('src', path.join(WORK, 'canon.glb'))
  const out = arg('out', src)
  const only = arg('only', null)
  const runSim = !process.argv.includes('--no-sim')
  const tolPos = Number(arg('tol-pos', KEY_TOL_POS))
  const tolRot = Number(arg('tol-rot', KEY_TOL_ROT))
  // The fabric knobs cloth-sim.py already accepts (bending, air, mass, pinpow,
  // pinstiff, …) reach it through bakeCloth's simArgs, which until now no shell
  // caller could set. A look-dev sweep needs them from the command line:
  //   --sim-args "--bending 5 --air 1"
  // Read straight out of argv rather than through arg(): the value legitimately
  // BEGINS with "--", and arg() treats any such token as the next flag and hands
  // back the default. That failure is silent — the sim runs with shipped
  // constants and reports plausible numbers for a rung that was never simulated.
  const simIdx = process.argv.indexOf('--sim-args')
  const simArgs = simIdx >= 0 && process.argv[simIdx + 1] ? process.argv[simIdx + 1].trim().split(/\s+/).filter(Boolean) : []
  if (simArgs.length) console.log(`sim overrides: ${simArgs.join(' ')}`)

  const { rig, baked, report, clothJoints } = await bakeCloth(src, { only, runSim, simArgs })

  if (!process.argv.includes('--sim-only')) {
    const io = new NodeIO()
    const doc = await io.read(src)
    const nodes = doc.getRoot().listNodes()
    const skinJoints = doc.getRoot().listSkins()[0].listJoints()
    let keysWritten = 0
    let keysTotal = 0
    for (const anim of doc.getRoot().listAnimations()) {
      const b = baked.get(anim.getName())
      if (!b) continue
      const before = anim.listChannels().length
      for (const j of clothJoints) {
        const node = skinJoints[j]
        for (const [pathName, vals, tol, dim, rest] of [
          ['translation', b.curves.get(j).t, tolPos, 3, [0, 0, 0]],
          ['rotation', b.curves.get(j).q, tolRot, 4, [0, 0, 0, 1]],
        ]) {
          // A channel that never leaves the bone's REST value is pure payload —
          // and rest is what the node falls back to when the channel is absent.
          // Testing against the channel's own first key instead (as this did)
          // keeps every channel whose curve is flat but displaced, which is most
          // of them: it wrote 26,124 keys where 3,600 carry the motion.
          const moved = vals.some((v) => v.some((x, d) => Math.abs(x - rest[d]) > tol))
          keysTotal += b.times.length
          if (!moved) continue
          const keep = reduceKeys(b.times, vals, tol, dim)
          keysWritten += keep.length
          const input = doc.createAccessor(`${anim.getName()}_${node.getName()}_${pathName}_t`).setType('SCALAR')
            .setArray(Float32Array.from(keep.map((i) => b.times[i])))
          const flat = new Float32Array(keep.length * dim)
          keep.forEach((i, n) => { for (let d = 0; d < dim; d++) flat[n * dim + d] = vals[i][d] })
          const output = doc.createAccessor(`${anim.getName()}_${node.getName()}_${pathName}`)
            .setType(dim === 4 ? 'VEC4' : 'VEC3').setArray(flat)
          const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR')
          anim.addSampler(sampler)
          anim.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(pathName).setSampler(sampler))
        }
      }
      console.log(`  ${anim.getName()}: ${before} → ${anim.listChannels().length} channels`)
    }
    // The law: nothing that existed before may have moved.
    {
      const srcDoc = await io.read(src)
      const dur = (d, n) => {
        const a = d.getRoot().listAnimations().find((x) => x.getName() === n)
        let m = 0
        for (const c of a.listChannels()) { const t = c.getSampler().getInput().getArray(); m = Math.max(m, t[t.length - 1]) }
        return m
      }
      for (const a of doc.getRoot().listAnimations()) {
        const d0 = dur(srcDoc, a.getName())
        const d1 = dur(doc, a.getName())
        if (Math.abs(d0 - d1) > 1e-6) throw new Error(`bake-cloth: ${a.getName()} duration ${d0} → ${d1}`)
      }
      const origJoints = skinJoints.filter((n) => !n.getName().startsWith(CLOTH_PREFIX))
      for (const a of doc.getRoot().listAnimations()) {
        const srcAnim = srcDoc.getRoot().listAnimations().find((x) => x.getName() === a.getName())
        const count = (anim, names) => anim.listChannels().filter((c) => names.has(c.getTargetNode().getName())).length
        const names = new Set(origJoints.map((n) => n.getName()))
        if (count(a, names) !== count(srcAnim, names))
          throw new Error(`bake-cloth: ${a.getName()} changed the original joints' channel count`)
      }
    }
    await io.write(out, doc)
    report.keys = { written: keysWritten, ofPossible: keysTotal }
    console.log(`wrote ${out}  (${keysWritten.toLocaleString()} of ${keysTotal.toLocaleString()} possible keys kept)`)
  }
  writeFileSync(path.join(WORK, 'bake.json'), JSON.stringify(report, null, 1))
}
