import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { bakeLandSync } from '@/components/labs/small-world/scene/land-bake-client'
import { readLandDials } from '@/components/labs/small-world/scene/tunables'
import { ICO_DETAIL, PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'

/**
 * STEP 1 OF THE OCCLUSION BAKE PIPELINE — serialize the journey terrain (BOTH variants) for
 * `scripts/small-world/occ-bake.py`.
 *
 *   SMALL_WORLD_OCC_GEO_OUT=…/geo pnpm vitest run __tests__/labs/small-world/occ-export-geo.test.ts
 *   blender -b --factory-startup --python scripts/small-world/occ-bake.py -- --geo …/geo --out …/atlas --variant A
 *   node scripts/small-world/occ-encode.mjs --in …/atlas --variant A --out public/labs/small-world/planet-occ-a.webp
 *
 * ── WHY THE EXPORTER IS A TEST ────────────────────────────────────────────────────────────────
 *
 * Because the ONLY correct source of the geometry is the shipped `bakeLandSync` under the shipped
 * dials, and that is TypeScript behind the `@/` alias. A `.mjs` script could not import it without
 * a build step, and a script that rebuilt the terrain itself would be a mirror of the runtime that
 * drifts — which is exactly how a bake ends up occluding geometry the browser does not draw. The
 * test runner already resolves both, so the export rides in it.
 *
 * It is INERT without the env var. A bake is an offline, minutes-long, GPU-bound act and this file
 * runs in everyone's `pnpm test:unit`; writing 4 MB of float buffers into a developer's working
 * tree as a side effect of running the suite would be a defect, not a feature. With the variable
 * absent the assertions still run — they hold the geometry to the shape the shipped atlases were
 * baked against, which is worth gating on its own.
 *
 * Raw little-endian float32, not PLY, deliberately: T90 paid once for Blender's PLY importer
 * silently applying an axis conversion. A uniform-sky occlusion bake has no orientation at all so
 * the frame question cannot arise here — but reading raw buffers keeps it that way by construction.
 *
 * Layout, per variant: `positions` (count*3), `normals` (count*3), `colors` (count*3), plus one
 * shared `uv` (count*2). Non-indexed, contiguous face triplets.
 */
const OUT = process.env.SMALL_WORLD_OCC_GEO_OUT ?? null

describe('occlusion bake — the geometry Blender is handed', () => {
  it('is the shipped bake, at the shape the atlases were rendered against', () => {
    const b = bakeLandSync(readLandDials())
    const count = b.positionsA.length / 3
    // three subdivides each icosahedron edge into (detail+1) segments, so
    // IcosahedronGeometry(R, 24) non-indexed = 20 * 25² faces * 3 = 37,500 verts.
    expect(count).toBe(20 * (ICO_DETAIL + 1) * (ICO_DETAIL + 1) * 3)
    // ONE uv for both variants — the two atlases are registered with each other and with the
    // ending's by construction, rather than by two exports agreeing.
    expect(b.uv.length).toBe(count * 2)
    expect(b.positionsB.length).toBe(b.positionsA.length)

    if (!OUT) return
    fs.mkdirSync(OUT, { recursive: true })
    const w = (name: string, a: Float32Array): void => {
      fs.writeFileSync(path.join(OUT, name), Buffer.from(a.buffer, a.byteOffset, a.byteLength))
    }
    w('posA.f32', b.positionsA)
    w('posB.f32', b.positionsB)
    w('norA.f32', b.normalsA)
    w('norB.f32', b.normalsB)
    w('colA.f32', b.colorsA)
    w('colB.f32', b.colorsB)
    w('uv.f32', b.uv)
    fs.writeFileSync(
      path.join(OUT, 'meta.json'),
      JSON.stringify({ count, icoDetail: ICO_DETAIL, planetRadius: PLANET_RADIUS }, null, 2)
    )
  })
})
