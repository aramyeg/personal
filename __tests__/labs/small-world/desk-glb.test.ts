import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
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
  COFFEE_ANCHOR,
  DESK_FIGURINES,
  DESK_GLB_URL,
  DESK_MESHES,
  DESK_PAD,
  DESK_PAYLOAD_BUDGET,
  DESK_RAW_CEILING,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { BIRD_WRAPPER } from '@/components/labs/small-world/scene/props/desk-deep'

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
  nodes: { name: string; mesh?: number; translation?: number[]; scale?: number[] }[]
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
  materials: {
    name: string
    pbrMetallicRoughness?: { baseColorTexture?: { index: number }; baseColorFactor?: number[] }
    emissiveTexture?: { index: number }
  }[]
  textures?: { source?: number; extensions?: { EXT_texture_webp?: { source: number } } }[]
  images?: { name: string; mimeType?: string }[]
  extensionsRequired?: string[]
  extensionsUsed?: string[]
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
  it('fits the round budget IN THE BYTES A BROWSER DOWNLOADS', () => {
    // The budget is a WIRE budget and this is the wire measurement: the server sends this file
    // gzipped, and zlib's default level reproduces the transferred length exactly. Gating on the
    // raw length instead — which is what T68 did while arguing in transferred bytes — measures a
    // number nobody pays.
    const wire = gzipSync(readFileSync(glbPath)).length
    expect(wire, `wire ${wire} B`).toBeLessThanOrEqual(DESK_PAYLOAD_BUDGET)
  })

  it('has not changed category uncompressed either', () => {
    // A loose ceiling on the parsed size, to catch an accidental texture or a duplicated attribute
    // that happens to compress well. Not a bound on the art.
    expect(glb.bytes).toBeLessThanOrEqual(DESK_RAW_CEILING)
  })

  it('ships no colour alpha that nothing reads', () => {
    // Blender writes every colour attribute VEC4, because that is what a Blender colour attribute
    // is. Three of the four carry a constant 1.0 in the fourth component and no shader looks at it —
    // 211 kB, 8.4% of the file — so `t81_trim.py` rewrites them VEC3 after export. The ONE that
    // must stay VEC4 is the gloss mesh's COLOR_1, whose alpha carries each surface's own specular
    // level (the glaze wants 1.34 and the coffee 2.80, and one material cannot serve both).
    const width = (mesh: string, attr: string) => {
      const a = meshOf(mesh).primitives[0].attributes[attr]
      return a === undefined ? null : glb.json.accessors[a].type
    }
    expect(width('DeskBaked', 'COLOR_0')).toBe('VEC3')
    expect(width('DeskBaked', 'COLOR_1')).toBe('VEC3')
    expect(width('DeskMetal', 'COLOR_0')).toBe('VEC3')
    expect(width('DeskGloss', 'COLOR_0')).toBe('VEC3')
    expect(width('DeskGloss', 'COLOR_1')).toBe('VEC4')
  })

  it('costs one draw call per contract mesh, not one per prop colour', () => {
    // glTF splits a mesh into one primitive per material and three.js draws one primitive per call.
    // The Blender set carries ~40 prop tints; they live in the vertex attribute, so one material per
    // mesh is enough. FOUR from T71/T81 (the donut glaze cannot share the unlit material the matte
    // set uses — see DESK_MESHES) plus ONE from T92: the notebook's verso, which moves and so
    // cannot live inside the joined bake. The count is the contract's length, not a literal, so a
    // sanctioned mesh cannot fail this gate while an accidental primitive split still does.
    const primitives = glb.json.meshes.reduce((s, m) => s + m.primitives.length, 0)
    expect(primitives).toBe(DESK_MESHES.length)
    // the verso shares T81_BAKED rather than adding a material — the runtime replaces materials
    expect(glb.json.materials).toHaveLength(4)
  })

  it('ships exactly the meshes the lab looks up by name — no more, no fewer', () => {
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
  // The original bake ships world-space vertices on TRS-less nodes; the T92 watering piece ships
  // LOCAL vertices under an authored node TRS (its meshes move), so the per-point test transforms
  // by the node the mesh hangs on — the same arithmetic the GPU runs.
  // The bird's twin is the one mesh whose placement is NOT in the file: it is authored at the
  // origin (the inverse-bind identity demands it — see BIRD_WRAPPER) and placed by a runtime
  // wrapper. The containment claim is about where it RENDERS, so this test applies the same TRS
  // the runtime applies, read from the same constant — one owner, imported not copied.
  const nodeTrs = (meshName: string) => {
    const mi = glb.json.meshes.findIndex((m) => m.name === meshName)
    const node = (glb.json.nodes as { mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }[]).find(
      (n) => n.mesh === mi
    )
    const runtime = meshName === 'Bar_river'
    const qLen = Math.hypot(...BIRD_WRAPPER.quaternion)
    const t = runtime ? [...BIRD_WRAPPER.position] : (node?.translation ?? [0, 0, 0])
    const q = runtime ? BIRD_WRAPPER.quaternion.map((c) => c / qLen) : (node?.rotation ?? [0, 0, 0, 1])
    const s = runtime
      ? [BIRD_WRAPPER.scale, BIRD_WRAPPER.scale, BIRD_WRAPPER.scale]
      : (node?.scale ?? [1, 1, 1])
    return (p: number[]): number[] => {
      const [x, y, z] = [p[0] * s[0], p[1] * s[1], p[2] * s[2]]
      const [qx, qy, qz, qw] = q
      const uvx = qy * z - qz * y
      const uvy = qz * x - qx * z
      const uvz = qx * y - qy * x
      const uux = qy * uvz - qz * uvy
      const uuy = qz * uvx - qx * uvz
      const uuz = qx * uvy - qy * uvx
      return [x + 2 * (qw * uvx + uux) + t[0], y + 2 * (qw * uvy + uuy) + t[1], z + 2 * (qw * uvz + uuz) + t[2]]
    }
  }

  for (const name of DESK_MESHES) {
    it(`${name} is wholly below the journey camera's bottom edge`, () => {
      const prim = meshOf(name).primitives[0]
      const p = readAccessor(glb.json, glb.bin, prim.attributes.POSITION)
      const toWorld = nodeTrs(name)
      let worst = Infinity
      let worstAt: number[] = []
      for (let i = 0; i < p.length; i += 3) {
        const [wx, wy, wz] = toWorld([p[i], p[i + 1], p[i + 2]])
        const margin = journeyFloorY(wz) - wy
        if (margin < worst) {
          worst = margin
          worstAt = [wx, wy, wz]
        }
      }
      expect(worst, `worst margin at [${worstAt.map((v) => v.toFixed(3))}]`).toBeGreaterThan(0)
    })
  }

  it('leaves the desk surface below the plane it was solved for', () => {
    expect(DESK_TOP_Y).toBeLessThan(journeyFloorY(DESK_BACK_Z))
  })
})

