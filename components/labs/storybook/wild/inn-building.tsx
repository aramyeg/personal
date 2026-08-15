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
 * The parent group owns the curtain-up rise; everything here is authored at final position and
 * simply clipped at the page surface by `applyRiseClip`.
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { innMaterials, type InnMaterials } from './inn-materials'
import {
  ARCH,
  BARRELS,
  CHIMNEY,
  DORMERS,
  HALL,
  JETTY,
  KEY_BOARD,
  LANTERN,
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
import { useWild } from './wild-frame'

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

const push = (bucket: Bucket, key: MatKey, geo: THREE.BufferGeometry): void => {
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
    push(bucket, 'interior', panel.toNonIndexed())

    // Lining: jambs and a cill board just inside the hole.
    const t = 0.007
    const d0 = wall.plane - REVEAL_D * 0.95
    const d1 = wall.plane + 0.0015
    const bar = (a0: number, b0: number, a1: number, b1: number) =>
      push(bucket, 'joinery', front ? box(a0, b0, d0, a1, b1, d1) : box(d0, b0, a0, d1, b1, a1))
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
  push(bucket, skin, uvProject(geo, tile))
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

  // Core: everything behind the facade skins, bored through by the arch.
  const core = rectShape(x0, y0 - 0.006, coreX1, y1)
  core.holes.push(archPath())
  push(bucket, 'stone', uvProject(spanZ(core, z0, coreZ1), TILE.stone))

  // Front skin, holed by the arch and the taproom windows.
  const frontWall: Wall = { axis: 'z', plane: z1, slots: slotsOn('z', z1) }
  facadeSkin(bucket, frontWall, rectShape(x0, y0 - 0.006, x1, y1), [archPath()], 'stone', TILE.stone)

  // Right return, holed by the kitchen windows. Authored in (z, y).
  const rightWall: Wall = { axis: 'x', plane: x1, slots: slotsOn('x', x1) }
  facadeSkin(bucket, rightWall, rectShape(z0, y0 - 0.006, z1, y1), [], 'stone', TILE.stone)

  // Plinth course: the wall sits on a proud footing, which catches the moon along its top arris.
  push(bucket, 'stone', uvProject(box(x0, 0, z0 - 0.012, x1 + 0.012, 0.034, z1 + 0.012), TILE.stone))
}

function buildArch(bucket: Bucket): void {
  const zFront = ARCH.frontZ
  const zBack = ARCH.backZ
  const hw = ARCH.halfW

  // Moulded surround, standing proud of the facade.
  const surround = archShape(0.026, -0.02)
  surround.holes.push(archPath())
  push(bucket, 'stone', uvProject(spanZ(surround, zFront, zFront + ARCH.reveal), TILE.stone))
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
    )
  }

  // Passage floor: worn flags, a touch above the cobbles so the mouth has an edge.
  push(bucket, 'stone', uvProject(box(ARCH.cx - hw, 0, zBack, ARCH.cx + hw, 0.009, zFront + 0.01), TILE.stone))

  // Rear wall of the passage, filling the arch profile, with a door standing part open.
  const doorW = 0.115
  const doorH = 0.215
  const doorX = ARCH.cx + 0.014
  const rear = archShape(-0.004, -0.02)
  rear.holes.push(rectPath(doorX - doorW / 2, 0.008, doorX + doorW / 2, doorH))
  push(bucket, 'stone', uvProject(spanZ(rear, zBack + 0.02, zBack + 0.038), TILE.stone))

  // Whatever lies beyond the door is dark until the passage lamp is lit.
  push(bucket, 'interior', box(ARCH.cx - hw, 0, zBack - 0.02, ARCH.cx + hw, ARCH.apexY, zBack + 0.021))

  const leaf = box(0, 0, 0, doorW * 0.98, doorH - 0.01, 0.011)
  leaf.rotateY(0.62)
  leaf.translate(doorX - doorW / 2, 0.008, zBack + 0.022)
  push(bucket, 'joinery', leaf)

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
