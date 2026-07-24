'use client'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../../palette'
import { PLANET_RADIUS, WATER_LEVEL, terrainBump } from '../planet'
import { deltaArmDist, type Cap } from '../biomes'
import { activeVariantAt, canonicalTheta } from '../renewal'
import { anchorTransform } from '../stage'
import { useClayRamp } from '../toon-ramp'
import { ClayFrog, ClayHeron, ClayRipple, ClayStiltHut, ClayTurtle } from './clay-kit'
import type { JourneyRef } from '../use-journey'

// The A2 360dialog wedge (band 2, variant A) is the GRAND DELTA (Task 48). All of this
// wetland dressing is variant-A (lap-1) content: each instance / figure shows only while
// variant 0 is active at its longitude, flipping to the B2 winter scene behind the horizon
// (renewal-scan), so it never pops on camera — same per-instance gating as the Forest/Jungle.

/** Wet-sandy delta palette family (named palette.ts entries — the same the A2 ground recolour
 *  uses, so flora + terrain read as one wetland). */
const WET = {
  reed: PALETTE.reedGreen,
  reedDeep: PALETTE.deltaMoss,
  mangrove: PALETTE.jungleCanopy,
  mangroveDeep: PALETTE.jungleDeep,
  bark: PALETTE.stiltRoof,
} as const

/** Keep the girl's lane clear — no delta flora inside the spine band. */
const MIN_NX = 0.2
const Y_UP = new THREE.Vector3(0, 1, 0)

const fract = (v: number): number => v - Math.floor(v)
const seeded = (i: number, s: number): number => fract(Math.sin(i * 127.1 + s) * 43758.5453)

/** Unit direction at latitude nx and longitude theta. */
const place = (nx: number, th: number): [number, number, number] => {
  const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
  return [nx, ring * Math.cos(th), ring * Math.sin(th)]
}

/** Caps tiling the A2 delta interior across both flanks + the braid fan (≈ th [5.5, 6.2]) so
 *  the wetland stays dense wherever the girl is during chapter 2 — not just one clump. */
const DELTA_CAPS: Cap[] = [
  { dir: place(0.42, 5.68), radius: 0.42, feather: 0.16 },
  { dir: place(0.4, 6.02), radius: 0.42, feather: 0.16 },
  { dir: place(-0.4, 5.72), radius: 0.42, feather: 0.16 },
  { dir: place(-0.42, 6.05), radius: 0.42, feather: 0.16 },
]

type Placed = { pos: THREE.Vector3; quat: THREE.Quaternion; s: number; tc: number; yaw: number }

/** Scatter accepted points inside a cap, grounded on the variant-A delta terrain (terrainBump
 *  carries the levee banks, so flora sits on the sculpted banks lining the braid), NEAR a water
 *  arm (so the wetland rings the channels) but on the DRY bank (above the waterline). */
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
  for (let i = 0; i < count * 3 && out.length < count; i++) {
    const cosT = 1 - (1 - cosR) * seeded(i, seedOff)
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
    const phi = seeded(i, seedOff + 40) * Math.PI * 2
    dir.copy(c).multiplyScalar(cosT).addScaledVector(t1, sinT * Math.cos(phi)).addScaledVector(t2, sinT * Math.sin(phi)).normalize()
    if (Math.abs(dir.x) < MIN_NX) continue
    const bump = terrainBump(dir.x * PLANET_RADIUS, dir.y * PLANET_RADIUS, dir.z * PLANET_RADIUS)
    if (1 + bump < WATER_LEVEL) continue // nothing in the water — flora rings it, doesn't drown
    if (deltaArmDist(dir.x, dir.y, dir.z) > 0.3) continue // cluster along the braid, not the far fan
    const pos = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
    const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
    const s = minS + seeded(i, seedOff + 80) * (maxS - minS)
    const tc = canonicalTheta(Math.atan2(dir.z, dir.y))
    const yaw = seeded(i, seedOff + 120) * Math.PI * 2
    out.push({ pos, quat, s, tc, yaw })
  }
  return out
}

