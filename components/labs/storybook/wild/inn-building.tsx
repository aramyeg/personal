'use client'

/**
 * WILD lane — "Lamplight": the inn itself.
 *
 * Every dimension comes from `inn-model.ts`; nothing here invents a number. The building is
 * assembled as a pile of `BufferGeometry`, bucketed by material and merged, so the whole inn
 * costs roughly a dozen draw calls instead of fifty.
 *
 * Two structural ideas carry the volume:
 *
 *  1. THE FACADE SKIN. Each visible wall is a thin extruded `THREE.Shape` WITH HOLES, standing
 *     in front of an inset core box. A window is therefore a real hole with real reveals, and
 *     the carriage arch is a real bore straight through the mass with a true curved head. The
 *     windows implementer's glass seats into these holes because both sides read `WINDOWS`.
 *
 *  2. THE JETTY OVERHANG. The first floor genuinely oversails the stone below on its joists,
 *     so the moon lays a hard shadow band across the ground floor. That band is the proof the
 *     spread is built rather than painted.
 *
 * THE FOLD-BIRTH lives here as ONE FLOAT PER VERTEX. Everything is still authored at its final
 * position and still merges by material, so the draw count is unchanged; each piece of geometry
 * is simply tagged with the hinge chunk it belongs to (`aFold`), and the vertex shader swings it
 * up about that chunk's crease as the leaf comes over. See wild/fold-birth.ts for the hinge
 * lines and wild/fold-uniforms.ts for how the tag reaches the GPU.
 *
 * The three pieces that are NOT merged — the sign, the lantern and the hundred keys — ride their
 * chunk's map on a real group instead, because their materials are shared with meshes that carry
 * no tag and an InstancedMesh applies its instance matrix after the vertex map anyway.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { foldSlot, signBoardAngle } from './fold-birth'
import { foldDepthMaterial, foldMatrix } from './fold-uniforms'
import { innMaterials, type InnMaterials } from './inn-materials'
import { applyRiseClip } from './rise-clip'
import { STAGE_LIFE as LIFE, windAt } from './stage-life'
import {
  ARCH,
  BARRELS,
  CHIMNEY,
  DORMERS,
  HALL,
  JETTY,
  JETTY_OVERHANG,
  KEY_BOARD,
  LANTERN,
  PALETTE,
  ROOF,
  SIGN,
  STEP,
  TOWER,
  WELL,
  WINDOWS,
  type MassBox,
  type Vec3,
  type WindowSlot,
} from './inn-model'
import { readWildFrame, useWild } from './wild-frame'

// ---------------------------------------------------------------------------------------------
// tuning that belongs to the BUILDER, not to the model
// ---------------------------------------------------------------------------------------------

/** Thickness of the holed facade skin — i.e. how deep every window reveal is. */
const REVEAL_D = 0.028
/** Openings are cut this much larger than the glass, so the reveal frames each pane. */
const OPENING_MARGIN = 0.011
/** World size of one texture tile, per skin. Bigger number = coarser stones/shingles. */
const TILE = { stone: 0.3, timber: 0.46, shingle: 0.26 } as const

type MatKey = keyof InnMaterials
type Bucket = Map<MatKey, THREE.BufferGeometry[]>

/** The hinge chunk each part of the building belongs to. Named once, threaded everywhere. */
const SLOT = {
  walls: foldSlot('walls'),
  tower: foldSlot('tower'),
  jetty: foldSlot('jetty'),
  yard: foldSlot('yard'),
  roof: foldSlot('roof'),
  dormers: foldSlot('dormers'),
  chimney: foldSlot('chimney'),
  sign: foldSlot('sign'),
  lantern: foldSlot('lantern'),
} as const

/**
 * Stamp a geometry with its hinge chunk. Every geometry in a merge bucket must carry the same
 * attribute set, so this runs on the way IN to the bucket and never anywhere else.
 */
function tagFold(geo: THREE.BufferGeometry, slot: number): THREE.BufferGeometry {
  const count = geo.getAttribute('position').count
  const tag = new Float32Array(count)
  if (slot !== 0) tag.fill(slot)
  geo.setAttribute('aFold', new THREE.BufferAttribute(tag, 1))
  return geo
}

const push = (bucket: Bucket, key: MatKey, geo: THREE.BufferGeometry, slot: number): void => {
  tagFold(geo, slot)
  const list = bucket.get(key)
  if (list) list.push(geo)
  else bucket.set(key, [geo])
}

// ---------------------------------------------------------------------------------------------
// UV projection — one world-space texel density for the whole building
// ---------------------------------------------------------------------------------------------

/**
 * Planar-project UVs in world units using each vertex's dominant normal axis. Every tile the
 * painters produce is seamless in both axes, so this gives a consistent texel density across
 * merged geometry that per-face 0..1 UVs could never manage.
 */
function uvProject(geo: THREE.BufferGeometry, tile: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nx = Math.abs(nor.getX(i))
    const ny = Math.abs(nor.getY(i))
    const nz = Math.abs(nor.getZ(i))
    let u: number
    let v: number
    if (ny >= nx && ny >= nz) {
      u = x
      v = z
    } else if (nx >= nz) {
      u = z
      v = y
    } else {
      u = x
      v = y
    }
    uv[i * 2] = u / tile
    uv[i * 2 + 1] = v / tile
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

/** The chimney wants ONE tile over its whole height so the painted soot gradient is real. */
function uvStack(geo: THREE.BufferGeometry, topY: number, height: number, around: number): THREE.BufferGeometry {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const horizontal = Math.abs(nor.getX(i)) >= Math.abs(nor.getZ(i)) ? z : x
    uv[i * 2] = horizontal / around
    uv[i * 2 + 1] = (topY - y) / height
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

// ---------------------------------------------------------------------------------------------
// primitive helpers — everything comes back non-indexed and world-positioned, ready to merge
// ---------------------------------------------------------------------------------------------

function box(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g.toNonIndexed()
}

const boxOf = (m: MassBox, inset = 0): THREE.BufferGeometry =>
  box(m.min[0], m.min[1], m.min[2], m.max[0] - inset, m.max[1], m.max[2] - inset)

/** Extrude a shape that lies in x/y forward along +z, with its FRONT face at `frontZ`. */
function extrudeZ(shape: THREE.Shape, frontZ: number, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 })
  g.translate(0, 0, frontZ - depth)
  return g.toNonIndexed()
}

/** Extrude a shape authored in (z, y) sideways, with its RIGHT face at `rightX`. */
function extrudeX(shape: THREE.Shape, rightX: number, depth: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 })
  // rotateY(-90) sends shape x -> world +z and the extrusion direction -> world -x.
  g.rotateY(-Math.PI / 2)
  g.translate(rightX, 0, 0)
  return g.toNonIndexed()
}

/** Extrude a shape authored in (z, y) sideways along +x, spanning x0..x1. */
const spanX = (shape: THREE.Shape, x0: number, x1: number): THREE.BufferGeometry =>
  extrudeX(shape, x1, x1 - x0)

/** Extrude a shape authored in (x, y) along z, spanning z0..z1. */
const spanZ = (shape: THREE.Shape, z0: number, z1: number): THREE.BufferGeometry =>
  extrudeZ(shape, z1, z1 - z0)

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  at: Vec3,
  open = false,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, open)
  g.translate(at[0], at[1] + height / 2, at[2])
  return g.toNonIndexed()
}

// ---------------------------------------------------------------------------------------------
// shapes — rectangles, arch heads, window outlines
// ---------------------------------------------------------------------------------------------

function rectPath(x0: number, y0: number, x1: number, y1: number): THREE.Path {
  const p = new THREE.Path()
  p.moveTo(x0, y0)
  p.lineTo(x1, y0)
  p.lineTo(x1, y1)
  p.lineTo(x0, y1)
  p.closePath()
  return p
}

function rectShape(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(x0, y0)
  s.lineTo(x1, y0)
  s.lineTo(x1, y1)
  s.lineTo(x0, y1)
  s.closePath()
  return s
}

