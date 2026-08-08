import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESK_GLB_URL } from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { BOOK_HINGE, BOOK_ZONE } from '@/components/labs/small-world/scene/props/desk-deep'

/**
 * THE NOTEBOOKS STAND ON THE PINK, NOT IN IT (Task 102, Aram's round-2 item 4) — re-derived from
 * the shipped bytes, because the claim is a geometric one about an asset and nothing in the code
 * can hold it up.
 *
 * WHAT WAS WRONG. The pad — "the pink desktop cover" — is `DeskSurface`'s second component: a
 * 0.0350-thick slab, footprint x ±3.3000 / z 8.6500..12.3500, top plane 1.3030. The notebook
 * stack shipped seated at 1.2670, the BARE slab's top (1.2675) less the 0.0005 seat bite, while
 * straddling the pad's left edge — 0.9067 of its 1.4134 width off the pad, 0.5067 over it. So the
 * pad's whole thickness passed through the bottom notebook: 204 vertices below the pad's top
 * plane, worst penetration 0.0360 world units. Baked, not runtime: the stack has no node, and the
 * only field that reaches it (`BOOK_VERTEX_BODY`) floors four tenths of a unit higher.
 *
 * WHAT FIXED IT. `t102_book_lift.mjs` added 0.0360 to y over three contiguous `DeskBaked` runs and
 * the whole of `BookVerso` — a splice, so every colour, index, sampler and node TRS byte is the
 * one that shipped before. The lift is vertical and not lateral BECAUSE `DeskSurface` carries 177
 * vertices in total: every shadow on the desk is in the atlas, keyed to x/z, and a sideways move
 * would strand the stack's contact shadow. The seat it lands on is the pad's own top plane —
 * measured here to be the same plane the mug, the donut and the pen cup already sit on, so the
 * number is the house's rather than this round's.
 */

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))

type Gltf = {
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

const { json, bin } = readGlb(glbPath)

function meshOf(name: string) {
  const mesh = json.meshes.find((m) => m.name === name || m.name.startsWith(name))
  if (!mesh) throw new Error(`mesh ${name} missing`)
  return mesh
}

function positionsOf(name: string): number[] {
  const a = json.accessors[meshOf(name).primitives[0].attributes.POSITION]
  const bv = json.bufferViews[a.bufferView]
  const stride = bv.byteStride ?? 12
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const out: number[] = []
  for (let i = 0; i < a.count; i++) {
    const o = start + i * stride
    out.push(bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8))
  }
  return out
}

/** Union-find over the triangles plus co-located split vertices — the derivation every zone in
 *  this lab is measured with, so "a component" means the same thing here as it does there. */
function componentsOf(name: string): Int32Array {
  const pos = positionsOf(name)
  const n = pos.length / 3
  const mesh = meshOf(name)
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
    uni(bin.readUInt16LE(start + k * 2), bin.readUInt16LE(start + k * 2 + 2))
    uni(bin.readUInt16LE(start + k * 2 + 2), bin.readUInt16LE(start + k * 2 + 4))
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
}

const surf = positionsOf('DeskSurface')
const baked = positionsOf('DeskBaked')
const verso = positionsOf('BookVerso')

/**
 * The pad, re-derived: `DeskSurface` splits into exactly two components — the desk slab and the
 * pad standing proud of it — and the pad is the one that does not reach the desk's own extent.
 */
const PAD = (() => {
  const comp = componentsOf('DeskSurface')
  const groups = new Map<number, number[]>()
  for (let i = 0; i < comp.length; i++) {
    const g = groups.get(comp[i])
    if (g) g.push(i)
    else groups.set(comp[i], [i])
  }
  expect(groups.size, 'DeskSurface is the slab and the pad, and nothing else').toBe(2)
  let pad: number[] | null = null
  let slabTop = -Infinity
  for (const ids of groups.values()) {
    let hiX = -Infinity
    for (const i of ids) hiX = Math.max(hiX, Math.abs(surf[i * 3]))
    if (hiX > 10) for (const i of ids) slabTop = Math.max(slabTop, surf[i * 3 + 1])
    else pad = ids
  }
  expect(pad, 'the pad component').not.toBeNull()
  let top = -Infinity
  let bottom = Infinity
  const lo = [Infinity, Infinity]
  const hi = [-Infinity, -Infinity]
  for (const i of pad!) {
    top = Math.max(top, surf[i * 3 + 1])
    bottom = Math.min(bottom, surf[i * 3 + 1])
    lo[0] = Math.min(lo[0], surf[i * 3])
    hi[0] = Math.max(hi[0], surf[i * 3])
    lo[1] = Math.min(lo[1], surf[i * 3 + 2])
    hi[1] = Math.max(hi[1], surf[i * 3 + 2])
  }
  return { top, bottom, slabTop, x: [lo[0], hi[0]], z: [lo[1], hi[1]] }
})()