/** A reed tuft merged into ONE geometry (so a whole clump is a single instance): several tall
 *  tapered blades fanning up from the base — taller + thinner than the jungle fern, so the delta
 *  reads as marsh grass, not rainforest. Non-indexed; flat-ish normals. */
function makeReedGeometry(): THREE.BufferGeometry {
  const blades = 7
  const seg = 4
  const H = 0.36 // blade height (tall marsh reed)
  const LEAN = 0.05 // outward lean reach
  const W0 = 0.012 // base half-width (thin)
  const verts: number[] = []
  const push = (v: THREE.Vector3) => verts.push(v.x, v.y, v.z)
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.3
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const L: THREE.Vector3[] = []
    const Rr: THREE.Vector3[] = []
    for (let s = 0; s <= seg; s++) {
      const p = s / seg
      const y = H * p
      const rad = LEAN * p * p
      const w = W0 * (1 - p * 0.85)
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

/** A mangrove stilt-root trunk merged into ONE geometry: a short central trunk lifted on four
 *  splayed prop roots meeting the ground — the delta's distinct stilt-tree silhouette (nothing
 *  like the jungle's straight trunk or the desert palm). Base at y=0. */
function makeMangroveTrunkGeometry(): THREE.BufferGeometry {
  const parts: Array<{ geo: THREE.BufferGeometry; m: THREE.Matrix4 }> = []
  const q = new THREE.Quaternion()
  const add = (geo: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number]) => {
    q.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]))
    parts.push({ geo, m: new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, new THREE.Vector3(1, 1, 1)) })
  }
  // central trunk, lifted so it sits above the splay
  add(new THREE.CylinderGeometry(0.028, 0.036, 0.34, 6), [0, 0.32, 0], [0, 0, 0])
  // four prop roots angling down to the ground from the trunk base
  const roots = 4
  for (let r = 0; r < roots; r++) {
    const a = (r / roots) * Math.PI * 2 + 0.4
    add(
      new THREE.CylinderGeometry(0.01, 0.022, 0.24, 5),
      [0.08 * Math.cos(a), 0.11, 0.08 * Math.sin(a)],
      [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]
    )
  }
  const positions: number[] = []
  const normals: number[] = []
  for (const { geo, m } of parts) {
    const g = geo.toNonIndexed()
    g.applyMatrix4(m)
    const pos = g.attributes.position.array as ArrayLike<number>
    const nor = g.attributes.normal.array as ArrayLike<number>
    for (let i = 0; i < pos.length; i++) {
      positions.push(pos[i])
      normals.push(nor[i])
    }
    g.dispose()
    geo.dispose()
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return out
}

/** One gated instanced flora layer + the parallel arrays the per-frame front reads to toggle
 *  each instance by whether variant A is active at its longitude. */
type Layer = { mesh: THREE.InstancedMesh; real: THREE.Matrix4[]; thetaC: Float32Array }

/**
 * Dense instanced wetland flora over the A2 delta — reed beds ringing the braid arms and
 * mangrove stilt trees rising off the levee banks. Three InstancedMesh in total (≤ +3 draw
 * calls); density is free on the draw budget because every family is a single instanced draw.
 * Each instance scale-zeros when variant A is not active at its longitude (the renewal front,
 * per-instance, always behind the horizon).
 */