/**
 * The carriage arch outline: jambs rising to `springY`, then a true segmental head to `apexY`.
 * Authored as a path so it can be a hole in the facade AND in the core, and so the head is a
 * real curve rather than a staircase of boxes.
 */
function drawArch<T extends THREE.Path>(
  p: T,
  cx: number,
  halfW: number,
  springY: number,
  apexY: number,
  grow = 0,
  floorY = -0.02,
): T {
  const hw = halfW + grow
  const rise = apexY + grow - (springY + grow * 0.4)
  p.moveTo(cx - hw, floorY)
  p.lineTo(cx - hw, springY + grow * 0.4)
  // Two symmetric quadratics meeting at the crown read as a pointed-shouldered head.
  p.quadraticCurveTo(cx - hw, springY + grow * 0.4 + rise * 0.86, cx, apexY + grow)
  p.quadraticCurveTo(cx + hw, springY + grow * 0.4 + rise * 0.86, cx + hw, springY + grow * 0.4)
  p.lineTo(cx + hw, floorY)
  p.closePath()
  return p
}

const archPath = (grow = 0, floorY = -0.02): THREE.Path =>
  drawArch(new THREE.Path(), ARCH.cx, ARCH.halfW, ARCH.springY, ARCH.apexY, grow, floorY)

const archShape = (grow = 0, floorY = -0.02): THREE.Shape =>
  drawArch(new THREE.Shape(), ARCH.cx, ARCH.halfW, ARCH.springY, ARCH.apexY, grow, floorY)

// ---------------------------------------------------------------------------------------------
// WINDOW OPENINGS — holes in the facade skin, plus reveals, frames and sills
// ---------------------------------------------------------------------------------------------

type WallAxis = 'z' | 'x'

/** A visible wall face: the plane its outer surface sits on, and the windows cut into it. */
type Wall = {
  readonly axis: WallAxis
  /** Outer surface: world z for a FRONT wall, world x for a RIGHT wall. */
  readonly plane: number
  readonly slots: readonly WindowSlot[]
  /** The hinge chunk this wall and all its dressing swing with. */
  readonly fold: number
}

/** Where a slot sits along its wall: world x on a front wall, world z on a right wall. */
const alongOf = (s: WindowSlot, axis: WallAxis): number => (axis === 'z' ? s.pos[0] : s.pos[2])

/** Windows whose glass plane matches this wall, within a hair. Both sides read `WINDOWS`. */
function slotsOn(axis: WallAxis, plane: number, proud = 0.006): WindowSlot[] {
  return WINDOWS.filter((s) => {
    const c = axis === 'z' ? s.pos[2] : s.pos[0]
    const n = axis === 'z' ? s.facing[2] : s.facing[0]
    return n > 0.5 && Math.abs(c - (plane + proud)) < 1e-4
  })
}

/** Holes to punch in the wall's skin shape, in that shape's own 2D frame. */
function wallHoles(wall: Wall): THREE.Path[] {
  return wall.slots.map((s) =>
    openingPath(
      alongOf(s, wall.axis),
      s.pos[1],
      s.w + OPENING_MARGIN * 2,
      s.h + OPENING_MARGIN * 2,
      s.shape,
    ),
  )
}

/**
 * The dressing every opening needs: a dark panel closing the reveal at the core face, a lining
 * of joinery inside the hole, and a stone sill projecting proud of the wall.
 */
function dressOpenings(bucket: Bucket, wall: Wall): void {
  const front = wall.axis === 'z'
  const backPlane = wall.plane - REVEAL_D
  for (const s of wall.slots) {
    const u = alongOf(s, wall.axis)
    const v = s.pos[1]
    const hw = s.w / 2 + OPENING_MARGIN
    const hh = s.h / 2 + OPENING_MARGIN

    // Dark panel across the back of the reveal — an unlit window has to read as a hole.
    const panel = new THREE.PlaneGeometry(hw * 2, hh * 2)
    if (front) panel.translate(u, v, backPlane + 0.0015)
    else {
      panel.rotateY(Math.PI / 2)
      panel.translate(backPlane + 0.0015, v, u)
    }
    push(bucket, 'interior', panel.toNonIndexed(), wall.fold)

    // Lining: jambs and a cill board just inside the hole.
    const t = 0.007
    const d0 = wall.plane - REVEAL_D * 0.95
    const d1 = wall.plane + 0.0015
    const bar = (a0: number, b0: number, a1: number, b1: number) =>
      push(
        bucket,
        'joinery',
        front ? box(a0, b0, d0, a1, b1, d1) : box(d0, b0, a0, d1, b1, a1),
        wall.fold,
      )
    bar(u - hw, v - hh, u - hw + t, v + hh)
    bar(u + hw - t, v - hh, u + hw, v + hh)
    bar(u - hw, v - hh, u + hw, v - hh + t * 0.8)
    if (s.shape === 'tall' || s.shape === 'square') bar(u - hw, v + hh - t * 0.8, u + hw, v + hh)

    // Sill: stone, wider than the opening, weathering forward.
    const sw = hw + 0.014
    const sy0 = v - hh - 0.014
    const sy1 = v - hh + 0.001
    push(
      bucket,
      'stone',
      front
        ? box(u - sw, sy0, wall.plane - 0.03, u + sw, sy1, wall.plane + 0.015)
        : box(wall.plane - 0.03, sy0, u - sw, wall.plane + 0.015, sy1, u + sw),
      wall.fold,
    )
  }
}

/** Build a holed facade skin for a wall, in the caller's chosen skin material. */
function facadeSkin(
  bucket: Bucket,
  wall: Wall,
  outline: THREE.Shape,
  extraHoles: readonly THREE.Path[],
  skin: MatKey,
  tile: number,
): void {
  outline.holes.push(...wallHoles(wall), ...extraHoles)
  const geo =
    wall.axis === 'z'
      ? spanZ(outline, wall.plane - REVEAL_D, wall.plane)
      : spanX(outline, wall.plane - REVEAL_D, wall.plane)
  push(bucket, skin, uvProject(geo, tile), wall.fold)
  dressOpenings(bucket, wall)
}

// ---------------------------------------------------------------------------------------------
// THE HALL, THE CARRIAGE ARCH AND THE PASSAGE
// ---------------------------------------------------------------------------------------------

function buildHall(bucket: Bucket): void {
  const [x0, y0, z0] = HALL.min
  const [x1, y1, z1] = HALL.max
  const coreX1 = x1 - REVEAL_D
  const coreZ1 = z1 - REVEAL_D

  // Core: everything behind the facade skins, bored through by the arch. The bore's floor sits
  // a hair ABOVE the wall outline's bottom: earcut drops (or garbles) a hole that crosses its
  // own outline, and an arch reaching below the wall base is exactly that — the whole opening
  // silently vanished and the "arch" was solid coursed stone. The 8mm curb this leaves is a
  // threshold under the gate, and the step slab in front hides it anyway.
  const ARCH_FLOOR = y0 + 0.002
  const core = rectShape(x0, y0 - 0.006, coreX1, y1)
  core.holes.push(archPath(0, ARCH_FLOOR))
  push(bucket, 'stone', uvProject(spanZ(core, z0, coreZ1), TILE.stone), SLOT.walls)

  // Front skin, holed by the arch and the taproom windows.
  const frontWall: Wall = { axis: 'z', plane: z1, slots: slotsOn('z', z1), fold: SLOT.walls }
  facadeSkin(bucket, frontWall, rectShape(x0, y0 - 0.006, x1, y1), [archPath(0, ARCH_FLOOR)], 'stone', TILE.stone)

  // Right return, holed by the kitchen windows. Authored in (z, y).
  const rightWall: Wall = { axis: 'x', plane: x1, slots: slotsOn('x', x1), fold: SLOT.walls }
  facadeSkin(bucket, rightWall, rectShape(z0, y0 - 0.006, z1, y1), [], 'stone', TILE.stone)

  // Plinth course: the wall sits on a proud footing, which catches the moon along its top arris.
  // It is also the fold's visible hinge line — the crease the whole ground floor swings up about
  // runs along the front of this course.
  push(
    bucket,
    'stone',
    uvProject(box(x0, 0, z0 - 0.012, x1 + 0.012, 0.034, z1 + 0.012), TILE.stone),
    SLOT.walls,
  )
}

