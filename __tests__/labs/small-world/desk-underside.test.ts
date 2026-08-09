import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  bakedMaterial,
  canMaterial,
  glossMaterial,
} from '@/components/labs/small-world/scene/props/desk-glb'
import {
  DESK_GLB_URL,
  DESK_NUDGE_ZONES,
  DESK_PAD,
} from '@/components/labs/small-world/scene/props/desk-glb-contract'
import { BOOK_HINGE, LANE, PLANT } from '@/components/labs/small-world/scene/props/desk-deep'
import { ROCK_PARAMS } from '@/components/labs/small-world/scene/props/desk-nudge'
import {
  LANE_BAR_INDEX,
  STATION_BARS,
  STATION_CASE,
  TRAY_FLOOR_RANGE,
} from '@/components/labs/small-world/scene/props/desk-station'
import {
  FIGURINE_FOOT_TOP,
  FOOT_SOFT,
  LIFT_BAND,
  LIFT_K,
  LIFT_RAMP,
  PAD_SURFACE,
  SEAT_BAND_TOP,
  TABLE_SURFACE,
  UNDERSIDE_BOUNCE,
  UNDERSIDE_DEFAULT,
  UNDERSIDE_FRAGMENT_BODY,
  UNDERSIDE_REGIONS,
  UNDERSIDE_TARGETS,
  UNDERSIDE_VERTEX_BODY,
  UNDERSIDE_ZONES,
  ZONE_SOFT,
} from '@/components/labs/small-world/scene/props/desk-underside'

/**
 * THE BLACK-UNDERSIDE LIFT, HELD TO WHAT IT CLAIMS (T102).
 *
 * The claims worth pinning are the ones a later edit could quietly withdraw: that the resting
 * frame takes the untouched path STRUCTURALLY, that the lift reaches exactly the objects the
 * diagnosis convicted and cannot reach the penguin's honest black paint, that the two family
 * colours are the surfaces the objects actually stand over, and that the composition order in
 * `desk-glb.tsx` still puts the weight after every motion block.
 *
 * T104 added the two FIGURINE BASES and moved one claim rather than adding a suite beside it: the
 * penguin is still out of reach above the pad's top plane, and now in reach below it. T104b moved
 * that same claim's PLANE — the ceiling is the top of the foot, walked out of the vertex rings —
 * and added the one law the vessel bands bring with them: a band stops below its own interior.
 */

// --- the shipped bytes, read independently of the runtime loader -------------

type Gltf = {
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices?: number }[] }[]
  accessors: {
    bufferView: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
    normalized?: boolean
  }[]
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

const NUM: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const SIZE: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }

function read(json: Gltf, bin: Buffer, idx: number): number[][] {
  const a = json.accessors[idx]!
  const bv = json.bufferViews[a.bufferView]!
  const n = NUM[a.type]!
  const cs = SIZE[a.componentType]!
  const stride = bv.byteStride ?? n * cs
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  const out: number[][] = []
  for (let i = 0; i < a.count; i++) {
    const o = start + i * stride
    const v: number[] = []
    for (let c = 0; c < n; c++) {
      const p = o + c * cs
      if (a.componentType === 5126) v.push(bin.readFloatLE(p))
      else if (a.componentType === 5125) v.push(bin.readUInt32LE(p))
      else if (a.componentType === 5123) v.push(a.normalized ? bin.readUInt16LE(p) / 65535 : bin.readUInt16LE(p))
      else v.push(a.normalized ? bin.readUInt8(p) / 255 : bin.readUInt8(p))
    }
    out.push(v)
  }
  return out
}

