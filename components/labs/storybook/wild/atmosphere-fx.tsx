'use client'

/**
 * WILD lane — embers, smoke, light shafts and pools. Owned by the WAKING implementer.
 *
 * Everything in this file is light with no surface: additive, `depthWrite: false`, and given a
 * deliberate `renderOrder` so the stack composites bottom-up — pools on the cobbles first, then
 * the smoke, then the shafts through it, then the arch's flare, then embers over everything.
 * Nothing here writes depth, so nothing here can punch a hole in the building.
 *
 * The one non-additive member is the chimney plume, which has to DARKEN the sky as well as
 * catch light from below, and the one non-drawing member is the camera lean, which is the
 * riskiest thing in the lane: it is the only code in the candidate that moves the reader's eye.
 * It is written to be exactly reversible — every pose is recomputed from the constants in
 * `book/reading-stage.ts` each frame, never accumulated — and it restores the camera on unmount.
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { CAMERA_LOOKAT, CAMERA_POSITION } from '../book/reading-stage'
import {
  ARCH,
  ARCH_SHAFT,
  CHIMNEY,
  LANTERN,
  LIGHT_POOLS,
  PALETTE,
  STAGE,
  WINDOWS,
} from './inn-model'
import { ramp, readWildFrame, useWild, damp } from './wild-frame'
import { roomLevel } from './windows'

// -----------------------------------------------------------------------------------------
// SHARED GLSL
// -----------------------------------------------------------------------------------------

const NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return v;
}
`

// -----------------------------------------------------------------------------------------
// THE BEAM — a soft cone of light with dust scrolling through it
// -----------------------------------------------------------------------------------------

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vPosV;
void main() {
  vUv = uv;
  vNrm = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPosV = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

/**
 * A cone pointed at the reader is a hard thing to shade: the shell's normals are perpendicular
 * to the view almost everywhere, so a plain fresnel either blanks it or leaves a hollow tube.
 * The floor term (`mix(0.38, 1.0, ...)`) keeps the barrel filled, the grazing term thickens the
 * rim where a real shaft's edge scatters most, and the scrolling fbm supplies the striations
 * that make it read as air rather than plastic.
 */
const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uNoiseScale;
uniform float uDrift;
uniform vec3 uHot;
uniform vec3 uCool;
varying vec2 vUv;
varying vec3 vNrm;
varying vec3 vPosV;

${NOISE}

void main() {
  if (uOpacity <= 0.001) discard;
  float graze = 1.0 - abs(dot(normalize(vNrm), normalize(-vPosV)));
  float body = mix(0.38, 1.0, pow(clamp(graze, 0.0, 1.0), 1.2));

  // Along the beam: the MOUTH is kept clear — the reader must be able to see through the
  // aperture to what the light is coming from (the passage, the hundred keys) — so the shaft
  // swells to full body a little way out and dies by the far end.
  float along = clamp(vUv.y, 0.0, 1.0);
  float lengthFade = pow(1.0 - along, 1.7) * smoothstep(0.0, 0.30, along);

  // Dust in the air, scrolling out along the beam and turning slowly around it.
  float n = fbm(vec2(vUv.x * uNoiseScale, along * uNoiseScale * 0.55 - uTime * uDrift));
  float dust = mix(0.55, 1.15, n);

  float a = body * lengthFade * dust * uOpacity;
  if (a <= 0.002) discard;
  vec3 col = mix(uHot, uCool, along);
  gl_FragColor = vec4(col * (0.7 + 0.6 * dust), a);
}
`

type BeamSpec = {
  origin: readonly [number, number, number]
  direction: readonly [number, number, number]
  length: number
  startHalfW: number
  endHalfW: number
}

const UP_Y = new THREE.Vector3(0, 1, 0)

function beamGeometry(spec: BeamSpec): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(
    spec.endHalfW,
    spec.startHalfW,
    spec.length,
    30,
    1,
    true,
  )
  // The lathe puts the origin at mid-height; slide it to the mouth so the mesh can be placed
  // at the aperture and pointed down its own normal.
  geo.translate(0, spec.length / 2, 0)
  return geo
}

function beamQuaternion(direction: readonly [number, number, number]): THREE.Quaternion {
  const dir = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize()
  return new THREE.Quaternion().setFromUnitVectors(UP_Y, dir)
}

function makeBeamMaterial(noiseScale: number, drift: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uNoiseScale: { value: noiseScale },
      uDrift: { value: drift },
      uHot: { value: new THREE.Color(PALETTE.lampHot) },
      uCool: { value: new THREE.Color(PALETTE.lamp) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

// -----------------------------------------------------------------------------------------
// SOFT RADIAL SPRITE — the flare in the arch's mouth
// -----------------------------------------------------------------------------------------

function makeGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('wild/atmosphere-fx: 2d canvas context unavailable')
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,240,214,1)')
  g.addColorStop(0.18, 'rgba(255,206,140,0.72)')
  g.addColorStop(0.5, 'rgba(255,160,72,0.24)')
  g.addColorStop(1, 'rgba(255,130,50,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  return tex
}

// -----------------------------------------------------------------------------------------
// LIGHT POOLS — instanced ellipses on the cobbles
// -----------------------------------------------------------------------------------------

const POOL_VERT = /* glsl */ `
attribute float aAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

