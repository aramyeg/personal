import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESK_GLB_URL,
  DESK_NUDGE_ZONES,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'
import {
  BIRD,
  BIRD_TOTAL,
  BOOK,
  BOOK_HINGE,
  BOOK_VERTEX_BODY,
  BOOK_ZONE,
  CAN_ZONE,
  COFFEE_ZONE,
  PLANT,
  STIR,
  STIR_FRAGMENT_BODY,
  STIR_VERTEX_BODY,
  WATER,
  WATER_FRAGMENT_BODY,
  WATER_TOTAL,
  WATER_VERTEX_BODY,
  bookRayHit,
  canRayHit,
  coffeeRayHit,
  restingBird,
  restingBook,
  restingStir,
  restingWater,
  sampleBird,
  sampleBook,
  sampleStir,
  sampleWater,
  triggerBird,
  triggerBook,
  triggerStir,
  triggerWater,
} from '@/components/labs/small-world/scene/props/desk-deep'

/**
 * THE DEEP TIER, HELD TO ITS OWN LAW (Task 92) — the coffee stir's closed forms, its zone against
 * the shipped bytes, and the one precedence rule it shares with the micro tier.
 */

// --- a minimal GLB reader, deliberately independent of the runtime loader ----

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))

type Gltf = {
  nodes: { name?: string; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }[]
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: {
    bufferView: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
    min?: number[]
    max?: number[]
  }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
  animations?: {
    name: string
    channels: { sampler: number; target: { node: number; path: string } }[]
    samplers: { input: number; output: number; interpolation?: string }[]
  }[]
}

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

function positionsOf(g: Gltf, bin: Buffer, meshName: string): number[] {
  const mesh = g.meshes.find((m) => m.name === meshName || m.name.startsWith(meshName))
  if (!mesh) throw new Error(`mesh ${meshName} missing`)
  const a = g.accessors[mesh.primitives[0].attributes.POSITION]
  const bv = g.bufferViews[a.bufferView]
  const stride = bv.byteStride ?? 12
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const out: number[] = []
  for (let i = 0; i < a.count; i++) {
    const o = start + i * stride
    out.push(bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8))
  }
  return out
}

const { json, bin } = readGlb(glbPath)