/**
 * The stack, as the splice addresses it: three contiguous `DeskBaked` runs — the three hardcovers,
 * their three page blocks, and T92's spliced interior — plus the whole of `BookVerso`.
 */
const STACK_RUNS: readonly (readonly [number, number])[] = [
  [0, 2083],
  [13398, 14347],
  [49156, 49529],
] as const

describe('the pink pad, as the shipped file draws it', () => {
  it('is a 0.0350 sheet standing proud of the desk, and the desk is under it', () => {
    expect(PAD.top).toBeCloseTo(1.303, 4)
    expect(PAD.bottom).toBeCloseTo(1.268, 4)
    expect(PAD.slabTop).toBeCloseTo(1.2675, 4)
    // it stands proud, which is the whole reason anything can sink into it
    expect(PAD.top).toBeGreaterThan(PAD.slabTop)
    expect(PAD.x[0]).toBeCloseTo(-3.3, 4)
    expect(PAD.x[1]).toBeCloseTo(3.3, 4)
    expect(PAD.z[0]).toBeCloseTo(8.65, 4)
    expect(PAD.z[1]).toBeCloseTo(12.35, 4)
  })

  it("its top is the house's seat plane — the mug, the donut and the pen cup all measure to it", () => {
    // Stated as a measurement rather than as a constant: the notebooks were lifted ONTO this
    // number, so it has to be the one the rest of the desk already stands on.
    const seats: [string, number[], number[]][] = [
      ['mug', [-3.2, 1.26, 10.92], [-2.21, 2.08, 11.68]],
      ['donut', [-2.2, 1.26, 10.92], [-1.34, 1.62, 11.83]],
      ['pencup', [2.558, 1.26, 11.42], [3.27, 2.76, 12.23]],
    ]
    for (const [label, lo, hi] of seats) {
      let minY = Infinity
      for (let i = 0; i < baked.length / 3; i++) {
        const x = baked[i * 3]
        const y = baked[i * 3 + 1]
        const z = baked[i * 3 + 2]
        if (x < lo[0] || x > hi[0] || y < lo[1] || y > hi[1] || z < lo[2] || z > hi[2]) continue
        minY = Math.min(minY, y)
      }
      expect(minY, `${label} seat`).toBeCloseTo(PAD.top, 4)
    }
  })
})

describe('the notebooks stand ON the pink cover, not through it', () => {
  it('the three runs are whole components — the lift could not shear a book off its own pages', () => {
    const comp = componentsOf('DeskBaked')
    const picked = new Set<number>()
    let n = 0
    for (const [lo, hi] of STACK_RUNS)
      for (let i = lo; i <= hi; i++) {
        picked.add(comp[i])
        n++
      }
    expect(n, 'vertices in the runs').toBe(3408)
    // three hardcovers, three page blocks, the spliced page and its gutter
    expect(picked.size, 'components the runs cover').toBe(8)
    let torn = 0
    for (let i = 0; i < comp.length; i++) {
      if (!picked.has(comp[i])) continue
      if (!STACK_RUNS.some(([lo, hi]) => i >= lo && i <= hi)) torn++
    }
    expect(torn, 'vertices of stack components left behind outside the runs').toBe(0)
  })

  it('NOT ONE vertex of the stack lies below the pad’s top plane', () => {
    // The defect, as a gate. Before the lift 204 vertices failed this, the worst by 0.0360.
    // Stated over the whole stack rather than only over the pad's footprint: the stack must clear
    // the plane everywhere, so the assertion cannot be weakened by an argument about the outline.
    let below = 0
    let worst = 0
    for (const [lo, hi] of STACK_RUNS)
      for (let i = lo; i <= hi; i++) {
        const d = PAD.top - baked[i * 3 + 1]
        if (d > 1e-5) {
          below++
          worst = Math.max(worst, d)
        }
      }
    for (let i = 0; i < verso.length / 3; i++) {
      const d = PAD.top - verso[i * 3 + 1]
      if (d > 1e-5) {
        below++
        worst = Math.max(worst, d)
      }
    }
    expect(below, `stack vertices inside the pad (worst ${worst.toFixed(4)})`).toBe(0)
  })

  it('...and it is SEATED on that plane, not hovering over it', () => {
    // The other half of the claim, and the reason the margin is exactly zero: the stack's
    // underside is coplanar with the pad's top, which is what the mug and the donut do. A margin
    // would be a gap, and a gap at this camera is a floating book.
    let minY = Infinity
    for (const [lo, hi] of STACK_RUNS) for (let i = lo; i <= hi; i++) minY = Math.min(minY, baked[i * 3 + 1])
    expect(minY).toBeCloseTo(PAD.top, 5)
  })

  it('keeps the stack’s authored taper — the lift is a translation, not a squash', () => {
    // The three covers ship 0.1500 / 0.1300 / 0.1100 thick, biggest book at the bottom. A squash
    // of the bottom board would have cleared the pad too, and would have thrown that away.
    const runOf = (lo: number, hi: number): [number, number] => {
      let a = Infinity
      let b = -Infinity
      for (let i = lo; i <= hi; i++) {
        a = Math.min(a, baked[i * 3 + 1])
        b = Math.max(b, baked[i * 3 + 1])
      }
      return [a, b]
    }
    const covers: [number, number][] = [runOf(0, 811), runOf(812, 1511), runOf(1512, 2083)]
    const thick = covers.map(([a, b]) => b - a)
    expect(thick[0]).toBeCloseTo(0.15, 4)
    expect(thick[1]).toBeCloseTo(0.13, 4)
    expect(thick[2]).toBeCloseTo(0.11, 4)
    // and they are still a STACK: each board's underside is the one below it's top, exactly
    expect(covers[1][0]).toBeCloseTo(covers[0][1], 5)
    expect(covers[2][0]).toBeCloseTo(covers[1][1], 5)
  })
})

