'use client'

/**
 * Option A of the character A/B: the image-generated 2.5D Alwi as a lit
 * billboard in the same scene. Stepped walk-cycle playback tied to travel,
 * strain frames chosen by effort with hysteresis, per-frame fist anchors
 * from the generated art (the strings follow the drawn hands). Implements
 * the same handle contract as the 3D chibi so the Stage swaps freely.
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
import { useLoader } from '@react-three/fiber'
import {
  SPRITE_FRAMES,
  SPRITE_HOLD_I0,
  SPRITE_STAND_H,
  SPRITE_STRAIN_I0,
  SPRITE_WALK,
  type SpriteFrame,
} from '@/lib/labs/cloth-pull/sprite-manifest'
import type { ChibiHandle, ChibiProps } from './chibi'

const URLS = SPRITE_FRAMES.map((f) => `/labs/cloth-pull/sprites/${f.name}.webp`)

/** seconds per full stride at full cruise */
const STRIDE_S = 0.85
/* The art is true side profile, so a mirrored frame would face her left and
 * read as walking backwards. Contact-left and contact-right are the same
 * silhouette in profile, so one stride plays the 4 drawn phases TWICE rather
 * than 4 phases plus 4 mirrors. Stepping the phase 8 times and folding by the
 * frame count keeps the footfall cadence and STRIDE_S exactly as they were. */
const WALK_STEPS = 8
/** synthetic bob (the drawn sizes were too noisy to keep the baked bob) */
const BOB_FRAC = 0.013

export const SpriteChibi = forwardRef<ChibiHandle, ChibiProps>(
  function SpriteChibi({ position, heightPx, reduced, onReady }, ref) {
    const textures = useLoader(THREE.TextureLoader, URLS)
    useMemo(() => {
      for (const t of textures) {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
      }
    }, [textures])

    const mesh = useRef<THREE.Mesh>(null)
    const material = useRef<THREE.MeshStandardMaterial>(null)
    const depthMaterial = useMemo(() => {
      const m = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
      })
      m.alphaTest = 0.35
      return m
    }, [])

    const state = useRef({
      phase: 0,
      frame: -1,
      strainLevel: 0,
      fist: new THREE.Vector3(),
    })

    const [announcedReady, setAnnouncedReady] = useState(false)
    useEffect(() => {
      if (!announcedReady) {
        setAnnouncedReady(true)
        onReady?.()
      }
    }, [announcedReady, onReady])

    const applyFrame = useMemo(() => {
      const px = (f: SpriteFrame) => (heightPx / SPRITE_STAND_H) * f.h
      const pw = (f: SpriteFrame) => (heightPx / SPRITE_STAND_H) * f.w
      return (idx: number, bob: number) => {
        const st = state.current
        const f = SPRITE_FRAMES[idx]
        const m = mesh.current
        if (!m) return
        if (st.frame !== idx) {
          st.frame = idx
          const tex = textures[idx]
          if (material.current) {
            material.current.map = tex
            material.current.needsUpdate = true
          }
          depthMaterial.map = tex
          depthMaterial.needsUpdate = true
          m.scale.set(pw(f), px(f), 1)
        }
        // feet line at the group origin; frame centered horizontally
        m.position.set(position[0], position[1] + px(f) / 2 + bob, position[2])
        // fist anchor in GROUP-LOCAL px (getFist lifts it to world space)
        const ax = position[0] + (f.anchorX / f.w - 0.5) * pw(f)
        const ay = position[1] + px(f) - (f.anchorY / f.h) * px(f) + bob
        state.current.fist.set(ax, ay, position[2] + 6)
      }
    }, [textures, depthMaterial, heightPx, position])

    useImperativeHandle(
      ref,
      () => ({
        ready: true,
        get debugRate() {
          return state.current.phase
        },
        frame(dt: number, effort: number, speedN: number) {
          const st = state.current

          // strain selection with hysteresis
          const target =
            effort < 0.28 ? 0 : effort < 0.6 ? 1 : effort < 0.95 ? 2 : 3
          if (target > st.strainLevel) st.strainLevel = target
          else if (target < st.strainLevel) {
            const backEdge = [0, 0.2, 0.5, 0.85][st.strainLevel]
            if (effort < backEdge) st.strainLevel = target
          }

          // strain frames only when she is genuinely stopped by a pull —
          // transient effort spikes at cruise must not pop the strain face
          if (!reduced && st.strainLevel > 0 && speedN < 0.45 && effort > 0.4) {
            applyFrame(SPRITE_STRAIN_I0 + (st.strainLevel - 1), 0)
            return
          }
          if (reduced || speedN < 0.06) {
            // one drawn hold pose, breathed rather than cross-faded
            st.phase += dt * 0.45
            const breathe =
              Math.sin(st.phase * Math.PI * 2) * heightPx * 0.004
            applyFrame(SPRITE_HOLD_I0, breathe)
            return
          }

          st.phase += (dt * Math.max(0.25, speedN)) / STRIDE_S
          const walkIdx =
            Math.floor((st.phase % 1) * WALK_STEPS) % SPRITE_WALK.length
          const bob =
            Math.abs(Math.sin(st.phase * Math.PI * 2)) *
            heightPx *
            BOB_FRAC *
            Math.min(1, speedN + 0.3)
          applyFrame(walkIdx, bob)
        },
        getFist(out: THREE.Vector3) {
          out.copy(state.current.fist)
          // stored group-local; the parent group carries her stage x
          mesh.current?.parent?.localToWorld(out)
          return out
        },
      }),
      [applyFrame, heightPx, reduced]
    )

    return (
      <mesh
        ref={mesh}
        castShadow
        frustumCulled={false}
        customDepthMaterial={depthMaterial}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          ref={material}
          map={textures[0]}
          transparent
          alphaTest={0.35}
          roughness={0.9}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    )
  }
)
