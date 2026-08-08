import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bakeLandSync } from '@/components/labs/small-world/scene/land-bake-client'
import { equirectPlanetUV, ICO_DETAIL, PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'
import { readLandDials } from '@/components/labs/small-world/scene/tunables'
import { makeBoilMaterial } from '@/components/labs/small-world/scene/boil-material'
import {
  PLANET_ATLAS_BYTE_BUDGET,
  PLANET_ATLAS_K,
  PLANET_ATLAS_SIZE,
  PLANET_ATLAS_URL,
} from '@/components/labs/small-world/scene/planet-atlas-contract'

/**
 * THE BAKE PIN — why this is a shipping gate and not a bench.
 *
 * The lighting atlas was rendered in Cycles against ONE specific terrain, and it is mounted by UV,
 * not by position. So if the land bake drifts by so much as a float, the baked light slides off
 * the hills it was baked for and the ending mis-shades — silently, and only at the money shot,
 * where no unit test would otherwise be looking. That is a regression, so it belongs in the gate
 * everyone runs (`pnpm test:unit`) rather than in `.superpowers/sdd/bench/`, which is opt-in and
 * exists to time things.
 *
 * THE HASHING SCHEME, recorded so the expected values are reproducible (T90 spike §3):
 *
 *  - per array: sha256 over the array's RAW BYTES exactly as they sit in its ArrayBuffer — i.e.
 *    little-endian IEEE-754 f32 (or i32 for capIdx), no separators, no length prefix — hex
 *    digest, TRUNCATED TO THE FIRST 16 CHARACTERS.
 *  - overall: one sha256 fed the same 14 arrays back to back IN THE `KEYS` ORDER BELOW, full hex.
 *    `thetaC` is deliberately not in it (the spike's harness enumerated these fourteen).
 *  - dials: sha256 over `JSON.stringify(readLandDials())` — so key ORDER is part of the hash —
 *    truncated to 16.
 *
 * The dials hash is asserted IN THE SAME TEST as the arrays on purpose. Split apart, a dial that
 * drifted would fail the array hashes and read as a float-path regression; together, the two
 * failures distinguish themselves.
 *
 * SCOPE: this pins the bake across JS contexts on a given machine. It is a determinism pin, not a
 * cross-CPU tolerance. A mismatch on new hardware is a finding to investigate, never a number to
 * update in place.
 */
const KEYS = [
  'positionsA', 'positionsB',
  'colorsA', 'colorsB', 'colorsC',
  'normalsA', 'normalsB',
  'floodedPositions', 'floodedColors', 'floodedNormals',
  'capIdx', 'capNx', 'capNy', 'capNz',
] as const

const EXPECTED: Record<(typeof KEYS)[number], string> = {
  positionsA: 'c7251d682baa60b0',
  positionsB: '19d3e4e1da470ccc',
  colorsA: '73a83185b4c674cd',
  colorsB: '93b1c2db35c8829c',
  colorsC: '8a240925fe6a0297',
  normalsA: '89846a6732df3fb7',
  normalsB: '9ee8048d649587f3',
  floodedPositions: 'e4ab3230b7f78324',
  floodedColors: 'fe3b630eb8f402d9',
  floodedNormals: 'becc218e2bdab9d6',
  capIdx: '42d28d559f00a78d',
  capNx: '3adacb30b7ce389a',
  capNy: 'e871bbd840eebd3e',
  capNz: '899e8e255aeebb67',
}
const EXPECTED_TOTAL = '18a696468b1e2dc61ed5534c36c8eac89e5b016d7d8540700c4f22636b6b1cc1'
const EXPECTED_DIALS = 'd9e75e05dbd22497'
/** ICO_DETAIL 24 → 37,500 non-indexed verts → 12,500 faces. */
const VERTS = 37_500

const bytesOf = (a: Float32Array | Int32Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)
const short = (a: Float32Array | Int32Array) =>
  createHash('sha256').update(bytesOf(a)).digest('hex').slice(0, 16)

describe('journey planet — the bake the lighting atlas was rendered against', () => {
  it('reproduces the pinned per-array hashes AND the dial snapshot they were taken under', () => {
    const dials = readLandDials()
    const bake = bakeLandSync(dials)

    const dialsHash = createHash('sha256').update(JSON.stringify(dials)).digest('hex').slice(0, 16)
    const arrays = Object.fromEntries(KEYS.map((k) => [k, short(bake[k])]))

    // Asserted as one object so a failure prints every drifted array at once, next to the dials —
    // which is the whole point of hashing them together.
    expect({ ...arrays, dials: dialsHash }).toEqual({ ...EXPECTED, dials: EXPECTED_DIALS })

    const all = createHash('sha256')
    for (const k of KEYS) all.update(bytesOf(bake[k]))
    expect(all.digest('hex')).toBe(EXPECTED_TOTAL)

    expect(bake.positionsA.length / 3).toBe(VERTS)
  })

  it('carries the atlas UV on the resolved bake, sized to the geometry', () => {
    // The UV never crosses the worker boundary — the client attaches it to both the worker and the
    // synchronous path — so this is the gate that it is attached at all.
    const bake = bakeLandSync(readLandDials())
    expect(bake.uv).toBeInstanceOf(Float32Array)
    expect(bake.uv.length).toBe(VERTS * 2)
  })
})

describe('journey planet — the equirect UV the atlas is mounted by', () => {
  const base = new Float32Array(VERTS * 3)
  // Rebuilt here from the same two constants the runtime uses, rather than imported, so the test
  // would notice if the base sphere itself moved under the map.
  {
    const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, ICO_DETAIL)
    base.set(geo.attributes.position.array as Float32Array)
    geo.dispose()
  }
  const uv = equirectPlanetUV(base, VERTS)

  it('keeps v inside [0,1] — the axis the sampler clamps', () => {
    let lo = Infinity
    let hi = -Infinity
    for (let i = 1; i < uv.length; i += 2) {
      if (uv[i] < lo) lo = uv[i]
      if (uv[i] > hi) hi = uv[i]
    }
    expect(lo, `v min ${lo}`).toBeGreaterThanOrEqual(0)
    expect(hi, `v max ${hi}`).toBeLessThanOrEqual(1)
  })

  it('pushes seam faces past u = 1 rather than folding them — the reason u wraps', () => {
    let hi = -Infinity
    for (let i = 0; i < uv.length; i += 2) if (uv[i] > hi) hi = uv[i]
    // Above 1 (the repair fired) but well under 2 (it only ever shifts by one turn).
    expect(hi, `u max ${hi}`).toBeGreaterThan(1)
    expect(hi, `u max ${hi}`).toBeLessThan(2)
  })

  it('leaves the meridian repaired everywhere except the two pole caps', () => {
    // A face still spanning more than half the sheet in u smears the whole atlas across one
    // triangle — the failure the per-face repair exists to prevent. It is repaired EVERYWHERE
    // except at the poles, and that exception is inherent rather than a bug: a triangle with a
    // vertex on the axis genuinely occupies a wide swath of longitude in an equirect map, and no
    // per-face shift can make it narrow. It is the same pole distortion the T90 spike flagged as
    // its second open defect (§5b) and is one half of the "dark seam near the pole".
    //
    // It does not threaten the MOUNT, which is what this gate is for: Blender was handed this
    // exact map, so those two faces are smeared identically in the bake and in the runtime. This
    // is therefore a CHARACTERISATION pin — if the count or the reach ever moves, the map has
    // changed under an atlas that was rendered for the old one.
    const wide: number[] = []
    let worst = 0
    for (let f = 0; f < VERTS; f += 3) {
      const a = uv[f * 2], b = uv[(f + 1) * 2], c = uv[(f + 2) * 2]
      const span = Math.max(a, b, c) - Math.min(a, b, c)
      worst = Math.max(worst, span)
      if (span > 0.5) wide.push(f)
    }
    expect(wide.length, `faces still wider than 0.5: ${wide.length}`).toBe(2)
    expect(worst, `widest face span ${worst}`).toBeLessThanOrEqual(0.75)
    // ...and both of them are polar. |v - 0.5| = 0.492 is latitude 88.6°, i.e. the cap triangles.
    for (const f of wide) {
      let reach = 0
      for (let k = 0; k < 3; k++) reach = Math.max(reach, Math.abs(uv[(f + k) * 2 + 1] - 0.5))
      expect(reach, `face ${f} reaches |lat| ${reach}`).toBeGreaterThan(0.49)
    }
  })
})

