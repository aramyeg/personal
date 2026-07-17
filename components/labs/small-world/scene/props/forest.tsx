'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump } from '../planet'
import { FOREST, SNOW, SNOW_B, capMask } from '../biomes'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'

/** ~100 trees inside the FOREST cap. Oversample so rejections still land ~100. */
const CANDIDATES = 150
const MAX_TREES = 108
/** Keep the girl's lane clear — no forest inside the spine band. */
const MIN_NX = 0.3

const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number, s: number): number => fract(Math.sin(i * 127.1 + s) * 43758.5453)

const Y_UP = new THREE.Vector3(0, 1, 0)

type Built = {
  trunk: THREE.InstancedMesh
  crown: THREE.InstancedMesh
  /** Per-instance crown colors for lap 1 (spring) and lap 2 (autumn). */
  crownA: Float32Array
  crownB: Float32Array
}

/**
 * A dense woods on the near-left flank, drawn as exactly TWO InstancedMesh
 * (trunk + crown) — deterministic seeded scatter inside the FOREST cap,
 * per-instance crown color. Two draw calls total. The crown instanceColor buffer
 * lerps from the spring cast (pine/leaf/sprout, snow where cold) to the autumn
 * cast (honey/dune/earth, with a WIDER snowy share) across the lap boundary.
 */
export function Forest({ journeyRef }: { journeyRef: JourneyRef }) {
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
    // fewer crown segments -> chunkier hand-rolled conifers under the hard ramp
    const crownGeo = new THREE.SphereGeometry(0.15, 8, 8)
    const mat = (): THREE.MeshToonMaterial =>
      new THREE.MeshToonMaterial({ gradientMap: ramp, vertexColors: false })

    // first pass: collect accepted trees with BOTH lap crown colors
    type Tree = { pos: THREE.Vector3; quat: THREE.Quaternion; s: number; crownA: THREE.Color; crownB: THREE.Color }
    const trees: Tree[] = []
    const pine = new THREE.Color(PALETTE.pine)
    const leaf = new THREE.Color(PALETTE.leaf)
    const sprout = new THREE.Color(PALETTE.sprout)
    const snow = new THREE.Color(PALETTE.snow)
    const honey = new THREE.Color(PALETTE.honey)
    const dune = new THREE.Color(PALETTE.dune)
    const earth = new THREE.Color(PALETTE.earth)

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
      const pick = seeded(i, 901.1)
      // lap 1: snowy conifer inside the cold cap, else pine/leaf/sprout
      const snowyA = capMask(dir.x, dir.y, dir.z, SNOW) > 0.3
      const crownA = snowyA ? snow : pick < 0.6 ? pine : pick < 0.85 ? leaf : sprout
      // lap 2: winter has spread (WIDER SNOW_B share); the rest turn autumn
      const snowyB = capMask(dir.x, dir.y, dir.z, SNOW_B) > 0.3
      const crownB = snowyB ? snow : pick < 0.5 ? honey : pick < 0.8 ? dune : earth
      trees.push({ pos: pos.clone(), quat: quat.clone(), s, crownA: crownA.clone(), crownB: crownB.clone() })
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

    const crownA = new Float32Array(n * 3)
    const crownB = new Float32Array(n * 3)
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
      crown.setColorAt(i, col.copy(tr.crownA))
      crownA[i * 3] = tr.crownA.r; crownA[i * 3 + 1] = tr.crownA.g; crownA[i * 3 + 2] = tr.crownA.b
      crownB[i * 3] = tr.crownB.r; crownB[i * 3 + 1] = tr.crownB.g; crownB[i * 3 + 2] = tr.crownB.b
    }
    trunk.instanceMatrix.needsUpdate = true
    crown.instanceMatrix.needsUpdate = true
    if (crown.instanceColor) crown.instanceColor.needsUpdate = true

    return { trunk, crown, crownA, crownB }
  }, [ramp])

  // Lerp the crown instanceColor A→B across the lap boundary; skipped whenever
  // worldBlend is unchanged so the common case costs nothing.
  const lastBlend = useRef(-1)
  useFrame(() => {
    const blend = journeyRef.current.worldBlend
    if (blend === lastBlend.current) return
    const buf = built.crown.instanceColor
    if (buf) {
      const arr = buf.array as Float32Array
      const { crownA, crownB } = built
      for (let i = 0; i < arr.length; i++) arr[i] = crownA[i] + (crownB[i] - crownA[i]) * blend
      buf.needsUpdate = true
    }
    lastBlend.current = blend
  })

  return (
    <>
      <primitive object={built.trunk} />
      <primitive object={built.crown} />
    </>
  )
}
