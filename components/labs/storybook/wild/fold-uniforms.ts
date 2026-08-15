/**
 * WILD lane — how the FOLD-BIRTH reaches the GPU without costing a single draw call.
 *
 * The inn is merged by MATERIAL (12 draws). Hinging nine pieces on nine separate Object3Ds would
 * mean merging by (piece x material) instead and paying about thirty draws for the same picture,
 * so the fold does not live in the scene graph at all: every vertex carries a one-float `aFold`
 * tag naming its piece, and the solved pose of every piece rides in a small uniform array that
 * the material's vertex shader applies. The merge — and the draw count — is untouched.
 *
 * THE DELIBERATE FAILURE MODE. Slot 0 is the identity and an untagged mesh reads slot 0 (an
 * absent attribute is (0,0,0,1) in WebGL). So a plumbing mistake anywhere costs the FOLD, never
 * the building: the piece simply stands still at its rest pose.
 *
 * WHAT TRAVELS PER SLOT
 *   uFoldM  mat4  the world map for a rest-space position (sheared: it collapses plan depth)
 *   uFoldQ  vec4  the piece's TRUE paper rotation as a quaternion — normals ride this, because
 *                 the map's linear part shears and a sheared normal turns a wall inside out
 *   uFoldC  vec4  hinge origin xyz + crease-darkening amount
 *   uFoldH  vec4  rise axis xyz + 1 / crease falloff
 *
 * CREASE SHADING. While a piece is in flight its faces darken toward the hinge line — the valley
 * a real crease casts along itself. `1 - amount * exp(-|distance from the hinge plane| / fall)`,
 * multiplied into the albedo. `amount` is 0 at rest, so at the end of the curtain-up every pixel
 * is bit-identical to the building that shipped before this file existed.
 *
 * SHADOWS. Casting materials get a matching custom depth material with the same vertex map, or
 * the moon would lay the shadow of an erect inn across the courtyard while the inn is still flat.
 */
import * as THREE from 'three'

import { FOLD_CHUNKS, FOLD_SLOT_COUNT, foldSlot, type FoldPose } from './fold-birth'
import { RISE_CLIP_PLANES } from './rise-clip'

// ---------------------------------------------------------------------------------------------
// THE SHARED UNIFORMS — one object graph, referenced by every patched material
// ---------------------------------------------------------------------------------------------

const matrices: THREE.Matrix4[] = []
const quats: THREE.Vector4[] = []
const creases: THREE.Vector4[] = []
const hinges: THREE.Vector4[] = []

for (let i = 0; i < FOLD_SLOT_COUNT; i += 1) {
  matrices.push(new THREE.Matrix4())
  quats.push(new THREE.Vector4(0, 0, 0, 1))
  creases.push(new THREE.Vector4(0, 0, 0, 0))
  hinges.push(new THREE.Vector4(0, 1, 0, 1))
}
// Slot 0 stays the identity for the life of the page.
for (const c of FOLD_CHUNKS) {
  const s = foldSlot(c.name)
  creases[s].set(c.origin[0], c.origin[1], c.origin[2], 0)
  hinges[s].set(c.rise[0], c.rise[1], c.rise[2], 1 / c.creaseFalloff)
}

export const FOLD_UNIFORMS = {
  uFoldM: { value: matrices },
  uFoldQ: { value: quats },
  uFoldC: { value: creases },
  uFoldH: { value: hinges },
} as const

/**
 * Push a solved curtain-up into the uniforms. Called once per frame by the diorama root — the
 * single owner, so no two consumers can disagree about where a piece is.
 */
export function writeFoldPoses(poses: readonly FoldPose[]): void {
  for (const pose of poses) {
    matrices[pose.slot].fromArray(pose.matrix)
    quats[pose.slot].set(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3])
    creases[pose.slot].w = pose.crease
  }
}

/** The live world map of one slot, for the few pieces posed by a group instead of the shader. */
export function foldMatrix(slot: number): THREE.Matrix4 {
  return matrices[slot]
}

// ---------------------------------------------------------------------------------------------
// THE SHADER PATCH
// ---------------------------------------------------------------------------------------------

const N = FOLD_SLOT_COUNT