describe("the hinge still cuts where it has to (the lift's one coupling)", () => {
  /**
   * THIS IS THE GATE THAT MAKES THE LIFT SAFE. `BOOK_VERTEX_BODY` selects the cover slab by REST
   * POSITION, and its floor threads a 0.0011 sandwich: above T92's spliced interior (static — it
   * is the page the open reveals) and below the slab's own bottom face (which moves). The lift
   * moved every one of those three planes by 0.0360, so `BOOK_HINGE.box` had to move with them.
   * If this fails, the shipped GLB and `desk-deep.ts` are out of step and the notebook's cover
   * either tears or drags its own interior open with it.
   */
  const inZone = (x: number, z: number): boolean =>
    x >= BOOK_ZONE.min[0] && x <= BOOK_ZONE.max[0] && z >= BOOK_ZONE.min[2] && z <= BOOK_ZONE.max[2]

  it('threads the interior and the slab’s bottom face', () => {
    let interiorTop = -Infinity
    let slabBottom = Infinity
    for (let i = 0; i < baked.length / 3; i++) {
      const x = baked[i * 3]
      const y = baked[i * 3 + 1]
      const z = baked[i * 3 + 2]
      if (!inZone(x, z)) continue
      // the spliced interior is the run above the top book's pages and below its cover slab
      if (y > 1.67 && y < BOOK_HINGE.box.min[1]) interiorTop = Math.max(interiorTop, y)
      if (y >= BOOK_HINGE.box.min[1]) slabBottom = Math.min(slabBottom, y)
    }
    expect(interiorTop).toBeGreaterThan(0)
    expect(slabBottom).toBeLessThan(Infinity)
    expect(BOOK_HINGE.box.min[1]).toBeGreaterThan(interiorTop)
    expect(BOOK_HINGE.box.min[1]).toBeLessThan(slabBottom)
    // ...and the ceiling still covers the slab's own top
    let slabTop = -Infinity
    for (let i = 1512; i <= 2083; i++) slabTop = Math.max(slabTop, baked[i * 3 + 1])
    expect(BOOK_HINGE.box.max[1]).toBeGreaterThan(slabTop)
  })

  it('the spine pivot sits at the slab’s mid-thickness, where it was authored', () => {
    let lo = Infinity
    let hi = -Infinity
    for (let i = 1512; i <= 2083; i++) {
      const y = baked[i * 3 + 1]
      if (!inZone(baked[i * 3], baked[i * 3 + 2])) continue
      if (y < BOOK_HINGE.box.min[1]) continue
      lo = Math.min(lo, y)
      hi = Math.max(hi, y)
    }
    expect(BOOK_HINGE.p0[1]).toBeGreaterThan(lo)
    expect(BOOK_HINGE.p0[1]).toBeLessThan(hi)
    expect(BOOK_HINGE.p0[1]).toBeCloseTo((lo + hi) / 2, 2)
  })

  it('the click zone still contains the notebook it opens, and the verso rides above the floor', () => {
    for (let i = 1512; i <= 2083; i++) {
      const y = baked[i * 3 + 1]
      expect(y).toBeGreaterThanOrEqual(BOOK_ZONE.min[1])
      expect(y).toBeLessThanOrEqual(BOOK_ZONE.max[1])
    }
    let versoMin = Infinity
    for (let i = 0; i < verso.length / 3; i++) versoMin = Math.min(versoMin, verso[i * 3 + 1])
    expect(versoMin).toBeGreaterThan(BOOK_HINGE.box.min[1])
  })
})