function buildArch(bucket: Bucket): void {
  const zFront = ARCH.frontZ
  const zBack = ARCH.backZ
  const hw = ARCH.halfW

  // Moulded surround, standing proud of the facade. Its inner hole keeps clear of the outline's
  // bottom edge for the same earcut reason as the wall bores — the sliver it closes across the
  // base reads as the gate's threshold stone.
  const surround = archShape(0.026, -0.02)
  surround.holes.push(archPath(0, 0.002))
  push(bucket, 'stone', uvProject(spanZ(surround, zFront, zFront + ARCH.reveal), TILE.stone), SLOT.walls)
  // Keystone at the crown, springer blocks at the haunches.
  push(
    bucket,
    'stone',
    uvProject(
      box(
        ARCH.cx - 0.022,
        ARCH.apexY - 0.012,
        zFront,
        ARCH.cx + 0.022,
        ARCH.apexY + 0.04,
        zFront + ARCH.reveal + 0.008,
      ),
      TILE.stone,
    ),
    SLOT.walls,
  )
  for (const sx of [-1, 1]) {
    const cx = ARCH.cx + sx * (hw - 0.002)
    push(
      bucket,
      'stone',
      uvProject(
        box(cx - 0.02, ARCH.springY - 0.016, zFront, cx + 0.02, ARCH.springY + 0.008, zFront + ARCH.reveal + 0.006),
        TILE.stone,
      ),
      SLOT.walls,
    )
  }

  // Passage floor: worn flags, a touch above the cobbles so the mouth has an edge.
  push(
    bucket,
    'stone',
    uvProject(box(ARCH.cx - hw, 0, zBack, ARCH.cx + hw, 0.009, zFront + 0.01), TILE.stone),
    SLOT.walls,
  )

  // Rear wall of the passage, filling the arch profile, with a door standing part open.
  // Deliberately NOT stone: through the bore the rear wall is most of what the reader sees,
  // and in the passage lamp's blaze a stone rear reads as the front wall continuing — the
  // arch stops being a hole. Dark joinery panelling gives the bore its depth, and the hundred
  // brass keys glint against it instead of vanishing into lit masonry.
  const doorW = 0.115
  const doorH = 0.215
  const doorX = ARCH.cx + 0.014
  const rear = archShape(-0.004, -0.02)
  rear.holes.push(rectPath(doorX - doorW / 2, 0.008, doorX + doorW / 2, doorH))
  push(bucket, 'joinery', uvProject(spanZ(rear, zBack + 0.02, zBack + 0.038), TILE.timber), SLOT.walls)

  // Whatever lies beyond the door is dark until the passage lamp is lit.
  push(
    bucket,
    'interior',
    box(ARCH.cx - hw, 0, zBack - 0.02, ARCH.cx + hw, ARCH.apexY, zBack + 0.021),
    SLOT.walls,
  )

  const leaf = box(0, 0, 0, doorW * 0.98, doorH - 0.01, 0.011)
  leaf.rotateY(0.62)
  leaf.translate(doorX - doorW / 2, 0.008, zBack + 0.022)
  push(bucket, 'joinery', leaf, SLOT.walls)

  // The key board's backing plank on the passage's far inner wall, and its rail.
  push(
    bucket,
    'joinery',
    box(
      KEY_BOARD.x - 0.007,
      KEY_BOARD.minY - 0.018,
      KEY_BOARD.minZ - 0.014,
      KEY_BOARD.x,
      KEY_BOARD.maxY + 0.02,
      KEY_BOARD.maxZ + 0.014,
    ),
    SLOT.walls,
  )
  push(
    bucket,
    'joinery',
    box(
      KEY_BOARD.x - 0.007,
      KEY_BOARD.maxY + 0.02,
      KEY_BOARD.minZ - 0.014,
      KEY_BOARD.x + 0.013,
      KEY_BOARD.maxY + 0.031,
      KEY_BOARD.maxZ + 0.014,
    ),
    SLOT.walls,
  )
}

/** A window opening in its own wall's 2D frame (u along the wall, v = height). */
function openingPath(u: number, v: number, w: number, h: number, shape: WindowSlot['shape']): THREE.Path {
  const hw = w / 2
  const hh = h / 2
  if (shape === 'round') {
    const p = new THREE.Path()
    p.absellipse(u, v, hw, hh, 0, Math.PI * 2, false, 0)
    return p
  }
  if (shape === 'arched') {
    const p = new THREE.Path()
    p.moveTo(u - hw, v - hh)
    p.lineTo(u + hw, v - hh)
    p.lineTo(u + hw, v + hh * 0.25)
    p.quadraticCurveTo(u + hw, v + hh, u, v + hh)
    p.quadraticCurveTo(u - hw, v + hh, u - hw, v + hh * 0.25)
    p.closePath()
    return p
  }
  return rectPath(u - hw, v - hh, u + hw, v + hh)
}

/** Centres of a run of members across a span: `pitch` is a target, and the run closes the span
 *  exactly, with a half-step margin at either end. */
function centres(a: number, b: number, pitch: number): number[] {
  const n = Math.max(2, Math.round((b - a) / pitch))
  const step = (b - a) / n
  const out: number[] = []
  for (let i = 0; i < n; i += 1) out.push(a + step * (i + 0.5))
  return out
}

// ---------------------------------------------------------------------------------------------
// THE JETTY — the first floor, riding out over the stone on its joists
// ---------------------------------------------------------------------------------------------

/** Joists: spacing along the wall, half their thickness, and how far they hang below the soffit. */
const JOIST = { pitch: 0.055, halfW: 0.011, drop: 0.04, bearing: 0.014, proud: 0.016 }
/** The bressummer — the beam across the joist ends that carries the wall above. */
const BRESSUMMER = { height: 0.026, depth: 0.03, proud: 0.008 }

function buildJetty(bucket: Bucket): void {
  const [x0, y0, z0] = JETTY.min
  const [x1, y1, z1] = JETTY.max

  // Core, sitting behind both skins.
  push(bucket, 'timber', uvProject(boxOf(JETTY, REVEAL_D), TILE.timber), SLOT.jetty)

  // Front: the gallery, clustered rather than ruled.
  const front: Wall = { axis: 'z', plane: z1, slots: slotsOn('z', z1), fold: SLOT.jetty }
  facadeSkin(bucket, front, rectShape(x0, y0, x1, y1), [], 'timber', TILE.timber)

  // Right return: the chambers. Authored in (z, y), like every right-hand wall here.
  const right: Wall = { axis: 'x', plane: x1, slots: slotsOn('x', x1), fold: SLOT.jetty }
  facadeSkin(bucket, right, rectShape(z0, y0, z1, y1), [], 'timber', TILE.timber)

  // THE OVERSAIL. The floor stands out past the stone by JETTY_OVERHANG on both visible sides,
  // and it does it the way a real one does: on joists that run back into the wall below, their
  // ends cut square and hanging clear under the bressummer. This is the volume proof. The moon
  // stands behind and to the right, so it is the RETURN's oversail that lays the hard band down
  // the kitchen wall — the front of the inn is backlit and reads by silhouette.
  const soffit = y0
  const jy0 = soffit - JOIST.drop
  const bearZ = z1 - JETTY_OVERHANG.z
  const bearX = x1 - JETTY_OVERHANG.x
  const beamZ = z1 - BRESSUMMER.depth
  const beamX = x1 - BRESSUMMER.depth

  for (const cx of centres(x0, x1, JOIST.pitch)) {
    push(
      bucket,
      'joinery',
      box(cx - JOIST.halfW, jy0, bearZ - JOIST.bearing, cx + JOIST.halfW, soffit, z1 + JOIST.proud),
      SLOT.jetty,
    )
  }
  // The return's joists stop short of the front run so the corner is one solid, not a lattice.
  for (const cz of centres(z0, bearZ, JOIST.pitch)) {
    push(
      bucket,
      'joinery',
      box(bearX - JOIST.bearing, jy0, cz - JOIST.halfW, x1 + JOIST.proud, soffit, cz + JOIST.halfW),
      SLOT.jetty,
    )
  }
  // The bressummer is the jetty's hinge line made visible: the whole first floor swings up about
  // the crease this beam runs along.
  push(
    bucket,
    'joinery',
    box(x0, soffit - BRESSUMMER.height, beamZ, x1, soffit, z1 + BRESSUMMER.proud),
    SLOT.jetty,
  )
  push(
    bucket,
    'joinery',
    box(beamX, soffit - BRESSUMMER.height, z0, x1 + BRESSUMMER.proud, soffit, beamZ),
    SLOT.jetty,
  )
}

