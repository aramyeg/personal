/**
 * Era-renderer + turntable maths for the figure hero, extracted as pure
 * functions so the renderer law and the spin/pause rules are unit-testable
 * without a WebGL context (same pattern as `fit-model.ts`).
 *
 * The lab's renderer law (spec §2): fits render as PS-era unlit polygons —
 * point-sampled textures with no mip chain, no PBR/normal contribution, and no
 * material lights. "Lighting lives in the texture" (AO + folds + seams are baked
 * into each fit's atlas), so a fit's material must be **unlit** (MeshBasic, map
 * only) or the baked light would be double-shaded by the scene. The per-save
 * accent is delivered as atmosphere (backdrop + ground glow), never as lights —
 * which unlit materials would ignore anyway.
 */

import * as THREE from 'three'

/** One turntable revolution, seconds. Inside the spec's 24–32s window; slow
 *  enough to read as an imperceptible constant drift, fast enough that two
 *  shots a few seconds apart show the yaw has moved. */
export const TURNTABLE_SECONDS = 28

/** Constant angular velocity of the turntable, radians per second. */
export const SPIN_RATE = (Math.PI * 2) / TURNTABLE_SECONDS

/** Reduced-motion resting pose: a static three-quarter turn (~45°, π/4) — a true
 *  3/4 view that shows the fit's form on the no-spin path, no dead-front flatness. */
export const REDUCED_YAW = Math.PI / 4

/** Clamp on a single frame's delta so a resume after a pause (tab hidden,
 *  dialog open) advances animation by at most this, never a jarring jump. */
export const MAX_FRAME_DELTA = 0.1

/** Turntable yaw for a given elapsed time, wrapped into [0, 2π). Front-facing
 *  (0) at t=0; a constant-rate drift with no easing. */
export function spinAngle(elapsedSeconds: number): number {
  const a = (elapsedSeconds * SPIN_RATE) % (Math.PI * 2)
  return a < 0 ? a + Math.PI * 2 : a
}

/**
 * Whether the turntable should be advancing frames. It spins only under full
 * motion, with nothing covering the hero, and while the tab is visible — the
 * three pause conditions (reduced motion, an overlay dialog/route, a hidden
 * tab). Off-viewport is handled upstream by the canvas unmounting, so it is not
 * a parameter here.
 */
export function turntableRunning(opts: {
  reduced: boolean
  paused: boolean
  hidden: boolean
}): boolean {
  return !opts.reduced && !opts.paused && !opts.hidden
}

/** Point-sample a texture with no mip chain (era renderer law), then flag it for
 *  re-upload. Mutates the (loader-cache-owned) texture in place — every fit
 *  texture is the figure's alone, so pinning it to NearestFilter is safe. */
export function applyEraTexture(tex: THREE.Texture): void {
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
}

/**
 * Rebuild one source material as an unlit era material: the albedo map (kept by
 * reference — never cloned, so the GPU texture is shared, not re-uploaded) plus
 * the base colour and the alpha/side flags a cutout silhouette needs. Every PBR
 * channel (metalness, roughness, normal, env) is dropped, and tone-mapping is
 * disabled so the baked texture renders 1:1.
 */
export function toEraMaterial(src: THREE.Material): THREE.MeshBasicMaterial {
  const s = src as THREE.MeshStandardMaterial
  const era = new THREE.MeshBasicMaterial()
  era.name = s.name
  if (s.color) era.color.copy(s.color)
  if (s.map) {
    era.map = s.map
    applyEraTexture(s.map)
  }
  if (s.alphaMap) era.alphaMap = s.alphaMap
  era.transparent = s.transparent ?? false
  era.opacity = s.opacity ?? 1
  era.alphaTest = s.alphaTest ?? 0
  era.side = s.side ?? THREE.FrontSide
  era.vertexColors = s.vertexColors ?? false
  era.toneMapped = false
  return era
}

/**
 * Convert every mesh material in a loaded fit scene to its unlit era material,
 * in place, and return a `restore()` that puts the originals back and disposes
 * only the materials this pass created. The loaded scene + its original
 * materials/textures are loader-cache-owned; they are never disposed here
 * (StrictMode texture/material law — a cache-owned resource must survive the dev
 * double-mount). Skinned meshes are handled by the same path (MeshBasicMaterial
 * skins automatically on a SkinnedMesh).
 */
export function applyEraRenderer(scene: THREE.Object3D): () => void {
  const originals: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = []
  const created: THREE.Material[] = []

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.material) return
    originals.push([mesh, mesh.material])
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => {
        const era = toEraMaterial(m)
        created.push(era)
        return era
      })
    } else {
      const era = toEraMaterial(mesh.material)
      created.push(era)
      mesh.material = era
    }
  })

  return () => {
    for (const [mesh, material] of originals) mesh.material = material
    for (const material of created) material.dispose()
  }
}
