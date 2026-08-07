'use client'

/**
 * The chibi: meshopt-compressed rigged GLB with two Blender-baked clips
 * ("haul" tug-of-war stroke, "hold" breathing). Effort crossfades the clips,
 * scales the stroke rate, and drives a spring-damped lean overlay spread
 * over the spine chain. The rope is pinned to the RightHand bone — the
 * parent reads its world position every frame; there is no runtime IK.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { CFG } from '@/lib/labs/cloth-pull/config'

export const CHIBI_URL = '/labs/cloth-pull/chibi.glb'
/** measured from the exported GLB (bbox height in model units) */
const MODEL_HEIGHT = 0.8648

export interface ChibiHandle {
  /** advance mixer + overlays; call once per rendered frame, before getFist */
  frame(dt: number, effort: number, hauling: boolean): void
  /** world position of the leading fist (rope pin), after frame() */
  getFist(out: THREE.Vector3): THREE.Vector3
  ready: boolean
  /** debug/e2e: current haul clip weight */
  debugHaulWeight: number
}

export interface ChibiProps {
  /** world position of the feet */
  position: [number, number, number]
  /** desired character height in world px */
  heightPx: number
  reduced: boolean
  onReady?: () => void
}

export const Chibi = forwardRef<ChibiHandle, ChibiProps>(function Chibi(
  { position, heightPx, reduced, onReady },
  ref
) {
  const { scene, animations } = useGLTF(CHIBI_URL)
  const group = useRef<THREE.Group>(null)
  const scale = heightPx / MODEL_HEIGHT

  const { mixer, haul, hold, spineBones, fist } = useMemo(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true
        obj.frustumCulled = false
      }
    })
    const mx = new THREE.AnimationMixer(scene)
    const haulClip = THREE.AnimationClip.findByName(animations, 'haul')
    const holdClip = THREE.AnimationClip.findByName(animations, 'hold')
    const haulAction = haulClip ? mx.clipAction(haulClip) : null
    const holdAction = holdClip ? mx.clipAction(holdClip) : null
    for (const a of [haulAction, holdAction]) {
      if (a) {
        a.setLoop(THREE.LoopRepeat, Infinity)
        a.play()
      }
    }
    const spines = ['Spine', 'Spine01', 'Spine02']
      .map((n) => scene.getObjectByName(n))
      .filter((b): b is THREE.Object3D => Boolean(b))
    return {
      mixer: mx,
      haul: haulAction,
      hold: holdAction,
      spineBones: spines,
      fist: scene.getObjectByName('RightHand') ?? scene,
    }
  }, [scene, animations])

  const lean = useRef({ x: 0, v: 0 })
  const haulWeight = useRef(0)
  const tmpQ = useRef(new THREE.Quaternion())
  const tmpQ2 = useRef(new THREE.Quaternion())
  const tmpAxis = useRef(new THREE.Vector3())

  const [announcedReady, setAnnouncedReady] = useState(false)
  useEffect(() => {
    if (!announcedReady) {
      setAnnouncedReady(true)
      onReady?.()
    }
  }, [announcedReady, onReady])

  useImperativeHandle(
    ref,
    () => ({
      ready: true,
      get debugHaulWeight() {
        return haulWeight.current
      },
      frame(dt: number, effort: number, hauling: boolean) {
        const C = CFG.chibi
        const wantHaul = reduced ? 0 : hauling ? 1 : 0
        haulWeight.current +=
          (wantHaul - haulWeight.current) * Math.min(1, dt / C.fade)
        if (haul) {
          haul.setEffectiveWeight(haulWeight.current)
          haul.timeScale =
            C.rateMin + Math.min(1, effort) * (C.rateMax - C.rateMin)
        }
        if (hold) hold.setEffectiveWeight(1 - haulWeight.current)
        mixer.update(dt)

        // spring-damped lean overlay: the body overshoots its mark and settles
        const target = Math.min(1.2, effort) * C.leanMax
        const st = lean.current
        st.v += (C.leanK * (target - st.x) - C.leanDamp * st.v) * dt
        st.x += st.v * dt
        if (st.x > 0.0005 && spineBones.length) {
          for (let i = 0; i < spineBones.length; i++) {
            const bone = spineBones[i]
            const angle = st.x * C.leanSpread[i] * (1 / spineBones.length) * 1.6
            const parent = bone.parent
            if (!parent) continue
            parent.getWorldQuaternion(tmpQ.current)
            tmpAxis.current
              .set(0, 0, 1)
              .applyQuaternion(tmpQ.current.conjugate())
            tmpQ2.current.setFromAxisAngle(tmpAxis.current, angle)
            bone.quaternion.premultiply(tmpQ2.current)
          }
        }
      },
      getFist(out: THREE.Vector3) {
        return fist.getWorldPosition(out)
      },
    }),
    [mixer, haul, hold, spineBones, fist, reduced]
  )

  return (
    <group ref={group} position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  )
})

useGLTF.preload(CHIBI_URL)

/**
 * Instant placeholder while the GLB streams: the existing 14KB sprite on a
 * plane, same footprint, so the stage is never characterless.
 */
export function ChibiSprite({
  position,
  heightPx,
}: {
  position: [number, number, number]
  heightPx: number
}) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let live = true
    new THREE.TextureLoader().load('/labs/cloth-pull/chibi-sprite.webp', (t) => {
      if (!live) {
        t.dispose()
        return
      }
      t.colorSpace = THREE.SRGBColorSpace
      setTex(t)
    })
    return () => {
      live = false
    }
  }, [])
  if (!tex) return null
  const img = tex.image as { width: number; height: number }
  const w = heightPx * (img.width / img.height)
  return (
    <mesh position={[position[0], position[1] + heightPx / 2, position[2]]}>
      <planeGeometry args={[w, heightPx]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.35} />
    </mesh>
  )
}
