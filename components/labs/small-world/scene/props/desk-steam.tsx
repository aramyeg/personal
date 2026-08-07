'use client'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { JourneyRef } from '../use-journey'
import { usePrefersReducedMotion } from '../use-reduced-motion'
import { useDeskAssets } from './desk-glb'
import {
  STEAM_BIRTH_FADE,
  STEAM_BIRTH_R,
  STEAM_COLOR,
  STEAM_DEATH_FADE,
  STEAM_DEATH_R,
  STEAM_DRIFT,
  STEAM_DRIFT_Z,
  STEAM_PEAK,
  STEAM_PUFFS,
  STEAM_RISE,
  STEAM_STRETCH,
  type CoffeeAnchor,
  readCoffeeAnchor,
  steamBoundsCenterY,
  steamBoundsRadius,
  steamClockAt,
  steamGateFor,
  steamPuffSeeds,
} from './desk-steam-field'
import { KICK_DECAY, KICK_FREQ, KICK_LAG, KICK_SWAY, steamKickMail } from './desk-nudge'

/**
 * THE COFFEE STEAM (Task 72) — the last thing the ending grows, and the first thing in the ENDING
 * that reads a clock.
 *
 * `desk-steam-field.ts` carries every number and the argument for it; this is how eighteen puffs
 * reach the screen. ONE draw call, ONE material, ONE BufferGeometry of 72 vertices, and nothing at
 * all allocated after mount — the frame loop writes two floats into two uniform objects that were
 * created once, and on most frames it writes neither.
 *
 * ============================================================================
 * THE DEVIATION: THIS COMPONENT READS TIME
 * ============================================================================
 * A first draft of this paragraph said this was the only thing in the lab that reads a clock. That
 * is simply false, and it is worth correcting rather than deleting because the true statement is
 * both narrower and sharper. The lab has had wall clocks since Round 14: `use-journey.ts` damps the
 * scroll on `delta`, `girl.tsx` runs an animation mixer on it, `girl-proxy.tsx` adds an idle sway on
 * `clock.elapsedTime`, `planet.tsx` steps the boil texture on it, and `yeti-egg.tsx` accumulates a
 * peek timer. Anyone auditing "does this lab read time" gets the answer yes, five times over.
 *
 * What is actually load-bearing is the ENDING's contract, and it is written down. Every one of those
 * five clocks lives in the journey, and `ending-timeline.ts` deliberately draws a line at the
 * ending's edge: "Anything you animate here must be a pure function of these values. No clocks: a
 * visitor who scrubs back must see the ending run backwards exactly" — and then names T54's arrival
 * clock as "the lab's ONE sanctioned wall-clock exception", noting in the same breath that it "does
 * not extend to the ending". The ending has been clock-free by rule for three rounds, and that rule
 * is what lets `ending-camera.test.ts` and `desk-studio.test.ts` prove things about it with
 * `Object.is` sweeps instead of tolerances.
 *
 * Steam that does not move is not steam. So this is the SECOND sanctioned exception and the first
 * one inside the ending, and the whole of the rest of this comment is the scoping that makes it cost
 * nothing — written out at length for the same reason `desk-note.tsx` writes out its one deferred
 * repaint, which is that an exception nobody can find later is indistinguishable from a bug.
 *
 * WHAT IS AND IS NOT IMPURE. The plume's VISIBILITY is a pure function of scroll and stays one:
 * `steamGateFor(ending)` is `studioLightsAt(zoom)` unshaped, the same single number the desk's two
 * bakes, the metal's environment, the backdrop and the winter grade's release all ride. Only the
 * wisp's INTERNAL PHASE — which puff is where inside a column that is always there — reads elapsed
 * time. Nothing about where the steam is, how bright it is, or whether it exists depends on the
 * clock; scrub to a scroll position and you get the same plume at the same opacity in the same
 * place, with its puffs at a different point in their loop.
 *
 * ...AND THE THREE THINGS THAT SCOPE IT TO EXACTLY ZERO OUTSIDE THE ENDING.
 *
 *  1. THE GATE IS A HARD +0. `ending.zoom` is exactly 0 for the entire journey and the entire still
 *     beat, and `smootherstep(0)` is exactly 0 — not asymptotically, arithmetically. So
 *     `steamGateFor` is `Object.is`-identical to +0 on every frame the journey owns, which is what
 *     the two sweeps in `desk-steam.test.ts` gate.
 *  2. THE MESH IS NOT DRAWN. At gate 0 `mesh.visible` is false, so the renderer never reaches it:
 *     zero draw calls, zero fragments, zero pixels. Not "an invisible quad at alpha 0" — measured
 *     with `renderer.info.render.calls`, the journey's frame is byte-identical to the frame this
 *     component did not exist for, and the report carries the region luminances that say so.
 *  3. THE CLOCK DOES NOT ADVANCE. `steamClockAt` returns the accumulator UNCHANGED while the gate is
 *     shut, so `uTime` does not merely go unused during the journey — it does not move. A visitor
 *     who scrolls to the ending after ten minutes and one who gets there in ten seconds see the
 *     plume from the same instant of its own life.
 *
 * The residue, stated rather than hidden: two visitors who reach the money shot and then WAIT for
 * different lengths of time see different frames. That is the entire cost, it applies to nothing
 * but which puff is at which height inside a plume that is otherwise identical, and it is the
 * irreducible price of the thing being steam at all.
 *
 * ============================================================================
 * WHY IT IS A BILLBOARD IN THE VERTEX SHADER AND NOT EIGHTEEN OBJECTS
 * ============================================================================
 * Every puff has to face the camera, and the camera moves for the whole of the pull-back. The
 * ordinary way to do that is `Sprite`, or a `lookAt` per puff in the frame loop; both cost eighteen
 * objects, eighteen draw calls and eighteen matrix updates a frame for a thing measuring 165 px.
 *
 * So the quads are expanded in VIEW SPACE instead. Each vertex carries a corner sign and its puff's
 * four seeds; the vertex shader places the puff's CENTRE through `modelViewMatrix` and then adds the
 * corner offset to the resulting x and y, which are camera axes by definition. The result is exactly
 * camera-facing at any camera pose, for one draw call and no CPU work at all. The `position`
 * attribute is all zeros and genuinely unread — which is why the geometry declares its own bounding
 * sphere (`steamBoundsRadius`) rather than letting three derive one from a buffer that describes a
 * point.
 *
 * ============================================================================
 * MATTE, AND WHAT IT MEANS FOR A THING MADE OF ALPHA
 * ============================================================================
 * No environment map, no specular term, no light input of any kind, and `scene.environment` is —
 * still, as it has been for four rounds — never assigned anywhere in this lab. The clay-scoping law
 * is structural here rather than observed: this is a raw `ShaderMaterial` whose fragment shader is
 * four lines long and contains no lighting, so there is nothing for it to reach the toon materials
 * WITH even if a future edit tried.
 *
 * `depthWrite: false` with depth TESTING left on, which is the pair that matters. Testing on means
 * the mug's rim and the donut in front of it occlude the plume correctly — the puffs are born below
 * the rim, at the liquid's surface, so the bottom of the column is genuinely inside the cup and has
 * to be cut by it. Writing off means the plume never occludes anything itself, which is right for a
 * medium and also what keeps the eighteen quads from z-fighting each other.
 *
 * The eighteen quads are drawn in buffer order rather than sorted back to front, because they are
 * one object. With a per-puff peak of 0.27 the ordering error where two puffs overlap is under a
 * level of sRGB and no capture has ever shown it; sorting them would mean eighteen objects, which is
 * the thing this design exists to avoid.
 */