describe('lighting atlas — the shader mount', () => {
  it('injects at chunk names the INSTALLED three actually has', () => {
    // `onBeforeCompile` rewrites by string replace, so a three upgrade that renames a chunk does
    // not throw — it silently drops the injection and the ending quietly stops crossfading. This
    // is the gate for that. `<opaque_fragment>` in particular was `<output_fragment>` in older
    // revisions, and it is the one we hang the whole baked term on.
    expect(THREE.ShaderLib.toon.fragmentShader).toContain('#include <opaque_fragment>')
    expect(THREE.ShaderLib.toon.vertexShader).toContain('#include <uv_vertex>')
    expect(THREE.ShaderLib.toon.vertexShader).toContain('#include <beginnormal_vertex>')
  })

  it('guards the whole baked term behind the mix, so mix 0 runs none of it', () => {
    const ramp = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
    const { material, uniforms } = makeBoilMaterial(ramp)
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: THREE.ShaderLib.toon.vertexShader,
      fragmentShader: THREE.ShaderLib.toon.fragmentShader,
    }
    material.onBeforeCompile(shader as never, null as never)

    expect(shader.uniforms.uBakeAtlas).toBe(uniforms.uBakeAtlas)
    expect(shader.uniforms.uBakeK).toBe(uniforms.uBakeK)
    expect(shader.uniforms.uBakeMix).toBe(uniforms.uBakeMix)
    expect(uniforms.uBakeK.value).toBe(PLANET_ATLAS_K)
    // The crossfade must START at 0 — the journey is the atlas's loading time.
    expect(uniforms.uBakeMix.value).toBe(0)

    // The material has no map, so three emits neither vMapUv nor vUv; we carry our own varying.
    expect(shader.vertexShader).toContain('varying vec2 vBakeUv;')
    expect(shader.vertexShader).toContain('vBakeUv = uv;')

    // ...and every line that touches the baked term sits inside the branch. Bit-identity at mix 0
    // is STRUCTURAL: an unconditional mix() would divide and re-multiply `outgoingLight` on every
    // fragment of the whole journey and change the shipped frame's last bits.
    const injected = shader.fragmentShader.slice(
      shader.fragmentShader.indexOf('if (uBakeMix > 0.0)'),
      shader.fragmentShader.indexOf('#include <opaque_fragment>')
    )
    expect(injected).not.toBe('')
    expect(injected).toContain('texture2D(uBakeAtlas, vBakeUv)')
    expect(injected).toContain('outgoingLight / albedo')
    expect(injected.split('}').pop()?.trim()).toBe('')
  })
})

