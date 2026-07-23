'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump } from '../planet'
import { channelDist, type Cap } from '../biomes'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { anchorTransform } from '../stage'
import { useClayRamp } from '../toon-ramp'
import { ClayFrog, ClayJaguar, ClayParrot, ClaySnake } from './clay-kit'
import type { JourneyRef } from '../use-journey'

// The A1 FLYERBEE wedge (band 1, variant A) is now a dense jungle (Task 42). All of this
// flora is variant-A (lap-1) content: each instance shows only while variant 0 is active at
// its longitude, flipping to the B1 canyon scene behind the horizon (renewal-scan), so it
// never pops on camera — same per-instance gating as the Forest.

/** Deep saturated jungle greens (named palette.ts entries — the same family the A1 ground
 *  recolour uses, so flora and terrain read as one jungle). */
const JUNGLE = {
  canopy: PALETTE.jungleCanopy,
  canopyDeep: PALETTE.jungleDeep,
  fern: PALETTE.jungleMoss,
  vine: PALETTE.jungleVine,
  leaf: PALETTE.jungleLeaf,
  trunk: PALETTE.jungleBark,
} as const

/** Keep the girl's lane clear — no jungle inside the spine band. */
const MIN_NX = 0.2
const Y_UP = new THREE.Vector3(0, 1, 0)

const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number, s: number): number => fract(Math.sin(i * 127.1 + s) * 43758.5453)

/** Unit direction at latitude nx and longitude theta. */
const place = (nx: number, th: number): [number, number, number] => {
  const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
  return [nx, ring * Math.cos(th), ring * Math.sin(th)]
}

/** Caps tiling the A1 band-1 interior across BOTH flanks and the whole arc (≈ th [2.7, 4.3])
 *  so the jungle stays dense wherever the girl is during chapter 1 — not just one clump. */
const JUNGLE_CAPS: Cap[] = [
  { dir: place(0.46, 2.95), radius: 0.46, feather: 0.16 },
  { dir: place(0.44, 3.85), radius: 0.46, feather: 0.16 },
  { dir: place(-0.44, 3.2), radius: 0.44, feather: 0.16 },
  { dir: place(-0.42, 4.05), radius: 0.44, feather: 0.16 },
]

type Placed = { pos: THREE.Vector3; quat: THREE.Quaternion; s: number; tc: number; yaw: number }

/** Scatter accepted points inside a cap, grounded on the variant-A jungle terrain
 *  (terrainBump now carries the canopy mounds, so flora sits on the hummocks). */
function scatterCaps(caps: Cap[], seedOff: number, perCap: number, minS: number, maxS: number): Placed[] {
  const out: Placed[] = []
  for (let i = 0; i < caps.length; i++) out.push(...scatter(caps[i], seedOff + i * 53.7, perCap, minS, maxS))
  return out
}
function scatter(cap: Cap, seedOff: number, count: number, minS: number, maxS: number): Placed[] {
  const c = new THREE.Vector3(cap.dir[0], cap.dir[1], cap.dir[2]).normalize()
  const t1 = new THREE.Vector3().crossVectors(c, Y_UP).normalize()
  const t2 = new THREE.Vector3().crossVectors(c, t1).normalize()
  const cosR = Math.cos(cap.radius)
  const dir = new THREE.Vector3()
  const out: Placed[] = []
  for (let i = 0; i < count * 2 && out.length < count; i++) {
    const cosT = 1 - (1 - cosR) * seeded(i, seedOff)
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
    const phi = seeded(i, seedOff + 40) * Math.PI * 2
    dir.copy(c).multiplyScalar(cosT).addScaledVector(t1, sinT * Math.cos(phi)).addScaledVector(t2, sinT * Math.sin(phi)).normalize()
    if (Math.abs(dir.x) < MIN_NX) continue
    const bump = terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
    if (1 + bump < WATER_LEVEL) continue // nothing in the water
    if (channelDist(dir.x, dir.y, dir.z, 0) < 0.08) continue // clear the stream
    const pos = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
    const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
    const s = minS + seeded(i, seedOff + 80) * (maxS - minS)
    const tc = canonicalTheta(Math.atan2(dir.z, dir.y))
    const yaw = seeded(i, seedOff + 120) * Math.PI * 2
    out.push({ pos, quat, s, tc, yaw })
  }
  return out
}

/** A giant-fern rosette merged into ONE geometry (so a whole fern is a single instance):
 *  several arched, tapered blades radiating from the base. Non-indexed; flat-ish normals. */