/**
 * THE GATE THAT SHOULD HAVE EXISTED THREE ROUNDS AGO (Task 81).
 *
 * The bird and the penguin sat finished in the blend from Task 68 and were never once exported: the
 * export selected five objects by name, the figurines were not among them, and nothing anywhere
 * checked. Aram had to notice twice, and Task 79 had to measure an NCC of 0.131 against the approved
 * render, before anyone looked at the export list.
 *
 * A comment saying "the figurines are exported" would have been just as true and just as useless.
 * This reads the shipped file: `DeskBaked` must carry vertices inside each souvenir's own box, and
 * the box must be filled to its corners rather than merely intersected, so a figurine that arrived
 * half-scale or seated on the wrong plane fails too.
 */
describe('desk GLB — the souvenirs are actually in the file', () => {
  const baked = readAccessor(glb.json, glb.bin, meshOf('DeskBaked').primitives[0].attributes.POSITION)

  for (const fig of DESK_FIGURINES) {
    it(`carries the ${fig.kind} where the contract publishes it`, () => {
      let n = 0
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let i = 0; i < baked.length; i += 3) {
        const [x, y, z] = [baked[i], baked[i + 1], baked[i + 2]]
        if (Math.abs(x - fig.x) > fig.halfW + 0.02) continue
        if (Math.abs(z - fig.z) > fig.halfD + 0.02) continue
        if (y < fig.seatY - 0.02 || y > fig.seatY + fig.height + 0.02) continue
        n++
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
      // ~5,000 vertices each in the shipped export; a floor an empty or decimated-to-nothing
      // figurine cannot clear, and loose enough that re-tessellation is not a failure.
      expect(n, `${fig.kind} vertices found`).toBeGreaterThan(2000)
      // ...and it fills its box, so a half-scale stand-in does not pass by sitting inside one.
      expect(maxY - minY).toBeGreaterThan(fig.height * 0.9)
      expect(maxX - minX).toBeGreaterThan(fig.halfW * 1.6)
      expect(minY).toBeCloseTo(fig.seatY, 1)
    })
  }

  it('draws them with the baked set, so they take the studio rather than a second tone map', () => {
    // The old procedural pair mounted MeshToonMaterial/MeshBasicMaterial with no `toneMapped` flag,
    // so they went through r3f's default ACES while every baked material opts out — two view
    // transforms in one frame. Being inside DeskBaked is what ends that, and DeskBaked is one
    // primitive with one material, so there is nowhere else for them to be.
    expect(meshOf('DeskBaked').primitives).toHaveLength(1)
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
    // Strides by the accessor's OWN component count rather than by 4. Task 81 trimmed the baked
    // colour sets from VEC4 to VEC3 — their alpha was a constant 1.0 that no shader reads, 211 kB
    // of it — and a hardcoded 4 would have walked off the end of every vertex silently.
    const mean = (a: number) => {
      const n = TYPE_COUNT[glb.json.accessors[a].type]
      const v = readAccessor(glb.json, glb.bin, a)
      let s = 0
      for (let i = 0; i < v.length; i += n) s += v[i] + v[i + 1] + v[i + 2]
      return (s * n) / (v.length * 3)
    }
    const lit = mean(prim.attributes.COLOR_0)
    const dim = mean(prim.attributes.COLOR_1)
    expect(lit).toBeGreaterThan(dim * 2)
  })

  it('carries both studio atlases on the surface mesh, in the right SLOTS', () => {
    // The dim atlas rides in the emissive slot because core glTF has exactly one base-colour
    // texture and this ending needs two. Both images have to be present or the crossfade has
    // nothing to fade to — and WHICH slot holds which is what makes the surface's lights-up run
    // forwards. A swapped export would fade the slab and pad backwards and pass every other test
    // here, which is precisely the failure that already happened once on `render_color_index`.
    expect(glb.json.images).toHaveLength(2)
    // Found by ROLE, not by name: it is the one material carrying both a base-colour and an
    // emissive texture, which is what "holds the two atlases" means. Naming it was how this test
    // used to find it, and the name is a pipeline detail that has already drifted once.
    const mat = glb.json.materials.find(
      (m) => m.pbrMetallicRoughness?.baseColorTexture && m.emissiveTexture
    )!
    expect(mat, 'a material carrying both atlases').toBeDefined()
    // Task 81: the atlases are WEBP, so the image index moved. A WebP texture carries no core
    // `source` at all — it lives under the extension — and reading `textures[i].source` on this
    // file yields undefined, which is why this resolves through both.
    const nameOfSlot = (texIndex: number) => {
      const tex = glb.json.textures![texIndex]
      const source = tex.extensions?.EXT_texture_webp?.source ?? tex.source
      expect(source, `texture ${texIndex} resolves to an image`).toBeDefined()
      return glb.json.images![source!].name
    }
    expect(nameOfSlot(mat.pbrMetallicRoughness!.baseColorTexture!.index)).toContain('lit')
    expect(nameOfSlot(mat.emissiveTexture!.index)).toContain('dim')
  })

  it('ships the atlases as LOSSLESS webp, and declares the extension that needs', () => {
    // PNG is the wrong codec for a baked lighting sheet: measured on the real 2048 atlas it cost
    // 930,397 B against WebP-lossless's 556,952 for bit-identical texels (decode-and-diff, mean
    // 0.000 / max 0 sRGB steps). The lossy rungs were cheaper again and REFUSED — masked to the
    // texels the mesh samples, q95 leaves 1.1-2.4% of them more than two steps out with a maximum
    // of 81, and it spends that error on the hard contact edges this round exists to sharpen.
    //
    // Blender writes the extension to extensionsREQUIRED because no PNG fallback is embedded (a
    // fallback would put every saved byte back). three.js registers GLTFTextureWebPExtension, so
    // that costs nothing here — but it is a real constraint on any other tool reading this file.
    expect(glb.json.extensionsRequired).toContain('EXT_texture_webp')
    expect(glb.json.images!.every((i) => i.mimeType === 'image/webp')).toBe(true)
  })

  it('gives the metal props one tint attribute and no baked lighting', () => {
    const prim = meshOf('DeskMetal').primitives[0]
    expect(prim.attributes.COLOR_0).toBeDefined()
    expect(prim.attributes.COLOR_1).toBeUndefined()
  })

  it('keeps a DISTINCT tint per metal, which is what one correction could not do', () => {
    // T68 learned this twice: a single multiplier tuned for the rose gold turned the sculpting
    // tool's neutral steel blue by 152 degrees of hue. So each metal's tint is solved from its own
    // measurement and written per material at export, and what proves it survived the collapse to
    // one material is that the shipped attribute still holds several different colours. Four
    // materials go in (dish, pen, tool, foil), so at least four distinct tints must come out.
    const prim = meshOf('DeskMetal').primitives[0]
    const n = TYPE_COUNT[glb.json.accessors[prim.attributes.COLOR_0].type]
    const v = readAccessor(glb.json, glb.bin, prim.attributes.COLOR_0)
    const seen = new Set<string>()
    for (let i = 0; i < v.length; i += n) {
      seen.add([v[i], v[i + 1], v[i + 2]].map((c) => c.toFixed(4)).join(','))
    }
    expect(seen.size, [...seen].join(' | ')).toBeGreaterThanOrEqual(4)
  })

  it('carries the gloss mesh PER-SURFACE specular level in COLOR_1 alpha', () => {
    // The glaze and the coffee share one material and one draw call, and they need levels a factor
    // of 2.1 apart — so the level rides per-vertex in an alpha channel the dim bake would otherwise
    // leave at a constant 1.0. If that packing were ever dropped, every value here would be 1 and
    // the coffee would silently lose half its reflection.
    const prim = meshOf('DeskGloss').primitives[0]
    const v = readAccessor(glb.json, glb.bin, prim.attributes.COLOR_1)
    const alphas = new Set<string>()
    for (let i = 3; i < v.length; i += 4) alphas.add(v[i].toFixed(3))
    expect(alphas.size, [...alphas].join(' | ')).toBe(2)
    // ...and the larger of the two is the scale itself, i.e. exactly 1
    expect(Math.max(...[...alphas].map(Number))).toBeCloseTo(1, 3)
  })
})