// ---------------------------------------------------------------------------------------------
// THE STAIR TOWER — the tallest thing on the page, and the run the cascade climbs
// ---------------------------------------------------------------------------------------------

/**
 * A four-sided pyramid over a rectangle: the tower's cap and the lantern's. Built by hand rather
 * than from a cone because the footprint is a rectangle, not a circle inscribed in one, and
 * because four triangles beat a cone's ring of degenerate tips.
 */
function pyramid(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  baseY: number,
  apexY: number,
): THREE.BufferGeometry {
  const ax = (x0 + x1) / 2
  const az = (z0 + z1) / 2
  // Corner order runs so that each side face comes out wound toward the outside.
  const ring: readonly (readonly [number, number])[] = [
    [x0, z0],
    [x0, z1],
    [x1, z1],
    [x1, z0],
  ]
  const v: number[] = []
  for (let i = 0; i < 4; i += 1) {
    const [ax0, az0] = ring[i]
    const [ax1, az1] = ring[(i + 1) % 4]
    v.push(ax0, baseY, az0, ax1, baseY, az1, ax, apexY, az)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

function buildTower(bucket: Bucket): void {
  const [x0, y0, z0] = TOWER.min
  const [x1, y1, z1] = TOWER.max
  const { baseY, apexY, oversail } = TOWER.cap

  push(bucket, 'stone', uvProject(box(x0, y0, z0, x1 - REVEAL_D, y1, z1 - REVEAL_D), TILE.stone), SLOT.tower)

  // The stair alternates faces as it climbs, so both visible walls are holed by the same run.
  const front: Wall = { axis: 'z', plane: z1, slots: slotsOn('z', z1), fold: SLOT.tower }
  facadeSkin(bucket, front, rectShape(x0, y0, x1, y1), [], 'stone', TILE.stone)
  const right: Wall = { axis: 'x', plane: x1, slots: slotsOn('x', x1), fold: SLOT.tower }
  facadeSkin(bucket, right, rectShape(z0, y0, z1, y1), [], 'stone', TILE.stone)

  // Footing, matching the hall's so the two masses share one ground line — and, since the fold,
  // carrying the tower's own base crease, parallel to the hall's a hand's breadth away.
  push(bucket, 'stone', uvProject(box(x0, 0, z0, x1 + 0.012, 0.034, z1 + 0.012), TILE.stone), SLOT.tower)

  // THE CAP. Steep enough to read as a spire rather than a hat, and oversailing the shaft, so
  // there is a shadow line right round the top of the stonework instead of a butt joint.
  push(
    bucket,
    'shingle',
    uvProject(pyramid(x0 - oversail, z0 - oversail, x1 + oversail, z1 + oversail, baseY, apexY), TILE.shingle),
    SLOT.tower,
  )
  // Verge course under the eaves: what the cap's shadow line is actually cast by.
  // (A finial belongs here and there is deliberately none: MASS_APEX_Y is the cap's apex, the
  // rise starts the mass exactly that far under the page, and anything taller floats a spike on
  // blank paper before the curtain goes up.)
  const vo = oversail + 0.005
  push(bucket, 'joinery', box(x0 - vo, baseY - 0.013, z0 - vo, x1 + vo, baseY, z1 + vo), SLOT.tower)
}

// ---------------------------------------------------------------------------------------------
// THE ROOF, AND THE TWO DORMERS BREAKING IT
// ---------------------------------------------------------------------------------------------

/** Thickness of a roof plane. Deep enough that the cut edge at the eaves is worth a fascia. */
const ROOF_T = 0.026
const EAVES = { fascia: 0.022, proud: 0.01 }
const RIDGE = { half: 0.013, reach: 0.016 }
/** Barge boards standing out past the gable end, and how deep they hang below the slope. */
const BARGE = { out: 0.011, deep: 0.01 }

/** The front roof plane as a line in (z, y) — anything that dies into the roof asks it here. */
const roofFrontZ = (y: number): number =>
  ROOF.frontEaveZ + ((y - ROOF.eaveY) * (ROOF.ridgeZ - ROOF.frontEaveZ)) / (ROOF.ridgeY - ROOF.eaveY)

/**
 * A roof slab authored in (z, y): the weathering surface runs from (z0, y0) to (z1, y1) and the
 * timber hangs `thick` below it, measured square to the pitch rather than plumb — so the eaves
 * edge is a proper cut end and not a wedge.
 */
function slabShape(z0: number, y0: number, z1: number, y1: number, thick: number): THREE.Shape {
  const len = Math.hypot(z1 - z0, y1 - y0)
  let nz = (y1 - y0) / len
  let ny = -(z1 - z0) / len
  // Of the two normals, always take the upward one: the slab hangs under its own surface.
  if (ny < 0) {
    nz = -nz
    ny = -ny
  }
  const s = new THREE.Shape()
  s.moveTo(z0, y0)
  s.lineTo(z1, y1)
  s.lineTo(z1 - nz * thick, y1 - ny * thick)
  s.lineTo(z0 - nz * thick, y0 - ny * thick)
  s.closePath()
  return s
}

/**
 * The dormer's eaves sit this far up its face. High enough that the arched light's head clears
 * the rake on BOTH dormers — the small one is only a hair wider than its window, and a hole that
 * crosses its own outline does not triangulate, it explodes.
 */
const DORMER = { shoulder: 0.62, verge: 0.013, proud: 0.012, back: 0.014 }

/** The gable outline of a dormer front, optionally grown for a barge board. */
function gableShape(
  cx: number,
  halfW: number,
  sillY: number,
  apexY: number,
  grow = 0,
): THREE.Shape {
  const hw = halfW + grow
  const shoulderY = sillY + (apexY - sillY) * DORMER.shoulder + grow * 0.4
  const s = new THREE.Shape()
  s.moveTo(cx - hw, sillY - grow)
  s.lineTo(cx + hw, sillY - grow)
  s.lineTo(cx + hw, shoulderY)
  s.lineTo(cx, apexY + grow * 1.5)
  s.lineTo(cx - hw, shoulderY)
  s.closePath()
  return s
}

function buildDormer(bucket: Bucket, d: (typeof DORMERS)[number]): void {
  // Deep enough that the ridge dies into the main slope instead of stopping in mid-air.
  const backZ = roofFrontZ(d.apexY) - DORMER.back

  // Body: cheeks and both little roof slopes come off one prism, so the dormer is a solid that
  // can cast, not three planes leaning together.
  push(
    bucket,
    'shingle',
    uvProject(
      spanZ(gableShape(d.cx, d.halfW, d.sillY, d.apexY), backZ, d.frontZ - REVEAL_D),
      TILE.shingle,
    ),
    SLOT.dormers,
  )

  // Front, holed by this dormer's attic light — and only this one's; both gables share a plane.
  const wall: Wall = {
    axis: 'z',
    plane: d.frontZ,
    slots: slotsOn('z', d.frontZ).filter((s) => Math.abs(s.pos[0] - d.cx) <= d.halfW),
    fold: SLOT.dormers,
  }
  facadeSkin(bucket, wall, gableShape(d.cx, d.halfW, d.sillY, d.apexY), [], 'timber', TILE.timber)

  // Barge boards and apron: the grown outline with the true one punched out of it, standing
  // proud of the face. One ring instead of five boards.
  const ring = gableShape(d.cx, d.halfW, d.sillY, d.apexY, DORMER.verge)
  ring.holes.push(gableShape(d.cx, d.halfW, d.sillY, d.apexY))
  push(bucket, 'joinery', spanZ(ring, d.frontZ - 0.004, d.frontZ + DORMER.proud), SLOT.dormers)
}

function buildRoof(bucket: Bucket): void {
  const { minX, maxX, eaveY, ridgeY, ridgeZ, frontEaveZ, backEaveZ } = ROOF

  // The two planes. Both run the full length; the ridge is where they meet — and the ridge is
  // also the fold's read: the slopes start folded face to face and OPEN as the roof lifts.
  push(
    bucket,
    'shingle',
    uvProject(spanX(slabShape(frontEaveZ, eaveY, ridgeZ, ridgeY, ROOF_T), minX, maxX), TILE.shingle),
    SLOT.roof,
  )
  push(
    bucket,
    'shingle',
    uvProject(spanX(slabShape(backEaveZ, eaveY, ridgeZ, ridgeY, ROOF_T), minX, maxX), TILE.shingle),
    SLOT.roof,
  )

  // Ridge capping, and a fascia at each eaves deep enough to hide the slab's cut end.
  push(bucket, 'joinery', box(minX, ridgeY - RIDGE.half, ridgeZ - RIDGE.reach, maxX, ridgeY + RIDGE.half, ridgeZ + RIDGE.reach), SLOT.roof)
  push(bucket, 'joinery', box(minX, eaveY - EAVES.fascia, frontEaveZ - ROOF_T, maxX, eaveY + 0.003, frontEaveZ + EAVES.proud), SLOT.roof)
  push(bucket, 'joinery', box(minX, eaveY - EAVES.fascia, backEaveZ - EAVES.proud, maxX, eaveY + 0.003, backEaveZ + ROOF_T), SLOT.roof)

  // The gable end. Only the right one is built: the left is buried in the tower shaft, and the
  // camera never sees a -x face anyway.
  const gable = new THREE.Shape()
  gable.moveTo(frontEaveZ, eaveY)
  gable.lineTo(backEaveZ, eaveY)
  gable.lineTo(ridgeZ, ridgeY)
  gable.closePath()
  push(bucket, 'timber', uvProject(spanX(gable, maxX - REVEAL_D, maxX), TILE.timber), SLOT.roof)

  // Barge boards down both rakes of that gable, standing out past the shingles.
  for (const eaveZ of [frontEaveZ, backEaveZ]) {
    push(
      bucket,
      'joinery',
      spanX(slabShape(eaveZ, eaveY, ridgeZ, ridgeY, ROOF_T + BARGE.deep), maxX, maxX + BARGE.out),
      SLOT.roof,
    )
  }

  for (const d of DORMERS) buildDormer(bucket, d)

  // The roof lights lie in the slope rather than in a wall, so `facadeSkin` cannot dress them.
  // They get a curb to sit in and a dark loft behind, which is all a bullseye needs to stop
  // reading as a sticker.
  for (const s of WINDOWS.filter((w) => Math.abs(w.facing[1]) > 0.5)) {
    const n = new THREE.Vector3(s.facing[0], s.facing[1], s.facing[2]).normalize()
    const r = Math.max(s.w, s.h) / 2 + 0.008
    const lift = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
    const curb = new THREE.CylinderGeometry(r, r, 0.018, 20, 1, true)
    curb.applyQuaternion(lift)
    curb.translate(s.pos[0] - n.x * 0.006, s.pos[1] - n.y * 0.006, s.pos[2] - n.z * 0.006)
    push(bucket, 'joinery', curb.toNonIndexed(), SLOT.roof)

    const back = new THREE.CircleGeometry(r, 20)
    back.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n))
    back.translate(s.pos[0] - n.x * 0.014, s.pos[1] - n.y * 0.014, s.pos[2] - n.z * 0.014)
    push(bucket, 'interior', back.toNonIndexed(), SLOT.roof)
  }
}

