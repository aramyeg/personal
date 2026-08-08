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
export type DeskAssets = { scene: THREE.Group; lit: THREE.Texture | null; dim: THREE.Texture | null }

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
        resolve({ scene: gltf.scene, lit: src?.map ?? null, dim: src?.emissiveMap ?? null })
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
    shader.vertexShader = ('attribute vec4 color_1;\nvarying vec3 vDimColor;\n' + shader.vertexShader).replace(
      '#include <color_vertex>',
      '#include <color_vertex>\n vDimColor = color_1.rgb;'
    )
    // unlit, so only positions move — there is no normal for the nudge to keep honest here: the
    // shading is baked into vertex colours, which travel with the vertices by construction
    wireNudge(shader, nudge)
    shader.fragmentShader = ('uniform float uLights;\nvarying vec3 vDimColor;\n' + shader.fragmentShader).replace(
      '#include <color_fragment>',
      'diffuseColor.rgb *= mix( vDimColor, vColor.rgb, uLights );'
    )
  }
  mat.customProgramCacheKey = () => 'sw-desk-baked'
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
    for (const [name, u] of Object.entries(nudge.uniforms)) shader.uniforms[name] = u
    shader.vertexShader = (
      nudge.decl +
      '\nattribute vec4 color_1;\nvarying vec4 vDimColor;\nvarying vec3 vGlossN;\nvarying vec3 vGlossW;\n' +
      shader.vertexShader
    )
      .replace('#include <color_vertex>', '#include <color_vertex>\n vDimColor = color_1;')
      // The icing rocks with the donut, and its SHEEN has to rock too: `swNrm` is the normal the
      // nudge may have rotated, and the reflection reads it instead of the rest-pose attribute —
      // a highlight that stayed pinned while the glaze tipped would un-sell the whole motion.
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vec3 swNrm = normal;\n' + nudge.body)
      .replace(
        '#include <project_vertex>',
        `vGlossN = normalize( mat3( modelMatrix ) * swNrm );
         vGlossW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
         #include <project_vertex>`
      )
    shader.fragmentShader = (
      'uniform float uLights;\nuniform float uGloss;\nuniform sampler2D uGlossEnv;\n' +
      'varying vec4 vDimColor;\nvarying vec3 vGlossN;\nvarying vec3 vGlossW;\n' +
      shader.fragmentShader
    )
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix( vDimColor.rgb, vColor.rgb, uLights );')
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
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\n' + nudgeNormal
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
    return { surface, baked, metal, glaze, metalMat: metal.material as THREE.MeshStandardMaterial }
  }, [assets, env, equirect])

  useEffect(() => {
    if (!built) return
    return () => {
      for (const m of [built.surface, built.baked, built.metal, built.glaze]) {
        ;(m.material as THREE.Material).dispose()
      }
    }
  }, [built])

  const last = useRef(Number.NaN)
  useFrame(() => {
    if (!built) return
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
    </group>
  )
}