/** The four corners of a puff, in the order the index buffer winds them. */
const CORNERS = [-1, -1, 1, -1, -1, 1, 1, 1]

/**
 * The whole plume as one geometry: four vertices and six indices per puff.
 *
 * `radius` only reaches the BOUNDING SPHERE, because everything else is scaled by `uR` in the
 * shader — the buffers themselves are pure topology and seeds, identical for any cup.
 */
export function buildSteamGeometry(radius: number): THREE.BufferGeometry {
  const seeds = steamPuffSeeds()
  const corner = new Float32Array(STEAM_PUFFS * 4 * 2)
  const seed = new Float32Array(STEAM_PUFFS * 4 * 4)
  const index = new Uint16Array(STEAM_PUFFS * 6)
  for (let i = 0; i < STEAM_PUFFS; i++) {
    for (let v = 0; v < 4; v++) {
      corner[(i * 4 + v) * 2] = CORNERS[v * 2]
      corner[(i * 4 + v) * 2 + 1] = CORNERS[v * 2 + 1]
      // the four seeds are per PUFF, so all four of its vertices carry the same copy — the cost of
      // not having instancing is 12 redundant floats per puff, which is 864 bytes for the plume
      for (let c = 0; c < 4; c++) seed[(i * 4 + v) * 4 + c] = seeds[i * 4 + c]
    }
    const b = i * 4
    index.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], i * 6)
  }
  const geo = new THREE.BufferGeometry()
  // Zeros, and read by nothing: the shader derives the puff's centre from `aSeed` and `uTime`. It
  // exists because three requires a `position` attribute to count vertices.
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STEAM_PUFFS * 4 * 3), 3))
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  // Assigned rather than computed — see the header, and `steamBoundsCenterY` for why it is centred
  // half way up the column rather than on the mesh's own origin.
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, steamBoundsCenterY() * radius, 0),
    steamBoundsRadius() * radius
  )
  return geo
}