const glbPath = path.join(process.cwd(), 'public', DESK_GLB_URL.replace(/^\//, ''))
const { json, bin } = readGlb(glbPath)

function meshOf(name: string) {
  const mesh = json.meshes.find((m) => m.name === name || m.name.startsWith(name))!
  const prim = mesh.primitives[0]!
  return {
    pos: read(json, bin, prim.attributes.POSITION!),
    col: prim.attributes.COLOR_0 != null ? read(json, bin, prim.attributes.COLOR_0) : null,
  }
}

const baked = meshOf('DeskBaked')
const surface = meshOf('DeskSurface')
const lum = (c: number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!

/** The shader's own selection test for one region, in TypeScript. */
function regionHas(r: (typeof UNDERSIDE_REGIONS)[number], i: number, p: number[]): boolean {
  return r.kind === 'range'
    ? i >= r.range[0] && i <= r.range[1]
    : p[0]! >= r.min[0] && p[0]! <= r.max[0] &&
      p[1]! >= r.min[1] && p[1]! <= r.max[1] &&
      p[2]! >= r.min[2] && p[2]! <= r.max[2]
}

/** Does this vertex fall inside any convicted region? */
const inRegion = (i: number, p: number[]): boolean =>
  UNDERSIDE_REGIONS.some((r) => regionHas(r, i, p))

/**
 * Where a region's honest colour is read from (T104). Five of the eight hold their own lit family
 * and answer with their own vertices — the penguin joined them at T104b, when its ceiling rose to
 * take in the feet. The other three are all core, and declare `albedoAbove`, which reads the same
 * xz column from the ceiling up by that much. Both branches are the shipped bytes; neither is a
 * number copied out of the source.
 */
function albedoSample(r: (typeof UNDERSIDE_REGIONS)[number]): number[][] {
  if (r.albedoAbove === undefined)
    return baked.pos.map((p, i) => ({ p, i })).filter(({ p, i }) => regionHas(r, i, p)).map(({ i }) => baked.col![i]!)
  if (r.kind !== 'box') throw new Error(`${r.id}: albedoAbove needs a box to sit on top of`)
  const out: number[][] = []
  for (let i = 0; i < baked.pos.length; i++) {
    const p = baked.pos[i]!
    if (p[0]! < r.min[0] || p[0]! > r.max[0] || p[2]! < r.min[2] || p[2]! > r.max[2]) continue
    if (p[1]! > r.max[1] && p[1]! <= r.max[1] + r.albedoAbove) out.push(baked.col![i]!)
  }
  return out
}

// --- the emitted GLSL ---------------------------------------------------------

/** three's `onBeforeCompile` contract minus the GL context, carrying every chunk this material
 *  patches — including `project_vertex`, which is the hook the lift's ORDER depends on. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader:
      '#include <begin_vertex>\n#include <project_vertex>\n#include <color_vertex>\nvoid main(){}',
    fragmentShader: '#include <map_fragment>\n#include <color_fragment>\nvoid main(){}',
  }
}
const compile = (mat: THREE.Material) => {
  const shader = fakeShader()
  ;(mat.onBeforeCompile as unknown as (s: ReturnType<typeof fakeShader>) => void)(shader)
  return shader
}

describe('the rest guard is structural, and it is in the shader that ships', () => {
  const shader = compile(bakedMaterial({ value: 1 }))

  it('computes the weight from a displacement that is EXACTLY zero on the untouched path', () => {
    // begin_vertex writes `transformed = position`; every motion block in this material is behind
    // its own exact-zero guard; so a pointerless frame reaches the lift with the two bit-equal.
    expect(UNDERSIDE_VERTEX_BODY).toContain('length( transformed - position )')
    expect(shader.vertexShader).toContain('length( transformed - position )')
    // ...and smoothstep with a strictly positive low edge returns a true +0 there.
    expect(LIFT_RAMP.dispLo).toBeGreaterThan(0)
    expect(LIFT_RAMP.dispHi).toBeGreaterThan(LIFT_RAMP.dispLo)
    const smoothstep = (lo: number, hi: number, x: number) => {
      const t = Math.min(Math.max((x - lo) / (hi - lo), 0), 1)
      return t * t * (3 - 2 * t)
    }
    expect(Object.is(smoothstep(LIFT_RAMP.dispLo, LIFT_RAMP.dispHi, 0), 0)).toBe(true)
  })

  it('skips the whole fragment term at zero rather than mixing by zero', () => {
    expect(UNDERSIDE_FRAGMENT_BODY.startsWith('if ( vUnderLift.x != 0.0 )')).toBe(true)
    expect(shader.fragmentShader).toContain('if ( vUnderLift.x != 0.0 )')
  })

  it('measures the weight AFTER every motion block, not before one of them', () => {
    // The order desk-glb.tsx builds is begin_vertex, STATION, BIRD, BOOK, WATER, nudge — and the
    // lift hangs off <project_vertex>, which is downstream of all of it. A future edit that moves
    // the lift up would read a partial displacement and lose the exact-zero guard with it.
    const v = shader.vertexShader
    // the BODY, not the varying's declaration — that is prepended above everything by design
    const weightAt = v.indexOf('vUnderLift.x = clamp')
    expect(weightAt).toBeGreaterThan(0)
    expect(weightAt).toBeGreaterThan(v.indexOf('#include <begin_vertex>'))
    // each motion block's own exact-zero guard is a unique string; the lift must sit after all of
    // them, because a partial displacement is both the wrong weight and no rest guard at all
    for (const guard of [
      'uBookHinge.x != 0.0',
      'uWater.x != 0.0',
      'uNudge_penguin.w != 0.0',
      'uNudge_mug.w != 0.0',
    ]) {
      expect(v.indexOf(guard), `${guard} must run before the lift reads the displacement`)
        .toBeLessThan(weightAt)
      expect(v.indexOf(guard)).toBeGreaterThan(0)
    }
    expect(weightAt).toBeLessThan(v.indexOf('#include <project_vertex>'))
    // ...and uBird, which the tray floor's weight READS, has to be declared above it
    expect(v.indexOf('uniform vec4 uBird;')).toBeGreaterThanOrEqual(0)
    expect(v.indexOf('uniform vec4 uBird;')).toBeLessThan(weightAt)
  })

  it('rides uLights, so the dark end of the pull-back cannot be repainted', () => {
    // The DIM bake is under the band almost everywhere (the plant's COLOR_1 is p95 0.129), so a
    // lift that ran at uLights 0 would paint an unlit desk. It cannot: the term is scaled by it.
    expect(UNDERSIDE_FRAGMENT_BODY).toContain('* uLights')
  })
})

describe('exactly one material is wired, and the diagnosis says which', () => {
  it('wires DeskBaked — all three convicted objects live in it', () => {
    const s = compile(bakedMaterial({ value: 1 }))
    expect(s.vertexShader).toContain('vUnderLift')
    expect(s.fragmentShader).toContain('vUnderLift')
  })

  it('leaves the can alone: its bake has no crushed darks at all', () => {
    // Measured on the shipped bytes — the floor below is the whole argument for not wiring it,
    // and its lift is a NODE transform anyway, so object-space displacement there is identically
    // zero and the weight would have to come from WATER_UNIFORM's canLift instead.
    const can = meshOf('Can_B')
    const min = Math.min(...can.col!.map(lum))
    expect(min).toBeGreaterThan(LIFT_BAND.lumHi)
    expect(compile(canMaterial({ value: 1 })).fragmentShader).not.toContain('vUnderLift')
  })

  it('leaves the gloss alone: the donut icing is dark ALBEDO, not a crushed bake', () => {
    // A crushed bake is dark only where the geometry hides itself. The icing is dark on the faces
    // that point at the key light too, which is what chocolate is.
    const gloss = meshOf('DeskGloss')
    const up = gloss.pos
      .map((p, i) => ({ p, L: lum(gloss.col![i]!) }))
      .filter((r) => r.p[1]! > 1.45)
    const median = up.map((r) => r.L).sort((a, b) => a - b)[Math.floor(up.length / 2)]!
    expect(median).toBeLessThan(LIFT_BAND.lumHi)
    const s = compile(glossMaterial(new THREE.Texture(), { value: 1 }, { value: 0 }))
    expect(s.fragmentShader).not.toContain('vUnderLift')
  })

  it('leaves the metal alone: DeskMetal ships a FLAT per-object colour, not a bake', () => {
    // Every vertex of a metal object carries the same value (the rose-gold pen 0.343, the knife
    // blade 0.489), so its dark side is a runtime reflection and there is nothing to lift.
    const metal = meshOf('DeskMetal')
    const pen = metal.col!.slice(1106, 1687).map(lum)
    expect(Math.max(...pen) - Math.min(...pen)).toBeLessThan(1e-4)
  })
})

describe('the region table reaches the objects the diagnosis convicted, and nothing else', () => {
  it('selects each object the way its own motion selects it', () => {
    const byId = Object.fromEntries(UNDERSIDE_REGIONS.map((r) => [r.id, r]))
    expect(byId.plantLeaves).toMatchObject({ kind: 'range', range: PLANT.leaves })
    expect(byId.kitCase).toMatchObject({ kind: 'range', range: STATION_CASE.range })
    expect(byId.bookCover!.kind).toBe('box')
    const book = byId.bookCover as { min: readonly number[]; max: readonly number[] }
    expect([...book.min]).toEqual([...BOOK_HINGE.box.min.slice(0, 3)])
    expect([...book.max]).toEqual([...BOOK_HINGE.box.max.slice(0, 3)])
  })

  it('finds a crushed core inside every region — otherwise the region is not a defect', () => {
    for (const r of UNDERSIDE_REGIONS) {
      const inside = baked.pos
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) =>
          r.kind === 'range'
            ? i >= r.range[0] && i <= r.range[1]
            : p[0]! >= r.min[0] && p[0]! <= r.max[0] &&
              p[1]! >= r.min[1] && p[1]! <= r.max[1] &&
              p[2]! >= r.min[2] && p[2]! <= r.max[2]
        )
      // 30, because the smallest region in the table is the pen cup's contact band — ONE authored
      // loop of 40 vertices, 100% of it crushed, which is what a seat band looks like on a vessel
      // that barely moves (its rock is 0.8°, the whisper on this desk). T104's 60 was the
      // bluebird's 97; T104b's floor is the pen cup's 40.
      expect(inside.length, `${r.id} selects nothing`).toBeGreaterThan(30)
      const crushed = inside.filter(({ i }) => lum(baked.col![i]!) < LIFT_BAND.lumLo).length
      expect(crushed / inside.length, `${r.id} has no crushed core`).toBeGreaterThan(0.02)
    }
  })

  it('CANNOT reach a figurine vertex above its own foot — that black is paint (T104b)', () => {
    // T102 kept the penguin out of the table entirely, on the finding that its black is PAINT:
    // 83% of the whole figurine is under luminance 0.12, so no band can separate a hole from a
    // penguin, and a lift that reached its body would turn it grey mid-wobble. T104 added only the
    // part of it that is UNDERGROUND and capped the region at `DESK_PAD.top`; its own capture round
    // then found the pad's plane too low, because the feet's undersides sit just above it.
    //
    // So the law keeps its shape and moves its plane: the ceiling is now the top of the FOOT,
    // walked out of the vertex rings (`FIGURINE_FOOT_TOP`) rather than typed. Both halves are
    // asserted here, and the second is the one that matters — that the paint above the foot is
    // still out of reach, which is what T102 convicted and what a raised ceiling could betray.
    for (const zone of DESK_NUDGE_ZONES.filter((z) => z.kind === 'bird' || z.kind === 'penguin')) {
      const ceiling = FIGURINE_FOOT_TOP[zone.kind]!
      let inZone = 0
      let dark = 0
      let lifted = 0
      let paintAbove = 0
      for (let i = 0; i < baked.pos.length; i++) {
        const p = baked.pos[i]!
        if (
          p[0]! < zone.min[0] || p[0]! > zone.max[0] || p[1]! < zone.min[1] ||
          p[1]! > zone.max[1] || p[2]! < zone.min[2] || p[2]! > zone.max[2]
        ) continue
        inZone++
        const crushed = lum(baked.col![i]!) < LIFT_BAND.lumLo
        if (crushed) dark++
        if (!inRegion(i, p)) {
          // ...and the paint the ceiling refuses: crushed, above the foot, and NOT in any region.
          if (crushed && p[1]! > ceiling) paintAbove++
          continue
        }
        lifted++
        expect(p[1]!, `${zone.kind} vertex ${i} is lifted above its own foot`)
          .toBeLessThanOrEqual(ceiling)
      }
      expect(inZone, `${zone.kind} zone is empty`).toBeGreaterThan(1000)
      expect(dark / inZone, `${zone.kind} is not the painted-black family`).toBeGreaterThan(0.4)
      expect(lifted, `${zone.kind} has no seat band to lift`).toBeGreaterThan(60)
      // The lift is still the base and the foot, not the animal: 1,327 of the penguin's 5,355
      // vertices and 97 of the bluebird's 3,410. 0.3 is the nearest round bound over the former.
      expect(lifted / inZone, `${zone.kind}'s lift has spread past its foot`).toBeLessThan(0.3)
      // ...and the paint is real and untouched — this is the assertion T102's warning becomes.
      expect(paintAbove, `${zone.kind} has no painted black left above the ceiling to protect`)
        .toBeGreaterThan(100)
    }
  })

  it('stops each vessel band below its own interior, which is honestly dark at rest (T104b)', () => {
    // The trap T104 §7 named: height above the seat alone is NOT a sufficient scope, because the
    // mug's and the pen cup's crushed runs continue upward into their INTERIORS — the floor you
    // look straight down into — which are honestly dark, visible at rest, and would be a new
    // defect if repainted. The ring walk stops before them, and the proof is RADIAL: everything
    // the band keeps lies on the vessel's outer profile, and the interior floor is a disc reaching
    // the axis. So no lifted vertex may sit near the axis, and the excluded interior must exist.
    for (const kind of ['mug', 'pencup'] as const) {
      const zone = DESK_NUDGE_ZONES.find((z) => z.kind === kind)!
      // the object's OWN axis — its rock pivot, not the box centre: the nudge box is grown to
      // cover the mug's handle, so its centre sits 0.11 off the ceramic's axis.
      const ax = zone.pivot[0]
      const az = zone.pivot[2]
      const radii: number[] = []
      let interior = 0
      for (let i = 0; i < baked.pos.length; i++) {
        const p = baked.pos[i]!
        if (
          p[0]! < zone.min[0] || p[0]! > zone.max[0] || p[1]! < zone.min[1] ||
          p[1]! > zone.max[1] || p[2]! < zone.min[2] || p[2]! > zone.max[2]
        ) continue
        const r = Math.hypot(p[0]! - ax, p[2]! - az)
        if (inRegion(i, p)) radii.push(r)
        else if (lum(baked.col![i]!) < LIFT_BAND.lumLo && p[1]! > SEAT_BAND_TOP[kind]! && r < 0.15)
          interior++
      }
      expect(radii.length, `${kind} band selects nothing`).toBeGreaterThan(30)
      // every kept vertex is out on the wall, not on the floor: the mug's band sits at 0.272-0.281
      // and the cup's at 0.244, against interior discs that reach r = 0.
      expect(Math.min(...radii), `${kind} band reaches into its own interior`).toBeGreaterThan(0.2)
      // ...and it is a CORE, not a penumbra: LIFT_BAND was measured for a bimodal region.
      const dark = radii.length
      expect(dark, `${kind} band is not one authored loop`).toBeLessThan(60)
      expect(interior, `${kind} has no excluded interior — the trap would be untested`)
        .toBeGreaterThan(40)
    }
    // ...and the third seated vessel gets no band at all, for a structural reason rather than a
    // measured one: the donut is the one that does not ROCK. `squashBlock` scales y about a pivot
    // whose y IS the seat plane, so its bottom ring's height is invariant (the factor multiplies
    // zero) and every vertex above it moves DOWN — a squash can only press a contact band harder
    // into the pad. Both halves of that argument are held here, because if the donut ever gains a
    // rock or its pivot leaves the seat, the acquittal expires and the band has to be derived.
    expect(UNDERSIDE_REGIONS.some((r) => r.id.startsWith('donut'))).toBe(false)
    expect(ROCK_PARAMS.donut, 'the donut has acquired a rock and needs re-deriving').toBeUndefined()
    expect(
      DESK_NUDGE_ZONES.find((z) => z.kind === 'donut')!.pivot[1],
      "the donut's squash pivot has left the seat plane"
    ).toBeCloseTo(DESK_PAD.top, 5)
  })

  it('weights the tray floor by the driver that uncovers it, not by its own motion', () => {
    // The floor is a STATIC sheet: the lane rolling away is what exposes it, so a
    // displacement-weighted term could never reach it. uBird.x is 0 at rest and 1 while the lane
    // is hidden (desk-glb.tsx writes nothing between), so the guard is as structural as the ramp.
    const tray = UNDERSIDE_REGIONS.find((r) => r.id === 'trayFloor')!
    expect(tray.drive).toBe('bird')
    expect(tray.kind === 'range' && tray.range).toEqual(TRAY_FLOOR_RANGE)
    expect(UNDERSIDE_VERTEX_BODY).toContain('uBird.x *')
    // the sheet really is flat and really is black under the lane's own footprint
    const ys = new Set<string>()
    let inFoot = 0
    let crushed = 0
    for (let i = TRAY_FLOOR_RANGE[0]; i <= TRAY_FLOOR_RANGE[1]; i++) {
      const p = baked.pos[i]!
      ys.add(p[1]!.toFixed(4))
      const f = tray.foot!
      if (p[0]! >= f.min[0] && p[0]! <= f.max[0] && p[2]! >= f.min[1] && p[2]! <= f.max[1]) {
        inFoot++
        if (lum(baked.col![i]!) < LIFT_BAND.lumLo) crushed++
      }
    }
    expect(ys.size, 'the tray floor is one flat sheet').toBe(1)
    expect(inFoot).toBeGreaterThan(20)
    expect(crushed / inFoot, 'the floor under the lane is not black').toBeGreaterThan(0.5)
  })

  it('scopes the tray lift to the lane footprint the bar table publishes', () => {
    const tray = UNDERSIDE_REGIONS.find((r) => r.id === 'trayFloor')!
    const lane = STATION_BARS[LANE_BAR_INDEX]!.aabb
    expect(tray.foot).toEqual({ min: [lane.min[0], lane.min[2]], max: [lane.max[0], lane.max[2]] })
    // ...and the rest of the sheet, which is visible at rest, stays out of it
    let outside = 0
    for (let i = TRAY_FLOOR_RANGE[0]; i <= TRAY_FLOOR_RANGE[1]; i++) {
      const p = baked.pos[i]!
      const f = tray.foot!
      if (p[0]! < f.min[0] - FOOT_SOFT || p[0]! > f.max[0] + FOOT_SOFT ||
          p[2]! < f.min[1] - FOOT_SOFT || p[2]! > f.max[1] + FOOT_SOFT) outside++
    }
    expect(outside, 'the whole sheet would move, not just the uncovered patch').toBeGreaterThan(150)
  })

  it('CANNOT reach the collapsed clay lane, whose displacement is a false one', () => {
    // BIRD_VERTEX_BODY moves the hidden baked lane to a single point while the twin performs —
    // a huge displacement on vertices that emit no fragments. Disjointness closes that
    // structurally; the degenerate triangles are only the second line.
    for (let i = LANE.range[0]; i <= LANE.range[1]; i++) {
      expect(inRegion(i, baked.pos[i]!), `lane vertex ${i} is inside a lift region`).toBe(false)
    }
  })

  it('the regions do not overlap each other', () => {
    const owners = new Map<number, string>()
    for (let i = 0; i < baked.pos.length; i++) {
      for (const r of UNDERSIDE_REGIONS) {
        const hit =
          r.kind === 'range'
            ? i >= r.range[0] && i <= r.range[1]
            : baked.pos[i]![0]! >= r.min[0] && baked.pos[i]![0]! <= r.max[0] &&
              baked.pos[i]![1]! >= r.min[1] && baked.pos[i]![1]! <= r.max[1] &&
              baked.pos[i]![2]! >= r.min[2] && baked.pos[i]![2]! <= r.max[2]
        if (!hit) continue
        expect(owners.has(i), `vertex ${i} claimed by ${owners.get(i)} and ${r.id}`).toBe(false)
        owners.set(i, r.id)
      }
    }
  })
})

describe('the zone table is the surface each vertex actually stands over', () => {
  it('has one rectangle per family, none overlapping another with a different target', () => {
    for (let a = 0; a < UNDERSIDE_ZONES.length; a++)
      for (let b = a + 1; b < UNDERSIDE_ZONES.length; b++) {
        const x = UNDERSIDE_ZONES[a]!
        const y = UNDERSIDE_ZONES[b]!
        const overlap =
          x.min[0] < y.max[0] && y.min[0] < x.max[0] && x.min[1] < y.max[1] && y.min[1] < x.max[1]
        if (overlap) expect(x.surface, `${x.id} and ${y.id} overlap`).toEqual(y.surface)
      }
    for (const z of UNDERSIDE_ZONES) {
      expect(z.max[0]).toBeGreaterThan(z.min[0])
      expect(z.max[1]).toBeGreaterThan(z.min[1])
    }
  })

  it('is the pad footprint the shipped surface itself carries, not a second copy of it', () => {
    const pad = UNDERSIDE_ZONES.find((z) => z.id === 'pad')!
    expect([pad.min[0], pad.max[0]]).toEqual([-DESK_PAD.halfW, DESK_PAD.halfW])
    expect([pad.min[1], pad.max[1]]).toEqual([DESK_PAD.backZ, DESK_PAD.nearZ])
    // ...and the file agrees: DeskSurface's top plane inside the rectangle is the pad's 1.303,
    // and every vertex of the surface outside it stands on the lower table plane.
    const inside = surface.pos.filter(
      (p) =>
        p[0]! > pad.min[0] + 0.05 && p[0]! < pad.max[0] - 0.05 &&
        p[2]! > pad.min[1] + 0.05 && p[2]! < pad.max[1] - 0.05
    )
    expect(inside.length).toBeGreaterThan(8)
    expect(Math.max(...inside.map((p) => p[1]!))).toBeCloseTo(DESK_PAD.top, 4)
    const outside = surface.pos.filter((p) => Math.abs(p[0]!) > pad.max[0] + 0.2)
    expect(outside.length).toBeGreaterThan(8)
    expect(Math.max(...outside.map((p) => p[1]!))).toBeLessThan(DESK_PAD.top - 0.02)
  })

  it('covers both surface families every convicted region actually stands over', () => {
    // The cover straddles the pad's edge and the case reaches just past it; the plant is wholly
    // off the pad. So the fold has to answer per VERTEX, and both answers have to be reachable.
    const overPad = (p: number[]) =>
      Math.abs(p[0]!) <= DESK_PAD.halfW && p[2]! >= DESK_PAD.backZ && p[2]! <= DESK_PAD.nearZ
    const seen = { pad: false, table: false }
    for (let i = 0; i < baked.pos.length; i++) {
      if (!inRegion(i, baked.pos[i]!)) continue
      if (overPad(baked.pos[i]!)) seen.pad = true
      else seen.table = true
    }
    expect(seen).toEqual({ pad: true, table: true })
    // and the book cover alone crosses the boundary, which is why the edge is softened at all
    const cover = baked.pos.filter(
      (p, i) => UNDERSIDE_REGIONS.some((r) => r.kind === 'box' && r.id === 'bookCover') && inRegion(i, p) &&
        p[0]! >= BOOK_HINGE.box.min[0] && p[0]! <= BOOK_HINGE.box.max[0] &&
        p[1]! >= BOOK_HINGE.box.min[1] && p[1]! <= BOOK_HINGE.box.max[1] &&
        p[2]! >= BOOK_HINGE.box.min[2] && p[2]! <= BOOK_HINGE.box.max[2]
    )
    expect(cover.some(overPad) && cover.some((p) => !overPad(p))).toBe(true)
    expect(ZONE_SOFT).toBeGreaterThan(0)
  })
})

describe('the targets are the measured surfaces, scaled by one bounce', () => {
  it('keeps the pink pink and the white neutral, by the numbers that were read', () => {
    // sRGB #eadade and #efeded, means over the unoccluded half of each top plane.
    expect(PAD_SURFACE[0] / PAD_SURFACE[1]).toBeCloseTo(1.168, 2)
    expect(PAD_SURFACE[2] / PAD_SURFACE[1]).toBeCloseTo(1.038, 2)
    expect(TABLE_SURFACE[0] / TABLE_SURFACE[1]).toBeCloseTo(1.015, 2)
    expect(Math.abs(TABLE_SURFACE[2] / TABLE_SURFACE[1] - 1)).toBeLessThan(0.01)
    // the table is the brighter surface and therefore the brighter bounce — measured, not styled
    expect(lum([...TABLE_SURFACE])).toBeGreaterThan(lum([...PAD_SURFACE]))
    expect(UNDERSIDE_DEFAULT).toBe(TABLE_SURFACE)
  })

  it('is a PRODUCT of the region albedo and the zone surface, by one shared coefficient', () => {
    // The first cut aimed at the surface colour alone and the captures convicted it: a green leaf
    // lifted toward a white table reads GREY. Bounce is the surface's light times the object's
    // own albedo, and both factors are read off the shipped bytes.
    for (const r of UNDERSIDE_REGIONS) {
      const t = UNDERSIDE_TARGETS[r.id]!
      for (const k of [0, 1, 2]) {
        expect(t.pad[k]!).toBeCloseTo(r.albedo[k]! * PAD_SURFACE[k]! * UNDERSIDE_BOUNCE, 9)
        expect(t.table[k]!).toBeCloseTo(r.albedo[k]! * TABLE_SURFACE[k]! * UNDERSIDE_BOUNCE, 9)
      }
    }
    expect(UNDERSIDE_BOUNCE).toBeGreaterThan(0)
  })

  it('carries each region its OWN measured albedo, re-derived from the shipped bytes', () => {
    // The albedo is the mean of that region's vertices above luminance 0.35 — its honest colour —
    // and it has to be a compile-time literal because it is folded into GLSL. Recomputing it here
    // is what stops a re-bake from leaving a hand-copied number behind.
    //
    // THE TOLERANCE IS DELIBERATELY LOOSE, and this is the reason: `desk.glb` is re-spliced by
    // concurrent work, and this constant is a LOOK TARGET rather than a fingerprint of one build.
    // It was already caught drifting once — the notebook lane raised the cover 0.0360 and re-floored
    // BOOK_HINGE.box with it, and until the box was re-floored it swallowed 364 vertices of the
    // spliced interior and washed the cover's pink out to near-neutral. 0.05 catches a real change
    // of colour and ignores a splice that moves a seat; the hue ratios below are the part the fix
    // actually depends on, so they are held tighter.
    for (const r of UNDERSIDE_REGIONS) {
      const bright = albedoSample(r).filter((c) => lum(c) > 0.35)
      expect(bright.length, `${r.id} has no bright family`).toBeGreaterThan(40)
      const mean = [0, 1, 2].map((k) => bright.reduce((a, c) => a + c[k]!, 0) / bright.length)
      for (const k of [0, 1, 2])
        expect(Math.abs(r.albedo[k]! - mean[k]!), `${r.id} albedo channel ${k}`).toBeLessThan(0.05)
      const gm = mean[1]!
      const gr = r.albedo[1]!
      expect(Math.abs(r.albedo[0]! / gr - mean[0]! / gm), `${r.id} r:g hue`).toBeLessThan(0.1)
      expect(Math.abs(r.albedo[2]! / gr - mean[2]! / gm), `${r.id} b:g hue`).toBeLessThan(0.1)
    }
  })

  it('lands a fully crushed vertex UNDER the honest tone of the object it lifts', () => {
    // An underside that outshone the lit side would be a worse lie than the black. Both sides of
    // the comparison come from the shipped bytes: the landing from the region's own target, the
    // bar from its own median non-crushed luminance.
    for (const r of UNDERSIDE_REGIONS) {
      const t = UNDERSIDE_TARGETS[r.id]!
      const landing = Math.max(lum([...t.pad]), lum([...t.table])) * LIFT_K
      const honest = albedoSample(r)
        .map(lum)
        .filter((v) => v >= LIFT_BAND.lumHi)
        .sort((a, b) => a - b)
      expect(honest.length, `${r.id} has no honest tone to compare against`).toBeGreaterThan(20)
      expect(honest[Math.floor(honest.length / 2)]!, `${r.id} would be outshone by its own lift`)
        .toBeGreaterThan(landing)
    }
    expect(LIFT_K).toBeGreaterThan(0)
    expect(LIFT_K).toBeLessThanOrEqual(1)
  })

  it('bands where the regions actually have a valley, not where BIRD_LIFT did', () => {
    // The three are bimodal: a crushed core, a near-empty gap, then their honest range. The band
    // must sit in that gap — this checks the gap is really there in the shipped bytes.
    for (const r of UNDERSIDE_REGIONS) {
      const L = baked.pos
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) =>
          r.kind === 'range'
            ? i >= r.range[0] && i <= r.range[1]
            : p[0]! >= r.min[0] && p[0]! <= r.max[0] &&
              p[1]! >= r.min[1] && p[1]! <= r.max[1] &&
              p[2]! >= r.min[2] && p[2]! <= r.max[2]
        )
        .map(({ i }) => lum(baked.col![i]!))
      const inGap = L.filter((v) => v >= LIFT_BAND.lumLo && v < LIFT_BAND.lumHi).length
      expect(inGap / L.length, `${r.id}'s band is not a valley`).toBeLessThan(0.1)
    }
    expect(LIFT_BAND.lumLo).toBeGreaterThan(0)
    expect(LIFT_BAND.lumHi).toBeGreaterThan(LIFT_BAND.lumLo)
  })
})
