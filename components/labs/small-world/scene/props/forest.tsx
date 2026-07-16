'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump } from '../planet'
import { FOREST, SNOW, capMask } from '../biomes'
import { useClayRamp } from '../toon-ramp'

/** ~100 trees inside the FOREST cap. Oversample so rejections still land ~100. */
const CANDIDATES = 150
const MAX_TREES = 108
/** Keep the girl's lane clear — no forest inside the spine band. */
const MIN_NX = 0.3

const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number, s: number): number => fract(Math.sin(i * 127.1 + s) * 43758.5453)

const Y_UP = new THREE.Vector3(0, 1, 0)

type Built = { trunk: THREE.InstancedMesh; crown: THREE.InstancedMesh }

/**
 * A dense woods on the near-left flank, drawn as exactly TWO InstancedMesh
 * (trunk + crown) — deterministic seeded scatter inside the FOREST cap,
 * per-instance crown color (pine/leaf/sprout, or snow where the tree also
 * falls in the cold cap). Two draw calls total.
 */
export function Forest() {
  const ramp = useClayRamp()

  const built = useMemo<Built>(() => {
    // tangent basis around the cap centre for in-cap sampling
    const c = new THREE.Vector3(FOREST.dir[0], FOREST.dir[1], FOREST.dir[2])
    const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
    const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
    const cosR = Math.cos(FOREST.radius)

    const dir = new THREE.Vector3()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    const m = new THREE.Matrix4()
    const lift = new THREE.Matrix4()
    const col = new THREE.Color()

    const trunkGeo = new THREE.CylinderGeometry(0.028, 0.04, 0.16, 6)
    const crownGeo = new THREE.SphereGeometry(0.15, 12, 12)
    const mat = (): THREE.MeshToonMaterial =>
      new THREE.MeshToonMaterial({ gradientMap: ramp, vertexColors: false })

    // first pass: collect accepted trees
    type Tree = { pos: THREE.Vector3; quat: THREE.Quaternion; s: number; crown: THREE.Color }
    const trees: Tree[] = []
    const pine = new THREE.Color(PALETTE.pine)
    const leaf = new THREE.Color(PALETTE.leaf)
    const sprout = new THREE.Color(PALETTE.sprout)
    const snow = new THREE.Color(PALETTE.snow)

    for (let i = 0; i < CANDIDATES && trees.length < MAX_TREES; i++) {
      const cosT = 1 - (1 - cosR) * seeded(i, 311.7)
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
      const phi = seeded(i, 74.7) * Math.PI * 2
      dir
        .copy(c)
        .multiplyScalar(cosT)
        .addScaledVector(t1, sinT * Math.cos(phi))
        .addScaledVector(t2, sinT * Math.sin(phi))
        .normalize()
      if (Math.abs(dir.x) < MIN_NX) continue
      const bump = terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
      if (1 + bump < WATER_LEVEL) continue // no trees in the water
      if (bump > 0.06) continue // bare the snowy peaks above the treeline
      pos.copy(dir).multiplyScalar(PLANET_RADIUS * (1 + bump))
      quat.setFromUnitVectors(Y_UP, dir)
      const s = 0.5 + seeded(i, 512.3) * 0.5
      const snowy = capMask(dir.x, dir.y, dir.z, SNOW) > 0.4
      const pick = seeded(i, 901.1)
      const crown = snowy ? snow : pick < 0.6 ? pine : pick < 0.85 ? leaf : sprout
      trees.push({ pos: pos.clone(), quat: quat.clone(), s, crown: crown.clone() })
    }

    const n = trees.length
    const trunkMat = mat()
    trunkMat.color = new THREE.Color(PALETTE.clayPath)
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, n)
    const crownMat = mat()
    crownMat.color = new THREE.Color(0xffffff)
    const crown = new THREE.InstancedMesh(crownGeo, crownMat, n)
    trunk.frustumCulled = false
    crown.frustumCulled = false

    for (let i = 0; i < n; i++) {
      const tr = trees[i]
      scl.setScalar(tr.s)
      m.compose(tr.pos, tr.quat, scl)
      // trunk: lift half its height along local up
      lift.makeTranslation(0, 0.08, 0)
      trunk.setMatrixAt(i, m.clone().multiply(lift))
      // crown: sit atop the trunk
      lift.makeTranslation(0, 0.24, 0)
      crown.setMatrixAt(i, m.clone().multiply(lift))
      crown.setColorAt(i, col.copy(tr.crown))
    }
    trunk.instanceMatrix.needsUpdate = true
    crown.instanceMatrix.needsUpdate = true
    if (crown.instanceColor) crown.instanceColor.needsUpdate = true

    return { trunk, crown }
  }, [ramp])

  return (
    <>
      <primitive object={built.trunk} />
      <primitive object={built.crown} />
    </>
  )
}
