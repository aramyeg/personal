'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { studioEnvIntensity, studioLightsFor } from '../desk-studio'
import { requestPrecompile } from '../precompile'
import { studioEnvFor, studioEquirectShared } from '../studio-env'
import type { JourneyRef } from '../use-journey'
import { DESK_GLB_URL, type DeskMeshName } from './desk-glb-contract'
import { nudgeNormalChunk, nudgeVertexChunk, type NudgeChunk } from './desk-nudge'
import {
  BIRD_LIFT_FRAGMENT_BODY,
  BIRD_LIFT_FRAGMENT_DECL,
  BIRD_LIFT_VERTEX_BODY,
  BIRD_LIFT_VERTEX_DECL,
  BIRD_UNIFORM,
  BIRD_VERTEX_BODY,
  BIRD_VERTEX_DECL,
  BIRD_WRAPPER,
  BOOK_UNIFORM,
  BOOK_VERTEX_BODY,
  BOOK_VERTEX_DECL,
  VERSO_VERTEX_BODY,
  VERSO_VERTEX_DECL,
  STIR_FRAGMENT_BODY,
  STIR_FRAGMENT_DECL,
  STIR_UNIFORM,
  STIR_VERTEX_BODY,
  STIR_VERTEX_DECL,
  WATER_FRAGMENT_BODY,
  WATER_FRAGMENT_DECL,
  WATER_UNIFORM,
  WATER_VERTEX_BODY,
  WATER_VERTEX_DECL,
  deepClipMail,
} from './desk-deep'
import {
  STATION_METAL_BODY,
  STATION_METAL_DECL,
  STATION_METAL_NORMAL_BODY,
  STATION_UNIFORMS,
  STATION_VERTEX_BODY,
  STATION_VERTEX_DECL,
} from './desk-station'

/**
 * THE NUDGE HOOK-UP (Task 89). Each baked material carries the vertex-shader block that lets the
 * pointer move "its" props — a rest-position box select and that object's OWN field: a rigid rock,
 * the donut's jelly squash, the pens' rim-lever rattle, the bird's neck bend. Boxes, pivots and
 * field constants are compile-time literals; only per-frame scalars cross as uniforms (see
 * `desk-nudge.ts` for the law and `DESK_NUDGE_ZONES` for the no-tear derivation). Behind
 * exact-zero guards the rest path is the untouched path, so a pointerless frame is bit-identical
 * to a build without the feature; the chunks are static strings, so no cache key changes per
 * frame and no second program is compiled.
 */
function wireNudge(
  shader: { uniforms: Record<string, unknown>; vertexShader: string },
  chunk: NudgeChunk
): void {
  for (const [name, u] of Object.entries(chunk.uniforms)) shader.uniforms[name] = u
  shader.vertexShader = (chunk.decl + '\n' + shader.vertexShader).replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n' + chunk.body
  )
}

/**
 * THE BAKED DESK, AS IT REACHES THE SCREEN (Task 68).
 *
 * `desk-glb-contract.ts` says what is in the file and why; this is only how it is loaded, shaded
 * and driven. Four meshes, four draw calls, and two numbers written per frame — and only on the
 * frames where they have changed, which during the whole journey is none of them.
 *
 * ============================================================================
 * WHY IT DOES NOT USE `useGLTF`
 * ============================================================================
 * drei's `useGLTF` loads through three's DefaultLoadingManager, and the lab's loader gate watches
 * exactly that manager (`loader/load-signal.tsx` bridges `useProgress` to the DOM planet loader).
 * Loading the desk through it would put 1.2 MB of studio between the visitor and the first frame of
 * a journey whose ending is 1600vh of scrolling away — the loader would sit on a spinner waiting
 * for furniture. So this loads through its OWN LoadingManager, which is not a preference but the
 * mechanism: a manager the gate does not watch cannot delay the gate, and no future edit to the
 * loading screen can accidentally start watching it.
 *
 * ============================================================================
 * WHAT SHOWS BEFORE IT ARRIVES
 * ============================================================================
 * Nothing, and that is the honest answer rather than the convenient one. The alternatives were a
 * fade-in (an event the eye can catch, competing with the pull-back — the objection `desk-set.tsx`
 * has made since Task 65) and holding the old procedural set (which would mean keeping every
 * builder this round retired, to serve a case that ends the moment the file lands). The desk is
 * parked outside the journey camera's frustum, so a mesh that appears while the visitor is anywhere
 * in the six chapters appears where nobody can see it; the only case with a visible seam is a
 * connection slow enough that 1.2 MB has not arrived after 1600vh of scrolling, and then the ending
 * shows the world on its stand against the studio backdrop with no desk under it. That is a bare
 * frame, not a broken one, and it is worth more than a permanent second copy of the set.
 */

