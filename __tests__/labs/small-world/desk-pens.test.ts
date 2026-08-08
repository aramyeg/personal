import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESK_GLB_URL } from '@/components/labs/small-world/scene/props/desk-glb-contract'
import {
  PENCUP_PENS,
  PEN_GEOM,
  penClatterNormalBlock,
  penClatterVertexBlock,
} from '@/components/labs/small-world/scene/props/desk-pens'

/**
 * A PEN IS ONE BODY (T102) — the gate that would have caught the T100 bug.
 *
 * The clatter selects vertices by `gl_VertexID`, so "which bytes are this pen" is a claim about
 * the shipped file that no type checker can see. T100 claimed each pen's shaft and nothing else,
 * and three of the five pens wear a CAP that the exporter wrote as its own block after all four
 * baked shafts: the shader levered the shaft about its rim while the cap hung in the air, which
 * is exactly what a reader reported seeing — caps detached from their pens.
 *
 * So everything `desk-pens.ts` types as an id run is RE-DERIVED here by union-find over the
 * shipped triangles (plus co-located duplicates — the exporter splits hard edges), and the claim
 * is held from both sides: every claimed id must belong to that pen, and every vertex that is
 * PART of that pen must be claimed. The second half is the one that was missing.
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

type Graph = { pos: number[]; find: (x: number) => number; n: number }

/** A mesh's positions plus the union-find over its physical objects. */
function meshGraph(g: Gltf, bin: Buffer, meshName: string): Graph {
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

type Comp = { ids: number[]; idMin: number; idMax: number; count: number }

function componentAt(graph: Graph, member: number): Comp {
  const root = graph.find(member)
  const ids: number[] = []
  for (let i = 0; i < graph.n; i++) if (graph.find(i) === root) ids.push(i)
  return { ids, idMin: ids[0], idMax: ids[ids.length - 1], count: ids.length }
}

const { json, bin } = readGlb(glbPath)
const baked = meshGraph(json, bin, 'DeskBaked')
const metal = meshGraph(json, bin, 'DeskMetal')
const graphOf = (mesh: 'DeskBaked' | 'DeskMetal'): Graph => (mesh === 'DeskMetal' ? metal : baked)

/** Every id this pen claims: shaft plus cap. */
const claimedIds = (p: (typeof PENCUP_PENS)[number]): number[] => {
  const out: number[] = []
  for (let i = p.range[0]; i <= p.range[1]; i++) out.push(i)
  if (p.cap) for (let i = p.cap[0]; i <= p.cap[1]; i++) out.push(i)
  return out
}

/** Distance from a point to the pen's capsule SEGMENT (clamped), and its parameter along the
 *  infinite axis — the same two measures the pick and the lean geometry are fitted on. */
function against(
  x: number,
  y: number,
  z: number,
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): { s: number; segDist: number; axisDist: number } {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
  const s = ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / L2
  const at = (t: number): number =>
    Math.hypot(x - (a[0] + d[0] * t), y - (a[1] + d[1] * t), z - (a[2] + d[2] * t))
  return { s, segDist: at(Math.max(0, Math.min(1, s))), axisDist: at(s) }
}

describe('the shipped bytes hold each pen as shaft plus cap', () => {
  it('every pen shaft is exactly one whole component', () => {
    for (const p of PENCUP_PENS) {
      const c = componentAt(graphOf(p.mesh), p.range[0])
      expect(c.idMin, `${p.id} shaft idMin`).toBe(p.range[0])
      expect(c.idMax, `${p.id} shaft idMax`).toBe(p.range[1])
      expect(c.count, `${p.id} shaft is a contiguous run`).toBe(p.range[1] - p.range[0] + 1)
    }
  })

  it('every claimed cap is exactly one whole component, and a SEPARATE one from its shaft', () => {
    const withCap = PENCUP_PENS.filter((p) => p.cap)
    expect(withCap.map((p) => p.id)).toEqual(['darkRed', 'white2', 'roseGold'])
    for (const p of withCap) {
      const g = graphOf(p.mesh)
      const cap = p.cap!
      const c = componentAt(g, cap[0])
      expect(c.idMin, `${p.id} cap idMin`).toBe(cap[0])
      expect(c.idMax, `${p.id} cap idMax`).toBe(cap[1])
      expect(c.count, `${p.id} cap is a contiguous run`).toBe(cap[1] - cap[0] + 1)
      // the bug in one line: the cap does NOT touch its shaft, so no range widening could find it
      expect(g.find(cap[0]), `${p.id} cap is its own component`).not.toBe(g.find(p.range[0]))
    }
  })

  it('each cap sits on the pen that claims it, by a wide margin', () => {
    for (const p of PENCUP_PENS) {
      if (!p.cap) continue
      const g = graphOf(p.mesh)
      const reach = (q: (typeof PENCUP_PENS)[number]): number => {
        let max = 0
        for (let i = p.cap![0]; i <= p.cap![1]; i++) {
          const d = against(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], q.a, q.b).axisDist
          if (d > max) max = d
        }
        return max
      }
      const own = reach(p)
      expect(own, `${p.id} cap to its own axis`).toBeLessThan(0.08)
      for (const q of PENCUP_PENS) {
        if (q.id === p.id || q.mesh !== p.mesh) continue
        expect(reach(q), `${p.id} cap to ${q.id}'s axis`).toBeGreaterThan(own * 3)
      }
    }
  })
})

