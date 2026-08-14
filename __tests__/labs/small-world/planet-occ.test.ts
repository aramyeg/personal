import { statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { makeBoilMaterial } from '@/components/labs/small-world/scene/boil-material'
import { FLIP_START, FLIP_WIDTH, STANCE_ALPHA } from '@/components/labs/small-world/scene/renewal'
import {
  PLANET_OCC_A_URL,
  PLANET_OCC_B_URL,
  PLANET_OCC_BYTE_BUDGET,
  PLANET_OCC_FLOOR,
  PLANET_OCC_OPEN,
  PLANET_OCC_POW,
  PLANET_OCC_SIZE,
} from '@/components/labs/small-world/scene/planet-occ-contract'
// The build-time encoder, imported for its own `fold` — so the gate below shapes the reference
// with the exact expression that shaped the shipped file rather than a restatement of it.
import { fold } from '../../../scripts/small-world/occ-encode.mjs'
import { loadSharp } from '../../../scripts/small-world/load-sharp.mjs'

/**
 * THE JOURNEY'S OCCLUSION ATLASES (T130).
 *
 * Two things can go wrong with a shipped image that no other test would notice, and they are what
 * this file is for:
 *
 *  1. **The wrong image ships.** These atlases are rendered offline and committed as binaries, so
 *     nothing in the build re-derives them. A re-encode that forgot the fold looks exactly like a
 *     correct one from the outside — same name, same dimensions, plausible size — and shows up as
 *     a dark stain across the delta meadow at runtime, on a lab nobody unit-tests visually. The
 *     decoded histogram is the discriminator: the fold's whole purpose is to put every texel inside
 *     [floor, 1], and the raw bake's minimum is 0.18.
 *  2. **The shader stops modulating.** `onBeforeCompile` rewrites by string replace, so a three
 *     upgrade that renames a chunk silently drops the injection and the planet quietly loses its
 *     form. Same failure class `planet-atlas.test.ts` gates for the ending's atlas.
 */

const filePath = (url: string) => path.join(process.cwd(), 'public', url)

describe('occlusion atlases — payload', () => {
  it('fits the pair inside the atlas round’s remaining headroom', () => {
    // ONE pin, gating the FILES ON DISK: the encoder re-encodes on write, so an in-memory buffer
    // length is not the wire length. Raw, not gzipped — WebP is already entropy-coded.
    const a = statSync(filePath(PLANET_OCC_A_URL)).size
    const b = statSync(filePath(PLANET_OCC_B_URL)).size
    expect(a + b, `pair ${a + b} B (a ${a}, b ${b})`).toBeLessThanOrEqual(PLANET_OCC_BYTE_BUDGET)
  })

  it('is the sheet the budget was argued for', async () => {
    // Bytes alone are not enough: a 1024² at a lower quality would fit the budget and lose the
    // form the resolution was chosen for.
    const sharp = loadSharp()
    for (const url of [PLANET_OCC_A_URL, PLANET_OCC_B_URL]) {
      const m = await sharp(filePath(url)).metadata()
      expect({ w: m.width, h: m.height, ch: m.channels }, url).toEqual({
        w: PLANET_OCC_SIZE,
        h: PLANET_OCC_SIZE,
        ch: 3,
      })
    }
  })
})

describe('occlusion atlases — the shaping is folded in, and the shipped files prove it', () => {
  // WebP at the shipped quality is lossy, so every bound here carries slack. It is sized to catch a
  // STRUCTURAL error (an unfolded sheet, an sRGB transform, a channel swap) rather than a codec's
  // few-step wobble at a contact edge: the raw bake's floor is 0.18, which misses by 0.32.
  const LOSSY = 0.03

  it.each([
    ['A', PLANET_OCC_A_URL],
    ['B', PLANET_OCC_B_URL],
  ])('variant %s stores a multiplier inside [floor, 1]', async (_v, url) => {
    const sharp = loadSharp()
    const px = await sharp(filePath(url)).raw().toBuffer()
    let min = 1
    let max = 0
    for (let i = 0; i < px.length; i++) {
      const v = px[i] / 255
      if (v < min) min = v
      if (v > max) max = v
    }
    // The floor is IN THE IMAGE. An unfolded sheet bottoms out near 0.18 and fails here by 10x the
    // slack; this is the assertion that a forgotten fold cannot slip past.
    expect(min, `min texel ${min.toFixed(4)}`).toBeGreaterThanOrEqual(PLANET_OCC_FLOOR - LOSSY)
    // ...and the open field is still pinned at exactly the identity, which is what makes
    // `mix(vec3(1.0), occ, m)` a no-op over open ground at any strength.
    expect(max, `max texel ${max.toFixed(4)}`).toBeCloseTo(PLANET_OCC_OPEN, 2)
  })

  it('leaves the shader nothing to shape — the fold is the whole transform', () => {
    // The three properties the runtime's ONE multiply depends on. Asserted against the encoder's
    // own expression, so a change to the fold has to come here to be accepted.
    expect(fold(1, PLANET_OCC_POW, PLANET_OCC_FLOOR)).toBe(PLANET_OCC_OPEN)
    expect(fold(0, PLANET_OCC_POW, PLANET_OCC_FLOOR)).toBe(PLANET_OCC_FLOOR)
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const v = fold(i / 200, PLANET_OCC_POW, PLANET_OCC_FLOOR)
      expect(v, `fold(${i / 200})`).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('occlusion atlases — the shader mount', () => {
  const compile = () => {
    const ramp = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    const { material, uniforms } = makeBoilMaterial(ramp)
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: THREE.ShaderLib.toon.vertexShader,
      fragmentShader: THREE.ShaderLib.toon.fragmentShader,
    }
    material.onBeforeCompile(shader as never, null as never)
    return { shader, uniforms }
  }

  it('binds every occlusion uniform and starts the modulation off', () => {
    const { shader, uniforms } = compile()
    for (const k of ['uOccA', 'uOccB', 'uOccMix', 'uOccRot'] as const) {
      expect(shader.uniforms[k], k).toBe(uniforms[k])
    }
    // The journey is the atlases' loading time, and the term MULTIPLIES — a sampler with no image
    // reads black, so starting anywhere but 0 would black out the planet on the first frames.
    expect(uniforms.uOccMix.value).toBe(0)
  })

  it('declares every symbol it uses — the failure that renders a bare water sphere', () => {
    // A uniform used in the body but missing from the declaration block fails VALIDATE_STATUS and
    // the land mesh simply stops drawing. T128 caught exactly that, and only because the CONTROL
    // column of a capture changed too.
    const { shader } = compile()
    for (const decl of [
      'uniform sampler2D uOccA;',
      'uniform sampler2D uOccB;',
      'uniform float uOccMix;',
      'varying float vOccBlend;',
    ]) {
      expect(shader.fragmentShader, decl).toContain(decl)
    }
    expect(shader.vertexShader).toContain('uniform float uOccRot;')
    expect(shader.vertexShader).toContain('varying float vOccBlend;')
    expect(shader.vertexShader).toContain('vOccBlend = smoothstep(')
  })

  it('costs one multiply — no shaping survives in the fragment stage', () => {
    const { shader } = compile()
    const start = shader.fragmentShader.indexOf('if (uOccMix > 0.0)')
    expect(start).toBeGreaterThan(0)
    const injected = shader.fragmentShader.slice(
      start,
      shader.fragmentShader.indexOf('#include <opaque_fragment>')
    )
    expect(injected).toContain('texture2D(uOccA, vBakeUv)')
    expect(injected).toContain('texture2D(uOccB, vBakeUv)')
    expect(injected).toContain('outgoingLight *= mix(vec3(1.0), occ, uOccMix)')
    // THE POINT OF THE FOLD. Three `pow`s per land fragment per frame is what this feature stopped
    // paying, and the only way that regresses is by coming back into this block.
    expect(injected, 'the exponent belongs in the atlas, not the fragment').not.toContain('pow(')
    // ...and every line of it sits inside the branch, so the money shot runs none of it.
    expect(injected.split('}').pop()?.trim()).toBe('')
  })

  it('blends the two variants on the SAME front the geometry morph uses', () => {
    // The shader recomputes `renewalGate` rather than taking an attribute. That is only safe while
    // it recomputes the CPU's constants — a typed literal here would drift the occlusion off the
    // terrain by half a chapter without breaking anything that throws.
    const { shader } = compile()
    expect(shader.vertexShader).toContain(`float occSeam = ${STANCE_ALPHA};`)
    expect(shader.vertexShader).toContain(
      `smoothstep(${FLIP_START}, ${FLIP_START + FLIP_WIDTH}, uOccRot - occTc)`
    )
  })
})