// ---------------------------------------------------------------------------------------------
// THE CHIMNEY — one tile over the whole stack, so the soot is a gradient and not a pattern
// ---------------------------------------------------------------------------------------------

/** Courses in the corbelled cap. Three is enough to read as stepped and cheap enough to merge. */
const CORBEL_COURSES = 3

function buildChimney(bucket: Bucket): void {
  const [x0, , z0] = CHIMNEY.min
  const [x1, , z1] = CHIMNEY.max
  const { baseY, topY, oversail } = CHIMNEY.cap
  // The shaft is BUILT from the slates down (CHIMNEY.foldBase) so it can hinge up out of the
  // roof as its own piece — everything below that was always buried in the jetty and the hall.
  // The UV height still runs from the model's ground, so the painted soot gradient samples the
  // exact same band of the tile it always did: the trim costs zero pixels.
  const y0 = CHIMNEY.foldBase
  const height = topY - CHIMNEY.min[1]
  // One horizontal repeat per face, so the brick courses line up round every arris.
  const around = (x1 - x0 + (z1 - z0)) / 2
  const brick = (g: THREE.BufferGeometry): void =>
    push(bucket, 'brick', uvStack(g, topY, height, around), SLOT.chimney)

  brick(box(x0, y0, z0, x1, baseY, z1))

  // The cap corbels out course by course, which is the only silhouette a chimney gets.
  for (let i = 0; i < CORBEL_COURSES; i += 1) {
    const g = (oversail * (i + 1)) / CORBEL_COURSES
    const ya = baseY + ((topY - baseY) * i) / CORBEL_COURSES
    const yb = baseY + ((topY - baseY) * (i + 1)) / CORBEL_COURSES
    brick(box(x0 - g, ya, z0 - g, x1 + g, yb, z1 + g))
  }

  // Stone capstone, laid as a collar round an open flue: the smoke has to leave from somewhere
  // the reader can see it leaving.
  const [vx, , vz] = CHIMNEY.vent
  const fh = Math.min(x1 - x0, z1 - z0) * 0.26
  const o = oversail + 0.006
  const cy0 = topY
  const cy1 = topY + 0.014
  const slab = (ax: number, az: number, bx: number, bz: number): void =>
    push(bucket, 'stone', uvProject(box(ax, cy0, az, bx, cy1, bz), TILE.stone), SLOT.chimney)
  slab(x0 - o, z0 - o, x1 + o, vz - fh)
  slab(x0 - o, vz + fh, x1 + o, z1 + o)
  slab(x0 - o, vz - fh, vx - fh, vz + fh)
  slab(vx + fh, vz - fh, x1 + o, vz + fh)

  // The flue: dark all the way down, so the opening is a hole and not a painted square.
  push(bucket, 'interior', box(vx - fh, baseY, vz - fh, vx + fh, cy1 - 0.002, vz + fh), SLOT.chimney)
}

// ---------------------------------------------------------------------------------------------
// THE COURTYARD — the step, the well, the barrels. Few, large, each doing a job.
// ---------------------------------------------------------------------------------------------

/** A cylinder lying along +x, centred on `at` rather than standing on it. */
function roller(radius: number, length: number, at: Vec3, segments = 12): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, length, segments)
  g.rotateZ(Math.PI / 2)
  g.translate(at[0], at[1], at[2])
  return g.toNonIndexed()
}

function buildStep(bucket: Bucket): void {
  const [x0, , z0] = STEP.min
  const [x1, y1, z1] = STEP.max
  // The tread overhangs its own bed, so the step has a shadow line under the nosing and reads
  // as worn stone rather than as a tile laid on the cobbles.
  const u = 0.008
  // The threshold step belongs to the WALLS: it is the arch's own doorstep and rides the ground
  // floor's crease, not the courtyard's.
  push(bucket, 'stone', uvProject(box(x0 + u, 0, z0 + u, x1 - u, y1 - u, z1), TILE.stone), SLOT.walls)
  push(bucket, 'stone', uvProject(box(x0, y1 - u, z0, x1, y1, z1), TILE.stone), SLOT.walls)
}