describe("the coffee's zone, held to the shipped desk", () => {
  const pos = positionsOf(json, bin, 'DeskGloss')
  const inBox = (x: number, y: number, z: number): boolean =>
    x >= COFFEE_ZONE.min[0] && x <= COFFEE_ZONE.max[0] &&
    y >= COFFEE_ZONE.min[1] && y <= COFFEE_ZONE.max[1] &&
    z >= COFFEE_ZONE.min[2] && z <= COFFEE_ZONE.max[2]

  it('agrees with the CoffeeAnchor the file itself carries', () => {
    const anchor = json.nodes.find((n) => n.name?.startsWith('CoffeeAnchor'))
    expect(anchor?.translation?.[0]).toBeCloseTo(COFFEE_ZONE.center[0], 3)
    expect(anchor?.translation?.[2]).toBeCloseTo(COFFEE_ZONE.center[1], 3)
    expect(anchor?.scale?.[0]).toBeCloseTo(COFFEE_ZONE.radius, 3)
  })

  it('splits the gloss mesh cleanly: every vertex is decisively the disc or decisively not', () => {
    // The disc is the run of vertices within the anchor's radius of the axis at the liquid's
    // height; the only other gloss component (the donut's icing) is 0.396 away from the box.
    let disc = 0
    let straddle = 0
    for (let i = 0; i < pos.length; i += 3) {
      const isDisc =
        Math.hypot(pos[i] - COFFEE_ZONE.center[0], pos[i + 2] - COFFEE_ZONE.center[1]) <
          COFFEE_ZONE.radius + 0.01 && pos[i + 1] > 1.8
      const boxed = inBox(pos[i], pos[i + 1], pos[i + 2])
      if (isDisc) disc++
      if (isDisc !== boxed) straddle++
    }
    // occupancy: the disc shipped with 265 vertices; floored a little under for re-decimation
    expect(disc).toBeGreaterThanOrEqual(250)
    expect(straddle, 'vertices the zone tears off the disc (or steals from the icing)').toBe(0)
  })

  it("sits inside the mug's micro box, which is what makes the precedence skip sufficient", () => {
    const mug = DESK_NUDGE_ZONES.find((z) => z.kind === 'mug')!
    for (const a of [0, 1, 2]) {
      expect(COFFEE_ZONE.min[a]).toBeGreaterThanOrEqual(mug.min[a] - 1e-9)
      expect(COFFEE_ZONE.max[a]).toBeLessThanOrEqual(mug.max[a] + 1e-9)
    }
  })

  it('is claimed by a ray straight down its axis, and not by one down the donut', () => {
    const hit = coffeeRayHit(COFFEE_ZONE.center[0], 5, COFFEE_ZONE.center[1], 0, -1, 0, 40, 900)
    expect(hit).not.toBeNull()
    // the claim lands on the liquid's own top plane — the disc, not the padded slab box (T97 S5)
    expect(hit!.point[1]).toBeCloseTo(COFFEE_ZONE.surfaceY, 5)
    expect(coffeeRayHit(-1.78, 5, 11.36, 0, -1, 0, 40, 900)).toBeNull()
  })

  it('claims the VISIBLE disc and nothing else at the money shot (T97 S5)', () => {
    // The disc's surface sits between the zone's authored y bounds...
    expect(COFFEE_ZONE.surfaceY).toBeGreaterThan(COFFEE_ZONE.min[1])
    expect(COFFEE_ZONE.surfaceY).toBeLessThan(COFFEE_ZONE.max[1])
    // ...and a grazing ray that crosses the surface plane OUTSIDE the disc's radius — the mug's
    // front body and handle, where the shipped box claimed the click — is refused, so the full
    // clink is reachable again. Ray aimed at the rim's front, 0.05 past the radius:
    const gx = COFFEE_ZONE.center[0]
    const gz = COFFEE_ZONE.center[1] + COFFEE_ZONE.radius + 0.05
    const miss = coffeeRayHit(gx, COFFEE_ZONE.surfaceY + 2, gz, 0, -1, 0, 40, 900)
    expect(miss).toBeNull()
    // paranoia: a ray that never crosses the plane cannot claim
    expect(coffeeRayHit(gx, COFFEE_ZONE.surfaceY - 1, 13, 0, -1, 0, 40, 900)).toBeNull()
  })
})

describe("the stir's closed forms", () => {
  const out = new Float32Array(4)

  it('crests at the authored dip and cream on a full click from rest', () => {
    const s = restingStir()
    triggerStir(s, 1, 1)
    expect(sampleStir(s, 1, out)).toBe(true)
    expect(out[0]).toBeCloseTo(STIR.dipMax, 6)
    expect(out[1]).toBeCloseTo(0, 6)
    expect(out[2]).toBeCloseTo(STIR.cream, 6)
  })

  it('dips as ω² and turns toward ω0/λ, monotonically', () => {
    const s = restingStir()
    triggerStir(s, 0, 1)
    let lastTheta = -1
    let lastDip = STIR.dipMax * 1.01
    for (let t = 0.05; t < 2; t += 0.05) {
      sampleStir(s, t, out)
      expect(out[1]).toBeGreaterThan(lastTheta)
      expect(out[0]).toBeLessThan(lastDip)
      lastTheta = out[1]
      lastDip = out[0]
    }
    expect(lastTheta).toBeLessThan(STIR.omega0 / STIR.lambda)
    // by 1.4 s — the T91 arc — the dip is under 2% of its crest
    sampleStir(s, 1.4, out)
    expect(out[0]).toBeLessThan(STIR.dipMax * 0.02)
  })

  it('re-stirs velocity-continuously: θ never jumps across a trigger', () => {
    const s = restingStir()
    triggerStir(s, 0, 1)
    sampleStir(s, 0.3 - 1e-9, out)
    const before = out[1]
    triggerStir(s, 0.3, 1)
    sampleStir(s, 0.3, out)
    expect(out[1]).toBeCloseTo(before, 5)
    // ...and the added spin only ever deepens the dip, up to the cap
    expect(out[0]).toBeGreaterThan(STIR.dipMax * 0.9)
    expect(out[0]).toBeLessThanOrEqual(STIR.dipMax * STIR.cap * STIR.cap + 1e-9)
  })

  it('caps pile-up: mashing the liquid cannot exceed cap·ω0', () => {
    const s = restingStir()
    for (let i = 0; i < 40; i++) triggerStir(s, i * 0.01, 1)
    sampleStir(s, 0.4, out)
    expect(out[0]).toBeLessThanOrEqual(STIR.dipMax * STIR.cap * STIR.cap + 1e-9)
  })

  it('settles to EXACT rest: zeros in the uniform, the banked turn forgotten', () => {
    const s = restingStir()
    triggerStir(s, 0, 1)
    expect(sampleStir(s, 10, out)).toBe(false)
    expect(s.active).toBe(false)
    for (const v of out) expect(Object.is(v, 0)).toBe(true)
    // the next stir starts a fresh spiral — θ from zero, exactly as the first ever did
    triggerStir(s, 11, 1)
    sampleStir(s, 11, out)
    expect(out[1]).toBeCloseTo(0, 6)
  })

  it('keeps the guard that makes a pointerless scrub bit-identical', () => {
    expect(STIR_VERTEX_BODY).toContain('uStir.x != 0.0')
    expect(STIR_FRAGMENT_BODY).toContain('uStir.z != 0.0')
    // the dip profile is zero AT the rim — the ring that meets the mug's wall never moves
    expect(STIR_VERTEX_BODY).toContain('max( 0.0')
  })
})

