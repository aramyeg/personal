'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PSXCanvas } from './scene/psx-pipeline'
import { Room } from './scene/room'
import {
  ANGLES,
  experienceReducer,
  initialState,
  type AngleId,
  type PanelId,
} from './scene/cameras'
import { hotspotById, hotspotsForAngle, type Hotspot } from './scene/hotspots'
import { Boot } from './boot'
import { createPS1Audio, type PS1Audio } from './audio'
import { MenuPanel } from './panels/menu-panel'
import { AboutPanel } from './panels/about-panel'
import { ProjectsPanel } from './panels/projects-panel'
import { SkillsPanel } from './panels/skills-panel'
import { ContactPanel } from './panels/contact-panel'
import { LabsPanel } from './panels/labs-panel'

type Hover = { id: string; label: string }

/**
 * The PSX world shell: boots it, drives the fixed-angle hard cuts, picks
 * hotspots by raycast, owns the Esc chain + keyboard a11y skeleton, renders
 * the real panels, and hangs the synth SFX off each dispatch call site.
 */
export function Ps1Experience() {
  const [state, dispatch] = useReducer(experienceReducer, initialState)
  // `null` until the media query is read on the client, so we never flash the
  // boot for a reduced-motion visitor (boot only mounts once we know it's off).
  const [reduced, setReduced] = useState<boolean | null>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduced(m)
    // Reduced motion skips the boot entirely: gate straight to the room.
    if (m) dispatch({ type: 'BOOT_DONE' })
  }, [])

  // Audio: created client-side only (it reads localStorage, so building it
  // during a server render would throw). Its own enabled() may already carry
  // a persisted 'on' from a previous visit — reconcile state.soundOn to match
  // once, here, rather than the reverse (which would immediately re-persist
  // 'off' and clobber the very preference we're trying to read).
  const audioRef = useRef<PS1Audio | null>(null)
  useEffect(() => {
    const audio = createPS1Audio()
    audioRef.current = audio
    if (audio.enabled() !== state.soundOn) dispatch({ type: 'TOGGLE_SOUND' })
    return () => audio.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: reconciles the initial soundOn once against the freshly-created audio's persisted state.
  }, [])

  // First user gesture anywhere unlocks the AudioContext (autoplay law).
  useEffect(() => {
    const onGesture = () => {
      audioRef.current?.resume()
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [])

  // Room tone runs exactly while booted and sound is on; toggling either off
  // kills it immediately.
  useEffect(() => {
    audioRef.current?.setRoomTone(state.booted && state.soundOn)
  }, [state.booted, state.soundOn])

  // The boot chime fires once, when the boot overlay actually starts (reduced
  // motion skips it) — never again, even if sound is toggled mid-boot.
  const bootChimedRef = useRef(false)
  useEffect(() => {
    if (reduced !== false || bootChimedRef.current) return
    bootChimedRef.current = true
    audioRef.current?.boot()
  }, [reduced])

  // Hover-enter blip: fires only when hover changes to a real hotspot, never
  // on hover-leave. Safe to key on the whole `hover` object — handleHover's
  // dedupe already only produces a new reference when the id actually changes.
  useEffect(() => {
    if (hover) audioRef.current?.blip()
  }, [hover])

  // A cut (or a panel open/close) can leave the old hover pointing at a hotspot
  // that is no longer under the cursor — drop it until the next pointer move.
  useEffect(() => {
    setHover(null)
  }, [state.angle, state.panel])

  // THE ESC LAW. Capture-phase window listener so it always beats GalleryChrome's
  // bubble-phase Esc handler: consume (preventDefault + dispatch) ONLY when a
  // panel is open; otherwise let the event through so the gallery navigates.
  // Arrow keys cut, but only while no panel holds the scene.
  const panelRef = useRef<PanelId>(state.panel)
  panelRef.current = state.panel
  const bootedRef = useRef(state.booted)
  bootedRef.current = state.booted
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panelRef.current !== null) {
          e.preventDefault()
          audioRef.current?.back()
          dispatch({ type: 'ESCAPE' })
        }
        return
      }
      // Arrows cut only once booted and with no panel holding the scene. The
      // boot gate matters: during the boot overlay an arrow should ONLY skip
      // the boot (Boot consumes it), never queue a cut.
      if (panelRef.current !== null || !bootedRef.current) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        audioRef.current?.blip()
        dispatch({ type: 'CUT', dir: -1 })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        audioRef.current?.blip()
        dispatch({ type: 'CUT', dir: 1 })
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const openPanel = useCallback((panel: Exclude<PanelId, null>) => {
    audioRef.current?.select()
    dispatch({ type: 'OPEN_PANEL', panel })
  }, [])

  const cutWithSound = useCallback((a: { type: 'CUT'; dir: 1 | -1 }) => {
    audioRef.current?.blip()
    dispatch(a)
  }, [])

  const toggleSound = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.setEnabled(!audio.enabled())
    dispatch({ type: 'TOGGLE_SOUND' })
  }, [])

  // Hover dedupe: pointer picking fires on every move, but the experience only
  // needs to re-render when the picked hotspot id changes. The functional
  // update returns the previous reference when the id is unchanged, so React
  // bails out of the render. Comparing against the live hover state (rather than
  // a private ref) keeps it in step with the cut/panel clear below — no stale
  // id can suppress a legitimate re-hover after an angle change.
  const handleHover = useCallback((next: Hover | null) => {
    setHover((prev) => ((prev?.id ?? null) === (next?.id ?? null) ? prev : next))
  }, [])

  const angleHotspots = hotspotsForAngle(state.angle)
  const showChip = hover !== null && state.panel === null
  const showControls = state.booted && state.panel === null

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-black"
      style={{ cursor: showChip ? 'pointer' : 'default' }}
    >
      <PSXCanvas>
        <FixedCamera angle={state.angle} />
        <Room staticFrame={reduced === true} />
        <ScenePointer onHover={handleHover} onPick={openPanel} />
        <HotspotPulse hoveredId={hover?.id ?? null} enabled={reduced === false} />
      </PSXCanvas>

      {/* Skip link — visible bottom-left (snowpark's affordance) and on focus;
          jumps to the crawlable content section that lands in Task 12. */}
      <a
        href="#content"
        className="fixed bottom-4 left-4 z-40 font-mono text-[11px] lowercase tracking-wide text-[#cfe9e6] opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#7de8e0]"
      >
        skip to the content
      </a>

      {/* Keyboard a11y skeleton: a visually-hidden button per hotspot in the
          current angle. Tab reaches them; Enter opens the same panel a click
          would. Mirrors hotspotsForAngle(state.angle). */}
      <nav aria-label="scene hotspots" className="sr-only">
        {angleHotspots.map((h: Hotspot) => (
          <button key={h.id} type="button" onClick={() => openPanel(h.panel)}>
            {h.label}
          </button>
        ))}
      </nav>

      {/* Angle label (dry lowercase). */}
      {state.booted && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 font-mono text-[11px] lowercase tracking-[0.25em] text-[#8fb0ac]">
          {ANGLES[state.angle].label}
        </div>
      )}

      {/* Sound toggle — HUD corner, persistent once booted. */}
      {state.booted && (
        <button
          type="button"
          onClick={toggleSound}
          className="fixed right-4 top-4 z-10 rounded-sm border border-[#3a5b57] bg-black/60 px-3 py-1.5 font-mono text-xs lowercase tracking-wide text-[#cfe9e6] outline-none transition-colors hover:bg-black/80 hover:text-white focus-visible:ring-2 focus-visible:ring-[#7de8e0]"
        >
          {state.soundOn ? 'sound: on' : 'sound: off'}
        </button>
      )}

      {/* Bottom-center hotspot hint (dry lowercase hotspot label). */}
      {showChip && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-sm border border-[#3a5b57] bg-black/70 px-3 py-1.5 font-mono text-xs lowercase tracking-wide text-[#e8f6f4]">
          {hover?.label}
        </div>
      )}

      {/* On-screen cuts — 44px hit areas for touch. */}
      {showControls && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-3">
          <CutButton dir={-1} label="previous angle" onCut={cutWithSound} />
          <CutButton dir={1} label="next angle" onCut={cutWithSound} />
        </div>
      )}

      {state.panel && (
        <PanelHost
          panel={state.panel}
          onClose={() => {
            audioRef.current?.back()
            dispatch({ type: 'CLOSE_PANEL' })
          }}
          onNavigate={openPanel}
        />
      )}

      {reduced === false && !state.booted && (
        <Boot onDone={() => dispatch({ type: 'BOOT_DONE' })} />
      )}
    </div>
  )
}

