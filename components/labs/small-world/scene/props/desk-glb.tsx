'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { studioEnvIntensity, studioLightsFor } from '../desk-studio'
import { studioEnvFor } from '../studio-env'
import type { JourneyRef } from '../use-journey'
import { DESK_GLB_URL, type DeskMeshName } from './desk-glb-contract'

/**
 * THE BAKED DESK, AS IT REACHES THE SCREEN (Task 68).
 *
 * `desk-glb-contract.ts` says what is in the file and why; this is only how it is loaded, shaded
 * and driven. Three meshes, three draw calls, and one number written per frame — and only on the
 * frames where that number has changed, which during the whole journey is none of them.
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

/** One manager, one request, shared by every mount — and NOT the default one. See the header. */
const manager = new THREE.LoadingManager()
let pending: Promise<THREE.Group> | null = null

function loadDeskScene(): Promise<THREE.Group> {
  pending ??= new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader(manager).load(DESK_GLB_URL, (gltf) => resolve(gltf.scene), undefined, reject)
  })
  return pending
}

/** The GLB's scene once it has arrived, or null. Never suspends, never throws into the tree: a
 *  failed desk leaves the ending bare rather than taking the canvas down with it. */
export function useDeskScene(): THREE.Group | null {
  const [scene, setScene] = useState<THREE.Group | null>(null)
  useEffect(() => {
    let live = true
    loadDeskScene().then(
      (s) => {
        if (live) setScene(s)
      },
      () => {}
    )
    return () => {
      live = false
    }
  }, [])
  return scene
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
function surfaceMaterial(src: THREE.Mesh, lights: { value: number }): THREE.MeshBasicMaterial {
  const from = src.material as THREE.MeshStandardMaterial
  const mat = new THREE.MeshBasicMaterial({ map: from.map, toneMapped: false })
  const dim = { value: from.emissiveMap }
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
function bakedMaterial(lights: { value: number }): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
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
  mat.customProgramCacheKey = () => 'sw-desk-baked'
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
const DESK_METAL_LEVEL = 0.70

function metalMaterial(env: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: new THREE.Color(DESK_METAL_LEVEL, DESK_METAL_LEVEL, DESK_METAL_LEVEL),
    metalness: 1,
    roughness: 0.33,
    envMap: env,
    toneMapped: false,
  })
}

export function DeskGlb({ journeyRef }: { journeyRef: JourneyRef }) {
  const scene = useDeskScene()
  const renderer = useThree((s) => s.gl)
  // ONE uniform object, shared by both matte materials, so the pair can never disagree about how
  // lit the ending is and the frame loop writes a single number.
  const lights = useRef({ value: 0 })
  // shared with the globe stand — the ring and the dish beside it must reflect one room
  const env = useMemo(() => studioEnvFor(renderer), [renderer])

  const built = useMemo(() => {
    if (!scene) return null
    const surface = findMesh(scene, 'DeskSurface')
    const baked = findMesh(scene, 'DeskBaked')
    const metal = findMesh(scene, 'DeskMetal')
    if (!surface || !baked || !metal) return null
    surface.material = surfaceMaterial(surface, lights.current)
    baked.material = bakedMaterial(lights.current)
    metal.geometry.computeVertexNormals()
    metal.material = metalMaterial(env)
    return { surface, baked, metal, metalMat: metal.material as THREE.MeshStandardMaterial }
  }, [scene, env])

  useEffect(() => {
    if (!built) return
    return () => {
      for (const m of [built.surface, built.baked, built.metal]) {
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
    built.metalMat.envMapIntensity = studioEnvIntensity(u)
  })

  if (!built) return null
  return (
    <group>
      <primitive object={built.surface} />
      <primitive object={built.baked} />
      <primitive object={built.metal} />
    </group>
  )
}