describe("the notebook's hinge, held to the shipped desk", () => {
  const pos = positionsOf(json, bin, 'DeskBaked')
  const hb = BOOK_HINGE.box
  const inHinge = (x: number, y: number, z: number): boolean =>
    x >= hb.min[0] && x <= hb.max[0] && y >= hb.min[1] && y <= hb.max[1] && z >= hb.min[2] && z <= hb.max[2]

  it('selects the cover slab, the whole cover slab, and nothing but the cover slab', () => {
    // Three layers meet under the hinge floor and the box must cut BETWEEN them: the slab's own
    // bottom face at 1.6410 (moves), the spliced interior at 1.6398..1.6399 (static, Task 92's
    // page + gutter), the pages block at 1.6390 and below (static). The floor 1.63995 is the cut.
    let slab = 0
    let boxed = 0
    let disagree = 0
    let interior = 0
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i]
      const y = pos[i + 1]
      const z = pos[i + 2]
      const inBook =
        x >= BOOK_ZONE.min[0] && x <= BOOK_ZONE.max[0] && z >= BOOK_ZONE.min[2] && z <= BOOK_ZONE.max[2]
      const isSlab = inBook && y > hb.min[1]
      const b = inHinge(x, y, z)
      if (isSlab) slab++
      if (b) boxed++
      if (isSlab !== b) disagree++
      // the revealed page + gutter: strictly between the pages block and the hinge floor
      if (inBook && y > 1.6392 && y < hb.min[1]) interior++
    }
    expect(slab).toBeGreaterThanOrEqual(250)
    expect(disagree, 'vertices the hinge box tears off the slab (or steals from the shell)').toBe(0)
    expect(boxed).toBe(slab)
    // the interior shipped, and none of it can be reached by the hinge
    expect(interior).toBeGreaterThanOrEqual(300)
  })

  it("the spine axis lies along the slab's attachment edge (the measured yaw)", () => {
    // every slab vertex is on the front side of the spine line, none further than the book depth
    const [ax, , az] = BOOK_HINGE.across
    for (let i = 0; i < pos.length; i += 3) {
      if (!inHinge(pos[i], pos[i + 1], pos[i + 2])) continue
      const u = (pos[i] - BOOK_HINGE.p0[0]) * ax + (pos[i + 2] - BOOK_HINGE.p0[2]) * az
      expect(u).toBeGreaterThan(-0.12)
      expect(u).toBeLessThan(0.85)
    }
    // and the flex ramp saturates before the verso's authored start (0.16), so the sketch panel
    // rides a RIGID cover
    expect(BOOK_HINGE.rampHi).toBeLessThanOrEqual(0.16)
  })

  it('claims a click through the cover, and stays out of every micro zone', () => {
    const cx = (BOOK_ZONE.min[0] + BOOK_ZONE.max[0]) / 2
    const cz = (BOOK_ZONE.min[2] + BOOK_ZONE.max[2]) / 2
    expect(bookRayHit(cx, 5, cz, 0, -1, 0, 40, 900)).not.toBeNull()
    expect(bookRayHit(-2.595, 5, 11.3, 0, -1, 0, 40, 900)).toBeNull()
    for (const z of DESK_NUDGE_ZONES) {
      const overlaps =
        BOOK_ZONE.min[0] <= z.max[0] && BOOK_ZONE.max[0] >= z.min[0] &&
        BOOK_ZONE.min[2] <= z.max[2] && BOOK_ZONE.max[2] >= z.min[2]
      expect(overlaps, `the book zone overlaps the ${z.kind} micro zone`).toBe(false)
    }
  })
})