const POOL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
varying float vAlpha;

${NOISE}

void main() {
  if (vAlpha <= 0.002) discard;
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(1.0 - clamp(r, 0.0, 1.0), 2.3);
  // Cobbles are not a mirror: break the falloff up so the pool reads as light on stone.
  float grain = mix(0.78, 1.12, vnoise(vUv * 9.0 + vec2(uTime * 0.03, 0.0)));
  gl_FragColor = vec4(uColor * (0.8 + 0.5 * a), a * grain * vAlpha);
}
`

// -----------------------------------------------------------------------------------------
// CHIMNEY PLUME
// -----------------------------------------------------------------------------------------

const SMOKE_H = 0.62
const SMOKE_W = 0.15

const SMOKE_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  float t = uv.y;
  vec3 p = position;
  // A plume widens as it cools and loses the flue's push, and it wanders — two slow sines,
  // both scaled by height so the base stays pinned in the pot.
  p.x *= mix(0.30, 1.0, pow(t, 0.7));
  p.x += (sin(t * 2.4 + uTime * 0.42) * 0.055 + sin(t * 5.3 - uTime * 0.29) * 0.022) * t;
  p.z += cos(t * 1.9 - uTime * 0.35) * 0.030 * t;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const SMOKE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uWarm;
uniform vec3 uCool;
varying vec2 vUv;

${NOISE}

void main() {
  if (uOpacity <= 0.002) discard;
  float t = vUv.y;
  // ONE continuous noise field, not a row of puffs: the plume's whole body is a single fbm
  // scrolling upward, so it never shows a sprite's edge.
  float n = fbm(vec2(vUv.x * 2.4, t * 2.1 - uTime * 0.085));
  n += 0.35 * fbm(vec2(vUv.x * 5.1 + 3.7, t * 4.3 - uTime * 0.15));
  float body = smoothstep(0.42, 0.95, n);
  float sides = 1.0 - pow(abs(vUv.x * 2.0 - 1.0), 2.0);
  float ends = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.35, 1.0, t));
  float a = body * sides * ends * uOpacity;
  if (a <= 0.003) discard;
  // Lit from below by the kitchen, cooling to moonlit grey as it climbs.
  vec3 col = mix(uWarm, uCool, smoothstep(0.0, 0.55, t));
  gl_FragColor = vec4(col, a);
}
`

// -----------------------------------------------------------------------------------------
// EMBERS
// -----------------------------------------------------------------------------------------

const EMBER_COUNT = 72

const EMBER_VERT = /* glsl */ `
attribute vec3 aSeed;   // x: phase seed, y: rise speed 0..1, z: size 0..1
uniform float uTime;
uniform float uLevel;
uniform float uScale;
varying float vAlpha;
varying float vLife;
void main() {
  float speed = 0.055 + aSeed.y * 0.085;
  float life = fract(aSeed.x + uTime * speed);
  vec3 p = position;
  // Rise, then peel away downwind — an ember loses lift as it cools, so the drift grows
  // faster than the climb.
  p.y += life * 0.66;
  p.x += sin(life * 5.4 + aSeed.x * 31.0) * 0.075 * life + life * life * 0.10;
  p.z += cos(life * 4.1 + aSeed.x * 17.0) * 0.045 * life + life * 0.05;
  vLife = life;
  vAlpha = uLevel * sin(life * 3.14159) * (0.35 + 0.65 * aSeed.z);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (0.006 + aSeed.z * 0.011) * uScale / max(0.05, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const EMBER_FRAG = /* glsl */ `
