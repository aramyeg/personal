#!/usr/bin/env node
/**
 * detach-girl.mjs — the shirt stops being skin.
 *
 *   girl-v2.glb (raw Meshy export)
 *     → rebind-girl.mjs   (T117: clean skin weights)
 *     → line-girl.mjs     (T120: the body surface under the garment)
 *     → THIS SCRIPT       (T121: garment becomes its own primitive + cloth bones)
 *     → canonicalize-girl.mjs → bake-cloth-girl.mjs → compress-girl.mjs
 *
 * T118 measured why this could not be done then: the overshirt had no free
 * boundary — hem, placket, sleeve ends and collar were creases in ONE continuous
 * skin with no body surface underneath, so cutting the garment out opened the
 * whole torso and both upper arms. T120 built that missing surface. The outline
 * is now a real free edge, and this stage cuts along it.
 *
 * TWO THINGS HAPPEN HERE, and they are separate on purpose:
 *
 * 1. THE CUT. The garment's triangles move to their own primitive of the same
 *    glTF mesh (so the file still holds exactly one mesh, and the skin, the
 *    skeleton and every animation are untouched). Both pieces get their own
 *    compacted vertex buffer, which duplicates the ~1,199 rim positions: the
 *    garment keeps its rim ring and the body+lining keeps the weld, coincident,
 *    so nothing opens. The garment gets a CLONE of the material — same texture,
 *    zero atlas bytes — because a second material is what lets Blender separate
 *    the two pieces for the sim, and what names the garment in the shipped file
 *    without a mask.
 *
 * 2. THE CLOTH BONES. See cloth-zone.mjs for why each one is an identity-at-bind
 *    child of a body joint and why there is one per (joint, region) pair. The
 *    consequence worth stating here: at identity a child's world matrix and
 *    inverse bind are its parent's, so redirecting an influence to a cloth bone
 *    is the SAME SKIN MATRIX. This stage therefore cannot change how anything
 *    deforms — it is asserted, not hoped (`--verify` skins every garment vertex
 *    through both rigs across all six clips). What moves the shirt is
 *    bake-cloth-girl.mjs writing curves onto these bones afterwards.
 *
 * The original 24 joints keep their indices (cloth bones are appended), so every
 * JOINTS_0 value outside the cloth zone still means what it meant.
 *
 * USAGE
 *   node scripts/small-world/detach-girl.mjs                 # lined → cloth
 *   node scripts/small-world/detach-girl.mjs --verify        # + LBS equivalence
 *   node scripts/small-world/detach-girl.mjs --src A --out B
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { clothZone, clothBones, readMask, PAIR_THRESHOLD, N_ORIG_TRI } from './cloth-zone.mjs'
import { shirtMask } from './shirt-region.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..', '..')
const LINED_SRC = path.join(WORKTREE, 'public/labs/small-world/girl-v2-lined.glb')
const DEFAULT_OUT = path.join(WORKTREE, 'public/labs/small-world/girl-v2-cloth.glb')
const DEFAULT_MASK = path.join(WORKTREE, 'scratchpad/t118/out/mask.tri.bin')

/** Name of the garment primitive's material — the shipped file's own label. */
export const GARMENT_MATERIAL = 'girl_garment'
/** Every cloth bone's name starts with this. */
export const CLOTH_PREFIX = 'Cloth_'

const el = (acc, i, n) => {
  const out = new Array(n)
  acc.getElement(i, out)
  return out
}

/**
 * @param {import('@gltf-transform/core').Document} doc  a lined source, in place
 */