/** Numbers that are fixed at compile time get baked into the source as literals rather than
 *  spending a uniform each — they cannot change without a rebuild, and a uniform that never varies
 *  is a lie about what the shader depends on. */
const f = (v: number): string => v.toFixed(5)

const VERT = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aSeed;   // x: phase offset, y: cycles per second, z: wander phase, w: wobble
uniform float uTime;
uniform float uR;
uniform vec4 uKick;
varying vec2 vCorner;
varying float vFade;

void main() {
  // where this puff is in its own life, 0 at the liquid and 1 gone
  float p = fract( aSeed.x + uTime * aSeed.y );

  // the wander earns its amplitude as the puff climbs, so every puff leaves the disc dead centre
  float wander = p * ${f(STEAM_DRIFT)};
  vec3 centre = vec3(
    sin( aSeed.z + p * aSeed.w ) * wander,
    p * ${f(STEAM_RISE)},
    cos( aSeed.z * 1.61 + p * aSeed.w * 0.77 ) * wander * ${f(STEAM_DRIFT_Z)}
  );

  // THE CLINK'S WAFT (Task 89): a stamped impulse on this shader's own clock. The disturbance
  // starts at the liquid and travels up (kT is delayed by height), each puff leans with the poke
  // and swings back, and the whole term is guarded so a mug nobody touches costs nothing. uKick is
  // (dir.x, dir.z, stamp, amp) — see desk-nudge.ts for the mailbox that fills it.
  if ( uKick.w != 0.0 ) {
    float kT = ( uTime - uKick.z ) - p * ${f(KICK_LAG)};
    if ( kT > 0.0 ) {
      float kSway = exp( -kT * ${f(KICK_DECAY)} ) * sin( kT * ${f(KICK_FREQ)} ) * uKick.w * p * ${f(KICK_SWAY)};
      centre.xz += vec2( uKick.x, uKick.y ) * kSway;
    }
  }

  // THE BILLBOARD. Place the centre through the model-view, then push the corner along the camera's
  // own x and y — which is what makes it face the camera at any pose, for no CPU work.
  vec4 mv = modelViewMatrix * vec4( centre * uR, 1.0 );
  float grow = mix( ${f(STEAM_BIRTH_R)}, ${f(STEAM_DEATH_R)}, p );
  float stretch = mix( 1.0, ${f(STEAM_STRETCH)}, p );
  mv.xy += aCorner * vec2( grow, grow * stretch ) * uR;

  // smooth at both ends: a puff that pops on at the surface is an event, and eighteen is a flicker
  vFade = smoothstep( 0.0, ${f(STEAM_BIRTH_FADE)}, p ) * ( 1.0 - smoothstep( ${f(STEAM_DEATH_FADE)}, 1.0, p ) );
  vCorner = aCorner;
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGate;
varying vec2 vCorner;
varying float vFade;

void main() {
  // A soft disc with no texture at all: squared falloff reaches zero AND zero slope at the rim, so
  // the puff has no edge to catch. Clamped first, because (1 - r2) goes positive again past r = 1
  // and the corners of the quad would come back as four bright dots.
  float d = max( 0.0, 1.0 - dot( vCorner, vCorner ) );
  gl_FragColor = vec4( uColor, d * d * vFade * uGate * ${f(STEAM_PEAK)} );
  #include <colorspace_fragment>
}
`

export type SteamUniforms = {
  uTime: { value: number }
  uGate: { value: number }
  uR: { value: number }
  uColor: { value: THREE.Color }
  /** (dir.x, dir.z, stamp on THIS clock, amp) — the mug's clink, 0 until one happens (Task 89). */
  uKick: { value: Float32Array }
}

/** The plume's one material. Unlit by construction — see the header on clay scoping. */
export function steamMaterial(radius: number): { material: THREE.ShaderMaterial; uniforms: SteamUniforms } {
  const uniforms: SteamUniforms = {
    uTime: { value: 0 },
    uGate: { value: 0 },
    uR: { value: radius },
    // sRGB in, decoded to the renderer's linear working space by ColorManagement exactly as every
    // other authored colour in the lab is; the fragment shader re-encodes on the way out
    uColor: { value: new THREE.Color(STEAM_COLOR) },
    uKick: { value: new Float32Array(4) },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    // testing ON so the mug's rim cuts the base of the column; writing OFF so the medium occludes
    // nothing and the eighteen quads cannot fight each other
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    // the quad is built in view space, so its winding is whatever the projection makes of it —
    // double-sided costs nothing for 28 triangles and removes the entire class of invisible-billboard
    side: THREE.DoubleSide,
  })
  return { material, uniforms }
}

type Steam = {
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  uniforms: SteamUniforms
  anchor: CoffeeAnchor
}

function buildSteam(root: THREE.Object3D): Steam | null {
  const anchor = readCoffeeAnchor(root)
  if (!anchor) return null
  const { material, uniforms } = steamMaterial(anchor.radius)
  return { geometry: buildSteamGeometry(anchor.radius), material, uniforms, anchor }
}

export function DeskSteam({ journeyRef }: { journeyRef: JourneyRef }) {
  const assets = useDeskAssets()
  const reduced = usePrefersReducedMotion()
  // No steam is a legitimate outcome, not an error: the desk loads through its own manager and can
  // fail forever, and an asset without a `CoffeeAnchor` is a re-bake this component has no business
  // guessing around. Both land here as null and the ending is simply a cup that is not steaming.
  const steam = useMemo(() => (assets ? buildSteam(assets.scene) : null), [assets])

  useEffect(() => {
    if (!steam) return
    return () => {
      steam.geometry.dispose()
      steam.material.dispose()
    }
  }, [steam])

  const mesh = useRef<THREE.Mesh>(null)
  const elapsed = useRef(0)
  // NaN so the mount frame always applies once (NaN !== NaN) and the plume starts in whatever state
  // the scroll says rather than in the one the JSX guessed.
  const lastGate = useRef(Number.NaN)
  /** The last clink consumed from the interactions' mailbox (Task 89). */
  const lastKick = useRef(steamKickMail.seq)

  useFrame((_, delta) => {
    const m = mesh.current
    if (!steam || !m) return
    const gate = steamGateFor(journeyRef.current.ending)
    if (gate !== lastGate.current) {
      lastGate.current = gate
      steam.uniforms.uGate.value = gate
      // the whole of the scoping, in one assignment: at +0 the renderer never reaches this mesh
      m.visible = gate > 0
    }
    const t = steamClockAt(elapsed.current, delta, gate, reduced)
    if (t !== elapsed.current) {
      elapsed.current = t
      steam.uniforms.uTime.value = t
    }
    // THE CLINK, stamped onto this component's own accumulator the frame it is noticed — the mug's
    // response rides the ending's one existing wall clock instead of bringing a second one. The
    // interactions are armed only while the gate is fully open, so there is no mail to miss while
    // it is shut; under reduced motion the mailbox never fills (the module is inert).
    if (steamKickMail.seq !== lastKick.current) {
      lastKick.current = steamKickMail.seq
      const k = steam.uniforms.uKick.value
      k[0] = steamKickMail.dirX
      k[1] = steamKickMail.dirZ
      k[2] = elapsed.current
      k[3] = steamKickMail.amp
    }
  })

  if (!steam) return null
  const { x, y, z } = steam.anchor
  return (
    <mesh
      ref={mesh}
      geometry={steam.geometry}
      material={steam.material}
      position={[x, y, z]}
      visible={false}
    />
  )
}