function buildWell(bucket: Bucket): void {
  const [cx, , cz] = WELL.center
  const r = WELL.radius
  const inner = r * 0.74
  const cope = r * 1.06

  // Drum, coping and shaft. The drum is a tube and the coping an annulus, because a well with a
  // lid on it is a drum: the hole is the whole point of the object.
  push(bucket, 'stone', uvProject(cylinder(r, r * 1.03, WELL.wallY - 0.012, 24, WELL.center, true), TILE.stone), SLOT.yard)
  push(bucket, 'stone', uvProject(cylinder(cope, cope, 0.012, 24, [cx, WELL.wallY - 0.012, cz], true), TILE.stone), SLOT.yard)
  const ring = new THREE.RingGeometry(inner, cope, 24)
  ring.rotateX(-Math.PI / 2)
  ring.translate(cx, WELL.wallY, cz)
  push(bucket, 'stone', uvProject(ring.toNonIndexed(), TILE.stone), SLOT.yard)
  // Sunk a hair below the coping: enough for the rim to shade it, not enough to show daylight
  // through the far side of the shaft.
  push(bucket, 'interior', cylinder(inner + 0.002, inner + 0.002, WELL.wallY - 0.006, 24, [cx, 0, cz]), SLOT.yard)

  // Two posts and a little gable, up to the height the model sets for it.
  const postX = r * 0.8
  const headY = WELL.archY - 0.05
  for (const sx of [-1, 1]) {
    const px = cx + sx * postX
    push(bucket, 'joinery', box(px - 0.009, WELL.wallY - 0.03, cz - 0.009, px + 0.009, headY + 0.01, cz + 0.009), SLOT.yard)
  }
  const roofline = new THREE.Shape()
  roofline.moveTo(cz - r * 0.85, headY)
  roofline.lineTo(cz + r * 0.85, headY)
  roofline.lineTo(cz, WELL.archY)
  roofline.closePath()
  push(bucket, 'shingle', uvProject(spanX(roofline, cx - postX - 0.016, cx + postX + 0.016), TILE.shingle), SLOT.yard)

  // Windlass: the roller, its bearings and a crank, all at a size a hand could turn.
  const rollY = headY - 0.036
  push(bucket, 'joinery', roller(0.013, postX * 2 - 0.006, [cx, rollY, cz]), SLOT.yard)
  push(bucket, 'iron', roller(0.004, postX * 2 + 0.03, [cx, rollY, cz], 8), SLOT.yard)
  push(bucket, 'iron', box(cx + postX + 0.013, rollY - 0.004, cz - 0.004, cx + postX + 0.021, rollY + 0.026, cz + 0.004), SLOT.yard)
  push(bucket, 'iron', roller(0.0035, 0.022, [cx + postX + 0.026, rollY + 0.022, cz], 8), SLOT.yard)
}

function buildBarrels(bucket: Bucket): void {
  for (const b of BARRELS) {
    const [bx, by, bz] = b.center
    const half = b.height / 2
    // Two shallow cones back to back: a barrel is a bulge, and a straight tube is a bin.
    push(bucket, 'joinery', cylinder(b.radius, b.radius * 0.88, half, 16, [bx, by, bz]), SLOT.yard)
    push(bucket, 'joinery', cylinder(b.radius * 0.88, b.radius, half, 16, [bx, by + half, bz]), SLOT.yard)
    for (const f of [0.12, 0.5, 0.88]) {
      const y = by + b.height * f
      // The hoops follow the bulge, so the middle one stands furthest out.
      const taper = 1 - Math.abs(f - 0.5) * 0.24
      push(bucket, 'iron', cylinder(b.radius * taper + 0.002, b.radius * taper + 0.002, 0.008, 16, [bx, y, bz], true), SLOT.yard)
    }
  }
}

function buildCourtyard(bucket: Bucket): void {
  buildStep(bucket)
  buildWell(bucket)
  buildBarrels(bucket)
}

// ---------------------------------------------------------------------------------------------
// THE SIGN — the one thing on this building that moves while the inn is still asleep
// ---------------------------------------------------------------------------------------------

/** A square-section member running from (ax, ay) to (bx, by) in the x/y plane, at depth z. */
function strut(ax: number, ay: number, bx: number, by: number, z: number, t: number): THREE.BufferGeometry {
  const len = Math.hypot(bx - ax, by - ay)
  const g = new THREE.BoxGeometry(len, t, t)
  g.translate(len / 2, 0, 0)
  g.rotateZ(Math.atan2(by - ay, bx - ax))
  g.translate(ax, ay, z)
  return g.toNonIndexed()
}

/** Gap between the pivot and the board's top edge — the length of its hangers. */
const SIGN_HANG = 0.022
const SIGN_THICK = 0.013

function buildBracket(): THREE.BufferGeometry {
  const [rx, ry, rz] = SIGN.bracketRoot
  const [px, py] = SIGN.pivot
  const parts = [
    // The arm, tailed back into the wall so it is carried rather than glued on.
    box(rx - 0.016, ry - 0.005, rz - 0.005, rx + SIGN.bracketReach, ry + 0.005, rz + 0.005),
    // The stay, which is what stops a wrought arm this long from drooping.
    strut(rx - 0.004, ry - 0.085, rx + SIGN.bracketReach * 0.62, ry - 0.004, rz, 0.008),
    box(rx - 0.014, ry - 0.098, rz - 0.008, rx + 0.006, ry - 0.072, rz + 0.008),
  ]
  // A shackle dropping from the arm to the pivot the board actually swings about. Both plates
  // stay inboard of the arm's tip: an eye hung off the end of nothing is worse than no eye.
  for (const sx of [-1, 1]) {
    const lx = px + sx * 0.009
    parts.push(box(lx - 0.003, py, SIGN.pivot[2] - 0.003, lx + 0.003, ry + 0.005, SIGN.pivot[2] + 0.003))
  }
  const geo = mergeGeometries(parts)
  if (!geo) throw new Error('wild/inn-building: the sign bracket would not merge')
  return geo
}

/** The board and its hangers, authored about the pivot so the whole group can swing. */
function buildSignBoard(): { board: THREE.BufferGeometry; hangers: THREE.BufferGeometry } {
  const board = new THREE.BoxGeometry(SIGN.halfW * 2, SIGN.height, SIGN_THICK)
  board.translate(0, -SIGN_HANG - SIGN.height / 2, 0)
  // The hangers splay from the shackle out to the board's top corners, so the board swings from
  // one point the way a hung sign does, rather than sliding on two parallel rails.
  const hangers: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    hangers.push(strut(sx * 0.008, 0.002, sx * SIGN.halfW * 0.7, -SIGN_HANG - 0.004, 0, 0.004))
  }
  const merged = mergeGeometries(hangers)
  if (!merged) throw new Error('wild/inn-building: the sign hangers would not merge')
  return { board: board.toNonIndexed(), hangers: merged }
}

/**
 * A group posed straight off a fold chunk's world map. The three unmerged pieces use this rather
 * than the vertex path: their materials are shared with untagged meshes, and an InstancedMesh
 * applies its instance matrix downstream of the vertex map anyway.
 */
function useFoldGroup(slot: number) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = ref.current
    if (!g) return
    g.matrixAutoUpdate = false
    g.matrix.copy(foldMatrix(slot))
    g.matrixWorldNeedsUpdate = true
  })
  return ref
}

