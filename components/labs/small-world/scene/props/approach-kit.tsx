'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump, terrainBumpB } from '../planet'
import { channelDist } from '../biomes'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { chapterTheta } from '../stage'
import { useClayRamp } from '../toon-ramp'
import type { JourneyRef } from '../use-journey'

/**
 * CLUSTERED SURFACE DRESSING — the shared placement machine behind Task 86.
 *
 * WHAT IT IS FOR. The journey camera is static and the planet turns under it, so at a
 * chapter's checkpoint the frame is a fixed map of the wedge's travel fraction:
 *
 *   ndc_y = (R·ring·cos(φ + 20°) / (12.1 − R·ring·sin(φ + 20°))) / tan(19°)
 *   φ = (t − PARK_FRAC)·CHAPTER_SLICE + STANCE_ALPHA
 *
 * Evaluated at the girl's lane that puts t = 0.40 at the top (she stands at ndc 0.459,
 * measured 0.456), the chapter's own tail t ≈ 0.8–1.0 across the lower middle, and
 * everything below the disc's half-height — the "underside" the T84 audit found undressed
 * — at t ≳ 0.95, which is the NEXT wedge's approach, foreshortened about 6:1 into the
 * last 130 px of the silhouette.
 *
 * WHAT THAT COMPRESSION DEMANDS OF THE ART, and why this is a cluster sampler rather than
 * a scatter. At 6:1 an isolated upright prop is a stroke with background on both sides:
 * chapter 3's three lone palms read as poultry legs and chapter 4's two geyser plumes as
 * grey drips, in the audit's words, and neither is a modelling fault — both are single
 * verticals standing alone at the limb. Chapter 1's lower third is the counter-example and
 * the reference: its mass is overlapping crowns, two and three deep, so the eye reads one
 * decorated edge instead of counting stems. So placement here is clustered by construction
 * — cluster centres first, members jittered around them — and members are meant to overlap.
 *
 * Everything is a pure function of the seed and the terrain: no Math.random, no wall clock.
 */

const Y_UP = new THREE.Vector3(0, 1, 0)
const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number, s: number): number => fract(Math.sin(i * 127.1 + s) * 43758.5453)

export type Placed = {
  pos: THREE.Vector3
  quat: THREE.Quaternion
  /** member scale, sampled from the spec's range */
  s: number
  /** canonical longitude — what the renewal front is queried at */
  tc: number
  /** free spin about the surface normal */
  yaw: number
  /** which cluster this member belongs to, so callers can vary a whole clump together */
  ci: number
  /** index within the cluster: 0 is the anchor member, which callers usually up-scale */
  mi: number
}

export type ClusterSpec = {
  /** wedge index 0..5 — the chapter whose travel fraction `t` is measured in */
  chapter: number
  /** 0 = lap-1 (A) content, 1 = lap-2 (B) */
  variant: 0 | 1
  /** travel-fraction window inside the chapter; may exceed [0,1] to spill into a neighbour */
  t: [number, number]
  /** |lateral offset| window in world units. The girl's lane is x = 0; keep lo ≳ 0.3. */
  x: [number, number]
  /** +1 = far flank only, −1 = near flank only, 0 = both (default) */
  side?: 1 | -1 | 0
  clusters: number
  /** members per cluster, [min, max] */
  perCluster: [number, number]
  /** cluster radius in travel-fraction units */
  spreadT: number
  /** cluster radius in world-x units */
  spreadX: number
  /** member scale range */
  scale: [number, number]
  seed: number
  /** reject members whose ground is below the waterline (default true) */
  dry?: boolean
  /** reject members within this angular distance of a river channel (default 0.08) */
  channelClear?: number
}

/**
 * Cluster centres inside the (t, x) window, then members jittered around each centre and
 * seated on the spec's variant terrain. Members that land in water, in a channel or inside
 * the lane are dropped WITHOUT being retried elsewhere — a rejected member leaves its clump
 * a little thinner, which is what a real thicket does at a water's edge, whereas resampling
 * would march it somewhere the author never asked for.
 */
