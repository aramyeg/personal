'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump, terrainBumpB } from '../planet'
import { channelDist, type Cap } from '../biomes'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'

/** Keep the girl's lane clear — no forest inside the spine band. */
const MIN_NX = 0.3
const CANDIDATES = 96
const MAX_PER_CLUSTER = 54

const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number, s: number): number => fract(Math.sin(i * 127.1 + s) * 43758.5453)
const Y_UP = new THREE.Vector3(0, 1, 0)

/** Green woods over the A0/A1 spring flank (variant A). */
const GREEN_CAP: Cap = { dir: [0.5, Math.cos(1.9) * 0.866, Math.sin(1.9) * 0.866], radius: 0.6, feather: 0.16 }
/** Snowy conifers over the B2 winter-summit flank (variant B). */
const SNOW_CAP: Cap = { dir: [0.5, Math.cos(5.55) * 0.866, Math.sin(5.55) * 0.866], radius: 0.55, feather: 0.16 }

type Tree = { pos: THREE.Vector3; quat: THREE.Quaternion; s: number; crown: THREE.Color; tc: number; variant: 0 | 1 }

/** Scatter accepted trees inside a cap, grounded on the cluster's variant terrain. */
function scatterCluster(cap: Cap, variant: 0 | 1, crown: THREE.Color, seedOff: number): Tree[] {
  const bumpFn = variant === 0 ? terrainBump : terrainBumpB
  const c = new THREE.Vector3(cap.dir[0], cap.dir[1], cap.dir[2]).normalize()
  const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
  const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
  const cosR = Math.cos(cap.radius)
  const dir = new THREE.Vector3()
  const out: Tree[] = []
  for (let i = 0; i < CANDIDATES && out.length < MAX_PER_CLUSTER; i++) {
    const cosT = 1 - (1 - cosR) * seeded(i, seedOff)
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
    const phi = seeded(i, seedOff + 40) * Math.PI * 2
    dir.copy(c).multiplyScalar(cosT).addScaledVector(t1, sinT * Math.cos(phi)).addScaledVector(t2, sinT * Math.sin(phi)).normalize()
    if (Math.abs(dir.x) < MIN_NX) continue
    const bump = bumpFn(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
    if (1 + bump < WATER_LEVEL) continue // no trees in water
    if (bump > 0.1) continue // bare the steep spires
    if (channelDist(dir.x, dir.y, dir.z, variant) < 0.09) continue // clear the channels
    const pos = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
    const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
    const s = 0.5 + seeded(i, seedOff + 80) * 0.5
    const tc = canonicalTheta(Math.atan2(dir.z, dir.y))
    out.push({ pos, quat, s, crown: crown.clone(), tc, variant })
  }
  return out
}

/** One gated instanced layer: the trunks (all trees) or a crown of one silhouette
 *  family (its cluster's subset). Each carries the parallel arrays the per-frame
 *  front needs to toggle instances by active variant. */
type Layer = {
  mesh: THREE.InstancedMesh
  real: THREE.Matrix4[]
  variant: Uint8Array
  thetaC: Float32Array
  lift: number
}
type Built = { layers: Layer[] }

/**
 * Two dense woods — a green spring cluster over A0/A1 and a snowy conifer cluster
 * over B2 — but the crowns now carry DISTINCT silhouettes (Task 23): the spring wood
 * is lobed broadleaf spheres, the winter wood is pinched conifer CONES. Drawn as
 * three InstancedMesh (shared trunk + one crown per family), within the ≤4-draw
 * budget. Per-instance positions differ per variant; each instance scale-zeros when
 * its variant is not active at its longitude (the renewal front, per-instance, never
 * a global lerp — the flip is always behind the horizon, renewal-scan).
 */
export function Forest({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  const built = useMemo<Built>(() => {
    const green = scatterCluster(GREEN_CAP, 0, new THREE.Color(PALETTE.foliageDeep), 311.7)
    const snowy = scatterCluster(SNOW_CAP, 1, new THREE.Color(PALETTE.snow), 733.1)

    const trunkGeo = new THREE.CylinderGeometry(0.028, 0.04, 0.16, 6)
    const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8)
    const coneGeo = new THREE.ConeGeometry(0.15, 0.42, 7)
    const mk = () => new THREE.MeshToonMaterial({ gradientMap: ramp, vertexColors: false })

    // trunks: all trees, one shared draw
    const all = [...green, ...snowy]
    const trunkMat = mk()
    trunkMat.color = new THREE.Color(PALETTE.clayPath)
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, all.length)
    trunk.frustumCulled = false

    const buildCrown = (trees: Tree[], geo: THREE.BufferGeometry, lift: number, deep: string): Layer => {
      const crownMat = mk()
      crownMat.color = new THREE.Color(0xffffff)
      const mesh = new THREE.InstancedMesh(geo, crownMat, trees.length)
      mesh.frustumCulled = false
      const real: THREE.Matrix4[] = []
      const variant = new Uint8Array(trees.length)
      const thetaC = new Float32Array(trees.length)
      const scl = new THREE.Vector3()
      const m = new THREE.Matrix4()
      const liftM = new THREE.Matrix4().makeTranslation(0, lift, 0)
      const col = new THREE.Color()
      const deepC = new THREE.Color(deep)
      for (let i = 0; i < trees.length; i++) {
        const tr = trees[i]
        scl.setScalar(tr.s)
        m.compose(tr.pos, tr.quat, scl)
        real.push(m.clone())
        variant[i] = tr.variant
        thetaC[i] = tr.tc
        mesh.setMatrixAt(i, m.clone().multiply(liftM))
        // a little crown-colour variety so the wood is not one flat green/white
        mesh.setColorAt(i, col.copy(i % 3 === 0 ? deepC : tr.crown))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return { mesh, real, variant, thetaC, lift }
    }

    const scl = new THREE.Vector3()
    const m = new THREE.Matrix4()
    const trunkReal: THREE.Matrix4[] = []
    const trunkVariant = new Uint8Array(all.length)
    const trunkTheta = new Float32Array(all.length)
    const liftM = new THREE.Matrix4().makeTranslation(0, 0.08, 0)
    for (let i = 0; i < all.length; i++) {
      const tr = all[i]
      scl.setScalar(tr.s)
      m.compose(tr.pos, tr.quat, scl)
      trunkReal.push(m.clone())
      trunkVariant[i] = tr.variant
      trunkTheta[i] = tr.tc
      trunk.setMatrixAt(i, m.clone().multiply(liftM))
    }
    trunk.instanceMatrix.needsUpdate = true

    const layers: Layer[] = [
      { mesh: trunk, real: trunkReal, variant: trunkVariant, thetaC: trunkTheta, lift: 0.08 },
      buildCrown(green, sphereGeo, 0.24, PALETTE.pineDeep), // spring wood: lobed spheres
      buildCrown(snowy, coneGeo, 0.3, PALETTE.pineDeep), // winter wood: pinched cones
    ]
    return { layers }
  }, [ramp])

  // Each instance shows only when its variant is active at its longitude; the flip
  // always happens behind the horizon (renewal-scan), so it never pops on camera.
  const lastRot = useRef(Number.NaN)
  const states = useRef<Int8Array[] | null>(null)
  const ZERO = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  useFrame(() => {
    const rot = journeyRef.current.rotation
    if (rot === lastRot.current) return
    lastRot.current = rot
    const { layers } = built
    if (!states.current) states.current = layers.map((l) => new Int8Array(l.thetaC.length).fill(-1))
    const lift = new THREE.Matrix4()
    const tmp = new THREE.Matrix4()
    for (let li = 0; li < layers.length; li++) {
      const { mesh, real, variant, thetaC, lift: y } = layers[li]
      const st = states.current[li]
      let changed = false
      for (let i = 0; i < thetaC.length; i++) {
        const on = activeVariantAt(thetaC[i], rot) === variant[i] ? 1 : 0
        if (st[i] === on) continue
        st[i] = on
        if (on) {
          lift.makeTranslation(0, y, 0)
          mesh.setMatrixAt(i, tmp.copy(real[i]).multiply(lift))
        } else {
          mesh.setMatrixAt(i, ZERO)
        }
        changed = true
      }
      if (changed) mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {built.layers.map((l, i) => (
        <primitive key={i} object={l.mesh} />
      ))}
    </>
  )
}
