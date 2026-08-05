import * as THREE from 'three'

/**
 * A STUDIO, FOR THE METAL TO REFLECT (Task 68) — generated, not shipped.
 *
 * The three rose-gold props are the one part of the desk that could not be baked: at metallic 0.88
 * almost everything they show is a reflection of where the viewer happens to be, and a bake stores
 * one colour per vertex. So they take a real metallic material, and a metallic material needs
 * something to reflect.
 *
 * That something is built here rather than downloaded. An HDRI would be a few hundred kilobytes for
 * a room nobody ever sees directly, and it would have to be tinted to match candidate B anyway;
 * what the props actually need is the shape of the T67 rig — a big soft key high on one side, a
 * dimmer fill on the other, a bright ceiling and a pink-white floor bounce — which is four numbers
 * and a gradient. The result is a 64×32 equirectangular texture, about 8 kB of memory and nothing
 * at all over the wire.
 *
 * IT CANNOT REACH THE CLAY. This is the scoping the round's one lighting rule asks for, and it is
 * structural rather than careful: the texture is assigned to ONE material's `envMap`. It is never
 * assigned to `scene.environment`, which is the only mechanism that would apply it to materials
 * that did not ask for it — and the clay world is `MeshToonMaterial`, which has no environment
 * input at all. There is no edit to this file that could tint the planet.
 */

/** Equirect resolution. Tiny on purpose: this is a soft studio, and PMREM blurs it further. */
const W = 64
const H = 32

/** The rig, as it reads in a reflection. Positions are (azimuth turns, elevation 0..1). */
const LIGHTS: readonly { az: number; el: number; size: number; gain: number }[] = [
  // KEY_softbox — high and to the viewer's left, the T67 rig's dominant source
  { az: 0.62, el: 0.82, size: 0.30, gain: 6.2 },
  // FILL_bounce — opposite side, low and weak
  { az: 0.13, el: 0.55, size: 0.42, gain: 1.1 },
  // TOP_wash — straight overhead, broad
  { az: 0.0, el: 1.0, size: 0.55, gain: 0.9 },
]

/** Floor and ceiling of the room itself, as candidate B tints them. */
const FLOOR = new THREE.Color('#F7DEE6')
const CEIL = new THREE.Color('#FFF7F8')

/**
 * The raw equirectangular studio. `HalfFloatType` because the key is six times over white and an
 * 8-bit texture would clip it flat — a clipped highlight is exactly the part of a reflection that
 * makes metal read as metal.
 */
export function buildStudioEquirect(): THREE.DataTexture {
  const data = new Uint16Array(W * H * 4)
  const c = new THREE.Color()
  for (let y = 0; y < H; y++) {
    // v runs 0 at the top of the sphere to 1 at the bottom
    const el = 1 - (y + 0.5) / H
    for (let x = 0; x < W; x++) {
      const az = (x + 0.5) / W
      c.copy(FLOOR).lerp(CEIL, el)
      let gain = 1
      for (const l of LIGHTS) {
        // shortest angular distance on the azimuth circle, so a light near the seam still reads
        const dAz = Math.min(Math.abs(az - l.az), 1 - Math.abs(az - l.az))
        const d = Math.hypot(dAz / l.size, (el - l.el) / l.size)
        gain += l.gain * Math.exp(-d * d * 2.4)
      }
      const i = (y * W + x) * 4
      data[i] = THREE.DataUtils.toHalfFloat(c.r * gain)
      data[i + 1] = THREE.DataUtils.toHalfFloat(c.g * gain)
      data[i + 2] = THREE.DataUtils.toHalfFloat(c.b * gain)
      data[i + 3] = THREE.DataUtils.toHalfFloat(1)
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.LinearSRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * ...processed into the mip chain a physical material actually samples.
 *
 * `MeshStandardMaterial` picks its environment mip from the material's roughness, so an unprocessed
 * equirect gives a mirror at every roughness. PMREM builds the pre-convolved chain once, at mount,
 * from a 64×32 source — a few milliseconds, during the journey, on geometry nobody can see yet.
 */
export function buildStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const src = buildStudioEquirect()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromEquirectangular(src)
  pmrem.dispose()
  src.dispose()
  return target.texture
}

/**
 * One environment per renderer, shared by everything metallic.
 *
 * Two components reflect this studio — the desk's three rose-gold props and the globe stand — and
 * they must reflect the SAME room or the stand's ring and the trinket dish beside it are lit by
 * different studios. A WeakMap on the renderer rather than a module-level singleton, so a second
 * canvas (Storybook mounts several) gets its own and nothing leaks when one goes away.
 */
const cache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>()

export function studioEnvFor(renderer: THREE.WebGLRenderer): THREE.Texture {
  let tex = cache.get(renderer)
  if (!tex) {
    tex = buildStudioEnv(renderer)
    cache.set(renderer, tex)
  }
  return tex
}