function DeltaFlora({ journeyRef }: { journeyRef: JourneyRef }) {
  const ramp = useClayRamp()
  const built = useMemo(() => {
    const reeds = scatterCaps(DELTA_CAPS, 311.7, 46, 0.7, 1.2)
    const mangroves = scatterCaps(DELTA_CAPS, 178.3, 22, 0.8, 1.25)

    const mk = (color: string) => {
      const m = new THREE.MeshToonMaterial({ gradientMap: ramp })
      m.color = new THREE.Color(color)
      return m
    }

    const reedGeo = makeReedGeometry()
    const trunkGeo = makeMangroveTrunkGeometry()
    const canopyGeo = new THREE.SphereGeometry(0.2, 10, 8)

    const buildLayer = (
      pts: Placed[],
      geo: THREE.BufferGeometry,
      color: string,
      colorDeep: string | null,
      local: (m: THREE.Matrix4, s: number, yaw: number) => void
    ): Layer => {
      // Per-instance colour via instanceColor (setColorAt), like the Forest/Jungle: base
      // material white when a deep variant is mixed in, else the flat colour.
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
        const shown = base.clone().multiply(lm)
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
      // reed beds at ground level, ringing the water arms
      buildLayer(reeds, reedGeo, WET.reed, WET.reedDeep, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        m.multiply(yawT)
      }),
      // mangrove stilt trunks
      buildLayer(mangroves, trunkGeo, WET.bark, null, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        m.multiply(yawT)
      }),
      // wide flat mangrove canopy riding above the stilt trunk
      buildLayer(mangroves, canopyGeo, WET.mangrove, WET.mangroveDeep, (m, _s, yaw) => {
        yawT.makeRotationY(yaw)
        trans.makeTranslation(0, 0.52, 0)
        scl.makeScale(1.5, 0.5, 1.5)
        m.multiply(trans).multiply(yawT).multiply(scl)
      }),
    ]
    return { layers }
  }, [ramp])

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

/** One lurking delta wader/creature: anchored on the A2 terrain, shown only while variant A is
 *  active at its longitude (like the Jungle's Lurker), with an optional subtle idle bob driven
 *  by rotation (deterministic — no clock; rests calm at the chapter stop where rotation freezes). */
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
 * The delta's lurking life + structure (Task 48): a heron standing still in a shallow, a turtle
 * basking on a sandbank, a frog by the reeds, fish-ripple hints on the braid, and a stilt fishing
 * hut on a levee. All variant-A gated (so lap 2 / the B2 winter scene stays clear).
 */
function DeltaWildlife({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {/* heron wading in a shallow off the +x braid, dead still */}
      <Lurker theta={5.7} x={0.4} journeyRef={journeyRef}>
        <ClayHeron rotation={[0, -0.9, 0]} />
      </Lurker>
      {/* turtle basking on a -x sandbar */}
      <Lurker theta={5.95} x={-0.4} journeyRef={journeyRef}>
        <ClayTurtle rotation={[0, 1.2, 0]} />
      </Lurker>
      {/* frog crouched in the reeds by the water */}
      <Lurker theta={5.62} x={0.46} journeyRef={journeyRef} bob={0.006} phase={2.4}>
        <ClayFrog rotation={[0, -0.5, 0]} />
      </Lurker>
      {/* fish-ripple hints breaking the braid surface (subtle bob = the ring spreading) */}
      <Lurker theta={5.84} x={0.28} journeyRef={journeyRef} bob={0.004} phase={0.7}>
        <ClayRipple />
      </Lurker>
      <Lurker theta={5.78} x={-0.24} journeyRef={journeyRef} bob={0.004} phase={3.5}>
        <ClayRipple />
      </Lurker>
      {/* the stilt fishing hut on a levee bank, facing its jetty toward the water */}
      <Lurker theta={6.02} x={0.5} journeyRef={journeyRef}>
        <ClayStiltHut rotation={[0, -1.2, 0]} />
      </Lurker>
    </>
  )
}

/** The A2 grand delta's wetland life: dense instanced flora + the lurking waders + the stilt
 *  hut. Composed into the scene alongside the Forest/Jungle/DesertLife; variant-A gated so lap 2
 *  (the B2 winter wedge) is clear. */
export function DeltaLife({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      <DeltaFlora journeyRef={journeyRef} />
      <DeltaWildlife journeyRef={journeyRef} />
    </>
  )
}
