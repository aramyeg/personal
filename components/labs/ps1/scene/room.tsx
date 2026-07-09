'use client'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PSX } from './psx-constants'
import { makePSXMaterial } from './psx-materials'
import {
  makeCarpetTexture,
  makeWallTexture,
  makeStickerSheetTexture,
  makeBoxSpineTexture,
} from './textures'
import {
  BUILD,
  buildClutter,
  buildCorkboard,
  buildCRT,
  buildDeck,
  buildDesk,
  buildKeyboard,
  buildPager,
  buildPosters,
  buildShelf,
  buildShadow,
  buildTV,
  buildTower,
  buildWindow,
} from './props'

/** Room shell dims (metres). Walls face inward; camera angles in cameras.ts are
 * framed against this box (window on the −z wall, shelf on +x, TV in +x/+z). */
const HALF_X = 2.4
const HALF_Z = 2.5
const CEIL = 2.7

/** CRT screen world position (crt group base + its local screen offset), reused
 * for the teal point light so the glow sits on the tube face. */
const CRT_AT: [number, number, number] = [-0.8, BUILD.deskH, -2.28]
const CRT_SCREEN_Y = BUILD.deskH + 0.05 + BUILD.crt.h / 2

/** Dispose every unique geometry/material/texture under a subtree. */
function disposeTree(root: THREE.Object3D): void {
  const geos = new Set<THREE.BufferGeometry>()
  const mats = new Set<THREE.Material>()
  const texs = new Set<THREE.Texture>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) geos.add(mesh.geometry)
    const material = mesh.material
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      mats.add(m)
      const map = (m as THREE.MeshLambertMaterial).map
      if (map) texs.add(map)
    }
  })
  geos.forEach((g) => g.dispose())
  mats.forEach((m) => m.dispose())
  texs.forEach((t) => t.dispose())
}

const place = (o: THREE.Object3D, x: number, y: number, z: number) => {
  o.position.set(x, y, z)
  return o
}

/** Build the shell (carpet floor, plaster walls, dim ceiling) as inward-facing
 * planes. Walls share one plaster texture/material; the ceiling is dimmed. */
function buildShell(): THREE.Group {
  const shell = new THREE.Group()

  const carpet = makeCarpetTexture()
  carpet.repeat.set(5, 5)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2),
    makePSXMaterial({ map: carpet }),
  )
  floor.rotation.x = -Math.PI / 2
  shell.add(floor)

  const wall = makeWallTexture()
  wall.repeat.set(3, 2)
  const wallMat = makePSXMaterial({ map: wall })
  const wallGeoZ = new THREE.PlaneGeometry(HALF_X * 2, CEIL)
  const wallGeoX = new THREE.PlaneGeometry(HALF_Z * 2, CEIL)
  const mkWall = (geo: THREE.BufferGeometry, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(geo, wallMat)
    m.position.set(x, CEIL / 2, z)
    m.rotation.y = ry
    shell.add(m)
  }
  mkWall(wallGeoZ, 0, -HALF_Z, 0) // −z (desk / window / posters)
  mkWall(wallGeoZ.clone(), 0, HALF_Z, Math.PI) // +z (behind establishing cam)
  mkWall(wallGeoX, -HALF_X, 0, Math.PI / 2) // −x (posters)
  mkWall(wallGeoX.clone(), HALF_X, 0, -Math.PI / 2) // +x (shelf)

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2),
    makePSXMaterial({ map: wall, color: '#8a8578' }),
  )
  ceil.position.y = CEIL
  ceil.rotation.x = Math.PI / 2
  shell.add(ceil)
  return shell
}

/** A taped sticker sheet plane (transparent) at a wall spot. */
function wallSticker(size: number, x: number, y: number, z: number, ry: number): THREE.Mesh {
  const m = makePSXMaterial({ map: makeStickerSheetTexture(), color: '#ffffff' })
  m.transparent = true
  m.depthWrite = false
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m)
  mesh.position.set(x, y, z)
  mesh.rotation.y = ry
  return mesh
}

/** Cheap wall dressing so no framing shows empty plaster: a sticker cluster on
 * the +x wall, a lower dressing shelf of tapes below the real shelf, a sticker
 * + wall clock on the +z wall (the TV framing's back wall). */
function buildWallDressing(): THREE.Group {
  const grp = new THREE.Group()
  const XW = HALF_X - 0.02
  const RY_X = -Math.PI / 2

  // +x wall (shelf framing): a sticker cluster above and below the shelf.
  grp.add(wallSticker(0.42, XW, 1.95, -0.35, RY_X))
  grp.add(wallSticker(0.5, XW, 0.72, -0.9, RY_X))
  grp.add(wallSticker(0.32, XW, 0.7, 0.35, RY_X))

  // Lower dressing shelf on the +x wall with a row of leaning tapes.
  const lower = new THREE.Group()
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.05, 1.3),
    makePSXMaterial({ color: '#7c6446' }),
  )
  lower.add(plank)
  for (let i = 0; i < 6; i++) {
    const spine = makePSXMaterial({ map: makeBoxSpineTexture(i + 2), color: '#ffffff' })
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.15, 0.11), makePSXMaterial({ color: '#b4b0a4' }))
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), spine)
    face.position.x = -0.01
    face.rotation.y = RY_X
    const tapeGrp = new THREE.Group()
    tapeGrp.add(tape)
    tapeGrp.add(face)
    tapeGrp.position.set(-0.05, 0.1, -0.5 + i * 0.16)
    tapeGrp.rotation.z = (i % 2 ? 1 : -1) * 0.04
    lower.add(tapeGrp)
  }
  lower.position.set(HALF_X - 0.15, 0.98, -0.3)
  grp.add(lower)

  // +z wall (TV framing back wall): a sticker + a simple wall clock.
  grp.add(wallSticker(0.44, 0.5, 1.55, HALF_Z - 0.02, Math.PI))
  const clock = new THREE.Group()
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16),
    makePSXMaterial({ color: '#d8d3c4' }),
  )
  disc.rotation.x = Math.PI / 2
  clock.add(disc)
  clock.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.12, 0.01), makePSXMaterial({ color: '#2c2e2c' })), 0, 0.04, -0.02))
  clock.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.01), makePSXMaterial({ color: '#2c2e2c' })), 0.03, 0, -0.02))
  clock.position.set(-0.85, 1.95, HALF_Z - 0.03)
  clock.rotation.y = Math.PI
  grp.add(clock)
  return grp
}