/**
 * What one load yields, and why the two atlases are captured HERE rather than read where they are
 * used.
 *
 * The scene Group is cached for the lifetime of the tab — one request, however many times the lab
 * is mounted. That cache is what made reading `surface.material.map` at build time a bug: this
 * component REPLACES `surface.material` with its own MeshBasicMaterial, which has no `emissiveMap`
 * property at all, so a SECOND mount read the maps off the material the FIRST mount installed and
 * got undefined for the dim atlas. The slab and the pad then sampled an empty texture through the
 * whole dim end of the pull-back and rendered black — reachable by ordinary SPA navigation
 * (gallery to lab to gallery to lab), and invisible to this round's captures because r3f's Canvas
 * root does not inherit Next's reactStrictMode.
 *
 * Capturing them once, off the glTF's own material, makes the second mount identical to the first
 * by construction rather than by the first mount having been careful.
 */
export type DeskAssets = {
  scene: THREE.Group
  lit: THREE.Texture | null
  dim: THREE.Texture | null
  /** The spliced set-piece clips (Task 92): `WaterAction` today, `BirdAction` beside it. */
  animations: THREE.AnimationClip[]
}

/** One manager, one request, shared by every mount — and NOT the default one. See the header. */
const manager = new THREE.LoadingManager()
let pending: Promise<DeskAssets> | null = null

function loadDeskScene(): Promise<DeskAssets> {
  pending ??= new Promise<DeskAssets>((resolve, reject) => {
    new GLTFLoader(manager).load(
      DESK_GLB_URL,
      (gltf) => {
        const surface = findMesh(gltf.scene, 'DeskSurface')
        const src = surface?.material as THREE.MeshStandardMaterial | undefined
        resolve({
          scene: gltf.scene,
          lit: src?.map ?? null,
          dim: src?.emissiveMap ?? null,
          animations: gltf.animations,
        })
      },
      undefined,
      reject
    )
  })
  return pending
}

/** The GLB's meshes and its two atlases once they have arrived, or null. Never suspends, never
 *  throws into the tree: a failed desk leaves the ending bare rather than taking the canvas down. */
export function useDeskAssets(): DeskAssets | null {
  const [assets, setAssets] = useState<DeskAssets | null>(null)
  useEffect(() => {
    let live = true
    loadDeskScene().then(
      (a) => {
        if (live) setAssets(a)
      },
      () => {}
    )
    return () => {
      live = false
    }
  }, [])
  // The desk's materials arrive AFTER the scene's mount-time shader precompile
  // (own manager, own schedule) — announce them once their meshes have
  // committed, so the ending's first-draw stall is eaten off-screen too (T96).
  useEffect(() => {
    if (assets) requestPrecompile()
  }, [assets])
  return assets
}

function findMesh(root: THREE.Object3D, name: DeskMeshName): THREE.Mesh | null {
  let found: THREE.Mesh | null = null
  root.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh && o.name.startsWith(name)) found = o as THREE.Mesh
  })
  return found
}

/**
 * THE CROSSFADE, injected rather than reimplemented.
 *
 * Both matte materials are `MeshBasicMaterial` — unlit, which is the cleanest scoping there is for
 * this round's one lighting rule: a material with no light input cannot be reached by any light,
 * so nothing added to this ending can change how the clay world is shaded, by construction rather
 * than by care. What they need on top of that is a second source and a mix, and `onBeforeCompile`
 * adds exactly that while leaving three's own colour-space handling in place. Writing a raw
 * `ShaderMaterial` instead would mean re-deriving the sRGB decode of every input by hand, which is
 * the kind of thing that is wrong by a gamma and looks nearly right.
 *
 * `customProgramCacheKey` is not decoration: three caches compiled programs across materials with
 * the same signature, and two `MeshBasicMaterial`s patched differently have the same signature.
 * Without a distinct key the second one silently gets the first one's program.
 */

/** The slab and the pad: two baked atlases, mixed. The dim one rides in the emissive slot (see
 *  `desk-glb-contract.ts`), so it is pulled off the loaded material rather than fetched again. */
/** Exported for `desk-glb-remount.test.ts`, which drives THIS function rather than a local copy
 *  of it — see that file for why its first version proved nothing. */
