'use client'

/**
 * WILD lane — the grade. RenderPass -> UnrealBloomPass -> vignette+grain -> OutputPass.
 *
 * WHY HAND-ROLLED: `@react-three/postprocessing` is not installed and the shared-node_modules
 * junction forbids installing it. three 0.185 ships the whole `examples/jsm/postprocessing`
 * suite, which is the same machinery that library wraps, so the pipeline is built directly.
 *
 * WHY THIS ORDER: three disables in-shader tone mapping whenever it renders into a render
 * target, so RenderPass writes LINEAR values into the composer's half-float buffer. Bloom
 * therefore thresholds against real radiance (a window at 4.0 blooms, a moonlit wall at 0.3
 * does not) instead of against film-compressed values where everything crowds toward 1 and the
 * threshold stops meaning anything. OutputPass applies the renderer's tone mapping and the sRGB
 * transfer last, once, at the end of the chain.
 *
 * WHY BLOOM MATTERS MORE THAN ANYTHING ELSE HERE: the candidate's payoff is a hundred windows
 * catching light. Without bleed they are bright rectangles on a dark box; with it they are
 * lamps in fog and the building reads as lit rather than painted.
 *
 * A `useFrame` at priority 1 takes r3f's render loop away from r3f globally. That is the
 * intent, and it is why <Ch1Diorama> mounts this only while spread 2 is on screen: unmounting
 * puts the loop, the tone mapping and every other spread back exactly as they were.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

import { REVEAL } from './inn-model'
import { ramp, readWildFrame, useWild } from './wild-frame'

/**
 * Bloom, eye-tuned against captures of both states.
 *
 * Asleep the frame holds exactly two warm notes and a moon; the bloom is there to give the moon
 * a halo and the one burning gable a breath of glow, and to do nothing else — anything stronger
 * and the "compressed cold values" half of the value story stops being cold. Woken, roughly
 * thirty windows and an arch flood are pouring light, and the bleed is what turns them from
 * rectangles into a lantern. So strength nearly doubles and the threshold drops, which lets the
 * mid-bright surfaces the lamps are washing (plaster, the cobble pools, mist) join the glow
 * instead of only the glass itself.
 */
const BLOOM = {
  asleep: { strength: 0.46, threshold: 0.82 },
  woken: { strength: 0.58, threshold: 0.8 },
  radius: 0.52,
} as const

/** Vignette depth at full night, and the film grain amount (0..1 artistic, not a multiplier). */
const VIGNETTE = 0.58
const GRAIN = 0.55

/** Below this the grade is a whisper: mid page-turn the book must still look like the book. */
const GRADE_FLOOR = 0.22

