import * as THREE from 'three'
import { PSX } from './psx-constants'

type PSXOpts = { affine?: boolean; snap?: boolean }

/**
 * Patch a three.js material to render through a PSX rasterizer: NDC vertex
 * snapping (the geometry "wobble") and affine — non-perspective-correct — UV
 * mapping (the texture "warp"). Both default on. Mutates and returns the
 * material, with a customProgramCacheKey so each option combo compiles its own
 * program instead of colliding in three's shader cache.
 */
export function patchPSX<M extends THREE.Material>(mat: M, opts: PSXOpts = {}): M {
  const affine = opts.affine !== false
  const snap = opts.snap !== false
  mat.onBeforeCompile = (shader) => {
    if (snap) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        // PSX fixed-point rasterizer: snap NDC xy to a coarse grid
        {
          vec2 grid = vec2(${PSX.SNAP_W}.0, ${PSX.SNAP_H}.0);
          vec2 ndc = gl_Position.xy / gl_Position.w;
          gl_Position.xy = (floor(ndc * grid + 0.5) / grid) * gl_Position.w;
        }`
      )
    }
    if (affine) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vAffineW;')
        .replace(
          '#include <fog_vertex>',
          `#include <fog_vertex>
          vAffineW = gl_Position.w;
          #ifdef USE_MAP
            vMapUv *= gl_Position.w;
          #endif`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAffineW;')
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffineW );
            diffuseColor *= sampledDiffuseColor;
          #endif`
        )
    }
  }
  mat.customProgramCacheKey = () => `psx-${affine ? 'a' : ''}${snap ? 's' : ''}`
  return mat
}

/**
 * Build the lab's standard surface material: Lambert (per-vertex Gouraud
 * lighting, the closest built-in to PS1), never Standard/Physical, patched with
 * the PSX vertex-snap + affine-UV pipeline.
 */
export function makePSXMaterial(opts: {
  map?: THREE.Texture
  color?: string
  vertexColors?: boolean
  affine?: boolean
  snap?: boolean
}): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({
    map: opts.map ?? null,
    color: opts.color ?? '#ffffff',
    vertexColors: opts.vertexColors ?? false,
  })
  return patchPSX(mat, opts)
}
