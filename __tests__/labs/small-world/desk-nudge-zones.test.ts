import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESK_GLB_URL,
  DESK_NUDGE_ZONES,
  type DeskMeshName,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'

/**
 * THE NO-TEAR GATE (Task 89) — the correctness condition of shader box selection, held against the
 * shipped bytes.
 *
 * The nudge zones move vertices whose REST position lies inside a box (`desk-nudge.ts`). That is
 * only rigid motion if every physical object is either entirely inside or entirely outside every
 * box: a component the box CUTS would shear along the boundary — half a mug rocking while half
 * stands — and a foreign component the box swallows would rock with an object it does not belong
 * to. Both failure modes are invisible to a type checker and to every existing test, and both are
 * exactly one re-bake away, so this file re-derives the physical objects from the GLB itself
 * (union-find over triangles, plus co-located duplicates from the exporter's hard-edge splits) and
 * holds each zone to the condition per mesh it is registered in.
 *
 * The occupancy floors pin the other half of the promise: a zone that tears nothing but has also
 * stopped CONTAINING its object (a prop moved by a re-bake) would make the interaction a dead
 * click, so each zone must still hold at least the vertex mass its objects shipped with.
 */

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))

type Gltf = {
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
}

const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

/** Minimal local GLB reader — deliberately independent of the runtime loader, like desk-glb.test.ts. */
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

type Component = { count: number; min: [number, number, number]; max: [number, number, number] }

/**
 * The mesh's physical objects: connected components over triangle edges UNIONED WITH co-located
 * vertices, because the exporter splits hard edges into duplicate positions — without that union a
 * single mug is dozens of "components" and the containment condition would be vacuously loose.
 */
function componentsOf(g: Gltf, bin: Buffer, meshName: DeskMeshName): Component[] {
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
  const comps = new Map<number, Component>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    let c = comps.get(r)
    if (!c) {
      c = { count: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      comps.set(r, c)
    }
    c.count++
    for (let a = 0; a < 3; a++) {
      const v = pos[i * 3 + a]
      if (v < c.min[a]) c.min[a] = v
      if (v > c.max[a]) c.max[a] = v
    }
  }
  return [...comps.values()]
}

const inside = (c: Component, z: { min: readonly number[]; max: readonly number[] }): boolean =>
  c.min[0] >= z.min[0] && c.max[0] <= z.max[0] &&
  c.min[1] >= z.min[1] && c.max[1] <= z.max[1] &&
  c.min[2] >= z.min[2] && c.max[2] <= z.max[2]

const intersects = (c: Component, z: { min: readonly number[]; max: readonly number[] }): boolean =>
  c.min[0] <= z.max[0] && c.max[0] >= z.min[0] &&
  c.min[1] <= z.max[1] && c.max[1] >= z.min[1] &&
  c.min[2] <= z.max[2] && c.max[2] >= z.min[2]

const { json, bin } = readGlb(glbPath)
const componentCache = new Map<DeskMeshName, Component[]>()
const meshComponents = (m: DeskMeshName): Component[] => {
  let c = componentCache.get(m)
  if (!c) {
    c = componentsOf(json, bin, m)
    componentCache.set(m, c)
  }
  return c
}

/** What each zone must still contain, per mesh — the vertex mass its objects shipped with, floored
 *  a little under the measured counts so a legitimate re-decimation has headroom. */
const OCCUPANCY: Record<string, Partial<Record<DeskMeshName, number>>> = {
  mug: { DeskBaked: 2900, DeskMetal: 400 },
  donut: { DeskBaked: 3300, DeskGloss: 1700 },
  pencup: { DeskBaked: 4400, DeskMetal: 900 },
  bird: { DeskBaked: 3200 },
  penguin: { DeskBaked: 4700 },
}

describe('the nudge zones, held to the shipped desk (Task 89)', () => {
  for (const zone of DESK_NUDGE_ZONES) {
    for (const mesh of zone.meshes) {
      it(`${zone.kind} tears nothing in ${mesh}`, () => {
        for (const c of meshComponents(mesh)) {
          if (intersects(c, zone)) {
            expect(
              inside(c, zone),
              `a ${c.count}-vertex component straddles the ${zone.kind} box in ${mesh}: ` +
                `[${c.min.map((v) => v.toFixed(3))}]..[${c.max.map((v) => v.toFixed(3))}]`
            ).toBe(true)
          }
        }
      })

      it(`${zone.kind} still contains its object in ${mesh}`, () => {
        const held = meshComponents(mesh)
          .filter((c) => inside(c, zone))
          .reduce((s, c) => s + c.count, 0)
        expect(held).toBeGreaterThanOrEqual(OCCUPANCY[zone.kind][mesh] ?? 1)
      })
    }

    it(`${zone.kind}'s pivot sits on its own floor, inside its box`, () => {
      const [px, py, pz] = zone.pivot
      expect(px).toBeGreaterThan(zone.min[0])
      expect(px).toBeLessThan(zone.max[0])
      expect(pz).toBeGreaterThan(zone.min[2])
      expect(pz).toBeLessThan(zone.max[2])
      // the pivot is the contact with the desk: at most a hair above the box floor
      expect(py - zone.min[1]).toBeGreaterThanOrEqual(0)
      expect(py - zone.min[1]).toBeLessThan(0.08)
    })
  }

  it('no component answers to two zones', () => {
    const meshes = new Set(DESK_NUDGE_ZONES.flatMap((z) => [...z.meshes]))
    for (const mesh of meshes) {
      for (const c of meshComponents(mesh)) {
        const owners = DESK_NUDGE_ZONES.filter((z) => z.meshes.includes(mesh) && inside(c, z))
        expect(owners.length, `a component in ${mesh} is claimed by ${owners.map((o) => o.kind)}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the coffee stays level: the gloss mesh holds exactly the icing inside the donut zone, and the disc is untouched', () => {
    const comps = meshComponents('DeskGloss')
    expect(comps.length).toBe(2)
    const donut = DESK_NUDGE_ZONES.find((z) => z.kind === 'donut')!
    const mug = DESK_NUDGE_ZONES.find((z) => z.kind === 'mug')!
    const held = comps.filter((c) => intersects(c, donut))
    expect(held.length).toBe(1)
    // ...and the mug zone is not registered in DeskGloss at all, so the disc cannot be reached
    expect(mug.meshes.includes('DeskGloss')).toBe(false)
  })
})