/** RIFF/WebP dimensions, for the three container variants a q90 encode can produce. */
function webpSize(buf: Buffer): { w: number; h: number } {
  expect(buf.toString('ascii', 0, 4)).toBe('RIFF')
  expect(buf.toString('ascii', 8, 12)).toBe('WEBP')
  const fourcc = buf.toString('ascii', 12, 16)
  if (fourcc === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
  if (fourcc === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (fourcc === 'VP8X') {
    return {
      w: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
      h: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
    }
  }
  throw new Error(`unrecognised WebP chunk ${fourcc}`)
}

describe('lighting atlas — payload', () => {
  const atlasPath = path.join(process.cwd(), 'public', PLANET_ATLAS_URL)

  it('fits the round headroom the feature promised not to raise', () => {
    // Measured RAW, not gzipped, unlike the GLB gate: WebP is already entropy-coded, so gzip
    // returns it to within a rounding error and the raw length IS what a browser downloads.
    const bytes = statSync(atlasPath).size
    expect(bytes, `atlas ${bytes} B`).toBeLessThanOrEqual(PLANET_ATLAS_BYTE_BUDGET)
  })

  it('is the sheet the budget was argued for', () => {
    // Bytes alone are not enough: a 1024² at a lower quality would fit the budget and lose the
    // form the resolution was chosen for.
    const { w, h } = webpSize(readFileSync(atlasPath))
    expect({ w, h }).toEqual({ w: PLANET_ATLAS_SIZE, h: PLANET_ATLAS_SIZE })
  })
})
