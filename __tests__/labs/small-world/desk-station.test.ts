import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESK_GLB_URL, DESK_NUDGE_ZONES } from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { AMP_CAP } from '@/components/labs/small-world/scene/props/desk-nudge'
import {
  CAMERA_FOV,
  ENDING_AIM_DROP,
  ZOOM_FACTOR,
  endingRig,
} from '@/components/labs/small-world/scene/camera'
import {
  BAR_CLAIM,
  CASE_POP,
  CHIP_PRESS,
  KNIFE_CLAIM,
  PENCUP_BODY,
  PENCUP_PENS,
  SCOOT,
  SLOT_DIR,
  STATION_BARS,
  STATION_CASE,
  STATION_CHIPS,
  STATION_KNIFE,
  STATION_METAL_BODY,
  STATION_METAL_NORMAL_BODY,
  STATION_CLAIMS,
  STATION_TREE,
  STATION_VERTEX_BODY,
  TEETER,
  TREE_CLAIM,
  TREE_SWAY,
  caseFlexWeight,
  rayCylinderHit,
  raySegmentHit,
  raySphereHit,
  resolveDeskPick,
  restingCasePop,
  restingChipPress,
  restingScoot,
  restingTeeter,
  restingTreeSway,
  sampleCasePop,
  sampleChipPress,
  sampleScoot,
  sampleTeeter,
  sampleTreeSway,
  scootSignFrom,
  teeterSignFrom,
  triggerCasePop,
  triggerChipPress,
  triggerScoot,
  triggerTeeter,
  triggerTreeSway,
} from '@/components/labs/small-world/scene/props/desk-station'

/**
 * THE STATION GATE (T97 fixes S2+S3) — the sculpting corner's five voices, held to the shipped
 * bytes and to their own closed forms.
 *
 * Everything `desk-station.ts` types as a measurement is RE-DERIVED here from the GLB (the
 * desk-nudge-zones discipline: union-find over triangles plus co-located duplicates), because the
 * shader selects vertices by `gl_VertexID` range and moves them by fields anchored to typed
 * centres/seats/axes — a re-bake that reorders or moves an object would silently tear or misplace
 * a voice, and no type checker can see it. The closed forms are held to the T89 law: exact +0
 * rest, determinism to the bit, and hard caps (the bar scoot's travel is a CLEARANCE statement —
 * the tray wall is 0.068 away — so the cap is gated against the re-derived slack, not trusted).
 */

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))

type Gltf = {
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
}

const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

/** Minimal local GLB reader — deliberately independent of the runtime loader, like the zones gate. */
function readGlb(file: string): { json: Gltf; bin: Buffer } {
  const buf = readFileSync(file)
  expect(buf.readUInt32LE(0), 'GLB magic').toBe(0x46546c67)
  let off = 12
  let json: Gltf | null = null
  let bin: Buffer | null = null
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const kind = buf.readUInt32LE(off + 4)
    const body = buf.subarray(off + 8, off + 8 + len)
    if (kind === 0x4e4f534a) json = JSON.parse(body.toString('utf8')) as Gltf
    else if (kind === 0x004e4942) bin = body
    off += 8 + len + ((4 - (len % 4)) % 4)
  }
  if (!json || !bin) throw new Error('GLB missing a chunk')
  return { json, bin }
}

function readAccessor(g: Gltf, bin: Buffer, index: number): number[] {
  const a = g.accessors[index]
  const bv = g.bufferViews[a.bufferView]
  const comps = TYPE_COUNT[a.type]
  const size = COMPONENT_BYTES[a.componentType]
  const stride = bv.byteStride ?? comps * size
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const out: number[] = []
  for (let i = 0; i < a.count; i++) {
    const o = start + i * stride
    for (let c = 0; c < comps; c++) {
      const at = o + c * size
      out.push(
        a.componentType === 5126
          ? bin.readFloatLE(at)
          : a.componentType === 5125
            ? bin.readUInt32LE(at)
            : a.componentType === 5123
              ? bin.readUInt16LE(at)
              : bin.readUInt8(at)
      )
    }
  }
  return out
}

/** A mesh's positions plus the union-find over its physical objects (triangle edges unioned with
 *  co-located duplicates — the exporter splits hard edges). */
