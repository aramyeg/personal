import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESK_BACK_Z,
  DESK_HALF_W,
  DESK_MAX_ASPECT,
  DESK_NEAR_Z,
  DESK_TOP_Y,
  deskAxialDepth,
  journeyFloorY,
} from '@/components/labs/small-world/scene/desk-stage'
import { CAMERA_FOV } from '@/components/labs/small-world/scene/camera'
import {
  DESK_GLB_URL,
  DESK_MESHES,
  DESK_PAD,
  DESK_PAYLOAD_BUDGET,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'

/**
 * THE SHIPPED DESK ASSET (Task 68), held to the same standard as the geometry the lab builds itself.
 *
 * Every other containment proof in this lab measures the vertices a BUILDER emits. This one has no
 * builder to measure: the desk is now baked in Blender and arrives as a file, so the only honest
 * subject is the file. These tests therefore parse `public/labs/small-world/desk.glb` and read the
 * real accessors — the same bytes the browser downloads.
 *
 * That matters most for the frame. Blender is Z-up and the lab is Y-up, and the glTF exporter's
 * +Y-up conversion happens to be exactly the mapping T67 derived (`gltf = (bx, bz, −by)`), so the
 * export SHOULD land in lab coordinates untouched. "Should" is why this is a test: an asset that
 * came in rotated would still load, still draw, and still be wrong.
 */

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))

type Gltf = {
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: {
    bufferView: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
    normalized?: boolean
    min?: number[]
    max?: number[]
  }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
  materials: { name: string }[]
  images?: unknown[]
}

const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNT: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

/** Minimal GLB reader. Deliberately local to this file rather than shared with the runtime loader:
 *  the point is to read the bytes INDEPENDENTLY of the code that consumes them. */
function readGlb(file: string): { json: Gltf; bin: Buffer; bytes: number } {
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
  return { json, bin, bytes: buf.length }
}

/** Every value of an accessor, un-normalised, as a flat array. */
function readAccessor(g: Gltf, bin: Buffer, index: number): number[] {
  const a = g.accessors[index]
  const bv = g.bufferViews[a.bufferView]
  const comps = TYPE_COUNT[a.type]
  const size = COMPONENT_BYTES[a.componentType]
  const stride = bv.byteStride ?? comps * size
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const scale = a.normalized ? (a.componentType === 5123 ? 65535 : 255) : 1
  const out: number[] = []
  for (let i = 0; i < a.count; i++) {
    const o = start + i * stride
    for (let c = 0; c < comps; c++) {
      const at = o + c * size
      const raw =
        a.componentType === 5126
          ? bin.readFloatLE(at)
          : a.componentType === 5123
            ? bin.readUInt16LE(at)
            : a.componentType === 5121
              ? bin.readUInt8(at)
              : bin.readInt16LE(at)
      out.push(raw / scale)
    }
  }
  return out
}

const glb = readGlb(glbPath)
const meshOf = (name: string) => {
  const m = glb.json.meshes.find((x) => x.name === name)
  if (!m) throw new Error(`mesh ${name} missing from the GLB`)
  return m
}

describe('desk GLB — payload and draw cost', () => {
  it('fits the round budget, and the report can state the number', () => {
    expect(glb.bytes).toBeLessThanOrEqual(DESK_PAYLOAD_BUDGET)
  })

  it('costs three draw calls, not one per prop colour', () => {
    // glTF splits a mesh into one primitive per material and three.js draws one primitive per call.
    // The Blender set carries 22 prop tints; they live in the vertex attribute, so one material per
    // mesh is enough and the whole desk is three draws.
    const primitives = glb.json.meshes.reduce((s, m) => s + m.primitives.length, 0)
    expect(primitives).toBe(3)
    expect(glb.json.materials).toHaveLength(3)
  })

  it('ships exactly the three meshes the lab looks up by name', () => {
    expect(glb.json.meshes.map((m) => m.name).sort()).toEqual([...DESK_MESHES].sort())
  })
})