describe('the watering, held to the shipped desk', () => {
  const pos = positionsOf(json, bin, 'DeskBaked')
  const n = pos.length / 3

  // Union-find over the shipped triangles plus co-located split vertices — the same derivation
  // the nudge zones use, because the claim is the same shape: a chunk that selects a vertex RANGE
  // must select whole physical objects, never parts of them.
  const comp = (() => {
    const mesh = json.meshes.find((m) => m.name.startsWith('DeskBaked'))!
    const a = json.accessors[mesh.primitives[0].indices!]
    const bv = json.bufferViews[a.bufferView]
    const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const parent = new Int32Array(n)
    for (let i = 0; i < n; i++) parent[i] = i
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]]
        i = parent[i]
      }
      return i
    }
    const uni = (x: number, y: number): void => {
      const rx = find(x)
      const ry = find(y)
      if (rx !== ry) parent[rx] = ry
    }
    for (let k = 0; k < a.count; k += 3) {
      const i0 = bin.readUInt16LE(start + k * 2)
      const i1 = bin.readUInt16LE(start + k * 2 + 2)
      const i2 = bin.readUInt16LE(start + k * 2 + 4)
      uni(i0, i1)
      uni(i1, i2)
    }
    const byKey = new Map<string, number>()
    for (let i = 0; i < n; i++) {
      const key = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`
      const j = byKey.get(key)
      if (j === undefined) byKey.set(key, i)
      else uni(i, j)
    }
    const out = new Int32Array(n)
    for (let i = 0; i < n; i++) out[i] = find(i)
    return out
  })()

  /** Every vertex of every component that intersects [lo, hi] must itself lie in [lo, hi]. */
  const wholeComponents = (lo: number, hi: number): { comps: Set<number>; torn: number } => {
    const comps = new Set<number>()
    for (let i = lo; i <= hi; i++) comps.add(comp[i])
    let torn = 0
    for (let i = 0; i < n; i++) if (comps.has(comp[i]) && (i < lo || i > hi)) torn++
    return { comps, torn }
  }

  it('the leaf range is thirty whole components — an index select cannot tear a leaf or a neighbour', () => {
    const { comps, torn } = wholeComponents(PLANT.leaves[0], PLANT.leaves[1])
    expect(comps.size).toBe(30)
    expect(torn, 'vertices of leaf components outside the selected range').toBe(0)
    // and they are geometrically the rosette: every selected vertex near the published origin
    for (let i = PLANT.leaves[0]; i <= PLANT.leaves[1]; i++) {
      const d = Math.hypot(pos[i * 3] - PLANT.origin[0], pos[i * 3 + 2] - PLANT.origin[2])
      expect(d).toBeLessThan(0.45)
      expect(pos[i * 3 + 1]).toBeGreaterThan(1.6)
      expect(pos[i * 3 + 1]).toBeLessThan(2.06)
    }
  })

  it('the soil range is one whole component, the disc inside the pot', () => {
    const { comps, torn } = wholeComponents(PLANT.soil[0], PLANT.soil[1])
    expect(comps.size).toBe(1)
    expect(torn).toBe(0)
    for (let i = PLANT.soil[0]; i <= PLANT.soil[1]; i++) {
      const d = Math.hypot(pos[i * 3] - PLANT.origin[0], pos[i * 3 + 2] - PLANT.origin[2])
      expect(d).toBeLessThan(0.3)
      expect(pos[i * 3 + 1]).toBeGreaterThan(1.62)
      expect(pos[i * 3 + 1]).toBeLessThan(1.7)
    }
  })

  it("the can zone is the spliced can's own measured footprint", () => {
    const mi = json.meshes.findIndex((m) => m.name === 'Can_B')
    expect(mi).toBeGreaterThanOrEqual(0)
    const node = json.nodes.find((nd) => nd.mesh === mi)!
    const a = json.accessors[json.meshes[mi].primitives[0].attributes.POSITION]
    const t = node.translation!
    const [qx, qy, qz, qw] = node.rotation!
    const rot = (x: number, y: number, z: number): number[] => {
      const uvx = qy * z - qz * y
      const uvy = qz * x - qx * z
      const uvz = qx * y - qy * x
      const uux = qy * uvz - qz * uvy
      const uuy = qz * uvx - qx * uvz
      const uuz = qx * uvy - qy * uvx
      return [x + 2 * (qw * uvx + uux) + t[0], y + 2 * (qw * uvy + uuy) + t[1], z + 2 * (qw * uvz + uuz) + t[2]]
    }
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (const x of [a.min![0], a.max![0]])
      for (const y of [a.min![1], a.max![1]])
        for (const z of [a.min![2], a.max![2]]) {
          const w = rot(x, y, z)
          for (let c = 0; c < 3; c++) {
            lo[c] = Math.min(lo[c], w[c])
            hi[c] = Math.max(hi[c], w[c])
          }
        }
    for (let c = 0; c < 3; c++) {
      // the zone contains the can's rotated AABB and hugs it to a hundredth
      expect(CAN_ZONE.min[c]).toBeLessThanOrEqual(lo[c])
      expect(CAN_ZONE.min[c]).toBeGreaterThan(lo[c] - 0.01)
      expect(CAN_ZONE.max[c]).toBeGreaterThanOrEqual(hi[c])
      expect(CAN_ZONE.max[c]).toBeLessThan(hi[c] + 0.01)
    }
  })

  it('claims a click through the can, and stays out of every other claim', () => {
    const cx = (CAN_ZONE.min[0] + CAN_ZONE.max[0]) / 2
    const cz = (CAN_ZONE.min[2] + CAN_ZONE.max[2]) / 2
    expect(canRayHit(cx, 5, cz, 0, -1, 0, 40, 900)).not.toBeNull()
    expect(canRayHit(-2.595, 5, 11.3, 0, -1, 0, 40, 900)).toBeNull()
    for (const z of DESK_NUDGE_ZONES) {
      const overlaps =
        CAN_ZONE.min[0] <= z.max[0] &&
        CAN_ZONE.max[0] >= z.min[0] &&
        CAN_ZONE.min[2] <= z.max[2] &&
        CAN_ZONE.max[2] >= z.min[2]
      expect(overlaps, `the can zone overlaps the ${z.kind} micro zone`).toBe(false)
    }
    const bookOverlap =
      CAN_ZONE.min[0] <= BOOK_ZONE.max[0] &&
      CAN_ZONE.max[0] >= BOOK_ZONE.min[0] &&
      CAN_ZONE.min[2] <= BOOK_ZONE.max[2] &&
      CAN_ZONE.max[2] >= BOOK_ZONE.min[2]
    expect(bookOverlap).toBe(false)
  })

  it('ships ONE merged clip that drives every watering node from one span and returns exactly to rest', () => {
    const anims = json.animations!.filter((an) => an.name === 'WaterAction')
    expect(anims).toHaveLength(1)
    const anim = anims[0]
    // can translation+rotation, 7 drops translation+scale
    expect(anim.channels).toHaveLength(16)
    const floats = (idx: number): number[] => {
      const a = json.accessors[idx]
      const bv = json.bufferViews[a.bufferView]
      const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
      const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type]!
      const out: number[] = []
      for (let k = 0; k < a.count * comps; k++) out.push(bin.readFloatLE(start + k * 4))
      return out
    }
    for (const ch of anim.channels) {
      const s = anim.samplers[ch.sampler]
      const input = json.accessors[s.input]
      // one span for every channel — the scrub writes ONE number
      expect(input.max![0]).toBeCloseTo(WATER.duration, 5)
      expect(s.interpolation ?? 'LINEAR').toBe('LINEAR')
      // rest-returning: first key equals last key AND equals the node's own authored rest
      const v = floats(s.output)
      const comps = v.length / input.count
      const node = json.nodes[ch.target.node]
      const rest =
        ch.target.path === 'translation'
          ? node.translation!
          : ch.target.path === 'rotation'
            ? node.rotation!
            : (node.scale ?? [1, 1, 1])
      for (let c = 0; c < comps; c++) {
        expect(v[c]).toBeCloseTo(v[v.length - comps + c], 6)
        expect(v[c]).toBeCloseTo(rest[c], 6)
      }
    }
  })
})

describe("the watering's closed forms", () => {
  const out = new Float32Array(4)

  it('holds the perk back until the water lands, crests at 1, and eases home', () => {
    const s = restingWater()
    triggerWater(s, 2)
    // before landing: clip advances, no perk
    expect(sampleWater(s, 2 + WATER.land * 0.5, out)).toBeCloseTo(WATER.land * 0.5, 6)
    expect(Object.is(out[0], 0)).toBe(true)
    // at full drink: perk crests at exactly 1
    sampleWater(s, 2 + WATER.land + WATER.perkRise + 0.01, out)
    expect(out[0]).toBeCloseTo(1, 6)
    // the clip clamps at its own end while the plant still holds its drink
    expect(sampleWater(s, 2 + WATER.duration + 0.5, out)).toBe(WATER.duration)
    expect(out[0]).toBeGreaterThan(0.9)
  })

  it('settles to EXACT rest and disarms — a watered plant is one never watered', () => {
    const s = restingWater()
    triggerWater(s, 0)
    expect(sampleWater(s, WATER_TOTAL + 0.001, out)).toBe(0)
    expect(s.active).toBe(false)
    expect(Object.is(out[0], 0)).toBe(true)
  })

  it('is pure in (now − t0): the same instant scrubs to the same frame', () => {
    const a = restingWater()
    const b = restingWater()
    triggerWater(a, 1)
    triggerWater(b, 5)
    const oa = new Float32Array(4)
    const ob = new Float32Array(4)
    for (const tau of [0.3, WATER.land + 0.2, 1.7, 2.4, 3.1]) {
      const ca = sampleWater(a, 1 + tau, oa)
      const cb = sampleWater(b, 5 + tau, ob)
      // 12 digits, not toBe: (1+τ)−1 and (5+τ)−5 differ by IEEE addition, which is the CALLER's
      // rounding, not the closed form's — the form itself is a pure function of its τ
      expect(ca).toBeCloseTo(cb, 12)
      expect(oa[0]).toBeCloseTo(ob[0], 6)
    }
  })

  it('absorbs clicks mid-arc — the set piece finishes its sentence', () => {
    const s = restingWater()
    triggerWater(s, 5)
    triggerWater(s, 5.5)
    expect(s.t0).toBe(5)
    expect(sampleWater(restingWater(), 100, out)).toBe(0)
  })

  it('keeps the guards and the derived index ranges in the chunks', () => {
    expect(WATER_VERTEX_BODY).toContain('uWater.x != 0.0')
    expect(WATER_FRAGMENT_BODY).toContain('uWater.x != 0.0')
    expect(WATER_VERTEX_BODY).toContain(`gl_VertexID >= ${PLANT.leaves[0]}`)
    expect(WATER_VERTEX_BODY).toContain(`gl_VertexID <= ${PLANT.leaves[1]}`)
    expect(WATER_VERTEX_BODY).toContain(`gl_VertexID >= ${PLANT.soil[0]}`)
  })
})

describe("the notebook's arc", () => {
  it('opens on the spring, overshooting like paper on board, and is near-open at the hold', () => {
    const s = restingBook()
    triggerBook(s, 1)
    let peak = 0
    for (let t = 0.02; t < BOOK.holdUntil; t += 0.02) {
      const th = sampleBook(s, 1 + t)
      if (th > peak) peak = th
    }
    expect(peak).toBeGreaterThan(BOOK.open)
    expect(peak).toBeLessThan(BOOK.open * 1.15)
    expect(sampleBook(s, 1 + BOOK.holdUntil - 0.01)).toBeGreaterThan(BOOK.open * 0.97)
  })

  it('falls shut, bounces without ever passing through the pages, and ends at EXACT zero', () => {
    const s = restingBook()
    triggerBook(s, 0)
    let ended = 0
    for (let t = BOOK.holdUntil; t < BOOK.holdUntil + 3; t += 0.01) {
      const th = sampleBook(s, t)
      expect(th).toBeGreaterThanOrEqual(0)
      if (!s.active) {
        ended = t
        break
      }
    }
    expect(ended).toBeGreaterThan(0)
    expect(Object.is(sampleBook(s, ended + 1), 0)).toBe(true)
    expect(s.active).toBe(false)
  })

  it('absorbs clicks mid-arc — the set piece finishes its sentence', () => {
    const s = restingBook()
    triggerBook(s, 5)
    triggerBook(s, 5.5)
    expect(s.t0).toBe(5)
    // and before the trigger there is nothing
    expect(sampleBook(restingBook(), 100)).toBe(0)
  })

  it('keeps the guard and the flex ramp in the chunk', () => {
    expect(BOOK_VERTEX_BODY).toContain('uBookHinge.x != 0.0')
    expect(BOOK_VERTEX_BODY).toContain('smoothstep')
  })
})

describe("the bird's perch hold (T97 P5)", () => {
  it('parks the clip at the standing pose for holdExtra seconds, then resumes 1:1', () => {
    const s = restingBird()
    triggerBird(s, 10)
    // 1:1 before the hold
    expect(sampleBird(s, 10 + 1.0)).toBeCloseTo(1.0, 9)
    expect(sampleBird(s, 10 + BIRD.holdAt - 1e-6)).toBeCloseTo(BIRD.holdAt - 1e-6, 6)
    // parked — one constant clip time is one constant pose
    expect(sampleBird(s, 10 + BIRD.holdAt + 0.01)).toBe(BIRD.holdAt)
    expect(sampleBird(s, 10 + BIRD.holdAt + BIRD.holdExtra - 0.01)).toBe(BIRD.holdAt)
    // resumed, shifted by exactly the hold — the unroll plays every one of its own frames
    expect(sampleBird(s, 10 + BIRD.holdAt + BIRD.holdExtra + 0.25)).toBeCloseTo(BIRD.holdAt + 0.25, 9)
    expect(sampleBird(s, 10 + BIRD_TOTAL - 0.01)).toBeCloseTo(BIRD.duration - 0.01, 6)
  })

  it('holds INSIDE the clip’s own standing beat (f46–65 = 1.92..2.71 s)', () => {
    expect(BIRD.holdAt).toBeGreaterThan(46 / 24)
    expect(BIRD.holdAt).toBeLessThan(65 / 24)
  })

  it('is monotone and continuous across both seams — no frame can play twice or skip', () => {
    const s = restingBird()
    triggerBird(s, 0)
    let prev = 0
    for (let t = 0.001; t < BIRD_TOTAL; t += 0.008) {
      const v = sampleBird(s, t)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v - prev).toBeLessThanOrEqual(0.009)
      prev = v
    }
  })

  it('disarms to exact rest past the whole arc, exactly as before the hold existed', () => {
    const s = restingBird()
    triggerBird(s, 5)
    expect(sampleBird(s, 5 + BIRD_TOTAL - 1e-6)).toBeGreaterThan(0)
    expect(Object.is(sampleBird(s, 5 + BIRD_TOTAL), 0)).toBe(true)
    expect(s.active).toBe(false)
    // ...and a re-trigger after rest starts a fresh arc (mid-arc clicks stay absorbed)
    triggerBird(s, 20)
    expect(s.active).toBe(true)
    expect(sampleBird(s, 20.5)).toBeCloseTo(0.5, 9)
  })
})