function meshGraph(g: Gltf, bin: Buffer, meshName: string): { pos: number[]; find: (x: number) => number; n: number } {
  const mesh = g.meshes.find((m) => m.name === meshName || m.name.startsWith(meshName))
  if (!mesh) throw new Error(`mesh ${meshName} missing`)
  const prim = mesh.primitives[0]
  const pos = readAccessor(g, bin, prim.attributes.POSITION)
  if (prim.indices === undefined) throw new Error(`${meshName} unindexed`)
  const idx = readAccessor(g, bin, prim.indices)
  const n = pos.length / 3
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const seen = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const key = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`
    const prev = seen.get(key)
    if (prev !== undefined) union(i, prev)
    else seen.set(key, i)
  }
  for (let t = 0; t < idx.length; t += 3) {
    union(idx[t], idx[t + 1])
    union(idx[t], idx[t + 2])
  }
  return { pos, find, n }
}

type Comp = {
  count: number
  idMin: number
  idMax: number
  min: [number, number, number]
  max: [number, number, number]
  centroid: [number, number, number]
}

function componentAt(
  graph: { pos: number[]; find: (x: number) => number; n: number },
  member: number
): Comp {
  const root = graph.find(member)
  const c: Comp = {
    count: 0,
    idMin: Infinity,
    idMax: -Infinity,
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    centroid: [0, 0, 0],
  }
  for (let i = 0; i < graph.n; i++) {
    if (graph.find(i) !== root) continue
    c.count++
    if (i < c.idMin) c.idMin = i
    if (i > c.idMax) c.idMax = i
    for (let a = 0; a < 3; a++) {
      const v = graph.pos[i * 3 + a]
      if (v < c.min[a]) c.min[a] = v
      if (v > c.max[a]) c.max[a] = v
      c.centroid[a] += v
    }
  }
  for (let a = 0; a < 3; a++) c.centroid[a] /= c.count
  return c
}

const { json, bin } = readGlb(glbPath)
const baked = meshGraph(json, bin, 'DeskBaked')
const metal = meshGraph(json, bin, 'DeskMetal')

const expectClose = (got: number, want: number, label: string, tol = 1e-3): void => {
  expect(Math.abs(got - want), `${label}: got ${got}, want ${want}`).toBeLessThanOrEqual(tol)
}

/** One-whole-component check: the run [lo, hi] IS the component of its first vertex. */
const expectWhole = (range: readonly [number, number] | readonly number[], label: string): Comp => {
  const [lo, hi] = range
  const c = componentAt(baked, lo)
  expect(c.idMin, `${label} idMin`).toBe(lo)
  expect(c.idMax, `${label} idMax`).toBe(hi)
  expect(c.count, `${label} contiguous`).toBe(hi - lo + 1)
  return c
}

/** Projection extent of a run onto the slot axis (xz). */
const slotSpan = (range: readonly number[]): [number, number] => {
  let lo = Infinity
  let hi = -Infinity
  for (let i = range[0]; i <= range[1]; i++) {
    const p = baked.pos[i * 3] * SLOT_DIR[0] + baked.pos[i * 3 + 2] * SLOT_DIR[2]
    if (p < lo) lo = p
    if (p > hi) hi = p
  }
  return [lo, hi]
}

/** The neighbours the case pop must structurally not reach — measurement inputs, like the zones
 *  gate's occupancy table; their id runs were derived by the same union-find that gates them. */
const CASE_NEIGHBOURS = {
  paper1: [38241, 38320],
  paper2: [38321, 38376],
  chipRow: [37215, 38240],
  tray: [31272, 32615],
} as const

const caseClaimBox = ((): { min: readonly number[]; max: readonly number[] } => {
  const z = STATION_CLAIMS.find((s) => s.shape === 'box')
  if (!z || z.shape !== 'box') throw new Error('case claim missing')
  return z
})()

/** Distance from a point to segment AB — the capsule-fit gate's ruler. */
const segDist = (
  px: number,
  py: number,
  pz: number,
  A: readonly [number, number, number],
  B: readonly [number, number, number]
): number => {
  const vx = B[0] - A[0]
  const vy = B[1] - A[1]
  const vz = B[2] - A[2]
  const wx = px - A[0]
  const wy = py - A[1]
  const wz = pz - A[2]
  const c2 = vx * vx + vy * vy + vz * vz
  let s = c2 > 0 ? (wx * vx + wy * vy + wz * vz) / c2 : 0
  s = Math.min(Math.max(s, 0), 1)
  return Math.hypot(wx - s * vx, wy - s * vy, wz - s * vz)
}

const countInBox = (range: readonly number[], box: { min: readonly number[]; max: readonly number[] }): number => {
  let c = 0
  for (let i = range[0]; i <= range[1]; i++) {
    const x = baked.pos[i * 3]
    const y = baked.pos[i * 3 + 1]
    const z = baked.pos[i * 3 + 2]
    if (
      x >= box.min[0] && x <= box.max[0] &&
      y >= box.min[1] && y <= box.max[1] &&
      z >= box.min[2] && z <= box.max[2]
    )
      c++
  }
  return c
}

describe('the station ranges are whole components of the shipped bytes', () => {
  it('every bar is one whole contiguous component', () => {
    for (const b of STATION_BARS) expectWhole(b.range, `bar ${b.id}`)
  })

  it('every chip is one whole contiguous component', () => {
    for (const c of STATION_CHIPS) expectWhole(c.range, `chip ${c.id}`)
  })

  it('tree pot, tree foliage and the knife handle are whole components', () => {
    expectWhole(STATION_TREE.potRange, 'tree pot')
    expectWhole(STATION_TREE.foliageRange, 'tree foliage')
    expectWhole(STATION_KNIFE.handleRange, 'knife handle')
  })

  it('the case run is id-closed: a union of whole components covering exactly [35407, 37214]', () => {
    // The shipped case is THREE components (inner sheet, lid sheet, body) written contiguously —
    // measured, and why the module says "id-closed" rather than "one component". What the shader
    // needs is that the range tears nothing: every component it touches lies wholly inside it.
    const [lo, hi] = STATION_CASE.range
    const roots = new Set<number>()
    for (let i = lo; i <= hi; i++) roots.add(baked.find(i))
    let covered = 0
    for (const r of roots) {
      const c = componentAt(baked, r)
      expect(c.idMin, 'case component straddles the range start').toBeGreaterThanOrEqual(lo)
      expect(c.idMax, 'case component straddles the range end').toBeLessThanOrEqual(hi)
      covered += c.count
    }
    expect(covered, 'case range fully covered by its components').toBe(hi - lo + 1)
  })
})

describe('the typed tables match the re-derived bytes to 1e-3', () => {
  it('bar AABBs and centres', () => {
    for (const b of STATION_BARS) {
      const c = componentAt(baked, b.range[0])
      for (let a = 0; a < 3; a++) {
        expectClose(c.min[a], b.aabb.min[a], `bar ${b.id} min[${a}]`)
        expectClose(c.max[a], b.aabb.max[a], `bar ${b.id} max[${a}]`)
      }
      expectClose(c.centroid[0], b.centre[0], `bar ${b.id} centre x`)
      expectClose(c.centroid[2], b.centre[1], `bar ${b.id} centre z`)
    }
  })

  it('chip AABBs, centres and seats', () => {
    for (const ch of STATION_CHIPS) {
      const c = componentAt(baked, ch.range[0])
      for (let a = 0; a < 3; a++) {
        expectClose(c.min[a], ch.aabb.min[a], `chip ${ch.id} min[${a}]`)
        expectClose(c.max[a], ch.aabb.max[a], `chip ${ch.id} max[${a}]`)
      }
      expectClose(c.centroid[0], ch.centre[0], `chip ${ch.id} centre x`)
      expectClose(c.centroid[2], ch.centre[1], `chip ${ch.id} centre z`)
      expectClose(c.min[1], ch.seat, `chip ${ch.id} seat`)
    }
  })

  it('tree base, bend band and the case corner', () => {
    const foliage = componentAt(baked, STATION_TREE.foliageRange[0])
    expectClose(foliage.centroid[0], STATION_TREE.base[0], 'rosette base x')
    expectClose(foliage.centroid[2], STATION_TREE.base[1], 'rosette base z')
    // The bend band brackets the foliage: y0 within a leaf's thickness of its lowest vertex
    // (weight 0 at the pot rim), yTop at its crown.
    expect(Math.abs(STATION_TREE.bendY0 - foliage.min[1])).toBeLessThanOrEqual(0.02)
    expectClose(STATION_TREE.bendYTop, foliage.max[1], 'bend yTop', 1e-2)
    // The pop corner is the case's min-x VERTEX — a real point on the rotated body, not the
    // AABB corner (which is air 0.3766 from the nearest vertex; the field anchored there was
    // near-silent at every vertex that exists).
    let minX = Infinity
    let minXz = 0
    for (let i = STATION_CASE.range[0]; i <= STATION_CASE.range[1]; i++) {
      if (baked.pos[i * 3] < minX) {
        minX = baked.pos[i * 3]
        minXz = baked.pos[i * 3 + 2]
      }
    }
    expectClose(minX, STATION_CASE.corner[0], 'case corner x')
    expectClose(minXz, STATION_CASE.corner[1], 'case corner z')
  })

  it('knife assembly, pivot, long dir and halfLen', () => {
    const handle = componentAt(baked, STATION_KNIFE.handleRange[0])
    const blade = componentAt(metal, 2011)
    for (let a = 0; a < 3; a++) {
      expectClose(blade.min[a], STATION_KNIFE.bladeAabb.min[a], `blade min[${a}]`)
      expectClose(blade.max[a], STATION_KNIFE.bladeAabb.max[a], `blade max[${a}]`)
      expectClose(Math.min(handle.min[a], blade.min[a]), STATION_KNIFE.assemblyAabb.min[a], `assembly min[${a}]`)
      expectClose(Math.max(handle.max[a], blade.max[a]), STATION_KNIFE.assemblyAabb.max[a], `assembly max[${a}]`)
    }
    // pivot = the assembly footprint's centre at its seat
    expectClose(
      (STATION_KNIFE.assemblyAabb.min[0] + STATION_KNIFE.assemblyAabb.max[0]) / 2,
      STATION_KNIFE.pivot[0],
      'pivot x'
    )
    expectClose(
      (STATION_KNIFE.assemblyAabb.min[2] + STATION_KNIFE.assemblyAabb.max[2]) / 2,
      STATION_KNIFE.pivot[2],
      'pivot z'
    )
    expectClose(STATION_KNIFE.assemblyAabb.min[1], STATION_KNIFE.pivot[1], 'pivot y')
    // halfLen: the farthest assembly vertex from the pivot along the long dir
    let reach = 0
    const scan = (pos: number[], range: readonly number[]): void => {
      for (let i = range[0]; i <= range[1]; i++) {
        const p =
          (pos[i * 3] - STATION_KNIFE.pivot[0]) * STATION_KNIFE.longDir[0] +
          (pos[i * 3 + 2] - STATION_KNIFE.pivot[2]) * STATION_KNIFE.longDir[2]
        if (Math.abs(p) > reach) reach = Math.abs(p)
      }
    }
    scan(baked.pos, STATION_KNIFE.handleRange)
    scan(metal.pos, [blade.idMin, blade.idMax])
    expectClose(reach, STATION_KNIFE.halfLen, 'halfLen', 0.02)
  })
})

describe('bar slots: shared axis and re-derived scoot clearance', () => {
  it('every bar\'s PCA principal axis agrees with SLOT_DIR to better than 0.999', () => {
    for (const b of STATION_BARS) {
      const [lo, hi] = b.range
      const n = hi - lo + 1
      let sx = 0
      let sz = 0
      for (let i = lo; i <= hi; i++) {
        sx += baked.pos[i * 3]
        sz += baked.pos[i * 3 + 2]
      }
      const mx = sx / n
      const mz = sz / n
      let cxx = 0
      let cxz = 0
      let czz = 0
      for (let i = lo; i <= hi; i++) {
        const dx = baked.pos[i * 3] - mx
        const dz = baked.pos[i * 3 + 2] - mz
        cxx += dx * dx
        cxz += dx * dz
        czz += dz * dz
      }
      const tr = cxx + czz
      const det = cxx * czz - cxz * cxz
      const l1 = tr / 2 + Math.sqrt((tr * tr) / 4 - det)
      const am = Math.hypot(l1 - czz, cxz)
      const dot = Math.abs(((l1 - czz) * SLOT_DIR[0] + cxz * SLOT_DIR[2]) / am)
      expect(dot, `bar ${b.id} axis`).toBeGreaterThan(0.999)
    }
  })

  it('along-slot slack against the tray floor covers the scoot cap plus margin, both ways', () => {
    const [floorLo, floorHi] = slotSpan([31025, 31271])
    for (const b of STATION_BARS) {
      const [lo, hi] = slotSpan(b.range)
      expect(floorHi - hi, `bar ${b.id} slack +`).toBeGreaterThanOrEqual(SCOOT.travelMax + 0.015)
      expect(lo - floorLo, `bar ${b.id} slack -`).toBeGreaterThanOrEqual(SCOOT.travelMax + 0.015)
    }
  })

  it('each bar capsule fits its bar: re-derived halfLen, every vertex within r of the axis', () => {
    STATION_BARS.forEach((b, i) => {
      const [lo, hi] = slotSpan(b.range)
      expectClose((hi - lo) / 2, BAR_CLAIM.halfLens[i], `bar ${b.id} halfLen`, 1e-3)
      // vert-to-AXIS (the infinite slot line at the bars' common height): the capsule is
      // centroid-centred while the span midpoint can sit a few cm off-centroid, so tip verts
      // may overhang the caps by a sub-r sliver — the radius is the fit that matters, and the
      // sweep below is the gate on what actually resolves.
      let dMax = 0
      for (let v = b.range[0]; v <= b.range[1]; v++) {
        const wx = baked.pos[v * 3] - b.centre[0]
        const wy = baked.pos[v * 3 + 1] - BAR_CLAIM.axisY
        const wz = baked.pos[v * 3 + 2] - b.centre[1]
        const along = wx * SLOT_DIR[0] + wz * SLOT_DIR[2]
        const d = Math.hypot(wx - along * SLOT_DIR[0], wy, wz - along * SLOT_DIR[2])
        if (d > dMax) dMax = d
      }
      expect(dMax, `bar ${b.id} within its claim radius`).toBeLessThanOrEqual(BAR_CLAIM.r)
    })
  })
})

describe('the case pop is structurally scoped', () => {
  it('every neighbour sits beyond the flex radius, where the field is exactly zero', () => {
    for (const [name, range] of Object.entries(CASE_NEIGHBOURS)) {
      let dMin = Infinity
      for (let i = range[0]; i <= range[1]; i++) {
        const d = Math.hypot(
          baked.pos[i * 3] - STATION_CASE.corner[0],
          baked.pos[i * 3 + 2] - STATION_CASE.corner[1]
        )
        if (d < dMin) dMin = d
      }
      expect(dMin, `${name} distance`).toBeGreaterThan(STATION_CASE.radius)
      expect(Object.is(caseFlexWeight(dMin), 0), `${name} flex weight is exact +0`).toBe(true)
    }
  })

  it('the pop corner is a REAL case vertex, not AABB air', () => {
    // the first two cuts anchored the field at the AABB corner of a rotated body — 0.3766 from
    // the nearest vertex that exists, so the pop was near-silent (addendum, measured)
    let dMin = Infinity
    for (let i = STATION_CASE.range[0]; i <= STATION_CASE.range[1]; i++) {
      const d = Math.hypot(
        baked.pos[i * 3] - STATION_CASE.corner[0],
        baked.pos[i * 3 + 2] - STATION_CASE.corner[1]
      )
      if (d < dMin) dMin = d
    }
    expect(dMin).toBeLessThanOrEqual(1e-3)
  })
})

describe('the knife', () => {
  it('the padded blade box holds the whole blade component and touches no other metal', () => {
    const p = STATION_KNIFE.bladePad
    const box = {
      min: STATION_KNIFE.bladeAabb.min.map((v) => v - p),
      max: STATION_KNIFE.bladeAabb.max.map((v) => v + p),
    }
    const roots = new Set<number>()
    for (let i = 0; i < metal.n; i++) roots.add(metal.find(i))
    let holds = 0
    for (const r of roots) {
      const c = componentAt(metal, r)
      const intersects =
        c.min[0] <= box.max[0] && c.max[0] >= box.min[0] &&
        c.min[1] <= box.max[1] && c.max[1] >= box.min[1] &&
        c.min[2] <= box.max[2] && c.max[2] >= box.min[2]
      if (!intersects) continue
      holds++
      for (let a = 0; a < 3; a++) {
        expect(c.min[a], 'blade wholly inside the padded box').toBeGreaterThanOrEqual(box.min[a])
        expect(c.max[a], 'blade wholly inside the padded box').toBeLessThanOrEqual(box.max[a])
      }
    }
    expect(holds, 'exactly one metal component in the padded box').toBe(1)
  })

  it('the teeter axis is horizontal-perpendicular to the long dir, and +θ dips the blade end', () => {
    const dot =
      STATION_KNIFE.axis[0] * STATION_KNIFE.longDir[0] + STATION_KNIFE.axis[2] * STATION_KNIFE.longDir[2]
    expect(Math.abs(dot)).toBeLessThan(1e-3)
    expect(STATION_KNIFE.axis[1]).toBe(0)
    // sign convention: axis × (blade − pivot) must point DOWN, so +θ (a blade-side tap) dips the
    // tapped end first
    const blade = componentAt(metal, 2011)
    const rx = blade.centroid[0] - STATION_KNIFE.pivot[0]
    const rz = blade.centroid[2] - STATION_KNIFE.pivot[2]
    const crossY = STATION_KNIFE.axis[2] * rx - STATION_KNIFE.axis[0] * rz
    expect(crossY).toBeLessThan(0)
    expect(teeterSignFrom([blade.centroid[0], 1.35, blade.centroid[2]])).toBe(1)
    const handle = componentAt(baked, STATION_KNIFE.handleRange[0])
    expect(teeterSignFrom([handle.max[0], 1.35, handle.min[2]])).toBe(-1)
  })

  it('the clatter hop covers at least 0.3 of the crest dip', () => {
    const crest = (TEETER.crestDeg * Math.PI) / 180
    const dip = STATION_KNIFE.halfLen * Math.sin(crest)
    const hop = STATION_KNIFE.hopK * STATION_KNIFE.halfLen * Math.abs(Math.sin(crest))
    expect(hop / dip).toBeGreaterThanOrEqual(0.3)
  })

  it('one claim capsule holds the whole knife — handle and blade', () => {
    let dMax = 0
    for (let i = STATION_KNIFE.handleRange[0]; i <= STATION_KNIFE.handleRange[1]; i++) {
      const d = segDist(baked.pos[i * 3], baked.pos[i * 3 + 1], baked.pos[i * 3 + 2], KNIFE_CLAIM.a, KNIFE_CLAIM.b)
      if (d > dMax) dMax = d
    }
    const blade = componentAt(metal, 2011)
    for (let i = blade.idMin; i <= blade.idMax; i++) {
      const d = segDist(metal.pos[i * 3], metal.pos[i * 3 + 1], metal.pos[i * 3 + 2], KNIFE_CLAIM.a, KNIFE_CLAIM.b)
      if (d > dMax) dMax = d
    }
    expect(dMax, 'knife max vert-to-segment').toBeLessThanOrEqual(KNIFE_CLAIM.r)
  })

  it('the tree claim capsule contains the whole crown, taper included', () => {
    let dMax = 0
    for (let i = STATION_TREE.foliageRange[0]; i <= STATION_TREE.foliageRange[1]; i++) {
      const d = segDist(baked.pos[i * 3], baked.pos[i * 3 + 1], baked.pos[i * 3 + 2], TREE_CLAIM.a, TREE_CLAIM.b)
      if (d > dMax) dMax = d
    }
    expect(dMax, 'crown max vert-to-segment').toBeLessThanOrEqual(TREE_CLAIM.r)
  })
})

describe('the closed forms: exact rest, determinism, caps', () => {
  const u = (): Float32Array => new Float32Array(4)

  it('a full scoot crests at the authored amp, overshoots once, and settles to exact +0', () => {
    const s = restingScoot()
    triggerScoot(s, 0, 1, 1, 1)
    const out0 = u()
    const out1 = u()
    let peak = 0
    let trough = 0
    for (let t = 0; t <= 4; t += 1 / 240) {
      sampleScoot(s, t, out0, out1)
      if (out0[2] > peak) peak = out0[2]
      if (out0[2] < trough) trough = out0[2]
    }
    expectClose(peak, SCOOT.amp, 'scoot crest', 1e-3)
    expect(trough, 'one overshoot back past the seat').toBeLessThan(-0.005)
    sampleScoot(s, 30, out0, out1)
    for (let i = 0; i < 4; i++) {
      expect(Object.is(out0[i], 0), `slot0[${i}] exact +0`).toBe(true)
      expect(Object.is(out1[i], 0), `slot1[${i}] exact +0`).toBe(true)
    }
    expect(s.slots[0].active).toBe(false)
  })

  it('scoot travel never exceeds the cap across pile-up re-pokes', () => {
    const s = restingScoot()
    const out0 = u()
    const out1 = u()
    for (let k = 0; k < 40; k++) {
      triggerScoot(s, k * 0.05, 2, 1, 1)
      for (let t = k * 0.05; t < (k + 1) * 0.05; t += 1 / 480) {
        sampleScoot(s, t, out0, out1)
        expect(Math.abs(out0[2])).toBeLessThanOrEqual(SCOOT.travelMax + 1e-9)
      }
    }
    for (let t = 2; t <= 8; t += 1 / 480) {
      sampleScoot(s, t, out0, out1)
      expect(Math.abs(out0[2])).toBeLessThanOrEqual(SCOOT.travelMax + 1e-9)
    }
  })

  it('two slots serve two bars; a third steals the more-settled slot; the scoot sign points away', () => {
    const s = restingScoot()
    triggerScoot(s, 0, 1, 1, 1)
    triggerScoot(s, 0.1, 3, -1, 1)
    const out0 = u()
    const out1 = u()
    sampleScoot(s, 0.15, out0, out1)
    expect(out0[0]).toBe(STATION_BARS[1].range[0])
    expect(out1[0]).toBe(STATION_BARS[3].range[0])
    triggerScoot(s, 0.2, 4, 1, 1)
    const bars = new Set(s.slots.map((sl) => sl.bar))
    expect(bars.has(4)).toBe(true)
    expect(bars.size).toBe(2)
    // sign: a poke on the bar's +SLOT_DIR end scoots it the other way
    const b = STATION_BARS[1]
    const hit: [number, number, number] = [b.centre[0] + SLOT_DIR[0] * 0.2, 1.37, b.centre[1] + SLOT_DIR[2] * 0.2]
    expect(scootSignFrom(hit, b.centre)).toBe(-1)
    expect(scootSignFrom([b.centre[0] - SLOT_DIR[0] * 0.2, 1.37, b.centre[1] - SLOT_DIR[2] * 0.2], b.centre)).toBe(1)
  })

  it('the tree sway crests near its amp, stays inside the energy cap, and settles to exact +0', () => {
    const s = restingTreeSway()
    triggerTreeSway(s, 0, 1, 0, 1)
    const out = u()
    let peak = 0
    for (let t = 0; t <= 5; t += 1 / 240) {
      sampleTreeSway(s, t, out)
      const m = Math.hypot(out[0], out[1])
      if (m > peak) peak = m
    }
    expect(peak).toBeGreaterThan(TREE_SWAY.amp * 0.9)
    for (let k = 0; k < 20; k++) triggerTreeSway(s, 5 + k * 0.04, 0.7, 0.7, 1)
    for (let t = 5.8; t <= 9; t += 1 / 240) {
      sampleTreeSway(s, t, out)
      expect(Math.hypot(out[0], out[1])).toBeLessThanOrEqual(TREE_SWAY.amp * AMP_CAP + 1e-9)
    }
    sampleTreeSway(s, 60, out)
    for (let i = 0; i < 4; i++) expect(Object.is(out[i], 0), `tree[${i}] exact +0`).toBe(true)
    expect(s.active).toBe(false)
  })

  it('the teeter crests at 4.5 degrees, alternates sign, and settles to exact +0', () => {
    const s = restingTeeter()
    triggerTeeter(s, 0, 1, 1)
    const out = u()
    let peak = 0
    let trough = 0
    for (let t = 0; t <= 3; t += 1 / 480) {
      sampleTeeter(s, t, out)
      if (out[0] > peak) peak = out[0]
      if (out[0] < trough) trough = out[0]
    }
    expectClose(peak, (TEETER.crestDeg * Math.PI) / 180, 'teeter crest', 1e-3)
    expect(trough, 'the see-saw alternates').toBeLessThan(-0.01)
    sampleTeeter(s, 30, out)
    for (let i = 0; i < 4; i++) expect(Object.is(out[i], 0), `teeter[${i}] exact +0`).toBe(true)
  })

  it('the case pop crests at its amp, deepens on a re-press instead of popping, and settles', () => {
    const s = restingCasePop()
    triggerCasePop(s, 0, 1)
    const out = u()
    let peak = 0
    for (let t = 0; t <= 2; t += 1 / 480) {
      sampleCasePop(s, t, out)
      if (out[0] > peak) peak = out[0]
    }
    expectClose(peak, CASE_POP.amp, 'pop crest', 1e-3)
    sampleCasePop(s, 0.5 - 1e-4, out)
    const before = out[0]
    triggerCasePop(s, 0.5, 1)
    sampleCasePop(s, 0.5 + 1e-4, out)
    expect(out[0], 're-press never pops').toBeGreaterThanOrEqual(before - 1e-4)
    sampleCasePop(s, 30, out)
    for (let i = 0; i < 4; i++) expect(Object.is(out[i], 0), `case[${i}] exact +0`).toBe(true)
  })

  it('a chip press squashes toward its own seat, carries its id range, and settles to exact +0', () => {
    const s = restingChipPress()
    triggerChipPress(s, 0, 5, 1)
    const out0 = u()
    const out1 = u()
    sampleChipPress(s, 0.05, out0, out1)
    expect(out0[0]).toBe(STATION_CHIPS[5].range[0])
    expect(out0[1]).toBe(STATION_CHIPS[5].range[1])
    expect(out0[3]).toBeCloseTo(STATION_CHIPS[5].seat, 4)
    let peak = 0
    for (let t = 0; t <= 2; t += 1 / 480) {
      sampleChipPress(s, t, out0, out1)
      if (out0[2] > peak) peak = out0[2]
    }
    expectClose(peak, CHIP_PRESS.squash, 'squash crest', 2e-3)
    // a second chip takes the other slot; a third steals the more-settled one
    triggerChipPress(s, 0.06, 7, 1)
    triggerChipPress(s, 0.07, 9, 1)
    const chips = new Set(s.slots.map((sl) => sl.chip))
    expect(chips.size).toBe(2)
    expect(chips.has(9)).toBe(true)
    sampleChipPress(s, 30, out0, out1)
    for (let i = 0; i < 4; i++) {
      expect(Object.is(out0[i], 0), `chip0[${i}] exact +0`).toBe(true)
      expect(Object.is(out1[i], 0), `chip1[${i}] exact +0`).toBe(true)
    }
  })

  it('every voice is deterministic: the same trigger sequence is bit-identical', () => {
    const run = (): number[] => {
      const frames: number[] = []
      const scoot = restingScoot()
      const chip = restingChipPress()
      const tree = restingTreeSway()
      const knife = restingTeeter()
      const casePop = restingCasePop()
      const b0 = u()
      const b1 = u()
      const c0 = u()
      const c1 = u()
      const tr = u()
      const kn = u()
      const ca = u()
      triggerScoot(scoot, 0.01, 1, 1, 0.35)
      triggerChipPress(chip, 0.02, 3, 1)
      triggerTreeSway(tree, 0.03, 0.6, -0.8, 1)
      triggerTeeter(knife, 0.04, -1, 1)
      triggerCasePop(casePop, 0.05, 1)
      triggerScoot(scoot, 0.3, 1, -1, 1)
      triggerScoot(scoot, 0.31, 5, 1, 1)
      triggerTeeter(knife, 0.5, 1, 0.35)
      for (let t = 0; t <= 3; t += 1 / 120) {
        sampleScoot(scoot, t, b0, b1)
        sampleChipPress(chip, t, c0, c1)
        sampleTreeSway(tree, t, tr)
        sampleTeeter(knife, t, kn)
        sampleCasePop(casePop, t, ca)
        for (const arr of [b0, b1, c0, c1, tr, kn, ca]) frames.push(arr[0], arr[1], arr[2], arr[3])
      }
      return frames
    }
    const a = run()
    const b = run()
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i++) {
      expect(Object.is(a[i], b[i]), `frame value ${i}`).toBe(true)
    }
  })
})

describe('the chunk text keeps the law', () => {
  it('every uniform is exact-zero guarded', () => {
    for (const guard of [
      'uStBar0.z != 0.0',
      'uStBar1.z != 0.0',
      'uStChip0.z != 0.0',
      'uStChip1.z != 0.0',
      'uStTree.x != 0.0',
      'uStKnife.x != 0.0',
      'uStCase.x != 0.0',
    ]) {
      expect(STATION_VERTEX_BODY, guard).toContain(guard)
    }
    expect(STATION_METAL_BODY).toContain('uStKnife.x != 0.0')
    expect(STATION_METAL_NORMAL_BODY).toContain('uStKnife.x != 0.0')
  })

  it('bar and chip slots select by gl_VertexID against their own uniform, not by box', () => {
    for (const un of ['uStBar0', 'uStBar1', 'uStChip0', 'uStChip1']) {
      expect(STATION_VERTEX_BODY).toContain(`float( gl_VertexID ) >= ${un}.x`)
      expect(STATION_VERTEX_BODY).toContain(`float( gl_VertexID ) <= ${un}.y`)
    }
    // the fixed owners stay literal id ranges
    expect(STATION_VERTEX_BODY).toContain(`gl_VertexID >= ${STATION_TREE.foliageRange[0]}`)
    expect(STATION_VERTEX_BODY).toContain(`gl_VertexID >= ${STATION_KNIFE.handleRange[0]}`)
    expect(STATION_VERTEX_BODY).toContain(`gl_VertexID >= ${STATION_CASE.range[0]}`)
  })

  it('the metal chunk rotates the normal with the teeter', () => {
    expect(STATION_METAL_NORMAL_BODY).toContain('objectNormal =')
    expect(STATION_METAL_NORMAL_BODY).toContain('cross( stNAx, objectNormal )')
  })

  it('the bar chunk carries the shuffle hop at the authored factor', () => {
    // a translation along a self-similar tube changes pixels only at its end caps (capture
    // round); the hop lifts the whole silhouette by hop·|offset|, same uniform, same guard
    for (const un of ['uStBar0', 'uStBar1']) {
      expect(STATION_VERTEX_BODY).toContain(`${SCOOT.hop.toFixed(5)} * abs( ${un}.z )`)
    }
  })

  it('the tree weight is linear in height, not squared', () => {
    expect(STATION_VERTEX_BODY).not.toContain('stW * stW')
  })
})

describe('no station ray zone swallows a foreign voice', () => {
  it('the case claim box contains no bar, chip, tree or knife vertices', () => {
    for (const b of STATION_BARS) expect(countInBox(b.range, caseClaimBox), `bar ${b.id} in case box`).toBe(0)
    for (const c of STATION_CHIPS) expect(countInBox(c.range, caseClaimBox), `chip ${c.id} in case box`).toBe(0)
    expect(countInBox(STATION_TREE.potRange, caseClaimBox), 'tree pot in case box').toBe(0)
    expect(countInBox(STATION_TREE.foliageRange, caseClaimBox), 'tree foliage in case box').toBe(0)
    expect(countInBox(STATION_KNIFE.handleRange, caseClaimBox), 'knife handle in case box').toBe(0)
  })
})

describe('the pen cup\'s rebuilt claim (capture rounds: box air shadowed the tray)', () => {
  it('each pen capsule fits its own whole component', () => {
    for (const p of PENCUP_PENS) {
      const graph = p.mesh === 'DeskMetal' ? metal : baked
      // the pen ranges are whole components too — same discipline as the station's own runs
      const c = componentAt(graph, p.range[0])
      expect(c.idMin, `pen ${p.id} idMin`).toBe(p.range[0])
      expect(c.idMax, `pen ${p.id} idMax`).toBe(p.range[1])
      let dMax = 0
      for (let i = p.range[0]; i <= p.range[1]; i++) {
        const d = segDist(graph.pos[i * 3], graph.pos[i * 3 + 1], graph.pos[i * 3 + 2], p.a, p.b)
        if (d > dMax) dMax = d
      }
      expect(dMax, `pen ${p.id} max vert-to-segment`).toBeLessThanOrEqual(p.r)
    }
  })

  it('the body cylinder covers the cup\'s real reach from its axis', () => {
    const t89 = DESK_NUDGE_ZONES.find((z) => z.kind === 'pencup')
    if (!t89) throw new Error('pencup zone missing')
    let reach = 0
    const scan = (graph: { pos: number[]; n: number }): void => {
      for (let i = 0; i < graph.n; i++) {
        const x = graph.pos[i * 3]
        const y = graph.pos[i * 3 + 1]
        const z = graph.pos[i * 3 + 2]
        if (
          x < t89.min[0] || x > t89.max[0] ||
          y < t89.min[1] || y > Math.min(t89.max[1], PENCUP_BODY.yMax) ||
          z < t89.min[2] || z > t89.max[2]
        )
          continue
        const d = Math.hypot(x - PENCUP_BODY.centre[0], z - PENCUP_BODY.centre[1])
        if (d > reach) reach = d
      }
    }
    scan(baked)
    scan(metal)
    expect(reach, 'cup body reach within the claim cylinder').toBeLessThanOrEqual(PENCUP_BODY.radius)
  })

  it('rayCylinderHit: entry distances, caps, and misses behave', () => {
    const { centre, radius, yMin, yMax } = PENCUP_BODY
    // straight down onto the top cap
    const down = rayCylinderHit(centre[0], 5, centre[1], 0, -1, 0, centre[0], centre[1], radius, yMin, yMax)
    expect(down).toBeCloseTo(5 - yMax, 10)
    // straight down just outside the radius: miss
    expect(
      rayCylinderHit(centre[0] + radius + 0.001, 5, centre[1], 0, -1, 0, centre[0], centre[1], radius, yMin, yMax)
    ).toBeNull()
    // horizontal through the axis inside the band: entry at the near wall
    const side = rayCylinderHit(centre[0] - 2, (yMin + yMax) / 2, centre[1], 1, 0, 0, centre[0], centre[1], radius, yMin, yMax)
    expect(side).toBeCloseTo(2 - radius, 10)
    // horizontal ABOVE the band (the old box's air): miss — the claim shadow is gone
    expect(
      rayCylinderHit(centre[0] - 2, yMax + 0.3, centre[1], 1, 0, 0, centre[0], centre[1], radius, yMin, yMax)
    ).toBeNull()
    // origin inside: claims at 0
    expect(
      rayCylinderHit(centre[0], (yMin + yMax) / 2, centre[1], 1, 0, 0, centre[0], centre[1], radius, yMin, yMax)
    ).toBe(0)
  })
})

describe('the claim primitives (round 3)', () => {
  const A: readonly [number, number, number] = [0, 0, 0]
  const B: readonly [number, number, number] = [10, 0, 0]

  it('raySegmentHit: perpendicular approach, endpoint caps, clamped origin, misses', () => {
    expect(raySegmentHit(5, 5, 0, 0, -1, 0, A, B, 0.5)).toBeCloseTo(5, 10)
    expect(raySegmentHit(5, 5, 0.4, 0, -1, 0, A, B, 0.5)).toBeCloseTo(5, 10)
    // past the endpoint: the cap claims within r, air beyond it does not
    expect(raySegmentHit(10.4, 5, 0, 0, -1, 0, A, B, 0.5)).toBeCloseTo(5, 10)
    expect(raySegmentHit(10.6, 5, 0, 0, -1, 0, A, B, 0.5)).toBeNull()
    // moving away with the origin already inside the capsule: claims at t = 0
    expect(raySegmentHit(5, 0.4, 0, 0, 1, 0, A, B, 0.5)).toBe(0)
    expect(raySegmentHit(5, 2, 0, 0, 1, 0, A, B, 0.5)).toBeNull()
  })

  it('raySphereHit: entry distance, inside origin, misses, behind-the-origin', () => {
    expect(raySphereHit(0, 0, 5, 0, 0, -1, [0, 0, 0], 1)).toBeCloseTo(4, 10)
    expect(raySphereHit(0, 0, 0.5, 0, 0, -1, [0, 0, 0], 1)).toBe(0)
    expect(raySphereHit(2, 0, 5, 0, 0, -1, [0, 0, 0], 1)).toBeNull()
    expect(raySphereHit(0, 0, -5, 0, 0, -1, [0, 0, 0], 1)).toBeNull()
  })
})

describe('the claim-resolution sweep under the settled ending eye (the decisive gate)', () => {
  // The settled ending pose at full zoom, parallax 0 — the rig the money shot actually uses
  // (ending-camera.test.ts holds this same construction to the composition), at the 1440x900
  // reference height. Every station target must win its own ray THROUGH THE REAL RESOLVER: this
  // drives the exact `resolveDeskPick` the component calls, not a replica.
  const rig = endingRig(ZOOM_FACTOR, ENDING_AIM_DROP)
  const HEIGHT_PX = 900

  const resolveAt = (target: readonly [number, number, number]) => {
    const dx = target[0] - rig.cam[0]
    const dy = target[1] - rig.cam[1]
    const dz = target[2] - rig.cam[2]
    const m = Math.hypot(dx, dy, dz)
    return resolveDeskPick(
      rig.cam[0], rig.cam[1], rig.cam[2],
      dx / m, dy / m, dz / m,
      CAMERA_FOV, HEIGHT_PX
    )
  }

  it('every bar resolves to itself — the lane through its precedence override', () => {
    // Reference points sit on each bar's VISIBLE length. Three centroids are genuinely behind
    // the tree's crown at this eye (the sightline to tan's centre passes 0.042 from the crown
    // axis at y 1.91 — inside the visible foliage — and cream's/red's graze it), and a click on
    // an occluded point HONESTLY belongs to the occluder; the click surface a visitor actually
    // sees is the bar's exposed run, so those refs shift along the slot away from the crown.
    const alongOffset = [0, 0.3, 0, 0.3, 0, 0.5]
    STATION_BARS.forEach((b, i) => {
      const off = alongOffset[i]
      const hit = resolveAt([
        b.centre[0] + off * SLOT_DIR[0],
        1.44,
        b.centre[1] + off * SLOT_DIR[2],
      ])
      expect(hit?.id, `bar ${b.id}`).toBe(`station-bar-${i}`)
    })
  })

  it('every chip is clickable on its visible extent, and never loses to pad air', () => {
    // A chip's sphere CENTRE is not always a visible pixel at this 20° grazing eye: darkBrown's
    // centre-height sightline passes 0.0977 from the cream bar's axis (inside the bar's
    // measured 0.098 outer skin) and orangeOff's top-centre passes 0.0196 from the white1
    // pen's shaft — REAL occluders, and a click on an occluded pixel honestly belongs to the
    // occluder. So the gate is the claim the visitor actually has: SOME point of the chip's
    // visible extent resolves to the chip, and every losing probe loses to a true SURFACE hit —
    // pad air never wins (that is the exact failure class this whole round removes).
    for (const c of STATION_CLAIMS) {
      if (c.shape !== 'sphere') continue
      const chip = STATION_CHIPS[c.index]
      const off = c.r * 0.6
      const probes: readonly (readonly [number, number, number])[] = [
        [c.c[0], chip.aabb.max[1], c.c[2]],
        [c.c[0] + off, c.c[1], c.c[2]],
        [c.c[0] - off, c.c[1], c.c[2]],
        [c.c[0], c.c[1], c.c[2] + off],
        [c.c[0], c.c[1], c.c[2] - off],
      ]
      let won = false
      for (const ref of probes) {
        const hit = resolveAt(ref)
        if (hit?.id === `station-chip-${c.index}`) {
          won = true
          break
        }
        expect(hit?.surface, `chip ${chip.id} probe stolen by PAD AIR (${hit?.id})`).toBe(true)
      }
      expect(won, `chip ${chip.id} unreachable at the ending eye`).toBe(true)
    }
  })

  it('tree, knife and case resolve to themselves', () => {
    expect(resolveAt([2.3833, 1.85, 10.7094])?.id, 'tree').toBe('station-tree-0')
    expect(
      resolveAt([(KNIFE_CLAIM.a[0] + KNIFE_CLAIM.b[0]) / 2, 1.4, (KNIFE_CLAIM.a[2] + KNIFE_CLAIM.b[2]) / 2])?.id,
      'knife'
    ).toBe('station-knife-0')
    expect(resolveAt([1.5208, 1.333, 8.3157])?.id, 'case').toBe('station-case-0')
  })
})