/** A single on-screen cut control (`‹` / `›`), min 44px touch target. */
function CutButton({
  dir,
  label,
  onCut,
}: {
  dir: 1 | -1
  label: string
  onCut: (a: { type: 'CUT'; dir: 1 | -1 }) => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onCut({ type: 'CUT', dir })}
      className="flex h-11 w-11 items-center justify-center rounded-sm border border-[#3a5b57] bg-black/60 font-mono text-lg leading-none text-[#cfe9e6] transition-colors hover:bg-black/80 hover:text-white"
    >
      {dir === -1 ? '‹' : '›'}
    </button>
  )
}

/**
 * Routes the open panel id to its real content panel. Each panel wraps itself in
 * PanelShell (the era chrome + focus trap); `menu` gets `onNavigate` so its list
 * dispatches OPEN_PANEL just like a hotspot click would.
 */
function PanelHost({
  panel,
  onClose,
  onNavigate,
}: {
  panel: Exclude<PanelId, null>
  onClose: () => void
  onNavigate: (panel: Exclude<PanelId, null>) => void
}) {
  switch (panel) {
    case 'menu':
      return <MenuPanel onClose={onClose} onNavigate={onNavigate} />
    case 'about':
      return <AboutPanel onClose={onClose} />
    case 'projects':
      return <ProjectsPanel onClose={onClose} />
    case 'skills':
      return <SkillsPanel onClose={onClose} />
    case 'contact':
      return <ContactPanel onClose={onClose} />
    case 'labs':
      return <LabsPanel onClose={onClose} />
  }
}