describe('a pen claims all of itself and none of its neighbours', () => {
  it('every vertex of every pen component is inside that pen\'s claimed set', () => {
    for (const p of PENCUP_PENS) {
      const g = graphOf(p.mesh)
      const claimed = new Set(claimedIds(p))
      const parts = p.cap ? [p.range[0], p.cap[0]] : [p.range[0]]
      for (const member of parts) {
        for (const id of componentAt(g, member).ids) {
          expect(claimed.has(id), `${p.id} component vertex ${id} unclaimed`).toBe(true)
        }
      }
    }
  })

  it('no claimed id belongs to a component the pen does not own — the cup is never torn', () => {
    for (const p of PENCUP_PENS) {
      const g = graphOf(p.mesh)
      const roots = new Set([g.find(p.range[0]), ...(p.cap ? [g.find(p.cap[0])] : [])])
      for (const id of claimedIds(p)) {
        expect(roots.has(g.find(id)), `${p.id} claims ${id}, which is foreign geometry`).toBe(true)
      }
    }
    // said again about the one neighbour that would be catastrophic: the cup the pens stand in
    const cup = componentAt(baked, 17240)
    expect(cup.idMin).toBe(17240)
    expect(cup.idMax).toBe(19081)
    const claimed = new Set(PENCUP_PENS.filter((p) => p.mesh === 'DeskBaked').flatMap(claimedIds))
    for (const id of cup.ids) expect(claimed.has(id), `cup vertex ${id} claimed by a pen`).toBe(false)
  })

  it('the five claimed sets are pairwise disjoint', () => {
    for (let i = 0; i < PENCUP_PENS.length; i++) {
      for (let j = i + 1; j < PENCUP_PENS.length; j++) {
        const a = PENCUP_PENS[i]
        const b = PENCUP_PENS[j]
        if (a.mesh !== b.mesh) continue
        const set = new Set(claimedIds(a))
        for (const id of claimedIds(b)) {
          expect(set.has(id), `${a.id} and ${b.id} both claim ${id}`).toBe(false)
        }
      }
    }
  })

  it('nothing pen-shaped is left unclaimed — the sweep that would have caught the caps', () => {
    for (const mesh of ['DeskBaked', 'DeskMetal'] as const) {
      const g = graphOf(mesh)
      const pens = PENCUP_PENS.filter((p) => p.mesh === mesh)
      const claimed = new Set(pens.flatMap(claimedIds))
      const cupRoot = mesh === 'DeskBaked' ? baked.find(17240) : null
      for (let i = 0; i < g.n; i++) {
        if (claimed.has(i)) continue
        for (const p of pens) {
          const d = against(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], p.a, p.b).segDist
          if (d >= p.r) continue
          // inside a pen's own pick capsule and unclaimed: only the cup the pens pass through
          // may be there. Anything else is a piece of pen that would be left behind.
          expect(g.find(i), `unclaimed vertex ${i} sits inside ${p.id}'s capsule`).toBe(cupRoot)
        }
      }
    }
  })
})

describe('claiming the caps disturbs nothing the leans are derived from', () => {
  it('every cap lies inside its own shaft\'s axial extent, so `b` stands', () => {
    for (const p of PENCUP_PENS) {
      if (!p.cap) continue
      const g = graphOf(p.mesh)
      const span = (lo: number, hi: number): [number, number] => {
        let min = Infinity
        let max = -Infinity
        for (let i = lo; i <= hi; i++) {
          const { s } = against(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], p.a, p.b)
          min = Math.min(min, s)
          max = Math.max(max, s)
        }
        return [min, max]
      }
      const shaft = span(p.range[0], p.range[1])
      const cap = span(p.cap[0], p.cap[1])
      expect(cap[0], `${p.id} cap starts before its shaft`).toBeGreaterThanOrEqual(shaft[0])
      expect(cap[1], `${p.id} cap reaches past its shaft`).toBeLessThanOrEqual(shaft[1])
    }
  })

  it('the pick capsule still covers everything the pen now claims', () => {
    for (const p of PENCUP_PENS) {
      const g = graphOf(p.mesh)
      let max = 0
      for (const i of claimedIds(p)) {
        const d = against(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], p.a, p.b).segDist
        if (d > max) max = d
      }
      expect(max, `${p.id} max vert-to-segment`).toBeLessThanOrEqual(p.r)
    }
  })
})

describe('the shader moves every run the pen owns', () => {
  const run = (r: readonly [number, number]): string =>
    `gl_VertexID >= ${r[0]} && gl_VertexID <= ${r[1]}`

  it('each mesh\'s vertex block tests both of a capped pen\'s runs', () => {
    for (const mesh of ['DeskBaked', 'DeskMetal'] as const) {
      const body = penClatterVertexBlock(mesh)
      const pens = PEN_GEOM.filter((g) => g.mesh === mesh)
      for (const g of pens) {
        expect(body, `${g.id} shaft run`).toContain(run(g.range))
        if (g.cap) expect(body, `${g.id} cap run`).toContain(run(g.cap))
      }
      // one branch per pen, and the cascade stays exclusive
      expect(body.match(/gl_VertexID >=/g)?.length, `${mesh} run count`).toBe(
        pens.length + pens.filter((g) => g.cap).length
      )
      expect(body.match(/else if \(/g)?.length ?? 0, `${mesh} else-if count`).toBe(pens.length - 1)
    }
  })

  it('the rose gold\'s normals turn with its cap too', () => {
    const body = penClatterNormalBlock('DeskMetal', 'objectNormal')
    const rose = PEN_GEOM.find((g) => g.id === 'roseGold')!
    expect(body).toContain(run(rose.range))
    expect(body).toContain(run(rose.cap!))
  })

  it('rest is still the untouched path', () => {
    for (const mesh of ['DeskBaked', 'DeskMetal'] as const) {
      expect(penClatterVertexBlock(mesh)).toContain('uPenClatter.x != 0.0 || uPenClatter.y != 0.0')
    }
  })
})