export function surfaceMaterial(
  litMap: THREE.Texture | null,
  dimMap: THREE.Texture | null,
  lights: { value: number }
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ map: litMap, toneMapped: false })
  const dim = { value: dimMap }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    shader.uniforms.uDimMap = dim
    shader.fragmentShader = ('uniform float uLights;\nuniform sampler2D uDimMap;\n' + shader.fragmentShader)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         diffuseColor.rgb = mix( texture2D( uDimMap, vMapUv ).rgb, diffuseColor.rgb, uLights );`
      )
  }
  mat.customProgramCacheKey = () => 'sw-desk-surface'
  return mat
}

/** Every matte prop: two vertex-colour sets, mixed. glTF's COLOR_1 arrives as the `color_1`
 *  attribute (three lower-cases any attribute it has no name for), which is why the varying below
 *  can be declared against it directly. */
export function bakedMaterial(lights: { value: number }): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  const nudge = nudgeVertexChunk('DeskBaked')
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    // The notebook's cover hinge (Task 92): the slab's shipped bytes stay in this mesh and the
    // open is a weighted spine rotation, guarded to exact zero like every nudge field.
    shader.uniforms.uBookHinge = BOOK_UNIFORM
    // ...and the plant's answer to the watering (Task 92): leaf perk + soil drink, gl_VertexID
    // range selects over the same shipped bytes, guarded to exact zero the same way.
    shader.uniforms.uWater = WATER_UNIFORM
    // ...and the bird swap's lane-hide (Task 92): while the skinned twin performs, the baked
    // lane collapses to a point — an index-range select, because the pad's lanes interleave
    // diagonally and no box can cut this one free.
    shader.uniforms.uBird = BIRD_UNIFORM
    // ...and the sculpting station's five voices (T97 S2/S3): the same id-range discipline as
    // the lane-hide, seven uniforms, every one exact-zero guarded.
    for (const [name, u] of Object.entries(STATION_UNIFORMS)) shader.uniforms[name] = u
    shader.vertexShader = (
      STATION_VERTEX_DECL +
      '\n' +
      BIRD_VERTEX_DECL +
      '\n' +
      BOOK_VERTEX_DECL +
      '\n' +
      WATER_VERTEX_DECL +
      '\nattribute vec4 color_1;\nvarying vec3 vDimColor;\n' +
      shader.vertexShader
    ).replace('#include <color_vertex>', '#include <color_vertex>\n vDimColor = color_1.rgb;')
    // unlit, so only positions move — there is no normal for the nudge to keep honest here: the
    // shading is baked into vertex colours, which travel with the vertices by construction
    wireNudge(shader, nudge)
    // STATION runs FIRST after begin_vertex — before BIRD's lane-hide overwrite — so a lane that
    // is mid-roll stays hidden even if its hover shiver is still settling: the scoot moves the
    // lane's vertices, then the hide collapses them to the point regardless.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n' +
        STATION_VERTEX_BODY +
        '\n' +
        BIRD_VERTEX_BODY +
        '\n' +
        BOOK_VERTEX_BODY +
        '\n' +
        WATER_VERTEX_BODY
    )
    shader.fragmentShader = (
      'uniform float uLights;\nvarying vec3 vDimColor;\n' +
      WATER_FRAGMENT_DECL +
      '\n' +
      shader.fragmentShader
    ).replace(
      '#include <color_fragment>',
      'diffuseColor.rgb *= mix( vDimColor, vColor.rgb, uLights );\n' + WATER_FRAGMENT_BODY
    )
  }
  mat.customProgramCacheKey = () => 'sw-desk-baked'
  return mat
}

/**
 * THE WATERING CAN (Task 92) — a real new prop, the first since the desk was baked, so it plays
 * by the bake's rules: two colour sets Cycles-baked in situ (behind the pot, frame 1 of the pour
 * clip), mixed exactly as every other matte prop. Its own mesh because it MOVES — the pour clip
 * drives its node. DoubleSide because the export ships it so and the spout's bore is visible at
 * the tilt. No nudge, no hinge: the can's only verb is the pour.
 */
export function canMaterial(lights: { value: number }): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    shader.vertexShader = ('attribute vec4 color_1;\nvarying vec3 vDimColor;\n' + shader.vertexShader).replace(
      '#include <color_vertex>',
      '#include <color_vertex>\n vDimColor = color_1.rgb;'
    )
    shader.fragmentShader = ('uniform float uLights;\nvarying vec3 vDimColor;\n' + shader.fragmentShader).replace(
      '#include <color_fragment>',
      'diffuseColor.rgb *= mix( vDimColor, vColor.rgb, uLights );'
    )
  }
  mat.customProgramCacheKey = () => 'sw-desk-can'
  return mat
}

/**
 * THE BIRD'S TWIN (Task 92) — the skinned duplicate of the clay lane that performs the deep
 * tier's centrepiece. Same two-set bake mix as every matte prop (its colours were TRANSFERRED
 * from the shipped lane's own baked bytes at splice time, so rest frame 1 is the lane,
 * bit-for-bit); `MeshBasicMaterial`, because the family is unlit and the export deliberately
 * ships no normals (dead wire bytes under a bake). Skinning and the morph target are enabled by
 * three automatically off the mesh and geometry — nothing to declare here. FrontSide: the lane
 * is a closed swept tube (0 boundary edges, measured) and stays one through the whole clip.
 */
export function birdMaterial(lights: { value: number }): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    shader.vertexShader = (
      BIRD_LIFT_VERTEX_DECL +
      '\nattribute vec4 color_1;\nvarying vec3 vDimColor;\n' +
      shader.vertexShader
    )
      .replace('#include <color_vertex>', '#include <color_vertex>\n vDimColor = color_1.rgb;')
      // The shadow-floor lift's weight (T97 P6) is measured HERE, after <skinning_vertex>: at that
      // point `transformed` holds the fully morphed+skinned position while `position` still holds
      // the rest attribute, so the difference is exactly how far the roll has moved this vertex —
      // and at the rest pose it is the 3e-8 skinning residual, which the smoothstep floors to +0.
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n' + BIRD_LIFT_VERTEX_BODY)
    shader.fragmentShader = (
      'uniform float uLights;\nvarying vec3 vDimColor;\n' +
      BIRD_LIFT_FRAGMENT_DECL +
      '\n' +
      shader.fragmentShader
    ).replace(
      '#include <color_fragment>',
      // The lift operates on the final mixed lit/dim colour — the same value the seam gate sees.
      'diffuseColor.rgb *= mix( vDimColor, vColor.rgb, uLights );\n' + BIRD_LIFT_FRAGMENT_BODY
    )
  }
  mat.customProgramCacheKey = () => 'sw-desk-bird'
  return mat
}

/**
 * The seven beads: flat water-blue, unlit, UNBAKED — they exist only mid-pour (authored scale 0
 * at rest) and a baked studio gradient pinned to a flying bead is wrong everywhere except the
 * frame it was baked in. One shared material; visibility is gated by the frame loop so a resting
 * desk spends zero draws on them.
 */
export function dropMaterial(): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.7, 0.86), toneMapped: false })
  mat.customProgramCacheKey = () => 'sw-desk-drop'
  return mat
}

/**
 * THE VERSO (Task 92) — the paper glued to the notebook cover's underside, with the pencil sketch
 * of the two souvenirs. Its own small mesh, because it MOVES as a rigid body (the component
 * rotates the object about the spine axis by the same angle the cover's shader chunk reads —
 * `BOOK_UNIFORM`, one writer). Same two-set bake mix as everything matte; deliberately NO nudge
 * and NO hinge chunk — a shader hinge on top of the object rotation would open the book twice.
 */
export function versoMaterial(lights: { value: number }): THREE.MeshBasicMaterial {
  // DoubleSide, deliberately: paper is visible from both faces, and during the opening spring's
  // brief overshoot past ~112° the camera catches the sheet's back — single-sided that was a
  // black flash (first capture round), double-sided it is the drawing seen through thin paper.
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    // The verso opens IN THE SHADER, with the cover's exact field (see VERSO_VERTEX_BODY for why
    // the first, rigid-object version was wrong).
    shader.uniforms.uBookHinge = BOOK_UNIFORM
    shader.vertexShader = (
      VERSO_VERTEX_DECL +
      '\nattribute vec4 color_1;\nvarying vec3 vDimColor;\n' +
      shader.vertexShader
    )
      .replace('#include <color_vertex>', '#include <color_vertex>\n vDimColor = color_1.rgb;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERSO_VERTEX_BODY)
    shader.fragmentShader = ('uniform float uLights;\nvarying vec3 vDimColor;\n' + shader.fragmentShader).replace(
      '#include <color_fragment>',
      'diffuseColor.rgb *= mix( vDimColor, vColor.rgb, uLights );'
    )
  }
  mat.customProgramCacheKey = () => 'sw-desk-verso'
  return mat
}

/**
 * THE DONUT GLAZE — the one dielectric that could not be baked (Task 71).
 *
 * ============================================================================
 * WHY IT IS NOT IN THE MATTE MESH
 * ============================================================================
 * The studio's material discipline has a 0.28 roughness floor and exactly one object below it: the
 * glaze, at roughness 0.12 under a 0.30 coat. That exception was granted deliberately — the matte
 * rule is for studio props, and food reads appetizing through sheen — and it is what makes the
 * glaze unbakeable for the same reason the rose gold is. A bake stores one colour per vertex, i.e.
 * a view-INDEPENDENT surface, and a sheen is a fact about where the viewer is standing. Baked, the
 * highlight is written into every vertex whose normal happens to face the key, which is a surface
 * with a bright patch in the wrong place and no dark side — the cradle ring's failure, one round on.
 *
 * So the glaze is DECOMPOSED, exactly as the round before decomposed the metals. Cycles bakes its
 * DIFFUSE (t71_bake.py) into the same two colour sets everything else carries, and the specular is
 * added here as a reflection of the same generated studio.
 *
 * ============================================================================
 * WHY THE REFLECTION IS SAMPLED BY HAND
 * ============================================================================
 * Not for control — because three's own path does not exist for this material. `envmap_fragment` in
 * three 0.185 resolves an environment colour under `#ifdef ENVMAP_TYPE_CUBE` and under no other
 * branch, so the PMREM texture the metals use (`CubeUVReflectionMapping`) assigned to a
 * `MeshBasicMaterial`'s `envMap` compiles cleanly, sets `USE_ENVMAP`, runs every frame and
 * contributes nothing at all. This is read out of the shipped chunk, not assumed.
 *
 * The alternative — `MeshStandardMaterial`, where PMREM works — would light the glaze twice: its
 * environment contributes DIFFUSE irradiance as well as specular, and the diffuse is already in the
 * bake. So the material stays unlit and the specular is one explicit term, sampled out of
 * `studioEquirectShared()` with three's own `equirectUv` arithmetic so it is the same room the
 * metals reflect.
 *
 * The clay-scoping law is untouched and still structural: this is a texture on ONE material,
 * `scene.environment` is never assigned anywhere in the lab, and `MeshToonMaterial` has no
 * environment input to reach even if it were.
 */