export function clusterPlacements(spec: ClusterSpec): Placed[] {
  const {
    chapter, variant, t: [t0, t1], x: [x0, x1], side = 0,
    clusters, perCluster: [pcLo, pcHi], spreadT, spreadX, scale: [sLo, sHi], seed,
    dry = true, channelClear = 0.08,
  } = spec
  const bumpFn = variant === 0 ? terrainBump : terrainBumpB
  const out: Placed[] = []
  for (let ci = 0; ci < clusters; ci++) {
    const ct = t0 + (t1 - t0) * seeded(ci, seed)
    const mag = x0 + (x1 - x0) * seeded(ci, seed + 17.3)
    const sgn = side !== 0 ? side : seeded(ci, seed + 31.1) < 0.5 ? 1 : -1
    const cx = sgn * mag
    const n = Math.round(pcLo + (pcHi - pcLo) * seeded(ci, seed + 47.9))
    for (let mi = 0; mi < n; mi++) {
      const k = ci * 97 + mi
      // polar jitter about the centre so members bunch toward it rather than filling a box
      const a = seeded(k, seed + 61.7) * Math.PI * 2
      const rad = Math.sqrt(seeded(k, seed + 71.3))
      const tt = ct + Math.cos(a) * rad * spreadT
      const xx = cx + Math.sin(a) * rad * spreadX
      if (Math.abs(xx) > PLANET_RADIUS * 0.95) continue
      const theta = chapterTheta(chapter, tt)
      const xN = xx / PLANET_RADIUS
      const ring = Math.sqrt(Math.max(0, 1 - xN * xN))
      const dir = new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
      const bump = bumpFn(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
      if (dry && 1 + bump < WATER_LEVEL) continue
      if (channelDist(dir.x, dir.y, dir.z, variant) < channelClear) continue
      const pos = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
      const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
      out.push({
        pos,
        quat,
        s: sLo + (sHi - sLo) * seeded(k, seed + 83.9),
        tc: canonicalTheta(Math.atan2(dir.z, dir.y)),
        yaw: seeded(k, seed + 101.3) * Math.PI * 2,
        ci,
        mi,
      })
    }
  }
  return out
}

/** Local per-instance transform, applied after the placement's base frame. */
export type LocalFn = (m: THREE.Matrix4, p: Placed) => void

export type FamilySpec = {
  placed: Placed[]
  geometry: THREE.BufferGeometry
  color: string
  /** when given, a third of instances wear this instead — cheap crown variety */
  colorDeep?: string
  local?: LocalFn
}

/**
 * One instanced family, gated per instance by the renewal front at its own longitude —
 * exactly the Forest/Jungle contract, restated here so a dressing file is one draw call per
 * family however dense it is. An instance that is not its variant's is scaled to zero rather
 * than removed, and the flip always happens behind the horizon, so nothing pops on camera.
 */
export function InstancedFamilies({
  families,
  variant,
  journeyRef,
}: {
  families: FamilySpec[]
  variant: 0 | 1
  journeyRef: JourneyRef
}) {
  const ramp = useClayRamp()
  const built = useMemo(() => {
    const scl = new THREE.Vector3()
    const base = new THREE.Matrix4()
    const lm = new THREE.Matrix4()
    const col = new THREE.Color()
    return families.map(({ placed, geometry, color, colorDeep, local }) => {
      const mat = new THREE.MeshToonMaterial({ gradientMap: ramp })
      mat.color = new THREE.Color(colorDeep ? '#ffffff' : color)
      const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, placed.length))
      mesh.frustumCulled = false
      const real: THREE.Matrix4[] = []
      const thetaC = new Float32Array(placed.length)
      const baseC = new THREE.Color(color)
      const deepC = colorDeep ? new THREE.Color(colorDeep) : null
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i]
        scl.setScalar(p.s)
        base.compose(p.pos, p.quat, scl)
        lm.identity()
        local?.(lm, p)
        const shown = base.clone().multiply(lm)
        real.push(shown)
        thetaC[i] = p.tc
        mesh.setMatrixAt(i, shown)
        if (deepC) mesh.setColorAt(i, col.copy((p.ci + p.mi) % 3 === 0 ? deepC : baseC))
      }
      // an over-allocated tail (placed.length === 0) must not draw a unit cube at the origin
      for (let i = placed.length; i < mesh.count; i++) mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0))
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return { mesh, real, thetaC }
    })
  }, [families, ramp])

  const lastRot = useRef(Number.NaN)
  const states = useRef<Int8Array[] | null>(null)
  const ZERO = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  useFrame(() => {
    const rot = journeyRef.current.rotation
    if (rot === lastRot.current) return
    lastRot.current = rot
    if (!states.current) states.current = built.map((l) => new Int8Array(l.thetaC.length).fill(-1))
    const tmp = new THREE.Matrix4()
    for (let li = 0; li < built.length; li++) {
      const { mesh, real, thetaC } = built[li]
      const st = states.current[li]
      let changed = false
      for (let i = 0; i < thetaC.length; i++) {
        const on = activeVariantAt(thetaC[i], rot) === variant ? 1 : 0
        if (st[i] === on) continue
        st[i] = on
        mesh.setMatrixAt(i, on ? tmp.copy(real[i]) : ZERO)
        changed = true
      }
      if (changed) mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {built.map((l, i) => (
        <primitive key={i} object={l.mesh} />
      ))}
    </>
  )
}
