'use client'

/**
 * CrtVignette — the About act's CRT/console vignette.
 *
 * The console is the shipped `crt.glb` (meipal, CC BY 4.0), staged like a
 * product shot inside a `<VignetteCanvas>`: loaded once, measured, and fit to a
 * fixed world-height the same way the card rail fits its GLB. One instance — no
 * clones needed — so the loaded scene is rendered directly.
 *
 * The one twist over a plain GLB vignette: the screen is re-skinned. The GLB
 * bakes a photo into the screen mesh's emissive map; we find that material by
 * the presence of an `emissiveMap` (it's the only one that carries one — the
 * material's authored name is brittle) and point it at a `CanvasTexture` we
 * draw: an era terminal running the bio as a ticker. The original texture is
 * left untouched in the shared loader cache (the StrictMode disposal law — a
 * cache-owned texture must survive the dev double-mount), restored on unmount;
 * only the CanvasTexture we created is disposed.
 *
 * Motion is a slow line-cycle stepping the highlighted row, driven from
 * `useFrame` so it only runs while the stage's frameloop is live. Under reduced
 * motion the stage runs a demand loop that never advances `useFrame`, so the
 * screen is painted once (no active highlight) and a single repaint forced.
 */

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { fitToStage } from '../lib/fit-model'
import { createCrtScreen } from '../lib/crt-screen'

const SRC = '/labs/memory-card/models/crt.glb'

/** Look-dev-approved framing for this GLB (GATE 0). */
const FIT_HEIGHT = 2.1
const FLOOR_Y = 0
const BASE_YAW = -1.0

/** Seconds each ticker line stays highlighted before the scan advances. */
const CYCLE_SECONDS = 1.6
/** Emissive lift so the phosphor screen reads as a lit CRT, not a flat decal. */
const SCREEN_EMISSIVE_INTENSITY = 1.3

/**
 * World-space bounds via the union of every mesh's transformed geometry box.
 * `updateMatrixWorld(true)` up front so each mesh reports settled matrices —
 * the same guard the card rail and single-model vignette rely on. The CRT ships
 * no skinned meshes, so the plain mesh path covers it.
 */
function measureScene(scene: THREE.Object3D): THREE.Box3 {
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const tmp = new THREE.Box3()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      mesh.geometry.computeBoundingBox()
      if (mesh.geometry.boundingBox) {
        tmp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
        box.union(tmp)
      }
    }
  })
  return box
}

/**
 * The screen material is the sole one carrying an emissive map (the baked
 * photo). Found by that property, never by the authored material name — glTF
 * exporters mangle names and the plan's `.008` is not a contract.
 */
function findScreenMaterial(
  scene: THREE.Object3D
): THREE.MeshStandardMaterial | null {
  let found: THREE.MeshStandardMaterial | null = null
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial
      if (std?.emissiveMap) found = std
    }
  })
  return found
}

export type CrtVignetteProps = {
  /** Bio condensed to short caps ticker lines (drawn on the screen). */
  lines: string[]
  reduced: boolean
}

function CrtModel({ lines, reduced }: CrtVignetteProps) {
  const gltf = useLoader(GLTFLoader, SRC)
  const invalidate = useThree((s) => s.invalidate)

  const fit = useMemo(() => {
    const box = measureScene(gltf.scene)
    if (box.isEmpty())
      return { scale: 1, offset: [0, FLOOR_Y, 0] as [number, number, number] }
    return fitToStage(
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.max.y, box.max.z],
      FIT_HEIGHT,
      FLOOR_Y
    )
  }, [gltf.scene])

  const screen = useMemo(() => findScreenMaterial(gltf.scene), [gltf.scene])

  // The terminal texture: inherit the GLB's UV orientation from the original
  // map (calibrated against a screenshot, not assumed). Rebuilt if the lines or
  // target material change; disposed by the swap effect below.
  const crt = useMemo(
    () => createCrtScreen(lines, screen?.emissiveMap?.flipY ?? false),
    [lines, screen]
  )

  // Point the screen material at our terminal; restore the original map + its
  // emissive state on unmount, disposing only what we created. The original map
  // is never disposed — it belongs to the shared loader cache.
  useEffect(() => {
    if (!screen) return
    const original = {
      map: screen.emissiveMap,
      emissive: screen.emissive.clone(),
      intensity: screen.emissiveIntensity,
    }
    screen.emissiveMap = crt.texture
    screen.emissive.setRGB(1, 1, 1)
    screen.emissiveIntensity = SCREEN_EMISSIVE_INTENSITY
    screen.needsUpdate = true
    crt.draw(reduced ? -1 : 0)
    invalidate()
    return () => {
      screen.emissiveMap = original.map
      screen.emissive.copy(original.emissive)
      screen.emissiveIntensity = original.intensity
      screen.needsUpdate = true
      crt.dispose()
    }
  }, [screen, crt, reduced, invalidate])

  // Slow line-cycle. Idle under reduced motion (useFrame never advances on the
  // demand loop) — the static paint above stands.
  const acc = useRef(0)
  const active = useRef(0)
  useFrame((_, dt) => {
    if (reduced || lines.length === 0) return
    acc.current += dt
    if (acc.current >= CYCLE_SECONDS) {
      acc.current = 0
      active.current = (active.current + 1) % lines.length
      crt.draw(active.current)
    }
  })

  return (
    <group rotation-y={BASE_YAW}>
      <group scale={fit.scale} position={fit.offset}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  )
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { failed: boolean }

/**
 * Swallows a failed GLB load so the decorative vignette renders nothing (the
 * bio prose beside it carries every fact). No logging — three owns the console.
 */
class CrtErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function CrtVignette(props: CrtVignetteProps) {
  return (
    <CrtErrorBoundary>
      <Suspense fallback={null}>
        <CrtModel {...props} />
      </Suspense>
    </CrtErrorBoundary>
  )
}

export default CrtVignette