/** All a vertex program needs to MOVE with the fold: the tag and the maps. */
const FOLD_DECL_MOVE = /* glsl */ `
attribute float aFold;
uniform mat4 uFoldM[${N}];
`

/** What it additionally needs to LIGHT and SHADE correctly while folding. */
const FOLD_DECL_SHADE = /* glsl */ `
uniform vec4 uFoldQ[${N}];
uniform vec4 uFoldC[${N}];
uniform vec4 uFoldH[${N}];
vec3 wildFoldRotate( vec4 q, vec3 v ) {
  return v + 2.0 * cross( q.xyz, cross( q.xyz, v ) + q.w * v );
}
`

const FOLD_VERTEX_DECL = FOLD_DECL_MOVE + FOLD_DECL_SHADE

const FOLD_CREASE_DECL = /* glsl */ `
varying float vCrease;
`

const FOLD_NORMAL_BODY = /* glsl */ `
  int wildSlot = int( aFold + 0.5 );
  objectNormal = wildFoldRotate( uFoldQ[ wildSlot ], objectNormal );
  vec4 wildCrease = uFoldC[ wildSlot ];
  vec4 wildHinge = uFoldH[ wildSlot ];
  vCrease = 1.0 - wildCrease.w * exp( - abs( dot( position - wildCrease.xyz, wildHinge.xyz ) ) * wildHinge.w );
`

const FOLD_POSITION_BODY = /* glsl */ `
  transformed = ( uFoldM[ wildSlot ] * vec4( transformed, 1.0 ) ).xyz;
`

/** The depth pass has no normals and no crease, so it computes its own slot. */
const FOLD_DEPTH_BODY = /* glsl */ `
  int wildSlot = int( aFold + 0.5 );
  transformed = ( uFoldM[ wildSlot ] * vec4( transformed, 1.0 ) ).xyz;
`

function shareUniforms(shader: { uniforms: Record<string, THREE.IUniform> }): void {
  shader.uniforms.uFoldM = FOLD_UNIFORMS.uFoldM as unknown as THREE.IUniform
  shader.uniforms.uFoldQ = FOLD_UNIFORMS.uFoldQ as unknown as THREE.IUniform
  shader.uniforms.uFoldC = FOLD_UNIFORMS.uFoldC as unknown as THREE.IUniform
  shader.uniforms.uFoldH = FOLD_UNIFORMS.uFoldH as unknown as THREE.IUniform
}

/**
 * Teach one of the inn's materials to fold. Every material in the set gets this, whether or not
 * any of its geometry is tagged — a shared material must compile to ONE program, and an untagged
 * mesh folds by the identity anyway.
 */
export function applyFoldPatch<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shareUniforms(shader)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FOLD_VERTEX_DECL}${FOLD_CREASE_DECL}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${FOLD_NORMAL_BODY}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FOLD_POSITION_BODY}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FOLD_CREASE_DECL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vCrease;')
  }
  // Patched and unpatched variants must never share a program cache entry.
  material.customProgramCacheKey = () => 'wild-fold-v1'
  return material
}

/**
 * The matching depth material for a caster. Without it the moon keeps casting the REST pose's
 * shadow through the whole fold — a full inn's shadow on an empty courtyard.
 */
export function foldDepthMaterial(): THREE.MeshDepthMaterial {
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depth.clippingPlanes = RISE_CLIP_PLANES
  depth.clipShadows = true
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.uFoldM = FOLD_UNIFORMS.uFoldM as unknown as THREE.IUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FOLD_DECL_MOVE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FOLD_DEPTH_BODY}`)
  }
  depth.customProgramCacheKey = () => 'wild-fold-depth-v1'
  return depth
}

/**
 * The fold decl for hand-written shaders (the instanced windows). They own their whole vertex
 * program, so they splice these lines in themselves rather than being patched. Movement only —
 * the panes are emissive glass and take no crease.
 */
export const FOLD_GLSL_MOVE = FOLD_DECL_MOVE

/** The uniform entries a hand-written ShaderMaterial has to carry to use FOLD_GLSL_MOVE. */
export function foldMoveUniforms(): Record<string, THREE.IUniform> {
  return { uFoldM: FOLD_UNIFORMS.uFoldM as unknown as THREE.IUniform }
}
