'use client'

/**
 * The chibi walker: rigged GLB, clips found by name — "walk"/"strain"/"hold"
 * when the authored set is present, any walking clip as the temporary
 * restage stand-in. Speed drives the stride rate, effort drives a
 * spring-damped FORWARD lean spread over the spine chain (she tows the
 * cloth), and the parent reads the fist-cluster anchor every frame to pin
 * the chain — no runtime IK.
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
const MODEL_HEIGHT = 0.9007
/** fallback anchor relative to the Hips bone, in body heights, used only
 * when a stand-in clip set without clasped hands is loaded */
const ANCHOR_BACK = 0.12
const ANCHOR_DOWN = 0.02

export interface ChibiHandle {
  /** advance mixer + overlays; call once per rendered frame, before getFist */
  frame(dt: number, effort: number, speedN: number): void
  /** world position of the fist-cluster anchor (chain pin), after frame() */
  getFist(out: THREE.Vector3): THREE.Vector3
  ready: boolean
  /** debug/e2e: current walk clip weight/rate */
  debugRate: number
}

export interface ChibiProps {
  /** world position of the feet */
  position: [number, number, number]
  /** desired character height in world px */
  heightPx: number
  /** extra yaw, radians, to face screen-right if the source faces elsewhere */
  yaw?: number
  reduced: boolean
  onReady?: () => void
}

export const Chibi = forwardRef<ChibiHandle, ChibiProps>(function Chibi(
  { position, heightPx, yaw = 0, reduced, onReady },
  ref
) {
  const { scene, animations } = useGLTF(CHIBI_URL)
  const group = useRef<THREE.Group>(null)
  const scale = heightPx / MODEL_HEIGHT

  const { mixer, walk, strain, hold, spineBones, hips, hand, hand2 } = useMemo(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true
        obj.frustumCulled = false
      }
    })
    const mx = new THREE.AnimationMixer(scene)
    const byName = (re: RegExp) =>
      animations.find((a) => re.test(a.name)) ?? null
    const walkClip = byName(/walk/i) ?? animations[0] ?? null
    const strainClip = byName(/strain/i)
    const holdClip = byName(/hold/i)
    const mk = (c: THREE.AnimationClip | null) => {
      if (!c) return null
      const a = mx.clipAction(c)
      a.setLoop(THREE.LoopRepeat, Infinity)
      a.play()
      return a
    }
    const spines = ['Spine', 'Spine01', 'Spine02']
      .map((n) => scene.getObjectByName(n))
      .filter((b): b is THREE.Object3D => Boolean(b))
    return {
      mixer: mx,
      walk: mk(walkClip),
      strain: mk(strainClip),
      hold: mk(holdClip),
      spineBones: spines,
      hips: scene.getObjectByName('Hips') ?? scene,
      hand: scene.getObjectByName('RightHand'),
      hand2: scene.getObjectByName('LeftHand'),
    }
  }, [scene, animations])

  /** true once the authored hands-behind-back clips are in the asset */
  const authored = strain !== null

  const lean = useRef({ x: 0, v: 0 })
  const strainWeight = useRef(0)
  const rate = useRef(1)
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
      get debugRate() {
        return rate.current
      },
      frame(dt: number, effort: number, speedN: number) {
        const C = CFG.chibi
        rate.current = C.rateMin + Math.min(1.2, speedN) * (C.rateMax - C.rateMin)
        const wantStrain = reduced ? 0 : Math.min(1, Math.max(0, effort - 0.15) * 1.6)
        strainWeight.current +=
          (wantStrain - strainWeight.current) * Math.min(1, dt / C.fade)

        if (walk) {
          walk.timeScale = reduced ? 0 : rate.current
          walk.setEffectiveWeight(
            (strain ? 1 - strainWeight.current : 1) * (hold && reduced ? 0 : 1)
          )
        }
        if (strain) strain.setEffectiveWeight(strainWeight.current)
        if (hold) hold.setEffectiveWeight(reduced ? 1 : 0)
        mixer.update(dt)

        // spring-damped FORWARD lean: she tows weight behind her
        const target = Math.min(1.2, effort) * C.leanMax
        const st = lean.current
        st.v += (C.leanK * (target - st.x) - C.leanDamp * st.v) * dt
        st.x += st.v * dt
        if (st.x > 0.0005 && spineBones.length) {
          for (let i = 0; i < spineBones.length; i++) {
            const bone = spineBones[i]
            const angle =
              -st.x * C.leanSpread[i] * (1 / spineBones.length) * 1.6
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
        if (authored && hand && hand2) {
          // hands are clasped behind the back — pin to the fist cluster
          hand.getWorldPosition(out)
          hand2.getWorldPosition(tmpAxis.current)
          return out.add(tmpAxis.current).multiplyScalar(0.5)
        }
        // stand-in clip set swings its arms — anchor to the tailbone instead
        hips.getWorldPosition(out)
        out.x -= ANCHOR_BACK * heightPx
        out.y -= ANCHOR_DOWN * heightPx
        return out
      },
    }),
    [mixer, walk, strain, hold, spineBones, hips, hand, hand2, authored, reduced, heightPx]
  )

  return (
    <group ref={group} position={position} scale={scale} rotation={[0, yaw, 0]}>
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
