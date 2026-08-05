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

/**
 * Equirect resolution. 128×64 rather than 64×32, and it is not a detail budget — it is what lets a
 * softbox have an EDGE. PMREM convolves this for roughness 0.32, and a source that coarse cannot
 * resolve the tight specular band the approved render's ring carries; the reflection came out as one
 * broad smear. 32 kB of memory, still nothing over the wire.
 */
const W = 128
const H = 64

/**
 * THE ROOM, IN LINEAR RADIANCE — and the correction that this file exists to record.
 *
 * The first version built the room out of candidate B's own hexes (`#F7DEE6` floor, `#FFF7F8`
 * ceiling), which are linear 0.73–1.0, and then ADDED softbox gains starting from 1. Probed, that
 * environment had a minimum luminance of 0.897, a red channel that never fell below 1.071, and
 * ZERO texels below 0.5. It was a room made entirely of light.
 *
 * A metal reads as metal because it reflects DARK things. At metalness 1 there is no diffuse term to
 * carry shape, so every value on the surface is a sample of the room — and a room with no dark
 * values cannot give a surface a dark side. The cradle ring came out with a white core running down
 * the middle of the tube falling off symmetrically to pale pink at both edges: 36.8% of it railed at
 * R ≥ 254, 57% of the approved render's value variation gone, chroma 2.42×. Not a metal lit from
 * above-left. An emissive cylinder.
 *
 * So the room is now written the way a room actually is: a DARK base with lights on top of it, in
 * absolute linear radiance rather than as a tint multiplied by a gain that only ever adds.
 *
 *  - `ROOM_FLOOR` is the studio floor beyond the light pool. It is genuinely dark, and it is what
 *    the ring's lower and inner curves reflect — i.e. it is the entire reason the tube has a shaded
 *    underside instead of a symmetrical falloff.
 *  - `ROOM_HORIZON` is the lit cyc the desk itself stands against.
 *  - `ROOM_CEIL` is the ceiling bounce.
 *
 * All three keep candidate B's pink cast in their RATIOS while sitting far below 1, which is the
 * part the first version had backwards.
 */
const ROOM_FLOOR = new THREE.Color(0.052, 0.041, 0.046)
const ROOM_HORIZON = new THREE.Color(0.310, 0.258, 0.274)
const ROOM_CEIL = new THREE.Color(0.760, 0.690, 0.712)

/**
 * The softboxes, as they read in a reflection: position in (azimuth turns, elevation 0..1), an
 * angular half-size per axis, and a peak radiance.
 *
 * Rectangular-ish and separated on purpose. The GAPS between them are as load-bearing as the boxes
 * — a continuous wash of light is the failure above, and what makes a specular band read as a band
 * is that it stops.
 */
const LIGHTS: readonly { az: number; el: number; sizeAz: number; sizeEl: number; gain: number }[] = [
  // KEY_softbox — high and to the viewer's left, the T67 rig's dominant source and the one the
  // ring's upper surface catches as a band
  { az: 0.62, el: 0.80, sizeAz: 0.115, sizeEl: 0.150, gain: 3.30 },
  // FILL_bounce — opposite side, low and weak; it opens the shadow without filling it
  { az: 0.13, el: 0.52, sizeAz: 0.190, sizeEl: 0.220, gain: 0.55 },
  // TOP_wash — a broad strip across the ceiling
  { az: 0.0, el: 0.98, sizeAz: 0.360, sizeEl: 0.130, gain: 0.62 },
]

/**
 * How dark the side of the room away from the key is, as a fraction of the base.
 *
 * A cyc lit from one side falls off across its width, and that falloff is the second source of dark
 * content after the floor — it is what gives the ring a shaded FLANK as well as a shaded underside.
 */
const SHADE_SIDE = 0.34

/**
 * One re-derivable knob for the whole room's level.
 *
 * It stays at 1.0 because the radiances above are now absolute and were solved against the shipped
 * capture rather than against a tint. It survives as the single place to move the room if the
 * reference ever changes — but note the history: two previous rounds used a knob like this one to
 * compensate for the missing dark end, and both made the picture worse, because a level cannot fix
 * a RANGE problem. If the metal looks wrong, look at the range first.
 */
const ENV_EXPOSURE = 1.0

const smoothstep = (t: number): number => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/**
 * The raw equirectangular studio. `HalfFloatType` because the key's core is over 3× white and the
 * floor is under 0.05 — an 8-bit texture cannot hold both ends, and both ends are the point.
 */
export function buildStudioEquirect(): THREE.DataTexture {
  const data = new Uint16Array(W * H * 4)
  const c = new THREE.Color()
  const keyAz = LIGHTS[0].az
  for (let y = 0; y < H; y++) {
    // el runs 1 at the top of the sphere to 0 at the bottom
    const el = 1 - (y + 0.5) / H
    for (let x = 0; x < W; x++) {
      const az = (x + 0.5) / W

      // the room: dark floor -> lit cyc at the horizon -> ceiling bounce
      if (el < 0.5) c.copy(ROOM_FLOOR).lerp(ROOM_HORIZON, smoothstep(el / 0.5))
      else c.copy(ROOM_HORIZON).lerp(ROOM_CEIL, smoothstep((el - 0.5) / 0.5))

      // ...and it is only lit from ONE side, so the far side of it is genuinely dim
      const dKey = Math.min(Math.abs(az - keyAz), 1 - Math.abs(az - keyAz))
      c.multiplyScalar(SHADE_SIDE + (1 - SHADE_SIDE) * smoothstep(1 - dKey / 0.5))

      // the softboxes sit ON the room rather than scaling it, with gaps between them
      for (const l of LIGHTS) {
        const dAz = Math.min(Math.abs(az - l.az), 1 - Math.abs(az - l.az))
        const d = Math.hypot(dAz / l.sizeAz, (el - l.el) / l.sizeEl)
        if (d < 1.6) {
          const box = l.gain * smoothstep(1 - d / 1.6) ** 2
          c.r += box
          c.g += box * 0.962
          c.b += box * 0.944
        }
      }

      const i = (y * W + x) * 4
      data[i] = THREE.DataUtils.toHalfFloat(c.r * ENV_EXPOSURE)
      data[i + 1] = THREE.DataUtils.toHalfFloat(c.g * ENV_EXPOSURE)
      data[i + 2] = THREE.DataUtils.toHalfFloat(c.b * ENV_EXPOSURE)
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
