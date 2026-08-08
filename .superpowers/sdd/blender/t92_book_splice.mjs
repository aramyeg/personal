/**
 * T92 — splice the notebook's baked interior into the shipped desk.glb, SURGICALLY.
 *
 *   node t92_book_splice.mjs <shipped desk.glb> <t92_book_new.glb> <out desk.glb>
 *
 * WHY A SPLICE AND NOT A PIPELINE RE-RUN. The T81 pipeline re-bakes the whole studio (Cycles,
 * sampled) — re-running it moves every vertex colour a little, and the T92 rest gate is pixel-diff
 * ZERO against the current ship. So the shipped file's bytes are the baseline and the interior is
 * added around them: `BookStatic` (the revealed page + gutter, hidden inside the closed book) is
 * APPENDED to `DeskBaked`'s accessors, and `BookVerso` (the cover's paper underside + the pencil
 * sketch) becomes a fifth mesh the runtime rotates. Every pre-existing byte of every pre-existing
 * accessor is copied verbatim; `desk-glb.test.ts` holds the result to the same gates as ever.
 *
 * Format facts this script relies on (verified against the ship): DeskBaked POSITION f32/VEC3,
 * COLOR_0 + COLOR_1 ushort-normalized/VEC3, indices uint16, tightly packed bufferViews, no
 * interleaving. The Blender export of the new pieces carries VEC4 colours; alpha is dropped here
 * exactly as t81_trim dropped it for everything else.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const [shipPath, bookPath, outPath] = process.argv.slice(2)

function readGlb(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + path)
  let off = 12
  let json = null
  let bin = null
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const kind = buf.readUInt32LE(off + 4)
    const body = buf.subarray(off + 8, off + 8 + len)
    if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8'))
    else if (kind === 0x004e4942) bin = body
    off += 8 + len + ((4 - (len % 4)) % 4)
  }
  return { json, bin }
}

const COMP_BYTES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

function accBytes(json, bin, i) {
  const a = json.accessors[i]
  const bv = json.bufferViews[a.bufferView]
  const elem = COMP_BYTES[a.componentType] * TYPE_N[a.type]
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return { a, data: bin.subarray(start, start + a.count * elem), elem }
}

function accFloats(json, bin, i) {
  const { a, data } = accBytes(json, bin, i)
  const out = new Float64Array(a.count * TYPE_N[a.type])
  const n = TYPE_N[a.type]
  for (let k = 0; k < a.count * n; k++) {
    out[k] =
      a.componentType === 5126
        ? data.readFloatLE(k * 4)
        : a.componentType === 5123
          ? data.readUInt16LE(k * 2) / (a.normalized ? 65535 : 1)
          : data.readUInt8(k) / (a.normalized ? 255 : 1)
  }
  return { count: a.count, comps: n, v: out }
}

function accIndices(json, bin, i) {
  const { a, data } = accBytes(json, bin, i)
  const out = new Uint32Array(a.count)
  for (let k = 0; k < a.count; k++) {
    out[k] = a.componentType === 5125 ? data.readUInt32LE(k * 4) : data.readUInt16LE(k * 2)
  }
  return out
}

const ship = readGlb(shipPath)
const book = readGlb(bookPath)

const findMesh = (g, name) => g.json.meshes.find((m) => m.name === name || m.name.startsWith(name))
const bakedMesh = findMesh(ship, 'DeskBaked')
const staticMesh = findMesh(book, 'BookStatic')
const versoMesh = findMesh(book, 'BookVerso')
if (!bakedMesh || !staticMesh || !versoMesh) throw new Error('a mesh is missing')

// --- the new pieces, read out of the Blender export --------------------------

function piece(g, mesh) {
  const p = mesh.primitives[0]
  const pos = accFloats(g.json, g.bin, p.attributes.POSITION)
  const c0 = accFloats(g.json, g.bin, p.attributes.COLOR_0)
  const c1 = accFloats(g.json, g.bin, p.attributes.COLOR_1)
  const idx = accIndices(g.json, g.bin, p.indices)
  if (c0.count !== pos.count || c1.count !== pos.count) throw new Error('attribute count mismatch')
  return { pos, c0, c1, idx }
}
const stat = piece(book, staticMesh)
const verso = piece(book, versoMesh)
console.log('BookStatic:', stat.pos.count, 'verts,', stat.idx.length / 3, 'tris')
console.log('BookVerso:', verso.pos.count, 'verts,', verso.idx.length / 3, 'tris')

// --- helpers to serialize ----------------------------------------------------

const f32 = (arr) => {
  const b = Buffer.alloc(arr.length * 4)
  for (let i = 0; i < arr.length; i++) b.writeFloatLE(arr[i], i * 4)
  return b
}
const u16n = (arr) => {
  const b = Buffer.alloc(arr.length * 2)
  for (let i = 0; i < arr.length; i++) b.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(arr[i] * 65535))), i * 2)
  return b
}
const u16 = (arr) => {
  const b = Buffer.alloc(arr.length * 2)
  for (let i = 0; i < arr.length; i++) b.writeUInt16LE(arr[i], i * 2)
  return b
}
const vec3of = (att) => {
  // drop alpha if the source is VEC4 — t81_trim's rule, applied to the new bytes
  if (att.comps === 3) return att.v
  const out = new Float64Array((att.v.length / 4) * 3)
  for (let i = 0, j = 0; i < att.v.length; i += 4, j += 3) {
    out[j] = att.v[i]
    out[j + 1] = att.v[i + 1]
    out[j + 2] = att.v[i + 2]
  }
  return out
}
const minMax = (v, comps) => {
  const min = Array(comps).fill(Infinity)
  const max = Array(comps).fill(-Infinity)
  for (let i = 0; i < v.length; i += comps) {
    for (let c = 0; c < comps; c++) {
      if (v[i + c] < min[c]) min[c] = v[i + c]
      if (v[i + c] > max[c]) max[c] = v[i + c]
    }
  }
  return { min, max }
}

// --- rebuild ------------------------------------------------------------------

const json = ship.json
const prim = bakedMesh.primitives[0]
const posAcc = json.accessors[prim.attributes.POSITION]
const c0Acc = json.accessors[prim.attributes.COLOR_0]
const c1Acc = json.accessors[prim.attributes.COLOR_1]
const idxAcc = json.accessors[prim.indices]
const baseCount = posAcc.count

if (baseCount + stat.pos.count > 65535) throw new Error('uint16 index overflow')

// bytes to append per DeskBaked accessor
const appendFor = new Map()
appendFor.set(posAcc.bufferView, f32(Float32Array.from(stat.pos.v)))
appendFor.set(c0Acc.bufferView, u16n(vec3of(stat.c0)))
appendFor.set(c1Acc.bufferView, u16n(vec3of(stat.c1)))
appendFor.set(idxAcc.bufferView, u16(Array.from(stat.idx, (i) => i + baseCount)))

// verso: fresh bufferViews at the end
const versoPos = f32(Float32Array.from(verso.pos.v))
const versoC0 = u16n(vec3of(verso.c0))
const versoC1 = u16n(vec3of(verso.c1))
const versoIdx = u16(verso.idx)

// lay out the new bin: every original bufferView in order, extended where appended
let cursor = 0
const parts = []
for (let i = 0; i < json.bufferViews.length; i++) {
  const bv = json.bufferViews[i]
  const orig = ship.bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength)
  const extra = appendFor.get(i)
  const chunk = extra ? Buffer.concat([orig, extra]) : orig
  cursor = Math.ceil(cursor / 4) * 4
  json.bufferViews[i] = { ...bv, byteOffset: cursor, byteLength: chunk.length }
  parts.push({ at: cursor, chunk })
  cursor += chunk.length
}
const pushBv = (chunk, target) => {
  cursor = Math.ceil(cursor / 4) * 4
  json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: chunk.length, target })
  parts.push({ at: cursor, chunk })
  cursor += chunk.length
  return json.bufferViews.length - 1
}
const bvVersoPos = pushBv(versoPos, 34962)
const bvVersoC0 = pushBv(versoC0, 34962)
const bvVersoC1 = pushBv(versoC1, 34962)
const bvVersoIdx = pushBv(versoIdx, 34963)

// update DeskBaked accessors
const newCount = baseCount + stat.pos.count
posAcc.count = newCount
c0Acc.count = newCount
c1Acc.count = newCount
idxAcc.count += stat.idx.length
{
  // POSITION min/max must cover the appended verts
  const mm = minMax(stat.pos.v, 3)
  posAcc.min = posAcc.min.map((v, i) => Math.min(v, mm.min[i]))
  posAcc.max = posAcc.max.map((v, i) => Math.max(v, mm.max[i]))
}

// new accessors for the verso
const pushAcc = (acc) => {
  json.accessors.push(acc)
  return json.accessors.length - 1
}
const vmm = minMax(verso.pos.v, 3)
const accVersoPos = pushAcc({
  bufferView: bvVersoPos,
  componentType: 5126,
  count: verso.pos.count,
  type: 'VEC3',
  min: vmm.min,
  max: vmm.max,
})
const accVersoC0 = pushAcc({ bufferView: bvVersoC0, componentType: 5123, normalized: true, count: verso.pos.count, type: 'VEC3' })
const accVersoC1 = pushAcc({ bufferView: bvVersoC1, componentType: 5123, normalized: true, count: verso.pos.count, type: 'VEC3' })
const accVersoIdx = pushAcc({ bufferView: bvVersoIdx, componentType: 5123, count: verso.idx.length, type: 'SCALAR' })

// the fifth mesh + its node, sharing the baked material (the runtime replaces materials anyway)
json.meshes.push({
  name: 'BookVerso',
  primitives: [
    {
      attributes: { POSITION: accVersoPos, COLOR_0: accVersoC0, COLOR_1: accVersoC1 },
      indices: accVersoIdx,
      material: bakedMesh.primitives[0].material,
      mode: 4,
    },
  ],
})
json.nodes.push({ name: 'BookVerso', mesh: json.meshes.length - 1 })
json.scenes[0].nodes.push(json.nodes.length - 1)

// --- write --------------------------------------------------------------------

const bin = Buffer.alloc(Math.ceil(cursor / 4) * 4)
for (const p of parts) p.chunk.copy(bin, p.at)
json.buffers[0].byteLength = bin.length

let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)])
const total = 12 + 8 + jsonBuf.length + 8 + bin.length
const out = Buffer.alloc(total)
out.writeUInt32LE(0x46546c67, 0)
out.writeUInt32LE(2, 4)
out.writeUInt32LE(total, 8)
out.writeUInt32LE(jsonBuf.length, 12)
out.writeUInt32LE(0x4e4f534a, 16)
jsonBuf.copy(out, 20)
out.writeUInt32LE(bin.length, 20 + jsonBuf.length)
out.writeUInt32LE(0x004e4942, 24 + jsonBuf.length)
bin.copy(out, 28 + jsonBuf.length)
writeFileSync(outPath, out)

const shipRaw = readFileSync(shipPath)
console.log('raw:', shipRaw.length, '->', out.length, `(+${out.length - shipRaw.length})`)
const g0 = gzipSync(shipRaw).length
const g1 = gzipSync(out).length
console.log('gz :', g0, '->', g1, `(+${g1 - g0})`)
