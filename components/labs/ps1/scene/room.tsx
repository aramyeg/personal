'use client'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { PSX } from './psx-constants'
import { makePSXMaterial } from './psx-materials'
import {
  makeCarpetTexture,
  makeWallTexture,
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

  // Ceiling faces down, away from the window key, so it only takes ambient —
  // keep its multiplier light so ambient alone renders dim plaster, not black.
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_X * 2, HALF_Z * 2),
    makePSXMaterial({ map: wall, color: '#ffffff' }),
  )
  ceil.position.y = CEIL
  ceil.rotation.x = Math.PI / 2
  shell.add(ceil)
  return shell
}

/** Wall dressing — believable objects only (no floating stickers): a lower
 * dressing shelf of tapes below the real shelf (fills the shelf close-up), and
 * a wall clock on the bare +x wall in the TV corner. */
function buildWallDressing(): THREE.Group {
  const grp = new THREE.Group()
  const RY_X = -Math.PI / 2

  // Lower dressing shelf on the +x wall (mounted back-face ~0.05 off the wall so
  // it never clips the corner). A short row of leaning tapes.
  const lower = new THREE.Group()
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.05, 1.0),
    makePSXMaterial({ color: '#7c6446' }),
  )
  lower.add(plank)
  for (let i = 0; i < 5; i++) {
    const spine = makePSXMaterial({ map: makeBoxSpineTexture(i + 2), color: '#ffffff' })
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.15, 0.11), makePSXMaterial({ color: '#b4b0a4' }))
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), spine)
    face.position.x = -0.02
    face.rotation.y = RY_X
    const tapeGrp = new THREE.Group()
    tapeGrp.add(tape)
    tapeGrp.add(face)
    tapeGrp.position.set(-0.02, 0.1, -0.38 + i * 0.19)
    tapeGrp.rotation.z = (i % 2 ? 1 : -1) * 0.04
    lower.add(tapeGrp)
  }
  lower.position.set(HALF_X - 0.17, 0.98, -0.35)
  grp.add(lower)

  // Wall clock on the +z wall — the wall the window key lights (the bright,
  // "blinding-empty" wall in the tv framing). Faces −z into the room.
  const clock = new THREE.Group()
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.03, 16),
    makePSXMaterial({ color: '#d8d3c4' }),
  )
  disc.rotation.x = Math.PI / 2 // lay the disc flat against the +z wall
  clock.add(disc)
  clock.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.12, 0.01), makePSXMaterial({ color: '#2c2e2c' })), 0, 0.04, -0.02))
  clock.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.01), makePSXMaterial({ color: '#2c2e2c' })), 0.03, 0, -0.02))
  clock.position.set(1.15, 1.62, HALF_Z - 0.03)
  clock.rotation.y = Math.PI
  grp.add(clock)
  return grp
}

/** A single grey CD jewel case (thin slab + darker tray inset), lying flat. */
function cdCase(x: number, z: number, ry: number): THREE.Group {
  const jc = new THREE.Group()
  jc.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.15), makePSXMaterial({ color: '#b4b0a4' })))
  jc.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.11), makePSXMaterial({ color: '#5a5d59' })), 0, 0.002, 0))
  jc.position.set(x, 0.007, z)
  jc.rotation.y = ry
  return jc
}

/** Neutral floor clutter: a flat cushion + magazine stack + can (kept off the
 * TV sightline centre), plus the loose CD cases scattered into the establishing
 * shot's otherwise-empty mid-floor. */
function buildFloorClutter(): THREE.Group {
  const grp = new THREE.Group()

  // Flat floor cushion — a low, wide lozenge, off the tv frame's centre.
  const cushion = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 8),
    makePSXMaterial({ color: '#8b7f63' }),
  )
  cushion.scale.set(1.5, 0.15, 1.2)
  cushion.position.set(-0.2, 0.05, 1.35)
  grp.add(cushion)

  // Magazine stack + soda can beside the cushion.
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
  stack.position.set(-0.75, 0, 1.5)
  grp.add(stack)

  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10),
    makePSXMaterial({ color: '#b9b6ad' }),
  )
  can.position.set(0.15, 0.06, 1.25)
  grp.add(can)

  // Loose CD cases + a magazine scattered into the establishing shot's mid-floor.
  grp.add(cdCase(0.45, 0.5, 0.4))
  grp.add(cdCase(0.62, 0.32, -0.5))
  grp.add(cdCase(0.3, 0.28, 1.1))
  const loose = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.28), makePSXMaterial({ color: '#8f8a76' }))
  loose.position.set(0.05, 0.009, 0.55)
  loose.rotation.y = 0.6
  grp.add(loose)
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

  // Skate deck leaning against the +x wall beside the TV (reads in the tv
  // framing). Nested groups: mount handles facing + position, lean handles the
  // tilt about the now-horizontal local x so the graphic still faces the room.
  const deckLean = new THREE.Group()
  deckLean.add(buildDeck())
  deckLean.rotation.x = -0.2 // tilt the top toward the +x wall
  const deckMount = place(new THREE.Group(), 2.28, 0.45, 1.2)
  deckMount.rotation.y = -Math.PI / 2 // deck graphic (+z) faces −x into the room
  deckMount.add(deckLean)
  root.add(deckMount)

  // Floor clutter filling the open carpet in the establishing / TV framings.
  root.add(buildFloorClutter())

  // Baked ground-contact shadows (era had no real-time shadows).
  root.add(place(buildShadow(1.8, 0.9), -0.65, 0.02, -2.05))
  root.add(place(buildShadow(0.9, 0.85), 1.7, 0.02, 1.85))
  root.add(place(buildShadow(0.4, 0.32), 2.16, 0.02, 1.2))
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