function makeFernGeometry(): THREE.BufferGeometry {
  const blades = 6
  const seg = 5
  const H = 0.3 // blade height
  const R = 0.17 // outward arch reach
  const W0 = 0.032 // base half-width
  const verts: number[] = []
  const push = (v: THREE.Vector3) => verts.push(v.x, v.y, v.z)
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    // centreline + width points at each param, then triangulate the strip
    const L: THREE.Vector3[] = []
    const Rr: THREE.Vector3[] = []
    for (let s = 0; s <= seg; s++) {
      const p = s / seg
      const y = H * Math.sin(p * 1.35)
      const rad = R * p * p
      const w = W0 * Math.pow(1 - p, 0.7)
      const cx = rad * ca
      const cz = rad * sa
      L.push(new THREE.Vector3(cx - w * -sa, y, cz - w * ca))
      Rr.push(new THREE.Vector3(cx + w * -sa, y, cz + w * ca))
    }
    for (let s = 0; s < seg; s++) {
      push(L[s]); push(Rr[s]); push(Rr[s + 1])
      push(L[s]); push(Rr[s + 1]); push(L[s + 1])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  g.computeVertexNormals()
  return g
}

/** One gated instanced flora layer + the parallel arrays the per-frame front reads to
 *  toggle each instance by whether variant A is active at its longitude. */
type Layer = { mesh: THREE.InstancedMesh; real: THREE.Matrix4[]; thetaC: Float32Array }

/**
 * Dense instanced jungle flora over the A1 wedge — broad-leaf trees (tall trunk + a wide
 * drooping canopy), giant ferns, hanging vine loops and dark understory leaves. Five
 * InstancedMesh in total (≤ +6 draw calls); density is free on the draw budget because
 * every family is a single instanced draw. Each instance scale-zeros when variant A is not
 * active at its longitude (the renewal front, per-instance, always behind the horizon).
 */
function JungleFlora({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  const built = useMemo(() => {
    const trees = scatterCaps(JUNGLE_CAPS, 401.3, 42, 0.7, 1.15)
    const ferns = scatterCaps(JUNGLE_CAPS, 233.1, 40, 0.6, 1.0)
    const leaves = scatterCaps(JUNGLE_CAPS, 145.9, 44, 0.7, 1.2)
    const vines = trees.filter((_, i) => i % 3 === 0)

    const mk = (color: string) => {
      const m = new THREE.MeshToonMaterial({ gradientMap: ramp })
      m.color = new THREE.Color(color)
      return m
    }

    const trunkGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.42, 6)
    const canopyGeo = new THREE.SphereGeometry(0.2, 10, 8)
    const fernGeo = makeFernGeometry()
    const vineGeo = new THREE.TorusGeometry(0.11, 0.014, 8, 16, Math.PI * 1.3)
    const leafGeo = new THREE.SphereGeometry(0.11, 8, 6)

    // trunk: lifted so its base sits at the ground, scaled by the tree scale
    const trunkLift = 0.21
    const buildLayer = (
      pts: Placed[],
      geo: THREE.BufferGeometry,
      color: string,
      colorDeep: string | null,
      local: (m: THREE.Matrix4, s: number, yaw: number) => void
    ): Layer => {
      // Per-instance colour is carried by instanceColor (setColorAt), NOT vertexColors —
      // like the Forest. With per-instance colour the base material is white and three
      // multiplies in instanceColor; without it the material just wears the flat colour.
      const mat = mk(colorDeep ? '#ffffff' : color)
      const mesh = new THREE.InstancedMesh(geo, mat, pts.length)
      mesh.frustumCulled = false
      const real: THREE.Matrix4[] = []
      const thetaC = new Float32Array(pts.length)
      const base = new THREE.Matrix4()
      const lm = new THREE.Matrix4()
      const col = new THREE.Color()
      const deepC = colorDeep ? new THREE.Color(colorDeep) : null
      const baseC = new THREE.Color(color)
      for (let i = 0; i < pts.length; i++) {
        base.compose(pts[i].pos, pts[i].quat, new THREE.Vector3(pts[i].s, pts[i].s, pts[i].s))
        thetaC[i] = pts[i].tc
        lm.identity()
        local(lm, pts[i].s, pts[i].yaw)
        const shown = base.clone().multiply(lm) // full base·local — the on-state matrix
        real.push(shown)
        mesh.setMatrixAt(i, shown)
        if (deepC) mesh.setColorAt(i, col.copy(i % 3 === 0 ? deepC : baseC))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return { mesh, real, thetaC }
    }

    const yawT = new THREE.Matrix4()
    const trans = new THREE.Matrix4()
    const scl = new THREE.Matrix4()

    const layers: Layer[] = [
      // trunks
      buildLayer(trees, trunkGeo, JUNGLE.trunk, null, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        trans.makeTranslation(0, trunkLift, 0)
        m.multiply(trans).multiply(yawT)
      }),
      // wide drooping broad-leaf canopy riding above the trunk
      buildLayer(trees, canopyGeo, JUNGLE.canopy, JUNGLE.canopyDeep, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        trans.makeTranslation(0, 0.5, 0)
        scl.makeScale(1.55, 0.62, 1.55)
        m.multiply(trans).multiply(yawT).multiply(scl)
      }),
      // giant ferns at ground level
      buildLayer(ferns, fernGeo, JUNGLE.fern, null, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        m.multiply(yawT)
      }),
      // hanging vine loops drooping from a subset of trunks
      buildLayer(vines, vineGeo, JUNGLE.vine, null, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        trans.makeTranslation(0.12, 0.44, 0)
        scl.makeRotationZ(Math.PI * 0.9)
        m.multiply(trans).multiply(yawT).multiply(scl)
      }),
      // dark understory big leaves lying low, filling the gaps
      buildLayer(leaves, leafGeo, JUNGLE.leaf, null, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        trans.makeTranslation(0, 0.05, 0)
        scl.makeScale(1.7, 0.14, 1.0)
        m.multiply(trans).multiply(yawT).multiply(scl)
      }),
    ]
    return { layers }
  }, [ramp])

  // Each instance shows only while variant A is active at its longitude; the flip always
  // happens behind the horizon (renewal-scan), so it never pops on camera.
  const lastRot = useRef(Number.NaN)
  const states = useRef<Int8Array[] | null>(null)
  const ZERO = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  useFrame(() => {
    const rot = journeyRef.current.rotation
    if (rot === lastRot.current) return
    lastRot.current = rot
    const { layers } = built
    if (!states.current) states.current = layers.map((l) => new Int8Array(l.thetaC.length).fill(-1))
    const tmp = new THREE.Matrix4()
    for (let li = 0; li < layers.length; li++) {
      const { mesh, real, thetaC } = layers[li]
      const st = states.current[li]
      let changed = false
      for (let i = 0; i < thetaC.length; i++) {
        const on = activeVariantAt(thetaC[i], rot) === 0 ? 1 : 0
        if (st[i] === on) continue
        st[i] = on
        // real[i] is the full on-state matrix (base·local); restore it on show, zero on hide.
        mesh.setMatrixAt(i, on ? tmp.copy(real[i]) : ZERO)
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

/** One lurking animal: anchored on the A1 terrain, shown only while variant A is active at
 *  its longitude (like GatedProp), with an optional subtle idle bob driven by rotation
 *  (deterministic — no clock; rests calm at the chapter stop where rotation is frozen). */
function Lurker({
  theta,
  x,
  journeyRef,
  bob = 0,
  phase = 0,
  children,
}: {
  theta: number
  x: number
  journeyRef: JourneyRef
  bob?: number
  phase?: number
  children: ReactNode
}) {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const tc = useMemo(() => canonicalTheta(theta), [theta])
  const { position, quaternion } = useMemo(() => anchorTransform(theta, x, 0), [theta, x])
  useFrame(() => {
    const g = outer.current
    if (!g) return
    const rot = journeyRef.current.rotation
    g.visible = activeVariantAt(tc, rot) === 0
    if (g.visible && bob > 0 && inner.current) {
      inner.current.position.y = bob * Math.sin(rot * 6 + phase)
    }
  })
  return (
    <group ref={outer} position={position} quaternion={quaternion}>
      <group ref={inner}>{children}</group>
    </group>
  )
}

/**
 * The lurking clay animals — mostly-occluded placement is the charm (Task 42): a snake
 * coiled at a trunk, a big cat's eyes/ears peeking from behind a canopy mound, a parrot
 * on a branch (subtle idle bob), and a frog by the water. All variant-A gated.
 */
function JungleAnimals({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {/* snake coiled at a trunk base, half-tucked in the ferns */}
      <Lurker theta={3.28} x={0.4} journeyRef={journeyRef}>
        <ClaySnake rotation={[0, 1.1, 0]} />
      </Lurker>
      {/* big cat peeking from behind a canopy mound — the scroll-scrub reward */}
      <Lurker theta={4.02} x={0.56} journeyRef={journeyRef}>
        <ClayJaguar position={[0, 0.16, 0]} rotation={[0.2, -0.6, 0]} />
      </Lurker>
      {/* parrot perched high on a broad-leaf branch, idle-bobbing */}
      <Lurker theta={3.5} x={-0.46} journeyRef={journeyRef} bob={0.014} phase={1.3}>
        <ClayParrot position={[0, 0.62, 0]} rotation={[0, 2.2, 0]} />
      </Lurker>
      {/* frog crouched by the A1 shelf-sea shore */}
      <Lurker theta={3.2} x={0.5} journeyRef={journeyRef} bob={0.006} phase={4.1}>
        <ClayFrog rotation={[0, -0.8, 0]} />
      </Lurker>
    </>
  )
}

/** The A1 jungle: dense instanced flora + the lurking animals. Composed into the scene
 *  alongside the existing Forest/Delights; variant-A gated so lap 2 (B1 canyon) is clear. */
export function Jungle({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      <JungleFlora journeyRef={journeyRef} />
      <JungleAnimals journeyRef={journeyRef} />
    </>
  )
}