/** Neutral floor clutter (cushion + magazine stack + soda can) to fill the open
 * carpet the establishing and TV framings would otherwise show empty. */
function buildFloorClutter(): THREE.Group {
  const grp = new THREE.Group()

  // Squashed floor cushion — neutral fabric, no accent.
  const cushion = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    makePSXMaterial({ color: '#8b7f63' }),
  )
  cushion.scale.set(1, 0.42, 1)
  cushion.position.set(0.55, 0.13, 0.85)
  grp.add(cushion)

  // Stack of magazines mid-floor.
  const stack = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.02, 0.3),
      makePSXMaterial({ color: i === 1 ? '#9a9486' : '#7f7a6c' }),
    )
    mag.position.y = 0.01 + i * 0.022
    mag.rotation.y = (i - 1) * 0.18
    stack.add(mag)
  }
  stack.position.set(-0.15, 0, 1.45)
  grp.add(stack)

  // Soda can by the cushion.
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10),
    makePSXMaterial({ color: '#b9b6ad' }),
  )
  can.position.set(1.0, 0.06, 1.15)
  grp.add(can)
  return grp
}

/** Assemble the full room graph once (shell + placed props + baked shadows). */
function buildRoom(): THREE.Group {
  const root = new THREE.Group()
  root.add(buildShell())
  root.add(buildWallDressing())

  // Desk cluster on the −z wall (left of the window).
  root.add(place(buildDesk(), -0.65, 0, -2.12))
  root.add(place(buildCRT(), ...CRT_AT))
  root.add(place(buildKeyboard(), -0.75, BUILD.deskH, -1.98))
  root.add(place(buildPager(), -1.2, BUILD.deskH, -2.0))
  root.add(place(buildTower(), 0.15, 0, -2.15))
  root.add(place(buildClutter(), -0.65, 0, -2.12))
  root.add(place(buildCorkboard(), -0.65, 1.9, -HALF_Z + 0.03))
  root.add(place(buildWindow(), 1.35, 1.45, -HALF_Z + 0.05))
  root.add(buildPosters(HALF_X, HALF_Z))

  // Shelf on the +x wall.
  root.add(place(buildShelf(), HALF_X - 0.16, 1.35, -0.3))

  // Floor TV zone in the +x/+z corner, angled back toward the tv camera.
  const tv = place(buildTV(), 1.7, 0, 1.8)
  tv.rotation.y = -2.27
  root.add(tv)

  // Leaned skate deck — foreground occluder at desk-frame left.
  const deck = place(buildDeck(), -1.35, 0.44, -1.7)
  deck.rotation.z = 0.16
  deck.rotation.y = 0.25
  root.add(deck)

  // Floor clutter filling the open carpet in the establishing / TV framings.
  root.add(buildFloorClutter())

  // Baked ground-contact shadows (era had no real-time shadows).
  root.add(place(buildShadow(1.8, 0.9), -0.65, 0.02, -2.05))
  root.add(place(buildShadow(0.9, 0.85), 1.7, 0.02, 1.85))
  root.add(place(buildShadow(0.42, 0.36), -1.3, 0.02, -1.55))
  return root
}

/**
 * `<Room>` — the 1999 dev bedroom: shell + all props placed against the
 * cameras.ts coordinate frame, plus the three-light overcast rig (window key,
 * teal ambient fill, CRT-face teal point light). All light values come from the
 * tuned `PSX.LIGHTS` surface. `staticFrame` marks the non-interactive gate mount
 * (no idle motion yet); recorded on the graph for Task 12's interactive pass.
 */
export function Room({ staticFrame = false }: { staticFrame?: boolean }) {
  const root = useMemo(() => buildRoom(), [])

  useEffect(() => {
    root.userData.staticFrame = staticFrame
  }, [root, staticFrame])

  useEffect(() => () => disposeTree(root), [root])

  return (
    <>
      {/* Key: overcast daylight angled from the window (−z wall, x≈1.2). */}
      <directionalLight
        color={PSX.LIGHTS.key}
        intensity={PSX.LIGHTS.keyIntensity}
        position={[1.35, 2.9, -3.8]}
      />
      {/* Teal-leaning ambient fill so shadow sides stay readable, never black. */}
      <ambientLight color={PSX.LIGHTS.ambient} intensity={PSX.LIGHTS.ambientIntensity} />
      {/* Faint teal glow off the CRT tube face. */}
      <pointLight
        color={PSX.TEX.crtTeal}
        intensity={PSX.LIGHTS.crtIntensity}
        distance={PSX.LIGHTS.crtDistance}
        position={[CRT_AT[0], CRT_SCREEN_Y, CRT_AT[2] + 0.25]}
      />
      <primitive object={root} />
    </>
  )
}