describe('desk GLB — the coffee is addressable without being a draw call', () => {
  it('ships a named anchor node at the coffee surface, scaled to its radius', () => {
    // Task 72 hangs steam off this. The coffee itself is inside the joined matte mesh, so the node
    // is an EMPTY: no mesh, no vertices, no draw. Its transform is the whole contract — position at
    // the centre of the liquid's top surface, uniform scale equal to its radius.
    const node = glb.json.nodes.find((n) => n.name === COFFEE_ANCHOR)
    expect(node, `nodes: ${glb.json.nodes.map((n) => n.name).join(', ')}`).toBeDefined()
    expect(node!.mesh).toBeUndefined()
    const [x, y, z] = node!.translation!
    // inside the mug's footprint, standing on the pad rather than in it
    expect(y).toBeGreaterThan(DESK_PAD.top)
    expect(z).toBeGreaterThan(DESK_PAD.backZ)
    expect(z).toBeLessThan(DESK_PAD.nearZ)
    expect(Math.abs(x)).toBeLessThan(DESK_PAD.halfW)
    // a real radius, uniform on all three axes
    const s = node!.scale!
    expect(s[0]).toBeGreaterThan(0.05)
    expect(s[1]).toBeCloseTo(s[0], 6)
    expect(s[2]).toBeCloseTo(s[0], 6)
  })

  it('leaves the anchor OUT of the containment walk it has no vertices for', () => {
    // Stated rather than assumed: the anchor is not a mesh node, so `DESK_MESHES` does not name it
    // and the per-vertex containment tests above never see it.
    expect(DESK_MESHES).not.toContain(COFFEE_ANCHOR as never)
  })
})