describe('desk GLB — the export landed in the LAB frame', () => {
  const surface = meshOf('DeskSurface').primitives[0]
  const pos = glb.json.accessors[surface.attributes.POSITION]

  it('puts the slab at the solved desk plane, not at Blender Z-up', () => {
    // If the +Y-up conversion had been missed the slab's vertical extent would land on z instead.
    expect(pos.max![1]).toBeCloseTo(1.303, 2) // pad surface, the highest point of the pair
    expect(pos.min![1]).toBeGreaterThan(0.6) // the back skirt's foot
  })

  it('spans the desk stage the lab solved, in x and z', () => {
    expect(Math.abs(pos.min![0])).toBeCloseTo(DESK_HALF_W, 3)
    expect(pos.max![0]).toBeCloseTo(DESK_HALF_W, 3)
    expect(pos.min![2]).toBeCloseTo(DESK_BACK_Z, 3)
    expect(pos.max![2]).toBeCloseTo(DESK_NEAR_Z, 3)
  })

  it('carries the pad where the contract publishes it', () => {
    // The pad is the only part of DeskSurface standing above the slab's plane, so its footprint is
    // recoverable from the vertices that do — which is what makes DESK_PAD a measurement of the
    // shipped asset rather than four numbers copied out of Blender and hoped for.
    const p3 = readAccessor(glb.json, glb.bin, surface.attributes.POSITION)
    let maxX = 0
    let minZ = Infinity
    let maxZ = -Infinity
    let top = -Infinity
    for (let i = 0; i < p3.length; i += 3) {
      if (p3[i + 1] <= DESK_TOP_Y + 0.005) continue
      maxX = Math.max(maxX, Math.abs(p3[i]))
      minZ = Math.min(minZ, p3[i + 2])
      maxZ = Math.max(maxZ, p3[i + 2])
      top = Math.max(top, p3[i + 1])
    }
    expect(maxX).toBeCloseTo(DESK_PAD.halfW, 2)
    expect(minZ).toBeCloseTo(DESK_PAD.backZ, 2)
    expect(maxZ).toBeCloseTo(DESK_PAD.nearZ, 2)
    expect(top).toBeCloseTo(DESK_PAD.top, 2)
  })

  it('is wide enough to fill the frame at the widest supported viewport', () => {
    // The reason the slab was rebuilt at all: T67 authored it +-13.0, and the frame is wider than
    // that on the desk plane at 4:1.
    const halfFrame = deskAxialDepth(DESK_BACK_Z) * Math.tan((CAMERA_FOV * Math.PI) / 360) * DESK_MAX_ASPECT
    expect(DESK_HALF_W).toBeGreaterThan(halfFrame)
    expect(pos.max![0]).toBeGreaterThan(halfFrame)
  })
})

describe('desk GLB — containment, measured on the emitted vertices', () => {
  // The journey camera's bottom frustum plane contains the world x axis, so a point is off the
  // bottom of the frame exactly when `y < journeyFloorY(z)`. That is a per-POINT test and it is
  // applied here to every vertex the file actually ships, not to a published bounding box.
  for (const name of DESK_MESHES) {
    it(`${name} is wholly below the journey camera's bottom edge`, () => {
      const prim = meshOf(name).primitives[0]
      const p = readAccessor(glb.json, glb.bin, prim.attributes.POSITION)
      let worst = Infinity
      let worstAt: number[] = []
      for (let i = 0; i < p.length; i += 3) {
        const margin = journeyFloorY(p[i + 2]) - p[i + 1]
        if (margin < worst) {
          worst = margin
          worstAt = [p[i], p[i + 1], p[i + 2]]
        }
      }
      expect(worst, `worst margin at [${worstAt.map((v) => v.toFixed(3))}]`).toBeGreaterThan(0)
    })
  }

  it('leaves the desk surface below the plane it was solved for', () => {
    expect(DESK_TOP_Y).toBeLessThan(journeyFloorY(DESK_BACK_Z))
  })
})

describe('desk GLB — the lights-up channels are the right way round', () => {
  it('carries two colour sets on the baked mesh, lit at COLOR_0', () => {
    const prim = meshOf('DeskBaked').primitives[0]
    expect(prim.attributes.COLOR_0).toBeDefined()
    expect(prim.attributes.COLOR_1).toBeDefined()

    // glTF gives COLOR_n no names, so the lab reads them by index and the ORDER is load-bearing:
    // the exporter takes COLOR_0 from the mesh's `render_color_index`, and an export that left that
    // on the last-baked attribute shipped the lights-up running backwards. The one property that
    // cannot be got backwards is brightness.
    const mean = (a: number) => {
      const v = readAccessor(glb.json, glb.bin, a)
      let s = 0
      for (let i = 0; i < v.length; i += 4) s += v[i] + v[i + 1] + v[i + 2]
      return (s * 4) / (v.length * 3)
    }
    const lit = mean(prim.attributes.COLOR_0)
    const dim = mean(prim.attributes.COLOR_1)
    expect(lit).toBeGreaterThan(dim * 2)
  })

  it('carries both studio atlases on the surface mesh', () => {
    // The dim atlas rides in the emissive slot because core glTF has exactly one base-colour
    // texture and this ending needs two. Both images have to be present or the crossfade has
    // nothing to fade to.
    expect(glb.json.images).toHaveLength(2)
  })

  it('gives the metal props one tint attribute and no baked lighting', () => {
    const prim = meshOf('DeskMetal').primitives[0]
    expect(prim.attributes.COLOR_0).toBeDefined()
    expect(prim.attributes.COLOR_1).toBeUndefined()
  })
})