export function detachGirl(doc, { triLabel, threshold = PAIR_THRESHOLD, band = undefined, torsoRegions = undefined, sleeveRegions = undefined, yokeFraction = undefined, yokeRamp = undefined } = {}) {
  const root = doc.getRoot()
  const meshes = root.listMeshes()
  if (meshes.length !== 1) throw new Error(`detach-girl: expected 1 mesh, found ${meshes.length}`)
  const prims = meshes[0].listPrimitives()
  if (prims.length !== 1) throw new Error(`detach-girl: expected 1 primitive, found ${prims.length} — already detached?`)
  const prim = prims[0]

  const SEMANTICS = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']
  const src = {}
  for (const s of SEMANTICS) {
    const a = prim.getAttribute(s)
    if (!a) throw new Error(`detach-girl: source has no ${s}`)
    src[s] = a
  }
  const nv = src.POSITION.getCount()
  const idx = src.POSITION.getCount() && prim.getIndices().getArray()
  const nTri = idx.length / 3

  const skin = root.listSkins()[0]
  const jointNodes = skin.listJoints()
  const jointNames = jointNodes.map((n) => n.getName())
  const nOrigJoints = jointNodes.length
  if (jointNames.some((n) => n.startsWith(CLOTH_PREFIX)))
    throw new Error('detach-girl: this source already carries cloth bones')

  // ---------- the zone, off plain arrays ----------
  const pos = new Float64Array(nv * 3)
  const jnt = new Int32Array(nv * 4)
  const wgt = new Float64Array(nv * 4)
  for (let i = 0; i < nv; i++) {
    const p = el(src.POSITION, i, 3)
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = p[k]
    const j = el(src.JOINTS_0, i, 4)
    const w = el(src.WEIGHTS_0, i, 4)
    for (let k = 0; k < 4; k++) { jnt[i * 4 + k] = j[k]; wgt[i * 4 + k] = w[k] }
  }
  const meshDesc = { nv, pos, tri: Int32Array.from(idx), jnt, wgt, jointNames }
  const Z = clothZone(meshDesc, triLabel, { ...(band ? { band } : {}), ...(torsoRegions ? { torsoRegions } : {}), ...(sleeveRegions ? { sleeveRegions } : {}), ...(yokeFraction ? { yokeFraction } : {}), ...(yokeRamp ? { yokeRamp } : {}) })
  const { bones, redirect, keptMass, zoneMass } = clothBones(meshDesc, Z, threshold)

  // ---------- the cut ----------
  const garmentTris = []
  const bodyTris = []
  for (let t = 0; t < nTri; t++) (Z.isGarmentTri[t] ? garmentTris : bodyTris).push(t)
  if (!garmentTris.length) throw new Error('detach-girl: the mask selected no triangles')

  /** Build a compacted primitive from a triangle list, optionally redirecting
   *  JOINTS_0 through the cloth bone table. Returns the source-vertex order so
   *  the caller can assert what was copied. */
  const buildPiece = (tris, useRedirect) => {
    const map = new Int32Array(nv).fill(-1)
    const order = []
    const newIdx = new Uint32Array(tris.length * 3)
    for (let n = 0; n < tris.length; n++) {
      const t = tris[n]
      for (let k = 0; k < 3; k++) {
        const v = idx[t * 3 + k]
        if (map[v] < 0) { map[v] = order.length; order.push(v) }
        newIdx[n * 3 + k] = map[v]
      }
    }
    const out = {}
    for (const s of SEMANTICS) {
      const a = src[s]
      const stride = a.getElementSize()
      const Ctor = a.getArray().constructor
      const arr = new Ctor(order.length * stride)
      const buf = new Array(stride)
      order.forEach((v, n) => {
        a.getElement(v, buf)
        for (let k = 0; k < stride; k++) arr[n * stride + k] = buf[k]
      })
      out[s] = { arr, stride, type: a.getType(), normalized: a.getNormalized() }
    }
    let redirected = 0
    if (useRedirect) {
      const J = out.JOINTS_0.arr
      order.forEach((v, n) => {
        for (let k = 0; k < 4; k++) {
          const o = redirect.get(`${v}:${k}`)
          if (o === undefined) continue
          J[n * 4 + k] = nOrigJoints + o
          redirected++
        }
      })
    }
    return { order, newIdx, out, redirected }
  }

  const body = buildPiece(bodyTris, false)
  const garment = buildPiece(garmentTris, true)

  // ---------- cloth bones ----------
  // Identity local TRS under the parent joint, so bindWorld(C) === bindWorld(j)
  // and the inverse bind is copied verbatim rather than recomputed. Anything else
  // here would silently change the deformation.
  const ibmAcc = skin.getInverseBindMatrices()
  const oldIBM = ibmAcc.getArray()
  const newIBM = new Float32Array((nOrigJoints + bones.length) * 16)
  newIBM.set(oldIBM.subarray(0, nOrigJoints * 16))
  const clothNodes = []
  bones.forEach((b, i) => {
    const node = doc.createNode(b.name).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1])
    jointNodes[b.joint].addChild(node)
    clothNodes.push(node)
    newIBM.set(oldIBM.subarray(b.joint * 16, b.joint * 16 + 16), (nOrigJoints + i) * 16)
  })
  skin.setInverseBindMatrices(doc.createAccessor('ibm_with_cloth').setType('MAT4').setArray(newIBM))
  for (const n of clothNodes) skin.addJoint(n)

  // ---------- write the two primitives ----------
  const material = prim.getMaterial()
  const garmentMaterial = material.clone().setName(GARMENT_MATERIAL)
  const mkAccessor = (name, spec) =>
    doc.createAccessor(name).setType(spec.type).setArray(spec.arr).setNormalized(spec.normalized)

  const bodyPrim = doc.createPrimitive().setMaterial(material)
  for (const s of SEMANTICS) bodyPrim.setAttribute(s, mkAccessor(`body_${s}`, body.out[s]))
  bodyPrim.setIndices(doc.createAccessor('body_idx').setType('SCALAR').setArray(body.newIdx))

  const garmentPrim = doc.createPrimitive().setMaterial(garmentMaterial)
  for (const s of SEMANTICS) garmentPrim.setAttribute(s, mkAccessor(`garment_${s}`, garment.out[s]))
  garmentPrim.setIndices(doc.createAccessor('garment_idx').setType('SCALAR').setArray(garment.newIdx))

  meshes[0].removePrimitive(prim)
  meshes[0].addPrimitive(bodyPrim)
  meshes[0].addPrimitive(garmentPrim)
  prim.dispose()

  // ---------- assertions ----------
  // Every triangle went to exactly one piece, with its corners' attributes
  // carried across verbatim (JOINTS_0 aside, where the redirect is the point).
  if (body.newIdx.length + garment.newIdx.length !== idx.length)
    throw new Error('detach-girl: the two pieces do not add up to the source triangles')
  const check = (piece, tris, redirected) => {
    for (let n = 0; n < tris.length; n++) {
      const t = tris[n]
      for (let k = 0; k < 3; k++) {
        const v = idx[t * 3 + k]
        const m = piece.newIdx[n * 3 + k]
        if (piece.order[m] !== v) throw new Error(`detach-girl: triangle ${t} corner ${k} lost its vertex`)
        for (const s of SEMANTICS) {
          if (s === 'JOINTS_0' && redirected) continue
          const stride = piece.out[s].stride
          const want = el(src[s], v, stride)
          for (let c = 0; c < stride; c++)
            if (piece.out[s].arr[m * stride + c] !== want[c])
              throw new Error(`detach-girl: ${s} changed on vertex ${v}`)
        }
      }
    }
  }
  check(body, bodyTris, false)
  check(garment, garmentTris, true)
  // JOINTS_0 on the garment: every value is either the original joint or the
  // cloth bone the redirect table names for it. Nothing else may appear.
  {
    const J = garment.out.JOINTS_0.arr
    garment.order.forEach((v, n) => {
      for (let k = 0; k < 4; k++) {
        const o = redirect.get(`${v}:${k}`)
        const want = o === undefined ? jnt[v * 4 + k] : nOrigJoints + o
        if (J[n * 4 + k] !== want) throw new Error(`detach-girl: JOINTS_0 wrong on vertex ${v} slot ${k}`)
      }
    })
  }
  // Weights are untouched everywhere: a cloth bone inherits its parent's share,
  // it does not take a bigger one.
  for (const piece of [body, garment])
    piece.order.forEach((v, n) => {
      for (let k = 0; k < 4; k++)
        if (piece.out.WEIGHTS_0.arr[n * 4 + k] !== src.WEIGHTS_0.getArray()[v * 4 + k])
          throw new Error(`detach-girl: WEIGHTS_0 changed on vertex ${v}`)
    })
  // Each cloth bone's inverse bind IS its parent's, bit for bit.
  bones.forEach((b, i) => {
    for (let k = 0; k < 16; k++)
      if (newIBM[(nOrigJoints + i) * 16 + k] !== oldIBM[b.joint * 16 + k])
        throw new Error(`detach-girl: ${b.name} inverse bind is not its parent's`)
  })
  if (skin.listJoints().length !== nOrigJoints + bones.length)
    throw new Error('detach-girl: joint list did not grow by the cloth bone count')
  skin.listJoints().slice(0, nOrigJoints).forEach((n, i) => {
    if (n !== jointNodes[i]) throw new Error(`detach-girl: original joint ${i} moved — JOINTS_0 indices are no longer valid`)
  })

  const zoneVerts = new Set([...redirect.keys()].map((k) => Number(k.split(':')[0])))
  return {
    report: {
      triangles: { total: nTri, garment: garmentTris.length, body: bodyTris.length },
      vertices: { source: nv, garment: garment.order.length, body: body.order.length, duplicated: garment.order.length + body.order.length - nv },
      rim: Z.gW.filter((w) => Z.wBody[w]).length,
      freeEdges: [...Z.edgeKind.values()].reduce((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {}),
      // The zoning is echoed into the report because a rung is identified by it
      // and a silently-defaulted flag produces a plausible file for a rung that
      // was never built (T122 §5.2). Read this back, do not trust the command.
      zone: {
        weldedPositions: Z.zone.length, indexVertices: zoneVerts.size, regions: new Set([...Z.region.values()]).size,
        mode: yokeFraction ? (yokeRamp ? 'yoke-pinned' : 'yoke-faded') : 'band', band: yokeFraction ? null : (band ?? null), yokeFraction: yokeFraction ?? null, yokeRamp: yokeRamp ?? null,
        hardPinnedPositions: Z.gW.filter((w) => Z.alpha[w] <= 0.001).length,
        meanAlphaOverGarment: Z.gW.reduce((s, w) => s + Z.alpha[w], 0) / Z.gW.length,
        garmentPositions: Z.gW.length,
      },
      clothBones: bones.map((b) => ({ name: b.name, parent: jointNames[b.joint], share: b.mass })),
      clothWeightCarried: keptMass,
      zoneMass,
      influencesRedirected: garment.redirected,
      joints: { before: nOrigJoints, after: nOrigJoints + bones.length },
      materials: root.listMaterials().map((m) => m.getName()),
    },
    bones,
    Z,
  }
}

