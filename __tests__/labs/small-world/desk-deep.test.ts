import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESK_GLB_URL,
  DESK_NUDGE_ZONES,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'
import {
  BOOK,
  BOOK_HINGE,
  BOOK_VERTEX_BODY,
  BOOK_ZONE,
  COFFEE_ZONE,
  STIR,
  STIR_FRAGMENT_BODY,
  STIR_VERTEX_BODY,
  bookRayHit,
  coffeeRayHit,
  restingBook,
  restingStir,
  sampleBook,
  sampleStir,
  triggerBook,
  triggerStir,
} from '@/components/labs/small-world/scene/props/desk-deep'

/**
 * THE DEEP TIER, HELD TO ITS OWN LAW (Task 92) — the coffee stir's closed forms, its zone against
 * the shipped bytes, and the one precedence rule it shares with the micro tier.
 */

// --- a minimal GLB reader, deliberately independent of the runtime loader ----

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))

type Gltf = {
  nodes: { name?: string; translation?: number[]; scale?: number[] }[]
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
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
    expect(hit!.point[1]).toBeCloseTo(COFFEE_ZONE.max[1], 5)
    expect(coffeeRayHit(-1.78, 5, 11.36, 0, -1, 0, 40, 900)).toBeNull()
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
    // the slab = Book2 vertices above the shell's own top plane; the hinge box must agree exactly
    let slab = 0
    let boxed = 0
    let disagree = 0
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i]
      const y = pos[i + 1]
      const z = pos[i + 2]
      const inBook =
        x >= BOOK_ZONE.min[0] && x <= BOOK_ZONE.max[0] && z >= BOOK_ZONE.min[2] && z <= BOOK_ZONE.max[2]
      const isSlab = inBook && y > 1.6395
      const b = inHinge(x, y, z)
      if (isSlab) slab++
      if (b) boxed++
      if (isSlab !== b) disagree++
    }
    expect(slab).toBeGreaterThanOrEqual(250)
    expect(disagree, 'vertices the hinge box tears off the slab (or steals from the shell)').toBe(0)
    expect(boxed).toBe(slab)
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