/** Fresnel at normal incidence for a clear coat at IOR 1.5 — the physical value, not a dial. */
const GLAZE_F0 = 0.04

/**
 * THE SHAPE OF THE REFLECTION, and why it is not simply the room as the metals see it.
 *
 * `studio-env.ts` is a room, not a set of lights: it runs from a floor at linear 0.33 to a softbox
 * core at 4.05, because that range is what a metal at roughness 0.33 needs — PMREM blurs it, and
 * what the ring reads off it is the room's general LEVEL. A surface at roughness 0.12 does not read
 * a level; it reads the LIGHTS. In the reference render the glaze's brightest pixel is 0.676 against
 * a mean of 0.149, which is Cycles showing a 78,000 W softbox through AgX; four percent of an
 * environment whose ceiling is 4.05 tops out at 0.16, so no amount of level can put that highlight
 * on the glaze — raising it just makes the whole surface paler.
 *
 * That was measured before it was believed. Levelling alone, the sweep ran mean +2.8% at 43% of the
 * reference's variation, and reaching the reference's variation cost +85% mean and a failed chroma.
 * A level cannot fix a shape — the same sentence `studio-env.ts` had to learn one round ago, from
 * the opposite side.
 *
 * So the sample is EXPANDED before it is levelled: raising the room to a power stretches the
 * distance between the softbox core and the room around it, which is exactly what makes a specular
 * band a band. It is scoped to this one material, so nothing the metals or the clay see moves.
 */