uniform vec3 uHot;
uniform vec3 uCool;
varying float vAlpha;
varying float vLife;
void main() {
  if (vAlpha <= 0.003) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(1.0 - clamp(d, 0.0, 1.0), 1.8) * vAlpha;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(mix(uHot, uCool, vLife), a);
}
`

// -----------------------------------------------------------------------------------------
// CAMERA LEAN
// -----------------------------------------------------------------------------------------

/** The last eighth of the turn draws the reader in. Small on purpose: 8% is felt, not seen. */
const LEAN_FROM = 0.8
const LEAN_TO = 1.0
const LEAN_IN = 0.08
const LEAN_DROP = 0.055
/** How far the aim swings toward the arch. A full swing would recompose the frame. */
const LEAN_AIM = 0.22
const LEAN_LAMBDA = 2.6
/** Below this the lean is over: the camera is put back on its constants exactly and left. */
const LEAN_EPS = 1e-4

/** <PopupSpread> sits at this world height, so the arch's local y has to be lifted to aim at. */
const POPUP_Y = 0.062

// -----------------------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------------------

/** Two or three upper windows throw their own thin shafts once the gallery is alight. */
const GALLERY_SHAFT_SOURCES = [0, 3, 6]

export function AtmosphereFx() {
  const ctx = useWild()
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const glowTex = useMemo(() => makeGlowTexture(), [])

  // --- the arch shaft: two nested shells plus the flare in the mouth ---------------------
  const arch = useMemo(() => {
    const geo = beamGeometry(ARCH_SHAFT)
    const quat = beamQuaternion(ARCH_SHAFT.direction)
    const outer = makeBeamMaterial(3.4, 0.30)
    const inner = makeBeamMaterial(5.2, 0.44)
    return { geo, quat, outer, inner }
  }, [])

  const flareRef = useRef<THREE.Sprite>(null)
  const flareMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        color: new THREE.Color(PALETTE.lampHot),
      }),
    [glowTex],
  )

  // --- the lantern's flame: the inn's second warm note while it sleeps ---------------------
  const lanternRef = useRef<THREE.Sprite>(null)
  const lanternLightRef = useRef<THREE.PointLight>(null)
  const lanternMat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        color: new THREE.Color(PALETTE.lampHot),
      }),
    [glowTex],
  )

  // --- three thin gallery shafts ---------------------------------------------------------
  const gallery = useMemo(() => {
    const galleryWindows = WINDOWS.filter((w) => w.room === 'gallery')
    const picks = GALLERY_SHAFT_SOURCES.map((i) => galleryWindows[i]).filter(Boolean)
    const mat = makeBeamMaterial(4.6, 0.26)
    const beams = picks.map((slot) => {
      const spec: BeamSpec = {
        origin: slot.pos,
        direction: [slot.facing[0] * 0.9 + 0.06, -0.42, slot.facing[2] * 0.9 + 0.55],
        length: 0.34,
        startHalfW: slot.w * 0.46,
        endHalfW: slot.w * 1.5,
      }
      return {
        id: slot.id,
        geo: beamGeometry(spec),
        quat: beamQuaternion(spec.direction),
        pos: slot.pos,
      }
    })
    return { mat, beams }
  }, [])

  // --- pools -----------------------------------------------------------------------------
  const poolsRef = useRef<THREE.InstancedMesh>(null)
  const pools = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    const alpha = new Float32Array(LIGHT_POOLS.length)
    const attr = new THREE.InstancedBufferAttribute(alpha, 1)
    attr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aAlpha', attr)
    const mat = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(PALETTE.lamp) },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat, attr }
  }, [])

  // Pool matrices are recomposed against the LIVE page angles (see the useFrame): the cobble
  // halves ride the tilted pages, so a pool laid flat at cobbleY is a pool under the paving.
  const poolScratch = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3() }),
    [],
  )

  useEffect(() => {
    const mesh = poolsRef.current
    if (mesh) mesh.frustumCulled = false
  }, [])

  // --- smoke -------------------------------------------------------------------------------
  const smoke = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SMOKE_W, SMOKE_H, 10, 36)
    geo.translate(0, SMOKE_H / 2, 0)
    const mat = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uWarm: { value: new THREE.Color('#6b5340') },
        uCool: { value: new THREE.Color('#39445c') },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { geo, mat }
  }, [])

  // --- embers ------------------------------------------------------------------------------
  const embers = useMemo(() => {
    const pos = new Float32Array(EMBER_COUNT * 3)
    const seed = new Float32Array(EMBER_COUNT * 3)
    for (let i = 0; i < EMBER_COUNT; i += 1) {
      const r = (n: number): number => {
        const s = Math.sin(i * 91.7 + n * 37.13) * 43758.5453
        return s - Math.floor(s)
      }
      // Two thirds off the chimney and ridge, the rest out of the arch's mouth.
      const fromRoof = r(1) < 0.66
      pos[i * 3 + 0] = fromRoof ? -0.7 + r(2) * 0.82 : ARCH.cx + (r(2) - 0.5) * 0.2
      pos[i * 3 + 1] = fromRoof ? 0.6 + r(3) * 0.34 : 0.06 + r(3) * 0.14
      pos[i * 3 + 2] = fromRoof ? -0.42 + r(4) * 0.3 : ARCH.frontZ + r(4) * 0.12
      seed[i * 3 + 0] = r(5)
      seed[i * 3 + 1] = r(6)
      seed[i * 3 + 2] = r(7)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uLevel: { value: 0 },
        uScale: { value: 1000 },
        uHot: { value: new THREE.Color(PALETTE.lampHot) },
        uCool: { value: new THREE.Color(PALETTE.ember) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [])

  // --- camera lean bookkeeping ---------------------------------------------------------------
  const leanRef = useRef(0)
  const leanActiveRef = useRef(false)
  const base = useMemo(
    () => ({
      pos: new THREE.Vector3(...CAMERA_POSITION),
      look: new THREE.Vector3(...CAMERA_LOOKAT),
      quat: new THREE.Quaternion(),
      captured: false,
    }),
    [],
  )
  const leanScratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      targetPos: new THREE.Vector3(),
      targetLook: new THREE.Vector3(),
    }),
    [],
  )

  useEffect(() => {
    // The scene pins the camera from these very constants, so the restore pose is exact rather
    // than "wherever it happened to be when this component mounted".
    base.pos.set(...CAMERA_POSITION)
    base.look.set(...CAMERA_LOOKAT)
    base.quat.copy(camera.quaternion)
    base.captured = true
    const cam = camera
    const home = base
    return () => {
      cam.position.copy(home.pos)
      cam.quaternion.copy(home.quat)
      cam.updateMatrixWorld()
    }
  }, [camera, base])

  // --- disposal -------------------------------------------------------------------------------
  useEffect(
    () => () => {
      glowTex.dispose()
      flareMat.dispose()
      arch.geo.dispose()
      arch.outer.dispose()
      arch.inner.dispose()
      gallery.mat.dispose()
      for (const b of gallery.beams) b.geo.dispose()
      pools.geo.dispose()
      pools.mat.dispose()
      smoke.geo.dispose()
      smoke.mat.dispose()
      embers.geo.dispose()
      embers.mat.dispose()
    },
    [glowTex, flareMat, arch, gallery, pools, smoke, embers],
  )

  const archGroupRef = useRef<THREE.Group>(null)
  const galleryGroupRef = useRef<THREE.Group>(null)
  const smokeGroupRef = useRef<THREE.Group>(null)
  const embersRef = useRef<THREE.Points>(null)

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30)
    const f = readWildFrame(ctx)

    // A global gate: none of this exists until the stage itself has arrived.
    const stage = f.hidden ? 0 : ramp(f.open, 0.55, 0.92)

    const passage = roomLevel(f.wake, 'passage')
    const galleryLevel = roomLevel(f.wake, 'gallery')
    const kitchen = roomLevel(f.wake, 'kitchen')

    // ARCH SHAFT — the money shot. Its two shells breathe against each other so the beam
    // never sits still, and the flare in the mouth carries the actual blow-out.
    {
      const breathe = 1 + 0.05 * Math.sin(f.time * 1.31) + 0.03 * Math.sin(f.time * 2.87 + 1.1)
      const level = passage * stage * breathe
      arch.outer.uniforms.uTime.value = f.time
      arch.inner.uniforms.uTime.value = f.time
      arch.outer.uniforms.uOpacity.value = level * 0.15
      arch.inner.uniforms.uOpacity.value = level * 0.14
      const group = archGroupRef.current
      if (group) group.visible = level > 0.003
      const flare = flareRef.current
      if (flare) {
        // The flare is a breath in the arch's mouth, not the light itself — the bore's own
        // edges must stay legible or the arch reads as a fireball stuck to the facade.
        flareMat.opacity = Math.min(1, level * 0.05)
        flare.visible = flareMat.opacity > 0.004
        const s = ARCH.halfW * (1.1 + 0.2 * Math.min(1, level))
        flare.scale.set(s, s * 1.05, 1)
      }
    }

    // THE LANTERN — an ember all night (the sleeping frame's second warm note), and the very
    // first thing to answer the key: `passage` saturates within the first few degrees of turn,
    // so the flare-up reads as cause-and-effect before a single window has lit.
    {
      const flicker =
        1 + 0.09 * Math.sin(f.time * 9.3) + 0.05 * Math.sin(f.time * 15.7 + 2.1)
      const level = stage * (0.2 + 0.8 * passage) * flicker
      lanternMat.opacity = Math.min(1, level * 0.5)
      const sprite = lanternRef.current
      if (sprite) {
        sprite.visible = lanternMat.opacity > 0.004
        const s = LANTERN.radius * (3.4 + 2.6 * passage)
        sprite.scale.set(s, s * 1.1, 1)
      }
      const light = lanternLightRef.current
      if (light) {
        light.intensity = (0.16 + 1.15 * passage) * stage * flicker
        light.visible = light.intensity > 0.004
      }
    }

    // GALLERY SHAFTS — thin, late, and only ever a supporting voice.
    {
      const level = galleryLevel * stage
      gallery.mat.uniforms.uTime.value = f.time
      gallery.mat.uniforms.uOpacity.value = level * 0.2
      const group = galleryGroupRef.current
      if (group) group.visible = level > 0.004
    }

    // POOLS on the cobbles — seated on the tilted paving, not on a flat floor.
    {
      const mesh = poolsRef.current
      if (mesh) {
        pools.mat.uniforms.uTime.value = f.time
        const arr = pools.attr.array as Float32Array
        const { m, q, e, p, s } = poolScratch
        let any = 0
        LIGHT_POOLS.forEach((pool, i) => {
          const wobble = 1 + 0.06 * Math.sin(f.time * (1.9 + i * 0.31) + i * 1.7)
          const v = roomLevel(f.wake, pool.room) * pool.strength * stage * wobble
          arr[i] = v
          any = Math.max(any, v)
          const theta = pool.center[0] >= 0 ? f.thetaR : f.thetaL - Math.PI
          e.set(-Math.PI / 2, 0, theta, 'ZYX')
          q.setFromEuler(e)
          p.set(
            pool.center[0],
            Math.tan(theta) * pool.center[0] + STAGE.cobbleY + 0.003,
            pool.center[1],
          )
          s.set(pool.rx * 2, pool.rz * 2, 1)
          m.compose(p, q, s)
          mesh.setMatrixAt(i, m)
        })
        pools.attr.needsUpdate = true
        mesh.instanceMatrix.needsUpdate = true
        mesh.visible = any > 0.004
      }
    }

    // SMOKE — a thread while the inn sleeps (the kitchen banks its fire overnight), a real
    // plume once the kitchen is lit, and thicker again as the whole inn comes up.
    {
      smoke.mat.uniforms.uTime.value = f.time
      const level = (0.1 + 0.62 * kitchen + 0.28 * f.wake) * stage
      smoke.mat.uniforms.uOpacity.value = level
      const group = smokeGroupRef.current
      if (group) group.visible = level > 0.006
    }

    // EMBERS — only once the inn is properly awake, and they arrive over a beat rather than
    // popping on at the threshold.
    {
      const level = ramp(f.wake, 0.5, 0.72) * stage
      embers.mat.uniforms.uTime.value = f.time
      embers.mat.uniforms.uLevel.value = level
      embers.mat.uniforms.uScale.value =
        (size.height * dpr) / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360))
      const pts = embersRef.current
      if (pts) pts.visible = level > 0.004
    }

    // CAMERA LEAN. Recomputed from the constants every frame — nothing here integrates, so
    // turning away and back cannot leave the eye a millimetre off where it started.
    if (base.captured) {
      const want = f.hidden ? 0 : ramp(f.wake, LEAN_FROM, LEAN_TO)
      leanRef.current = damp(leanRef.current, want, LEAN_LAMBDA, dt)
      if (leanRef.current < LEAN_EPS) {
        if (leanActiveRef.current) {
          camera.position.copy(base.pos)
          camera.quaternion.copy(base.quat)
          camera.updateMatrixWorld()
          leanActiveRef.current = false
        }
      } else {
        leanActiveRef.current = true
        const k = leanRef.current
        const { pos, look, targetPos, targetLook } = leanScratch
        targetPos.copy(base.look).sub(base.pos).multiplyScalar(LEAN_IN).add(base.pos)
        targetPos.y -= LEAN_DROP
        targetLook.set(ARCH.cx, POPUP_Y + (ARCH.springY + ARCH.apexY) / 2, ARCH.frontZ)
        targetLook.sub(base.look).multiplyScalar(LEAN_AIM).add(base.look)
        pos.copy(base.pos).lerp(targetPos, k)
        look.copy(base.look).lerp(targetLook, k)
        camera.position.copy(pos)
        camera.lookAt(look)
        camera.updateMatrixWorld()
      }
    }
  })

  const archOrigin = ARCH_SHAFT.origin as unknown as [number, number, number]

  return (
    <>
      {/* THE ARCH SHAFT — two nested shells so the barrel reads filled rather than hollow. */}
      <group ref={archGroupRef} name="wild-arch-shaft" visible={false}>
        <mesh
          position={archOrigin}
          quaternion={arch.quat}
          geometry={arch.geo}
          material={arch.outer}
          renderOrder={4}
        />
        <mesh
          position={archOrigin}
          quaternion={arch.quat}
          geometry={arch.geo}
          material={arch.inner}
          scale={[0.46, 1, 0.46]}
          renderOrder={4}
        />
        <sprite ref={flareRef} position={archOrigin} material={flareMat} renderOrder={5} />
      </group>

      {/* The lantern's flame and its pool of warmth on the stone. */}
      <sprite
        ref={lanternRef}
        position={LANTERN.pos as unknown as [number, number, number]}
        material={lanternMat}
        renderOrder={5}
        visible={false}
        name="wild-lantern-flame"
      />
      <pointLight
        ref={lanternLightRef}
        position={[LANTERN.pos[0], LANTERN.pos[1] + 0.01, LANTERN.pos[2] + 0.03]}
        color={PALETTE.lampHot}
        intensity={0}
        distance={0.55}
        decay={2}
        visible={false}
      />

      {/* Thin shafts from the gallery. */}
      <group ref={galleryGroupRef} name="wild-gallery-shafts" visible={false}>
        {gallery.beams.map((b) => (
          <mesh
            key={b.id}
            position={b.pos as unknown as [number, number, number]}
            quaternion={b.quat}
            geometry={b.geo}
            material={gallery.mat}
            renderOrder={4}
          />
        ))}
      </group>

      {/* Warm pools on the cobbles. */}
      <instancedMesh
        ref={poolsRef}
        args={[pools.geo, pools.mat, LIGHT_POOLS.length]}
        renderOrder={2}
        name="wild-light-pools"
        visible={false}
      />

      {/* Chimney plume: one continuous noise ribbon, doubled at an angle for body. */}
      <group
        ref={smokeGroupRef}
        name="wild-smoke"
        position={CHIMNEY.vent as unknown as [number, number, number]}
        visible={false}
      >
        <mesh geometry={smoke.geo} material={smoke.mat} renderOrder={3} />
        <mesh geometry={smoke.geo} material={smoke.mat} rotation={[0, Math.PI / 2.6, 0]} renderOrder={3} />
      </group>

      {/* Embers. */}
      <points
        ref={embersRef}
        geometry={embers.geo}
        material={embers.mat}
        renderOrder={6}
        frustumCulled={false}
        name="wild-embers"
        visible={false}
      />
    </>
  )
}