function TheSign({ materials }: { materials: InnMaterials }) {
  const ctx = useWild()
  const { clock } = ctx
  const foldRef = useFoldGroup(SLOT.sign)
  const swayRef = useRef<THREE.Group>(null)
  const dropRef = useRef<THREE.Group>(null)
  const parts = useMemo(() => ({ bracket: buildBracket(), ...buildSignBoard() }), [])

  useEffect(
    () => () => {
      parts.bracket.dispose()
      parts.board.dispose()
      parts.hangers.dispose()
    },
    [parts],
  )

  // One shared wall clock, never an integrated delta: the sign, the mist and the flames all
  // have to agree about what time it is or the spread develops two different winds.
  useFrame(() => {
    const frame = readWildFrame(ctx)
    const g = swayRef.current
    if (g) {
      // THE SIGN SWINGS ON THE WEATHER, not on a private sine. `windAt` is the one signal the
      // plume, the mist and the tower pennant also answer, so a gust crosses the whole stage; the
      // faster whip on top is the board snatching at the end of a swing, which is the difference
      // between a hanging sign and a metronome. Amplitude is still SIGN.sway.amp (D8).
      const wind = windAt(clock.current, frame.wake)
      const whip =
        LIFE.sign.whip *
        Math.sin((clock.current * Math.PI * 2) / LIFE.sign.whipPeriod) *
        Math.abs(wind)
      g.rotation.z = SIGN.sway.amp * LIFE.sign.gain * (wind + whip)
    }
    // THE LAST BEAT OF THE CURTAIN-UP. The board rides the bracket out folded up against the arm
    // and then DROPS onto its shackle — the same event the clip-rise staged, now crease-born.
    const d = dropRef.current
    if (d) d.rotation.x = signBoardAngle(frame.open)
  })

  return (
    <group ref={foldRef} name="wild-sign">
      <mesh geometry={parts.bracket} material={materials.iron} castShadow receiveShadow />
      <group ref={swayRef} position={SIGN.pivot as unknown as [number, number, number]}>
        <group ref={dropRef}>
          <mesh geometry={parts.hangers} material={materials.iron} castShadow />
          <mesh geometry={parts.board} material={materials.sign} castShadow receiveShadow />
        </group>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// THE LANTERN — the body only. Whatever burns inside it belongs to the waking layer.
// ---------------------------------------------------------------------------------------------

function buildLantern(): { iron: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const [lx, ly, lz] = LANTERN.pos
  const r = LANTERN.radius
  const h = r * 2.3
  const y0 = ly - h / 2
  const y1 = ly + h / 2
  const t = 0.0045

  const parts: THREE.BufferGeometry[] = [
    // Arm off the hall wall, and the drop it hangs on.
    box(lx - 0.004, y1 + 0.036, HALL.max[2] - 0.01, lx + 0.004, y1 + 0.044, lz),
    box(lx - 0.0035, y1 + 0.008, lz - 0.0035, lx + 0.0035, y1 + 0.04, lz + 0.0035),
    // Base tray and top plate.
    box(lx - r, y0 - 0.006, lz - r, lx + r, y0, lz + r),
    box(lx - r * 0.92, y1, lz - r * 0.92, lx + r * 0.92, y1 + 0.005, lz + r * 0.92),
    // `pyramid` is the one primitive that arrives without UVs; the iron never samples them, but
    // the merge insists every geometry in a bucket carries the same attributes.
    uvProject(pyramid(lx - r * 1.15, lz - r * 1.15, lx + r * 1.15, lz + r * 1.15, y1 + 0.005, y1 + 0.03), 1),
  ]
  // Four corner posts: the cage is what makes the glow read as a lamp and not a firefly.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = lx + sx * (r - t / 2)
      const pz = lz + sz * (r - t / 2)
      parts.push(box(px - t / 2, y0, pz - t / 2, px + t / 2, y1, pz + t / 2))
    }
  }
  const iron = mergeGeometries(parts)
  if (!iron) throw new Error('wild/inn-building: the lantern cage would not merge')

  // One glazed volume rather than four panes: the material is transparent and depth-write-free,
  // so a box costs less and never shows a seam where two panes meet at a corner.
  const glass = box(lx - r * 0.9, y0 + 0.004, lz - r * 0.9, lx + r * 0.9, y1 - 0.004, lz + r * 0.9)
  return { iron, glass }
}