const GLAZE_ENV_GAMMA = 2.0

/**
 * ...and then the level — which is PER SURFACE, because one number could not serve both.
 *
 * This material draws two dark liquids, and solved separately against the reference they want levels
 * a factor of 2.1 apart: the glaze 1.34, the coffee 2.80. Forced to share, both land about 17% out.
 * The reason is not slack in the tuning. The glaze is curved and catches the softbox out of the room
 * proper; the coffee is a flat disc at the bottom of a mug, and most of what the reference shows in
 * it is a reflection of the mug's own brightly lit inner wall — which a single global room does not
 * contain at any level.
 *
 * So this constant is the LARGEST of the two, and each vertex carries its own share of it in
 * COLOR_1's alpha, which the dim bake leaves at a constant 1.0 and nothing else reads
 * (`t71_export.py`, `GLOSS_LEVEL`). One material, one draw call, no extra bytes — COLOR_1 was
 * already VEC4 — and each surface solved from its own measurement, which is the standing lesson of
 * the round before this one.
 */
const GLAZE_ENV = 2.8

export function glossMaterial(
  env: THREE.Texture,
  lights: { value: number },
  gloss: { value: number }
): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  const nudge = nudgeVertexChunk('DeskGloss', 'swNrm')
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLights = lights
    shader.uniforms.uGloss = gloss
    shader.uniforms.uGlossEnv = { value: env }
    // The coffee stir (Task 92): the liquid disc lives in THIS mesh, so its vortex dip rides the
    // same chain as the nudge — after `swNrm` is born, guarded behind its own exact zero.
    shader.uniforms.uStir = STIR_UNIFORM
    for (const [name, u] of Object.entries(nudge.uniforms)) shader.uniforms[name] = u
    shader.vertexShader = (
      nudge.decl +
      '\n' +
      STIR_VERTEX_DECL +
      '\nattribute vec4 color_1;\nvarying vec4 vDimColor;\nvarying vec3 vGlossN;\nvarying vec3 vGlossW;\n' +
      shader.vertexShader
    )
      .replace('#include <color_vertex>', '#include <color_vertex>\n vDimColor = color_1;')
      // The icing rocks with the donut, and its SHEEN has to rock too: `swNrm` is the normal the
      // nudge may have rotated, and the reflection reads it instead of the rest-pose attribute —
      // a highlight that stayed pinned while the glaze tipped would un-sell the whole motion.
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vec3 swNrm = normal;\n' + nudge.body + '\n' + STIR_VERTEX_BODY
      )
      .replace(
        '#include <project_vertex>',
        `vGlossN = normalize( mat3( modelMatrix ) * swNrm );
         vGlossW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
         #include <project_vertex>`
      )
    shader.fragmentShader = (
      'uniform float uLights;\nuniform float uGloss;\nuniform sampler2D uGlossEnv;\n' +
      STIR_FRAGMENT_DECL +
      '\nvarying vec4 vDimColor;\nvarying vec3 vGlossN;\nvarying vec3 vGlossW;\n' +
      shader.fragmentShader
    )
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix( vDimColor.rgb, vColor.rgb, uLights );')
      // The cream spiral inserts FIRST so the sheen's replace below finds the one remaining
      // `opaque_fragment` token — both terms are additive, so their order carries no meaning.
      .replace('#include <opaque_fragment>', STIR_FRAGMENT_BODY + '\n#include <opaque_fragment>')
      .replace(
        '#include <opaque_fragment>',
        `vec3 gN = normalize( vGlossN );
         vec3 gV = normalize( vGlossW - cameraPosition );
         vec3 gR = reflect( gV, gN );
         // three's own equirectUv, so this samples the room PMREM builds the metals' from
         vec2 gUv = vec2( atan( gR.z, gR.x ) * 0.15915494309 + 0.5,
                          asin( clamp( gR.y, -1.0, 1.0 ) ) * 0.31830988618 + 0.5 );
         float gF = ${GLAZE_F0} + ( 1.0 - ${GLAZE_F0} ) * pow( clamp( 1.0 + dot( gV, gN ), 0.0, 1.0 ), 5.0 );
         vec3 gEnv = pow( max( texture2D( uGlossEnv, gUv ).rgb, vec3( 0.0 ) ), vec3( ${GLAZE_ENV_GAMMA.toFixed(1)} ) );
         // vDimColor.a is this surface's own share of the level — see GLAZE_ENV
         outgoingLight += gEnv * gF * uGloss * vDimColor.a;
         #include <opaque_fragment>`
      )
  }
  mat.customProgramCacheKey = () => 'sw-desk-gloss'
  return mat
}