const GradeShader = {
  name: 'WildGradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;

    // Hash without sine — stable across drivers, unlike the fract(sin(dot(...))) idiom.
    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      // Vignette, aspect-corrected so it stays a circle rather than an ellipse on a wide window.
      float aspect = max(uResolution.x, 1.0) / max(uResolution.y, 1.0);
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
      float r = length(d) / length(vec2(0.5 * aspect, 0.5));
      color *= 1.0 - uVignette * smoothstep(0.42, 1.08, r);

      // Grain. This pass runs on LINEAR values, where a fixed additive noise is invisible in the
      // highlights and a blizzard in the shadows, so the amplitude is taken on a perceptual
      // (sqrt) luminance and applied mostly multiplicatively: the noise rides the signal the way
      // film grain rides exposure, strongest through the mids, gone in the specular and gone in
      // the true blacks. The small additive term keeps the deepest shadows from reading as a
      // dead flat fill without lifting them.
      float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float perceptual = sqrt(clamp(lum, 0.0, 1.0));
      float weight = smoothstep(0.015, 0.30, perceptual) * (1.0 - smoothstep(0.62, 0.98, perceptual));
      float n = hash21(vUv * uResolution + vec2(uTime * 311.0, uTime * 197.0)) - 0.5;
      float g = n * uGrain * weight;
      color *= 1.0 + g * 0.34;
      color += g * 0.006;

      gl_FragColor = vec4(color, texel.a);
    }
  `,
}

// ---------------------------------------------------------------------------
// THE SHARED, PRE-ALLOCATED RIG (E5 perf).
//
// <CinematicGrade> mounts and unmounts on every turn into and out of spread 2
// (ch1-diorama.tsx's `live &&` gate — that gating is correct and stays: a
// priority-1 useFrame seizes r3f's render loop GLOBALLY, so the grade may only
// own presentation while the diorama is on screen). What must not happen on
// that mount is the ALLOCATION. Built fresh, the chain costs two full-size
// half-float buffers plus UnrealBloomPass's eleven mip targets, and
// `new EffectComposer(gl)` sizes itself off the renderer immediately — so the
// whole allocation landed in the frame the turn armed.
//
// So the rig is built ONCE, at load, behind the loader veil, and every later
// mount borrows it. Only the RenderPass's scene/camera and the composer's
// renderToScreen flag change hands. Resize still reallocates, which is fine:
// a resize is not a turn.
//
// The old warm pass sized a THROWAWAY composer down to 32 squares. That warmed
// the programs (its real point) but it also meant the first full-size chain was
// allocated from scratch anyway — and worse, it made the 32-square targets the
// only ones the driver had ever seen. The warm now runs the REAL rig at the
// REAL drawing-buffer size, so the load-time render is both the program warm
// and the allocation.
//
// THE PRICE, STATED PLAINLY: the chain's buffers are now resident for the whole
// session rather than only while spread 2 is on screen. All of them are RGBA
// half-float (8 B/px), so at 1600x900 CSS with dpr 2 — a 3200x1800 drawing
// buffer — that is 2 x 46.1 MB for the composer's read/write pair, 11.5 MB for
// renderTargetBright, and 30.7 MB across the five horizontal + five vertical
// blur mips: ~134 MB of GPU memory, held from load. It scales with the square
// of the window, and it is spent whether or not the reader ever opens the book.
// If that budget ever has to come back, the lever is the composer's pixel ratio
// (resizeRig is the single place that sets it), NOT going back to allocating on
// the turn.
// ---------------------------------------------------------------------------

type GradeRig = {
  readonly gl: THREE.WebGLRenderer
  readonly composer: EffectComposer
  readonly renderPass: RenderPass
  readonly bloom: UnrealBloomPass
  readonly grade: ShaderPass
  readonly output: OutputPass
  /** Last applied sizing, so an unchanged resize costs nothing. */
  pixelRatio: number
  width: number
  height: number
}

/** The RenderPass needs a scene and a camera at all times; while nothing has
 *  borrowed the rig it points at these, so a module-level singleton can never
 *  keep a torn-down r3f scene graph alive. */
let idleScene: THREE.Scene | null = null
let idleCamera: THREE.Camera | null = null

let sharedRig: GradeRig | null = null
let gradeWarmed = false

function disposeRig(rig: GradeRig): void {
  rig.composer.dispose()
  rig.bloom.dispose()
  rig.grade.dispose()
  rig.output.dispose()
  rig.renderPass.dispose()
}

/**
 * Resize the rig. THE one place that knows EffectComposer multiplies its size
 * by its pixel ratio, so the warm pass and the mount path can't disagree about
 * what "full size" means and quietly reallocate every buffer past each other.
 */
function resizeRig(rig: GradeRig, pixelRatio: number, width: number, height: number): void {
  if (rig.pixelRatio === pixelRatio && rig.width === width && rig.height === height) return
  rig.pixelRatio = pixelRatio
  rig.width = width
  rig.height = height
  // setPixelRatio internally re-runs setSize against the composer's STORED
  // dimensions, so a genuine change sweeps the buffers twice — once at the old
  // size, once at the new. Only an actual resize pays that, and a resize is not
  // a page turn; the equality guard above keeps every other caller at zero.
  rig.composer.setPixelRatio(pixelRatio)
  rig.composer.setSize(width, height)
  rig.grade.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio)
}

/** Build the rig against `gl` at the renderer's CURRENT size, or return the
 *  existing one. A different renderer (a remounted Canvas, a restored context)
 *  retires the old rig — its buffers belong to a context that is gone. */
function ensureRig(gl: THREE.WebGLRenderer): GradeRig {
  if (sharedRig && sharedRig.gl === gl) return sharedRig
  if (sharedRig) disposeRig(sharedRig)

  idleScene ??= new THREE.Scene()
  idleCamera ??= new THREE.PerspectiveCamera()

  const size = gl.getSize(new THREE.Vector2())
  const pixelRatio = gl.getPixelRatio()
  const composer = new EffectComposer(gl)
  const renderPass = new RenderPass(idleScene, idleCamera)
  // Sized at construction rather than from a 1x1 seed: UnrealBloomPass
  // allocates its mip chain in the constructor, and a 1x1 seed would throw all
  // eleven targets away on the first resize.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, size.width * pixelRatio), Math.max(1, size.height * pixelRatio)),
    BLOOM.asleep.strength,
    BLOOM.radius,
    BLOOM.asleep.threshold
  )
  const grade = new ShaderPass(GradeShader)
  const output = new OutputPass()
  composer.addPass(renderPass)
  composer.addPass(bloom)
  composer.addPass(grade)
  composer.addPass(output)

  sharedRig = {
    gl,
    composer,
    renderPass,
    bloom,
    grade,
    output,
    pixelRatio,
    width: size.width,
    height: size.height,
  }
  resizeRig(sharedRig, pixelRatio, size.width, size.height)
  return sharedRig
}

/** True while a live <CinematicGrade> owns the rig. The warm pass must never
 *  run against a borrowed rig: it renders off screen, and leaving
 *  `renderToScreen` false under a live grade would freeze the canvas on the
 *  last presented frame. */
let rigBorrowed = false

/** Lend the rig to a live <CinematicGrade>. */
function acquireRig(rig: GradeRig, scene: THREE.Scene, camera: THREE.Camera): void {
  rigBorrowed = true
  rig.renderPass.scene = scene
  rig.renderPass.camera = camera
  // The composer owns presentation from here; it is the only difference between
  // a borrowed rig and the warm pass's throwaway render.
  rig.composer.renderToScreen = true
}

/** Hand it back WITHOUT disposing — the allocation is the thing being kept. */
function releaseRig(rig: GradeRig): void {
  rigBorrowed = false
  rig.composer.renderToScreen = false
  if (idleScene) rig.renderPass.scene = idleScene
  if (idleCamera) rig.renderPass.camera = idleCamera
}

/**
 * Warm the grade chain before the reader can ever reach it: build the shared
 * rig at the real drawing-buffer size and push one throwaway frame through it,
 * off screen. That single render both links the chain's programs (the renderer
 * caches by shader source, and the ~1s dead frame the old profile caught on
 * arrival at the chapter was dominated by these compiles) and forces the
 * driver to actually back every render target it just allocated.
 *
 * ACES is forced because OutputPass specializes its shader on the renderer's
 * tone mapping, and the variant the diorama actually uses is the ACES one.
 *
 * Called from an idle slice at diorama mount — which, since the pop-up group
 * became resident, is book LOAD, behind the loader veil.
 */
export function warmGradePrograms(gl: THREE.WebGLRenderer): void {
  if (gradeWarmed) return
  // A rig already drawing the real spread is warm by definition, and rendering
  // off screen underneath it would strand the canvas on its last frame.
  if (rigBorrowed) {
    gradeWarmed = true
    return
  }
  gradeWarmed = true
  const prevToneMapping = gl.toneMapping
  const prevTarget = gl.getRenderTarget()
  try {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    const rig = ensureRig(gl)
    // Off screen: the veil is up, but a graded frame of an empty scene must
    // never reach the canvas even so.
    rig.composer.renderToScreen = false
    rig.composer.render(1 / 60)
  } catch {
    // A failed warm costs nothing but the head start.
  } finally {
    gl.toneMapping = prevToneMapping
    gl.setRenderTarget(prevTarget)
  }
}

export function CinematicGrade() {
  const wild = useWild()
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const contextLost = useRef(false)

  const perfRef = useRef<{ frames: number; head: number; times: Float32Array } | null>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('wilddebug') !== '1') return
    perfRef.current = { frames: 0, head: 0, times: new Float32Array(240) }
    // info.autoReset clears the counters after every internal pass; whole-frame numbers need
    // one manual reset per frame instead (done at the top of the useFrame below).
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  // Borrowed, not built (E5 perf — see the shared-rig block above): the chain
  // was allocated at load, behind the loader veil, and this mount only points
  // its RenderPass at the live scene. The previous `useMemo` ran on the frame
  // the turn into spread 2 armed, and built two full-size half-float buffers
  // plus UnrealBloomPass's whole mip chain right there.
  const rig = useMemo(() => ensureRig(gl), [gl])

  // The borrow is a LAYOUT effect, not a passive one: it flips the chain to
  // renderToScreen, and the priority-1 useFrame below could otherwise tick
  // against an off-screen composer for a frame — a black flash on arrival.
  // Released, NOT disposed, on the way out: keeping the allocation warm for the
  // next arrival is the entire point. Release only detaches the r3f scene graph
  // (so a module singleton cannot outlive it) and stops the chain presenting.
  useLayoutEffect(() => {
    acquireRig(rig, scene, camera)
    return () => releaseRig(rig)
  }, [rig, scene, camera])

  // ACES for as long as the diorama is up. OutputPass reads `renderer.toneMapping` every frame
  // and rebuilds its defines when it changes, so this is all that is needed to put the whole
  // chain on a filmic curve — and restoring the previous value on unmount is all that is needed
  // to give the rest of the book back its NoToneMapping look.
  useEffect(() => {
    const previous = gl.toneMapping
    gl.toneMapping = THREE.ACESFilmicToneMapping
    return () => {
      gl.toneMapping = previous
      gl.setRenderTarget(null)
    }
  }, [gl])

  useEffect(() => {
    const canvas = gl.domElement
    const onLost = () => {
      contextLost.current = true
    }
    const onRestored = () => {
      contextLost.current = false
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl])

  // A resize IS allowed to reallocate — a resize is not a page turn. In the
  // ordinary case this is a no-op: the rig was built from the same renderer's
  // own size and pixel ratio, which is exactly what r3f mirrors into `size`
  // and `viewport.dpr`, so `resizeRig` recognises the numbers and returns.
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return
    resizeRig(rig, dpr, size.width, size.height)
  }, [rig, size, dpr])

  useFrame((_, delta) => {
    if (contextLost.current || size.width <= 0 || size.height <= 0) return

    if (perfRef.current) gl.info.reset()

    const { open, wake, time } = readWildFrame(wild)

    // The grade arrives with the night rather than snapping on with the component, and it keeps
    // a floor so a spread caught mid-turn is still recognisably graded rather than flickering.
    const graded = GRADE_FLOOR + (1 - GRADE_FLOOR) * ramp(open, REVEAL.night[0], REVEAL.night[1])
    // Waking is read through a smooth ramp so the bloom swells with the cascade instead of
    // tracking the reader's wrist one-to-one.
    const lit = ramp(wake, 0, 1)

    rig.bloom.strength =
      (BLOOM.asleep.strength + (BLOOM.woken.strength - BLOOM.asleep.strength) * lit) * graded
    rig.bloom.threshold =
      BLOOM.asleep.threshold + (BLOOM.woken.threshold - BLOOM.asleep.threshold) * lit
    rig.bloom.radius = BLOOM.radius

    rig.grade.uniforms.uVignette.value = VIGNETTE * graded
    rig.grade.uniforms.uGrain.value = GRAIN * graded
    rig.grade.uniforms.uTime.value = time

    rig.composer.render(delta)

    // Dev-only perf telemetry for the capture harness (?wilddebug=1): renderer counters for
    // the whole frame (composer passes included) plus a rolling frame-time window.
    if (perfRef.current) {
      const p = perfRef.current
      p.frames += 1
      p.times[p.head] = delta * 1000
      p.head = (p.head + 1) % p.times.length
      const info = gl.info.render
      ;(window as unknown as { __wildPerf?: unknown }).__wildPerf = {
        calls: info.calls,
        triangles: info.triangles,
        frames: p.frames,
        times: Array.from(p.times.slice(0, Math.min(p.frames, p.times.length))),
        dpr,
        size: [size.width, size.height],
        wake,
      }
    }
  }, 1)

  return null
}