// ── r3f layer ───────────────────────────────────────────────────────────────

/** Snap the camera to a fixed angle — RE/FF7 hard cut, no tween. */
function FixedCamera({ angle }: { angle: AngleId }) {
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    const a = ANGLES[angle]
    camera.position.set(a.position[0], a.position[1], a.position[2])
    camera.lookAt(a.lookAt[0], a.lookAt[1], a.lookAt[2])
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = a.fov
      camera.updateProjectionMatrix()
    }
  }, [camera, angle])
  return null
}

/**
 * Raycast hotspot picking. One raycaster for the component's life (never rebuilt
 * per frame); listens on the canvas for pointer moves (→ hover) and clicks (→
 * open). A hit resolves to a hotspot via the mesh `name` the room builders set.
 */
function ScenePointer({
  onHover,
  onPick,
}: {
  onHover: (h: Hover | null) => void
  onPick: (panel: Exclude<PanelId, null>) => void
}) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)

  // Lazy-init: one raycaster + NDC vector for the component's life, without
  // constructing a throwaway on every render.
  const raycasterRef = useRef<THREE.Raycaster | null>(null)
  if (!raycasterRef.current) raycasterRef.current = new THREE.Raycaster()
  const raycaster = raycasterRef.current
  const ndcRef = useRef<THREE.Vector2 | null>(null)
  if (!ndcRef.current) ndcRef.current = new THREE.Vector2()
  const ndc = ndcRef.current
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    const el = gl.domElement

    const pick = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect()
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      for (const hit of hits) {
        const hs = hotspotById(hit.object.name)
        if (hs) return hs
      }
      return undefined
    }

    const onMove = (e: PointerEvent) => {
      const hs = pick(e.clientX, e.clientY)
      onHoverRef.current(hs ? { id: hs.id, label: hs.label } : null)
    }
    const onLeave = () => onHoverRef.current(null)
    const onClick = (e: MouseEvent) => {
      const hs = pick(e.clientX, e.clientY)
      if (hs) onPickRef.current(hs.panel)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('click', onClick)
    }
  }, [camera, scene, gl, raycaster, ndc])

  return null
}

/**
 * Hover pulse: lerp the hovered hotspot's material color toward white by up to
 * ±8% on a 1.2s sine — no outline/glow pass. The original color of every touched
 * material is stored on hover and copied back exactly on unhover/change/unmount,
 * so a shared material instance can never strand a tint on the room.
 */
function HotspotPulse({
  hoveredId,
  enabled,
}: {
  hoveredId: string | null
  enabled: boolean
}) {
  const scene = useThree((s) => s.scene)
  const activeRef = useRef<string | null>(null)
  const originalsRef = useRef(new Map<THREE.Material, THREE.Color>())
  // Lazy-init the shared white target so it isn't reconstructed each render.
  const whiteRef = useRef<THREE.Color | null>(null)
  if (!whiteRef.current) whiteRef.current = new THREE.Color('#ffffff')
  const white = whiteRef.current

  const restore = useCallback(() => {
    originalsRef.current.forEach((color, mat) => {
      ;(mat as THREE.MeshLambertMaterial).color.copy(color)
    })
    originalsRef.current.clear()
    activeRef.current = null
  }, [])

  // Never leave a tinted material behind when the pulse layer unmounts.
  useEffect(() => restore, [restore])

  useFrame((frameState) => {
    const target = enabled ? hoveredId : null
    if (target !== activeRef.current) {
      restore()
      if (target) {
        scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || o.name !== target) return
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) {
            const lm = m as THREE.MeshLambertMaterial
            if (lm.color && !originalsRef.current.has(m)) {
              originalsRef.current.set(m, lm.color.clone())
            }
          }
        })
        activeRef.current = target
      }
    }
    if (!activeRef.current) return
    const amt = 0.08 * (0.5 + 0.5 * Math.sin((frameState.clock.elapsedTime / 1.2) * Math.PI * 2))
    originalsRef.current.forEach((orig, mat) => {
      ;(mat as THREE.MeshLambertMaterial).color.copy(orig).lerp(white, amt)
    })
  })

  return null
}
