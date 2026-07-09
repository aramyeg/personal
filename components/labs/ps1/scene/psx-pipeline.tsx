'use client'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PSX } from './psx-constants'

/**
 * The PS1 rasterizer front-end: render the scene into a tiny 384x216 target,
 * then blit it to the canvas through an ordered-dither + 15-bit-quantize pass,
 * paced to a hard 30fps. Everything that sells "PS1 hardware" downstream of the
 * per-material affine/snap patches (low-res grain, dither, choppy cadence, hard
 * pixels) lives here.
 */
function PSXCompositor({ onFrame }: { onFrame?: (t: number) => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const advance = useThree((s) => s.advance)

  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  // The pipeline resources. Two 384x216 targets + one fullscreen quad reused
  // across the two blit passes:
  //   scene render: the 3D scene -> sceneTarget (linear, with depth)
  //   encode blit:  sceneTarget  -> ldrTarget, applying the sRGB transfer
  //   dither blit:  ldrTarget    -> canvas, the verbatim Bayer quantize
  // The explicit encode is the load-bearing step: three writes *linear* color
  // into a render target (the texture's colorSpace tag only matters when the
  // texture is later sampled by a built-in material, not by our raw shader), and
  // quantizing linear HDR gives perceptually-uneven bands. Converting with the
  // sRGB transfer first — the research's recommended ordering — both fixes the
  // banding and restores the exposure the scene's light values assume (the sRGB
  // curve lifts the dim linear lighting), so the brief's ~1.1/~0.55 lights read
  // correctly. NearestFilter keeps every upscale blocky.
  const { sceneTarget, ldrTarget, quad, quadScene, quadCamera, encodeMaterial, ditherMaterial } =
    useMemo(() => {
      const rtOpts = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        stencilBuffer: false,
      } as const
      const sceneTarget = new THREE.WebGLRenderTarget(PSX.LOW_W, PSX.LOW_H, {
        ...rtOpts,
        depthBuffer: true,
      })
      const ldrTarget = new THREE.WebGLRenderTarget(PSX.LOW_W, PSX.LOW_H, {
        ...rtOpts,
        depthBuffer: false,
      })

      const fullscreenVertex = /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `

      // Linear -> sRGB (three's exact transfer). Applied before the quantize so
      // color depth is reduced in perceptual (encoded) space.
      const encodeMaterial = new THREE.ShaderMaterial({
        uniforms: { tScene: { value: sceneTarget.texture } },
        depthTest: false,
        depthWrite: false,
        vertexShader: fullscreenVertex,
        fragmentShader: /* glsl */ `
          uniform sampler2D tScene;
          varying vec2 vUv;
          vec3 toSRGB(vec3 c) {
            return mix(
              pow(c, vec3(0.41666)) * 1.055 - 0.055,
              c * 12.92,
              vec3(lessThanEqual(c, vec3(0.0031308)))
            );
          }
          void main() {
            vec3 c = texture2D(tScene, vUv).rgb;
            gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
          }
        `,
      })

      // Binding blit shader (from the task brief) — used verbatim. Bayer index
      // is derived from the LOW-RES pixel (floor(vUv * LOW)) so the dither grain
      // stays locked to the 384x216 grid however large the canvas is upscaled.
      const ditherMaterial = new THREE.ShaderMaterial({
        uniforms: { tScene: { value: ldrTarget.texture } },
        depthTest: false,
        depthWrite: false,
        vertexShader: fullscreenVertex,
        fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        varying vec2 vUv;
        const float LOW_W = 384.0; const float LOW_H = 216.0;
        float bayer(vec2 p) {
          int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
          int m[16]; m[0]=0;m[1]=8;m[2]=2;m[3]=10;m[4]=12;m[5]=4;m[6]=14;m[7]=6;
          m[8]=3;m[9]=11;m[10]=1;m[11]=9;m[12]=15;m[13]=7;m[14]=13;m[15]=5;
          return float(m[y * 4 + x]) / 16.0;
        }
        void main() {
          vec2 lowPx = floor(vUv * vec2(LOW_W, LOW_H));
          vec3 c = texture2D(tScene, vUv).rgb;
          float t = (bayer(lowPx) - 0.5) / 31.0;
          c = clamp(c + t, 0.0, 1.0);
          c = floor(c * 31.0 + 0.5) / 31.0;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      })

      const quadScene = new THREE.Scene()
      const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ditherMaterial)
      quad.frustumCulled = false
      quadScene.add(quad)

      return {
        sceneTarget,
        ldrTarget,
        quad,
        quadScene,
        quadCamera,
        encodeMaterial,
        ditherMaterial,
      }
    }, [])

  // Pin the drawing buffer to 384x216 and let CSS + image-rendering:pixelated do
  // the enlargement (updateStyle=false keeps the element filling the viewport).
  // Result: the render never leaves low-res, and a window resize only stretches
  // pixels — it never re-renders at a higher internal resolution.
  useEffect(() => {
    const el = gl.domElement
    el.style.imageRendering = 'pixelated'
    el.style.width = '100%'
    el.style.height = '100%'
    gl.setPixelRatio(1)
    gl.setSize(PSX.LOW_W, PSX.LOW_H, false)
  }, [gl])

  // The single render callback. priority>0 makes r3f hand rendering to us — its
  // loop skips `gl.render` when `internal.priority` is set — so we own all three
  // passes: scene -> linear target, sRGB-encode -> ldr target, dither -> canvas.
  useFrame((state) => {
    onFrameRef.current?.(state.clock.elapsedTime)

    // r3f resets the buffer to container size on any resize; re-pin it (and hold
    // the internal 16:9 aspect) the next frame so we never drift off 384x216.
    const el = gl.domElement
    if (el.width !== PSX.LOW_W || el.height !== PSX.LOW_H) {
      gl.setSize(PSX.LOW_W, PSX.LOW_H, false)
      el.style.width = '100%'
      el.style.height = '100%'
    }
    if (camera instanceof THREE.PerspectiveCamera) {
      const aspect = PSX.LOW_W / PSX.LOW_H
      if (camera.aspect !== aspect) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }
    }

    gl.setRenderTarget(sceneTarget)
    gl.render(scene, camera)

    quad.material = encodeMaterial
    gl.setRenderTarget(ldrTarget)
    gl.render(quadScene, quadCamera)

    quad.material = ditherMaterial
    gl.setRenderTarget(null)
    gl.render(quadScene, quadCamera)
  }, 1)

  // FRAME PACING (documented choice): frameloop="never" + our own rAF
  // accumulator that calls advance() on 1/FPS boundaries. This is a *genuine*
  // cap, not a cosmetic throttle — bare rAF fires at the display's refresh
  // (60-144Hz); here the clock and the render only step at 30fps, so motion has
  // the choppy PS1 cadence rather than smooth 60. We pass elapsed SECONDS to
  // advance() because under frameloop="never" r3f writes that timestamp straight
  // into clock.elapsedTime, which onFrame/useFrame then read back.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const start = last
    let acc = 0
    const frameMs = 1000 / PSX.FPS
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      acc += now - last
      last = now
      if (acc < frameMs) return
      // Shed backlog (tab-away, GC hitch) instead of fast-forwarding time.
      acc %= frameMs
      advance((now - start) / 1000)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [advance])

  // Release GPU resources on unmount / hot-reload so nothing leaks.
  useEffect(
    () => () => {
      sceneTarget.dispose()
      ldrTarget.dispose()
      encodeMaterial.dispose()
      ditherMaterial.dispose()
      quad.geometry.dispose()
    },
    [sceneTarget, ldrTarget, encodeMaterial, ditherMaterial, quad],
  )

  return null
}

/**
 * `<PSXCanvas>` — the pipeline shell. Renders its children (the 3D scene) into
 * the low-res target and blits them through the dither pass. `onFrame(t)` runs
 * once per rendered (30fps) frame with elapsed seconds, for scene animation.
 */
export function PSXCanvas({
  onFrame,
  children,
}: {
  onFrame?: (t: number) => void
  children: ReactNode
}) {
  return (
    // `flat` (toneMapping = NoToneMapping) keeps the scene off the modern filmic
    // curve — PS1 had no tone mapping — which also makes our encode pass a pure
    // linear->sRGB transfer. Color management stays on (the default): the scene
    // is lit in linear space, and the pipeline's encode pass does the sRGB step
    // three would normally do at the screen (but skips for a render target).
    <Canvas
      frameloop="never"
      flat
      dpr={1}
      gl={{ antialias: false }}
      camera={{ fov: 55, near: 0.1, far: 100 }}
    >
      <PSXCompositor onFrame={onFrame} />
      {children}
    </Canvas>
  )
}