/**
 * Skin every garment vertex through the pre- and post-detach rigs across all six
 * clips and return the worst disagreement, in millimetres. Should be exactly 0:
 * a cloth bone at identity is its parent joint. This is the checkpoint-(a) gate.
 */
export async function verifyEquivalence(srcPath, outPath) {
  const { loadRig } = await import('../../scratchpad/t115/skin.mjs')
  const { SOURCE_CLIPS } = await import('./cloth-zone.mjs')
  const A = await loadRig(srcPath)
  const B = await loadRig(outPath)
  if (A.nv !== B.nv) {
    // B is compacted into two primitives; match by bind position instead.
  }
  const key = (p, i) => `${p[i * 3].toFixed(6)},${p[i * 3 + 1].toFixed(6)},${p[i * 3 + 2].toFixed(6)}`
  const bIndex = new Map()
  for (let i = 0; i < B.nv; i++) {
    const k = key(B.pos, i)
    if (!bIndex.has(k)) bIndex.set(k, [])
    bIndex.get(k).push(i)
  }
  let worst = 0
  let worstClip = null
  const outA = new Float64Array(A.nv * 3)
  const outB = new Float64Array(B.nv * 3)
  for (const [srcName, slot] of Object.entries(SOURCE_CLIPS)) {
    const ca = A.clips.find((c) => c.name === srcName)
    const cb = B.clips.find((c) => c.name === srcName)
    if (!ca || !cb) throw new Error(`verify: clip ${srcName} missing`)
    for (let f = 0; f <= 12; f++) {
      const t = (ca.duration * f) / 12
      A.skinAll(A.pose(ca, t), outA)
      B.skinAll(B.pose(cb, t), outB)
      for (let i = 0; i < A.nv; i++) {
        const cand = bIndex.get(key(A.pos, i))
        if (!cand) continue
        let best = Infinity
        for (const j of cand)
          best = Math.min(best, Math.hypot(outA[i * 3] - outB[j * 3], outA[i * 3 + 1] - outB[j * 3 + 1], outA[i * 3 + 2] - outB[j * 3 + 2]))
        if (best > worst) { worst = best; worstClip = slot }
      }
    }
  }
  return { worstMm: worst * 1000, worstClip }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => {
    const i = process.argv.indexOf(`--${n}`)
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
  }
  const src = arg('src', LINED_SRC)
  const out = arg('out', DEFAULT_OUT)
  const maskPath = arg('mask', DEFAULT_MASK)
  const io = new NodeIO()
  const doc = await io.read(src)

  let triLabel
  if (existsSync(maskPath)) triLabel = readMask(maskPath)
  else {
    // Recompute from the REBOUND source: shirtMask() runs on the original mesh,
    // and the lined source has the lining appended past N_ORIG_TRI.
    const rebound = path.join(WORKTREE, 'public/labs/small-world/girl-v2-rebound.glb')
    const m = await shirtMask(await io.read(rebound))
    triLabel = m.triLabel
    writeFileSync(maskPath, Buffer.from(triLabel))
  }

  const num = (n) => (arg(n, null) ? Number(arg(n, null)) : undefined)
  const { report, Z } = detachGirl(doc, {
    triLabel, band: num('band'), threshold: num('threshold') ?? PAIR_THRESHOLD, torsoRegions: num('torso-regions'),
    sleeveRegions: num('sleeve-regions'), yokeFraction: num('yoke'), yokeRamp: num('yoke-ramp'),
  })
  await io.write(out, doc)
  writeFileSync(path.join(WORKTREE, 'scratchpad/t121/out/detach.json'), JSON.stringify(report, null, 1))

  // The cloth fraction per GARMENT-PRIMITIVE vertex, in that primitive's own
  // order. Written here because this is the only stage that knows the garment's
  // vertex order and the zone at the same time; bake-cloth-girl.mjs pairs it with
  // the RENDERED bind positions (which only exist after canonicalize stands her
  // up) to build the map cloth-sim.py pins from.
  {
    const gPrim = doc.getRoot().listMeshes()[0].listPrimitives().find((p) => p.getMaterial().getName() === GARMENT_MATERIAL)
    const gp = gPrim.getAttribute('POSITION')
    const n = gp.getCount()
    const out = new Float32Array(n)
    const e = [0, 0, 0]
    // alpha is a per-WELDED-POSITION quantity; look it up by position.
    const byPos = new Map()
    for (let w = 0; w < Z.nW; w++)
      byPos.set(`${Z.wpos[w * 3].toFixed(6)},${Z.wpos[w * 3 + 1].toFixed(6)},${Z.wpos[w * 3 + 2].toFixed(6)}`, w)
    let missing = 0
    for (let i = 0; i < n; i++) {
      gp.getElement(i, e)
      const w = byPos.get(`${e[0].toFixed(6)},${e[1].toFixed(6)},${e[2].toFixed(6)}`)
      if (w === undefined) missing++
      else out[i] = Z.alpha[w]
    }
    if (missing) throw new Error(`detach-girl: ${missing} garment vertices have no zone entry`)
    writeFileSync(path.join(WORKTREE, 'scratchpad/t121/out/clothalpha.bin'), Buffer.from(out.buffer))
    console.log(`cloth alpha ${n.toLocaleString()} garment vertices → scratchpad/t121/out/clothalpha.bin`)
  }

  console.log(`wrote ${out}`)
  console.log(`triangles  ${report.triangles.total.toLocaleString()} → body ${report.triangles.body.toLocaleString()} + garment ${report.triangles.garment.toLocaleString()}`)
  console.log(`vertices   ${report.vertices.source.toLocaleString()} → ${report.vertices.body.toLocaleString()} + ${report.vertices.garment.toLocaleString()}  (+${report.vertices.duplicated.toLocaleString()} duplicated at the cut)`)
  console.log(`free edges ${JSON.stringify(report.freeEdges)}  rim ${report.rim}`)
  console.log(`cloth zone ${report.zone.weldedPositions} welded positions in ${report.zone.regions} regions; ${report.influencesRedirected} influences redirected`)
  console.log(`cloth bones ${report.clothBones.length} (joints ${report.joints.before} → ${report.joints.after}) carrying ${(report.clothWeightCarried * 100).toFixed(1)}% of the zone's cloth weight`)
  for (const b of report.clothBones) console.log(`   ${b.name.padEnd(30)} ${(b.share * 100).toFixed(2)}%`)

  if (process.argv.includes('--verify')) {
    const v = await verifyEquivalence(src, out)
    console.log(`\nLBS equivalence over all six clips x 13 frames: worst ${v.worstMm.toExponential(3)} mm${v.worstClip ? ` (${v.worstClip})` : ''}`)
    if (v.worstMm > 1e-9) {
      console.log('DETACH IS NOT NEUTRAL — a cloth bone is not its parent joint')
      process.exitCode = 1
    } else console.log('detach is deformation-neutral')
  }
}
