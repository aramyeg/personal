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

import { useEffect, useMemo, useRef } from 'react'
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

let gradeWarmed = false

/**
 * Compile the grade chain's shader programs ahead of first use. The renderer caches programs
 * by shader source, so one render through a throwaway 32-square composer at book-idle time
 * means the real composer's first frame links nothing — the ~1s dead frame the profile caught
 * on arrival at the chapter was dominated by these compiles. ACES is forced for the warm
 * render because OutputPass specializes its shader on the renderer's tone mapping, and the
 * variant the diorama actually uses is the ACES one.
 */
export function warmGradePrograms(gl: THREE.WebGLRenderer): void {
  if (gradeWarmed) return
  gradeWarmed = true
  const prevToneMapping = gl.toneMapping
  const prevTarget = gl.getRenderTarget()
  try {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const composer = new EffectComposer(gl)
    composer.renderToScreen = false
    composer.setSize(32, 32)
    const bloom = new UnrealBloomPass(new THREE.Vector2(32, 32), 0.5, 0.5, 0.5)
    const grade = new ShaderPass(GradeShader)
    const output = new OutputPass()
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(bloom)
    composer.addPass(grade)
    composer.addPass(output)
    composer.render(1 / 60)
    composer.dispose()
    bloom.dispose()
    grade.dispose()
    output.dispose()
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

  const rig = useMemo(() => {
    const composer = new EffectComposer(gl)
    // The composer owns presentation from here; RenderPass must not be told to clear to screen.
    composer.renderToScreen = true

    const renderPass = new RenderPass(scene, camera)
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
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

    return { composer, renderPass, bloom, grade, output }
  }, [gl, scene, camera])

  useEffect(
    () => () => {
      rig.composer.dispose()
      rig.bloom.dispose()
      rig.grade.dispose()
      rig.output.dispose()
      rig.renderPass.dispose()
    },
    [rig]
  )

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

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return
    rig.composer.setPixelRatio(dpr)
    rig.composer.setSize(size.width, size.height)
    rig.grade.uniforms.uResolution.value.set(size.width * dpr, size.height * dpr)
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