/**
 * The three rose-gold props. A real metallic material, and the ONLY thing in this round that takes
 * a light — an environment map assigned to this material alone (see `studio-env.ts` for why that
 * cannot reach the clay).
 *
 * Normals are computed here rather than shipped: they are 320 kB of attribute for a set that is
 * otherwise unlit, and the export splits its hard edges already, so recomputing them at load gives
 * exactly the smooth-within-island normals the file would have carried.
 */
/**
 * How much of the room the DESK's metal reflects, against the stand's full share.
 *
 * The two metal objects in this ending need different levels, and that is geometry rather than
 * taste. The globe stand's ring is a torus whose normals sweep the whole room, so it reads the
 * room's general LEVEL — at the shipped environment it measures +1.6% against the approved render.
 * The trinket dish is a shallow bowl aimed almost straight back at the camera, so it throws the
 * key's hot CORE into frame, and at that same environment it clips its red channel at 255 and
 * measures +36.6%. A clipped highlight is exactly what stops rose gold reading as metal: there is
 * no shape left in it.
 *
 * Tuning the room to suit the dish is what the first two attempts did, and it drags the ring with
 * it — 0.62 of the room took the dish to −19.7% and the ring to −41.1%. `MeshStandardMaterial`
 * multiplies `color` by the vertex colour, so this scales the desk's three metal props alone and
 * leaves the stand where it already measures right.
 */
const DESK_METAL_LEVEL = 1.0

/**
 * ...and the desk metal's TINT correction, for the same reason the stand's tint is render-tuned.
 *
 * WHITE, and that is the end of a short story. It was briefly a per-channel correction applied here,
 * because the three desk metals shipped with T67's ALBEDOS in their vertex colours and an albedo is
 * not what a metal renders — the dish measured 1.77x the reference's chroma and the pen 1.52x.
 *
 * One correction cannot serve three tints. Tuned for the rose gold, it turned the sculpting tool's
 * NEUTRAL steel blue: hue 152 degrees off the reference, chroma 3.26x. Exactly the shape of mistake
 * as tuning one room level for two differently-curved reflectors, one scale down.
 *
 * So the tints are solved per material in the EXPORT (`t68_export.py`, `METAL_TINT`) where each one
 * can differ, and nothing is corrected here. Kept as a hook in case the desk's metals ever need to
 * differ from the stand's as a group.
 */
const DESK_METAL_TINT = new THREE.Color(1, 1, 1)

function metalMaterial(env: THREE.Texture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: DESK_METAL_TINT.clone().multiplyScalar(DESK_METAL_LEVEL),
    metalness: 1,
    roughness: 0.33,
    envMap: env,
    toneMapped: false,
  })
  // The mug's and the cup's foil prints rock with their hosts (Task 89). `objectNormal` is rotated
  // with the positions — a metal is nothing but its reflection, and the sweep of that reflection as
  // the print tips is most of what the eye gets paid. The rotation lands in `beginnormal_vertex`
  // because the standard material has consumed `objectNormal` before `begin_vertex` runs.
  const nudge = nudgeVertexChunk('DeskMetal')
  const nudgeNormal = nudgeNormalChunk('DeskMetal', 'objectNormal')
  mat.onBeforeCompile = (shader) => {
    wireNudge(shader, nudge)
    // The carving knife's metal blade (T97 S2/S3): the see-saw teeter + clatter hop, composed
    // with the nudge wiring above — the blade's padded box and the foil-print zones are disjoint
    // (measured: nearest foreign metal is the pen at x > 2.74; the blade ends at 1.83), so the
    // two fields can never both claim a vertex and their order after begin_vertex is free.
    shader.uniforms.uStKnife = STATION_UNIFORMS.uStKnife
    shader.vertexShader = (STATION_METAL_DECL + '\n' + shader.vertexShader)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + STATION_METAL_BODY)
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\n' + nudgeNormal + '\n' + STATION_METAL_NORMAL_BODY
      )
  }
  // Distinct key, because the stand's cradle uses the same MeshStandardMaterial signature and three
  // caches programs by it — without this the two would silently share one program.
  mat.customProgramCacheKey = () => 'sw-desk-metal'
  return mat
}