function TheLantern({ materials }: { materials: InnMaterials }) {
  const foldRef = useFoldGroup(SLOT.lantern)
  const parts = useMemo(() => buildLantern(), [])
  useEffect(
    () => () => {
      parts.iron.dispose()
      parts.glass.dispose()
    },
    [parts],
  )
  return (
    <group ref={foldRef} name="wild-lantern">
      <mesh geometry={parts.iron} material={materials.iron} castShadow receiveShadow />
      <mesh geometry={parts.glass} material={materials.glass} renderOrder={1} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// THE TOWER PENNANT — the tallest thing in the frame, and it was dead still
// ---------------------------------------------------------------------------------------------

/**
 * A short staff at the stair tower's apex with a tapered banner flying off it. It exists for one
 * reason: the sleeping inn needs a moving silhouette against the sky. The sign swings down at
 * first-floor height where the mass is busy; up here the pennant reads against empty night, which
 * is the cheapest movement on the whole stage.
 *
 * It flies +x — downwind, the same wind the sign swings on and the plume leans into — which is
 * also toward the moon, so its crests have something to catch.
 *
 * STAFF AND CLOTH ARE ONE GEOMETRY, one draw. `aWave` is 0 along the staff and runs 0..1 from the
 * hoist to the fly end of the banner, so the same vertex program leaves the staff rigid and puts
 * a travelling wave through the cloth.
 */
const PENNANT_VERT = /* glsl */ `
#include <clipping_planes_pars_vertex>
attribute float aWave;
uniform float uTime;
uniform float uWind;
varying float vWave;
varying float vCrest;

void main() {
  float k = aWave;
  vWave = k;
  vec3 p = position;
  float gust = abs(uWind);
  // A travelling wave down the cloth, growing toward the free end (k*k), deeper in a gust.
  float ph = uTime * ${((Math.PI * 2) / LIFE.pennant.wavePeriod).toFixed(4)} - k * 6.0;
  float s = sin(ph);
  p.z += ${LIFE.pennant.wave.toFixed(4)} * k * k * s * (0.4 + 0.6 * gust);
  // Pushed downwind, and drooping toward the staff as the wind drops: a flag in still air is a
  // rag, and a pennant that flies at full stretch through a lull is a decal.
  p.x += uWind * ${LIFE.pennant.push.toFixed(4)} * k;
  p.y -= (1.0 - gust) * ${LIFE.pennant.sag.toFixed(4)} * k * k;
  vCrest = 0.5 + 0.5 * s;
  // Named mvPosition because three's clipping_planes_vertex chunk reads exactly that name.
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}
`

const PENNANT_FRAG = /* glsl */ `
#include <clipping_planes_pars_fragment>
uniform vec3 uShade;
uniform vec3 uRim;
varying float vWave;
varying float vCrest;
void main() {
  #include <clipping_planes_fragment>
  // The crests turn their face to the moon and the troughs fall away from it; the hoist stays
  // in the tower's own shadow, so the cloth reads as cloth rather than as a cut-out.
  float lit = vCrest * mix(0.35, 1.0, vWave);
  gl_FragColor = vec4(mix(uShade, uRim, lit * ${LIFE.pennant.rim.toFixed(3)}), 1.0);
}
`

function buildPennant(): THREE.BufferGeometry {
  const P = LIFE.pennant
  const cx = (TOWER.min[0] + TOWER.max[0]) / 2
  const cz = (TOWER.min[2] + TOWER.max[2]) / 2
  const topY = TOWER.cap.apexY + P.staff

  // The staff is tailed a few millimetres INTO the cap: a pole balanced on an apex is a pole
  // about to fall off it.
  const staff = box(
    cx - P.staffT / 2,
    TOWER.cap.apexY - 0.008,
    cz - P.staffT / 2,
    cx + P.staffT / 2,
    topY,
    cz + P.staffT / 2,
  )

  const cloth = new THREE.PlaneGeometry(P.length, P.height, 14, 2)
  // Hoist edge to x = 0, top edge to y = 0, then taper to a swallowtail point at the fly end.
  cloth.translate(P.length / 2, -P.height / 2, 0)
  const pos = cloth.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i += 1) {
    const u = pos.getX(i) / P.length
    pos.setY(i, pos.getY(i) * (1 - 0.72 * u))
  }
  pos.needsUpdate = true
  cloth.translate(cx + P.staffT / 2, topY - 0.006, cz)

  const staffWave = new Float32Array(staff.getAttribute('position').count)
  staff.setAttribute('aWave', new THREE.BufferAttribute(staffWave, 1))
  const clothPos = cloth.getAttribute('position') as THREE.BufferAttribute
  const clothWave = new Float32Array(clothPos.count)
  for (let i = 0; i < clothPos.count; i += 1) {
    clothWave[i] = (clothPos.getX(i) - (cx + P.staffT / 2)) / P.length
  }
  cloth.setAttribute('aWave', new THREE.BufferAttribute(clothWave, 1))

  const flat = cloth.toNonIndexed()
  const merged = mergeGeometries([staff, flat])
  staff.dispose()
  cloth.dispose()
  flat.dispose()
  if (!merged) throw new Error('wild/inn-building: the pennant would not merge')
  return merged
}

function ThePennant() {
  const ctx = useWild()
  // It stands on the tower cap, so it rides the tower's crease — including flat and sunk under
  // the page while the tower is still lying on the paper.
  const foldRef = useFoldGroup(SLOT.tower)
  const parts = useMemo(() => {
    const geometry = buildPennant()
    const material = applyRiseClip(
      new THREE.ShaderMaterial({
        vertexShader: PENNANT_VERT,
        fragmentShader: PENNANT_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uWind: { value: 0 },
          uShade: { value: new THREE.Color(PALETTE.stoneCold) },
          uRim: { value: new THREE.Color(PALETTE.nightRim) },
        },
        side: THREE.DoubleSide,
        clipping: true,
      }),
    )
    return { geometry, material }
  }, [])

  useEffect(
    () => () => {
      parts.geometry.dispose()
      parts.material.dispose()
    },
    [parts],
  )

  useFrame(() => {
    const f = readWildFrame(ctx)
    parts.material.uniforms.uTime.value = f.time
    parts.material.uniforms.uWind.value = windAt(f.time, f.wake)
  })

  return (
    <group ref={foldRef} name="wild-pennant">
      {/* The wave happens in the vertex program and the group rides a sheared fold map, so the
          rest bounding sphere is a lie in flight — and a culled pennant is a pennant that
          disappears for exactly the frames it is moving. */}
      <mesh geometry={parts.geometry} material={parts.material} frustumCulled={false} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// THE HUNDRED KEYS — one draw call, hung by hand
// ---------------------------------------------------------------------------------------------

/** Deterministic per-key noise. A reload has to hang them in exactly the same places. */
function hash01(i: number, salt: number): number {
  const s = Math.sin(i * 78.233 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}

const KEY = { thick: 0.0013, width: 0.004, height: 0.016, bit: 0.0075 }

function buildKey(): THREE.BufferGeometry {
  const shank = box(-KEY.thick / 2, -KEY.height / 2, -KEY.width / 2, KEY.thick / 2, KEY.height / 2, KEY.width / 2)
  // A ward standing off one side of the shank: without it a key is a tally stick.
  const ward = box(
    -KEY.thick / 2,
    -KEY.height / 2,
    KEY.width / 2 - 0.0005,
    KEY.thick / 2,
    -KEY.height / 2 + 0.0045,
    KEY.bit - KEY.width / 2,
  )
  const geo = mergeGeometries([shank, ward])
  if (!geo) throw new Error('wild/inn-building: the key would not merge')
  return geo
}

function TheHundredKeys({ material }: { material: THREE.MeshStandardMaterial }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  // The board hangs on the passage's inner wall, so the keys swing up with the ground floor.
  const foldRef = useFoldGroup(SLOT.walls)
  const geometry = useMemo(() => buildKey(), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const pos = new THREE.Vector3()
    const one = new THREE.Vector3(1, 1, 1)
    const cellZ = (KEY_BOARD.maxZ - KEY_BOARD.minZ) / KEY_BOARD.cols
    const cellY = (KEY_BOARD.maxY - KEY_BOARD.minY) / KEY_BOARD.rows

    for (let row = 0; row < KEY_BOARD.rows; row += 1) {
      for (let col = 0; col < KEY_BOARD.cols; col += 1) {
        const i = row * KEY_BOARD.cols + col
        // A board of keys hung by a landlord is never a printed grid: every hook is a little
        // off, every key hangs at its own angle, and a few have been turned face-on.
        pos.set(
          KEY_BOARD.x + KEY.thick + 0.0012 + hash01(i, 3) * 0.0016,
          KEY_BOARD.maxY - cellY * (row + 0.5) + (hash01(i, 1) - 0.5) * cellY * 0.3,
          KEY_BOARD.minZ + cellZ * (col + 0.5) + (hash01(i, 2) - 0.5) * cellZ * 0.34,
        )
        e.set((hash01(i, 4) - 0.5) * 0.5, (hash01(i, 5) - 0.5) * 1.1, 0)
        q.setFromEuler(e)
        m.compose(pos, q, one)
        mesh.setMatrixAt(i, m)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }, [])

  return (
    <group ref={foldRef} name="wild-keys-fold">
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, KEY_BOARD.count]}
        name="wild-keys"
      />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// THE BUILDING
// ---------------------------------------------------------------------------------------------

type Merged = { readonly key: MatKey; readonly geometry: THREE.BufferGeometry }

/**
 * The moon is the only caster in the book, and it only has the mass to cast with. Joinery,
 * linings and interiors receive: a shadow map spent on a barge board is a shadow map not spent
 * on the jetty's band across the hall wall, which is the one shadow that has to land.
 */
const CASTERS = new Set<MatKey>(['stone', 'timber', 'shingle', 'brick'])

function buildInn(): Merged[] {
  const bucket: Bucket = new Map()
  buildHall(bucket)
  buildArch(bucket)
  buildJetty(bucket)
  buildTower(bucket)
  buildRoof(bucket)
  buildChimney(bucket)
  buildCourtyard(bucket)

  return [...bucket].map(([key, parts]) => {
    const geometry = mergeGeometries(parts)
    if (!geometry) throw new Error(`wild/inn-building: the ${key} bucket would not merge`)
    geometry.computeBoundingSphere()
    return { key, geometry }
  })
}

export function InnBuilding() {
  const materials = useMemo(() => innMaterials(), [])
  const merged = useMemo(() => buildInn(), [])
  // THE SHADOW HAS TO FOLD TOO. The depth pass runs its own material, so without this the moon
  // lays the shadow of a finished inn across the courtyard while the inn is still lying flat.
  // ONE PER CASTER, not one shared: three copies the source material's `map` and `side` onto the
  // depth material before every object, and a shared instance would have those thrashing between
  // four different skins behind three's back.
  const depths = useMemo(() => {
    const out = new Map<MatKey, THREE.MeshDepthMaterial>()
    for (const { key } of merged) if (CASTERS.has(key)) out.set(key, foldDepthMaterial())
    return out
  }, [merged])

  useEffect(
    () => () => {
      for (const part of merged) part.geometry.dispose()
      for (const d of depths.values()) d.dispose()
    },
    [merged, depths],
  )

  return (
    <group name="wild-inn">
      {merged.map(({ key, geometry }) => (
        <mesh
          key={key}
          name={`wild-inn-${key}`}
          geometry={geometry}
          material={materials[key]}
          customDepthMaterial={depths.get(key)}
          castShadow={CASTERS.has(key)}
          receiveShadow
          // The fold happens in the VERTEX shader, so a folded piece leaves the bounding sphere
          // three computed from the rest geometry — and a piece culled mid-flight is a piece that
          // vanishes for exactly the frames the reader is watching it move. Twelve meshes on a
          // spread the camera always sees whole: culling them buys nothing anyway.
          frustumCulled={false}
        />
      ))}
      <TheSign materials={materials} />
      <TheLantern materials={materials} />
      <ThePennant />
      <TheHundredKeys material={materials.brass} />
    </group>
  )
}
