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
 * read as walking backwards. That ruled out 4 phases plus 4 mirrors, and until
 * Task 04 the stride played the 4 drawn phases TWICE — the same four keys for
 * both halves of the stride, which is a hop rather than a walk because she
 * never leads with the other leg.
 *
 * All 8 Williams keys are now drawn (contact, down, passing, up on each leg),
 * so the fold below is the identity and every step of the stride shows its own
 * frame. WALK_STEPS is unchanged, so footfall cadence and STRIDE_S are exactly
 * what they were — this adds the missing half of the cycle, it does not
 * retime it. The fold is kept rather than dropped so the runtime survives a
 * manifest regenerated with fewer keys. */
const WALK_STEPS = 8
/** synthetic bob (the drawn sizes were too noisy to keep the baked bob) */
const BOB_FRAC = 0.013
/**
 * Follow time for the fist anchor, seconds.
 *
 * The frames sample a continuous hand path 8 times a stride; the drawn anchor
 * therefore JUMPS 20-30px at every frame change, and the strings are pinned to
 * it. A verlet chain reads a teleported pin as tension: the segments are 18px
 * long and the effort curve saturates at 6% segment stretch, so the walk cycle
 * was heaving on the cloth once per drawn frame — measured effort never fell
 * below 0.45 at cruise and she spent 41% of a quiet walk in a strain pose.
 * Following the anchor over ~3 frames restores the in-betweens the sprite
 * sheet cannot draw. Only the group-LOCAL offset is followed; her stage x is
 * fed through untouched, so the strings never lag her walk-in.
 */
const FIST_TAU = 0.05
/** a drawn pose has to hold long enough to be read as a pose. Below this the
 * strain gate chattered against the walk at ~5 Hz whenever effort hovered on
 * its threshold, which is what read as "the cycle is broken". */
const STRAIN_DWELL_S = 0.22

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
      /** walk-stride phase; advances in EVERY pose so the cycle is continuous
       * across a strain or a stop instead of resuming on a frozen foot */
      phase: 0,
      /** hold-pose breathing, its own clock (it used to share `phase` and
       * scrambled the stride every time she stood still) */
      breath: 0,
      frame: -1,
      /** the follower has to start ON the anchor, not at the origin */
      fistSeeded: false,
      strainLevel: 0,
      /** latched strain gate + seconds since it last flipped */
      strained: false,
      sinceSwitch: STRAIN_DWELL_S,
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
      // worldScale is the whole of her sizing: without it the strain frames
      // draw 15.7% smaller than the walk, and the 8 walk sheets — generated
      // separately, disagreeing about her head-to-body ratio by ~21% — pulse
      // frame to frame. See sprite-worldscale.mjs for the landmark it rests on.
      const k = (f: SpriteFrame) => (heightPx / SPRITE_STAND_H) * f.worldScale
      const px = (f: SpriteFrame) => k(f) * f.h
      const pw = (f: SpriteFrame) => k(f) * f.w
      // regX is the whole of her horizontal registration, in the same spirit:
      // every frame is cropped to its own ink bbox and that bbox is set by her
      // FEET, so centring on it slid her body sideways 0.065 of her height
      // across the cycle and ~0.09 whenever she changed pose group. The
      // pipeline measures where her body actually sits and bakes the offset
      // that lands every frame on the same spot. See sprite-bodyx.mjs.
      const rx = (f: SpriteFrame) => (heightPx / SPRITE_STAND_H) * f.regX
      // heightPx changed (a resize): the cached frame index would skip the
      // scale write and leave her at the old viewport's size
      state.current.frame = -1
      state.current.fistSeeded = false
      return (idx: number, bob: number, dt: number) => {
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
        // feet line at the group origin; frame registered on her BODY, so the
        // drawn figure lands in the same place whatever the crop did
        const cx = position[0] + rx(f)
        m.position.set(cx, position[1] + px(f) / 2 + bob, position[2])
        // fist anchor in GROUP-LOCAL px (getFist lifts it to world space),
        // followed rather than snapped — see FIST_TAU. It hangs off the frame
        // centre, so it rides the registration offset and stays on her hands.
        const ax = cx + (f.anchorX / f.w - 0.5) * pw(f)
        const ay = position[1] + px(f) - (f.anchorY / f.h) * px(f) + bob
        const fist = state.current.fist
        if (!state.current.fistSeeded) {
          state.current.fistSeeded = true
          fist.set(ax, ay, position[2] + 6)
          return
        }
        const a = 1 - Math.exp(-Math.max(0, dt) / FIST_TAU)
        fist.set(
          fist.x + (ax - fist.x) * a,
          fist.y + (ay - fist.y) * a,
          position[2] + 6
        )
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

          // the stride clock runs in every pose, so leaving a strain or a
          // stop re-enters the walk where the cycle had got to
          st.phase += (dt * Math.max(0.25, speedN)) / STRIDE_S
          st.sinceSwitch += dt

          // strain selection with hysteresis
          const target =
            effort < 0.28 ? 0 : effort < 0.6 ? 1 : effort < 0.95 ? 2 : 3
          if (target > st.strainLevel) st.strainLevel = target
          else if (target < st.strainLevel) {
            const backEdge = [0, 0.2, 0.5, 0.85][st.strainLevel]
            if (effort < backEdge) st.strainLevel = target
          }

          // Strain frames only when she is genuinely stopped by a pull.
          //
          // The old gate (effort > 0.4, speedN < 0.45) sat on a knife edge:
          // towing the cloth loads her permanently, so a quiet walk measures
          // effort ~0.7 and speedN ~0.64 on the page and only the speed term
          // held the strain face back. Any nudge crossed it. Measured on the
          // production build: a quiet walk never drops below speedN 0.35, a
          // real backward haul pins her at speedN 0 and effort 1.2 — so the
          // gate belongs between those, not between cruise and cruise.
          // Hysteretic (harder to start heaving than to keep heaving) and
          // held for STRAIN_DWELL_S so a wobble cannot flicker it.
          const wants =
            !reduced &&
            st.strainLevel > 0 &&
            (st.strained
              ? effort > 0.5 && speedN < 0.45
              : effort > 0.8 && speedN < 0.3)
          if (wants !== st.strained && st.sinceSwitch >= STRAIN_DWELL_S) {
            st.strained = wants
            st.sinceSwitch = 0
          }

          if (st.strained) {
            // the level can relax to 0 inside the dwell; keep her on the
            // gentlest strain frame rather than indexing off the group
            applyFrame(SPRITE_STRAIN_I0 + Math.max(1, st.strainLevel) - 1, 0, dt)
            return
          }
          if (reduced || speedN < 0.06) {
            // one drawn hold pose, breathed rather than cross-faded
            st.breath += dt * 0.45
            const breathe =
              Math.sin(st.breath * Math.PI * 2) * heightPx * 0.004
            applyFrame(SPRITE_HOLD_I0, breathe, dt)
            return
          }

          const walkIdx =
            Math.floor((st.phase % 1) * WALK_STEPS) % SPRITE_WALK.length
          const bob =
            Math.abs(Math.sin(st.phase * Math.PI * 2)) *
            heightPx *
            BOB_FRAC *
            Math.min(1, speedN + 0.3)
          applyFrame(walkIdx, bob, dt)
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