export function DeskGlb({ journeyRef }: { journeyRef: JourneyRef }) {
  const assets = useDeskAssets()
  const renderer = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  // ONE uniform object, shared by all three baked materials, so they can never disagree about how
  // lit the ending is and the frame loop writes a single number.
  const lights = useRef({ value: 0 })
  // ...and one for the two things that reflect the room rather than carrying a bake, for the same
  // reason: the glaze's sheen and the metal's environment come up on one curve or on none.
  const gloss = useRef({ value: 0 })
  // shared with the globe stand — the ring and the dish beside it must reflect one room
  const env = useMemo(() => studioEnvFor(renderer), [renderer])
  const equirect = useMemo(() => studioEquirectShared(), [])

  const built = useMemo(() => {
    if (!assets) return null
    const { scene } = assets
    const surface = findMesh(scene, 'DeskSurface')
    const baked = findMesh(scene, 'DeskBaked')
    const metal = findMesh(scene, 'DeskMetal')
    const glaze = findMesh(scene, 'DeskGloss')
    if (!surface || !baked || !metal || !glaze) return null
    surface.material = surfaceMaterial(assets.lit, assets.dim, lights.current)
    baked.material = bakedMaterial(lights.current)
    metal.geometry.computeVertexNormals()
    metal.material = metalMaterial(env)
    // The export ships no normals (they are 12 bytes a vertex for a set that is otherwise unlit),
    // and both of the meshes that reflect anything need them. The exporter splits hard edges
    // already, so recomputing gives exactly the smooth-within-island normals the file would carry.
    glaze.geometry.computeVertexNormals()
    glaze.material = glossMaterial(equirect, lights.current, gloss.current)
    // The notebook's verso (Task 92): present once the interior ships in the GLB; its absence is a
    // desk without a deep book, not a broken desk.
    const verso = findMesh(scene, 'BookVerso')
    if (verso) verso.material = versoMaterial(lights.current)
    // The watering piece (Task 92): the can and its seven beads, driven by ONE paused action whose
    // .time the deep tier mails in (`deepClipMail`) — the mixer never reads the frame delta. The
    // same absence rule as the verso: no can, no pour, still a desk.
    const can = findMesh(scene, 'Can_B')
    const drops: THREE.Mesh[] = []
    let waterGroup: THREE.Group | null = null
    let mixer: THREE.AnimationMixer | null = null
    let waterAction: THREE.AnimationAction | null = null
    if (can) {
      can.material = canMaterial(lights.current)
      const dropMat = dropMaterial()
      for (let i = 0; i < 7; i++) {
        const d = findMesh(scene, `Water_Drop0${i}` as DeskMeshName)
        if (d) {
          d.material = dropMat
          d.visible = false
          drops.push(d)
        }
      }
      // The animated nodes live under ONE group and the mixer roots THERE, not at the glTF scene:
      // rendering through <primitive> re-parents objects out of the loaded scene, and a mixer
      // rooted above the re-parenting line would find nothing to bind. The group survives the
      // tab-lifetime scene cache, so a second mount reuses it (get-or-create by name).
      waterGroup = (scene.getObjectByName('WaterRig') as THREE.Group) ?? new THREE.Group()
      if (waterGroup.name !== 'WaterRig') {
        waterGroup.name = 'WaterRig'
        waterGroup.add(can, ...drops)
        scene.add(waterGroup)
      }
      const waterClip = assets.animations.find((c) => c.name === 'WaterAction')
      if (waterClip) {
        mixer = new THREE.AnimationMixer(waterGroup)
        waterAction = mixer.clipAction(waterClip)
        waterAction.play()
        waterAction.paused = true
        waterAction.time = 0
        // One evaluation at rest so a remount mid-pour (the scene Group is cached for the tab)
        // can never leave the previous mount's pose standing.
        mixer.update(0)
      }
    }
    // The bird (Task 92): the skinned lane twin + its 8-bone rig, wrapped in ONE runtime
    // Object3D. The rig is authored at the ORIGIN — a parent node inside the GLB would put the
    // bind-arithmetic error straight back (globalBind walks to the scene root), so the placement
    // is a RUNTIME wrapper, whose matrix applies after skinning and never enters the bind. Same
    // get-or-create-by-name pattern as WaterRig: the scene Group is cached for the tab.
    const bird = findMesh(scene, 'Bar_river')
    let birdGroup: THREE.Group | null = null
    let birdMixer: THREE.AnimationMixer | null = null
    let birdAction: THREE.AnimationAction | null = null
    if (bird) {
      bird.material = birdMaterial(lights.current)
      // Invisible at rest — the baked lane in DeskBaked is the resting statement; the twin costs
      // zero draws until a click. Culling off: the morph reaches 0.58 units above the base
      // geometry's own bounding sphere mid-clip, and 742 vertices are cheaper than a wrong cull.
      bird.visible = false
      bird.frustumCulled = false
      birdGroup = (scene.getObjectByName('BirdRig') as THREE.Group) ?? new THREE.Group()
      if (birdGroup.name !== 'BirdRig') {
        birdGroup.name = 'BirdRig'
        const rig = scene.getObjectByName('Lane_Rig')
        if (rig) birdGroup.add(rig)
        birdGroup.add(bird)
        birdGroup.position.fromArray(BIRD_WRAPPER.position as unknown as number[])
        birdGroup.quaternion.fromArray(BIRD_WRAPPER.quaternion as unknown as number[]).normalize()
        birdGroup.scale.setScalar(BIRD_WRAPPER.scale)
        scene.add(birdGroup)
      }
      const birdClip = assets.animations.find((c) => c.name === 'BirdAction')
      if (birdClip) {
        birdMixer = new THREE.AnimationMixer(birdGroup)
        birdAction = birdMixer.clipAction(birdClip)
        birdAction.play()
        birdAction.paused = true
        birdAction.time = 0
        birdMixer.update(0)
      }
      // A remount must not inherit the previous mount's swap state: the uniform is module-scope
      // and would otherwise hold uBird=1 with no frame-loop change to clear it — a desk with a
      // hidden lane and no bird.
      BIRD_UNIFORM.value.fill(0)
    }
    return {
      surface,
      baked,
      metal,
      glaze,
      verso,
      can,
      drops,
      waterGroup,
      mixer,
      waterAction,
      bird,
      birdGroup,
      birdMixer,
      birdAction,
      metalMat: metal.material as THREE.MeshStandardMaterial,
    }
  }, [assets, env, equirect])

  useEffect(() => {
    if (!built) return
    // Warm-compile the bird's program while the studio is still dark: `compile` initialises
    // materials with a plain traverse (visibility is not consulted), so the invisible twin's
    // skinned+morphed program is on the GPU before the first click ever needs it.
    if (built.birdGroup) renderer.compile(built.birdGroup, camera)
    return () => {
      for (const m of [built.surface, built.baked, built.metal, built.glaze, built.verso, built.can, built.bird]) {
        if (m) (m.material as THREE.Material).dispose()
      }
      if (built.drops[0]) (built.drops[0].material as THREE.Material).dispose()
      if (built.mixer) {
        // Park the clip at rest before letting go, so the cached scene the NEXT mount receives
        // holds the authored TRS — then release the mixer's bindings entirely.
        if (built.waterAction) built.waterAction.time = 0
        built.mixer.update(0)
        built.mixer.stopAllAction()
        built.mixer.uncacheRoot(built.mixer.getRoot())
      }
      if (built.birdMixer) {
        // The bird parks the same way — and the swap parks with it: lane shown, twin hidden.
        if (built.birdAction) built.birdAction.time = 0
        built.birdMixer.update(0)
        built.birdMixer.stopAllAction()
        built.birdMixer.uncacheRoot(built.birdMixer.getRoot())
        if (built.bird) built.bird.visible = false
        BIRD_UNIFORM.value.fill(0)
      }
    }
  }, [built, renderer, camera])

  const last = useRef(Number.NaN)
  const lastWater = useRef(0)
  const lastBird = useRef(0)
  useFrame(() => {
    if (!built) return
    // The set-piece clips (Task 92): the deep tier mails clip TIMES (never deltas); this stamps
    // them onto the paused actions and evaluates the mixer with a zero step — scroll-pure, and a
    // resting desk pays one number compare. Drop visibility rides the same write, so the seven
    // beads cost draws only while a pour is actually in flight.
    if (built.waterAction && deepClipMail.water !== lastWater.current) {
      const active = deepClipMail.water !== 0
      const wasActive = lastWater.current !== 0
      lastWater.current = deepClipMail.water
      built.waterAction.time = deepClipMail.water
      built.mixer!.update(0)
      if (active !== wasActive) for (const d of built.drops) d.visible = active
    }
    // The bird's swap rides the same mail pattern, with BOTH halves flipped in one place: the
    // skinned twin's visibility AND the baked lane's hide uniform change in the same statement,
    // so no rendered frame can ever hold two lanes or none.
    if (built.birdAction && deepClipMail.bird !== lastBird.current) {
      const active = deepClipMail.bird !== 0
      const wasActive = lastBird.current !== 0
      lastBird.current = deepClipMail.bird
      built.birdAction.time = deepClipMail.bird
      built.birdMixer!.update(0)
      if (active !== wasActive) {
        built.bird!.visible = active
        BIRD_UNIFORM.value[0] = active ? 1 : 0
      }
    }
    // The verso needs no per-frame transform: it opens in its own vertex shader, off the same
    // BOOK_UNIFORM the cover's chunk reads (see versoMaterial).
    const u = studioLightsFor(journeyRef.current.ending)
    if (u === last.current) return
    last.current = u
    lights.current.value = u
    gloss.current.value = GLAZE_ENV * studioEnvIntensity(u)
    built.metalMat.envMapIntensity = studioEnvIntensity(u)
  })

  if (!built) return null
  return (
    <group>
      <primitive object={built.surface} />
      <primitive object={built.baked} />
      <primitive object={built.metal} />
      <primitive object={built.glaze} />
      {built.verso ? <primitive object={built.verso} /> : null}
      {built.waterGroup ? <primitive object={built.waterGroup} /> : null}
      {built.birdGroup ? <primitive object={built.birdGroup} /> : null}
    </group>
  )
}
