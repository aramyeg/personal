#!/usr/bin/env node
/**
 * merge-clips.mjs — fold Meshy animation exports onto the shared girl rig.
 *
 * Aram generates each new clip (Idle, Walk_Backward, Wave, ...) in Meshy ON THE
 * SAME rigged girl asset, exporting one GLB per clip. Every export carries the
 * full mesh + skeleton, but only its animation is new. This script takes the
 * base girl.glb plus N animation GLBs and produces ONE girl.glb whose
 * `animations` array holds every clip renamed to the slot names girl-anim.ts
 * expects — with the duplicate meshes / materials / skeletons the extras drag
 * along stripped out.
 *
 * It works by retargeting: each extra's animation channels are re-pointed from
 * that export's copy of the skeleton to the BASE rig's bones (matched by node
 * name — identical because it is the same Meshy rig), then the orphaned
 * duplicate scene/mesh/skin is pruned away. Renaming an already-merged slot
 * replaces it, so re-running is idempotent (no clip piles up).
 *
 * USAGE
 *   node scripts/small-world/merge-clips.mjs \
 *     --base public/labs/small-world/girl.glb \
 *     --out  public/labs/small-world/girl.glb \
 *     Idle=path/to/idle.glb Walk_Backward=path/to/back.glb Wave=path/to/wave.glb
 *
 *   node scripts/small-world/merge-clips.mjs --self-test
 *     Merges the current girl.glb with itself under the name "Idle" into a temp
 *     file and asserts the load (clip added, meshes deduped, channels retargeted).
 *     Used as the test until real clips land — do NOT commit the produced GLB.
 *
 * Determinism: gltf-transform read/merge/prune/write are pure functions of the
 * inputs (no wall-clock, no RNG). Same GLBs in → byte-identical GLB out.
 */
import { NodeIO } from '@gltf-transform/core'
import { mergeDocuments, prune } from '@gltf-transform/functions'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @param {object} opts
 * @param {string} opts.base   path to the base girl.glb
 * @param {string} opts.out    path to write the merged girl.glb
 * @param {{name:string,path:string}[]} opts.clips  slot-name → animation GLB
 * @returns {Promise<{out:string, animations:string[], meshes:number}>}
 */
export async function mergeClips({ base, out, clips }) {
  const io = new NodeIO()
  const doc = await io.read(base)
  const root = doc.getRoot()

  // The base rig's bones, keyed by name — the retarget destination. Captured
  // once; merged duplicates never enter this map.
  const baseNodesByName = new Map(root.listNodes().map((n) => [n.getName(), n]))

  for (const { name, path } of clips) {
    // Idempotency: a slot already filled is replaced, never doubled.
    for (const anim of root.listAnimations()) {
      if (anim.getName() === name) anim.dispose()
    }

    const src = await io.read(path)
    const srcAnims = src.getRoot().listAnimations()
    if (srcAnims.length === 0) throw new Error(`no animations found in ${path}`)
    const srcAnim = srcAnims[0]

    // Copy the export's graph into the base document; `map` pairs every source
    // property with its fresh copy in `doc`.
    const map = mergeDocuments(doc, src)
    const mergedAnim = map.get(srcAnim)
    if (!mergedAnim) throw new Error(`failed to copy animation from ${path}`)
    mergedAnim.setName(name)

    // Retarget every channel onto the base rig's bone of the same name, so the
    // animation no longer depends on the export's duplicate skeleton.
    for (const channel of mergedAnim.listChannels()) {
      const dupNode = channel.getTargetNode()
      if (!dupNode) continue
      const baseNode = baseNodesByName.get(dupNode.getName())
      if (baseNode) channel.setTargetNode(baseNode)
    }

    // Everything else the merge copied (the export's scene, nodes, mesh, skin,
    // materials, textures, and its now-orphan vertex accessors) is a duplicate
    // of what the base already has — dispose it, keeping only the animation and
    // the accessors its samplers read. Buffers are left for the consolidation
    // pass below (kept accessors still point into them here).
    const keep = new Set([mergedAnim, ...mergedAnim.listChannels(), ...mergedAnim.listSamplers()])
    for (const sampler of mergedAnim.listSamplers()) {
      keep.add(sampler.getInput())
      keep.add(sampler.getOutput())
    }
    for (const [, copy] of map) {
      if (keep.has(copy) || copy.propertyType === 'Buffer') continue
      copy.dispose()
    }
  }

  await doc.transform(prune())

  // Each merged export arrived with its own buffer; a GLB allows only one, so
  // pull every surviving accessor onto the base buffer and drop the empties.
  const mainBuffer = root.listBuffers()[0]
  for (const accessor of root.listAccessors()) accessor.setBuffer(mainBuffer)
  for (const buffer of root.listBuffers()) {
    if (buffer !== mainBuffer) buffer.dispose()
  }

  await io.write(out, doc)

  const reloaded = await new NodeIO().read(out)
  const rRoot = reloaded.getRoot()
  return {
    out,
    animations: rRoot.listAnimations().map((a) => a.getName()),
    meshes: rRoot.listMeshes().length,
  }
}

/** Parse `Slot=path.glb` pairs and `--base` / `--out` flags from argv. */
function parseArgs(argv) {
  const opts = { base: 'public/labs/small-world/girl.glb', out: null, clips: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') opts.base = argv[++i]
    else if (a === '--out') opts.out = argv[++i]
    else if (a.includes('=')) {
      const idx = a.indexOf('=')
      opts.clips.push({ name: a.slice(0, idx), path: a.slice(idx + 1) })
    }
  }
  opts.out ||= opts.base
  return opts
}

/**
 * Self-test: merge the current girl.glb with itself under "Idle" and assert the
 * result. Proves the pipeline end-to-end before real clips exist. Writes to a
 * temp file only — never commits a GLB.
 */
async function selfTest() {
  const base = 'public/labs/small-world/girl.glb'
  const before = await new NodeIO().read(base)
  const beforeAnims = before.getRoot().listAnimations().length
  const beforeMeshes = before.getRoot().listMeshes().length

  const out = join(tmpdir(), 'girl-merge-selftest.glb')
  const result = await mergeClips({ base, out, clips: [{ name: 'Idle', path: base }] })

  const checks = []
  const assert = (label, ok) => {
    checks.push({ label, ok })
    if (!ok) process.exitCode = 1
  }
  assert(`clip count grew by exactly 1 (${beforeAnims} → ${result.animations.length})`,
    result.animations.length === beforeAnims + 1)
  assert(`"Idle" slot present`, result.animations.includes('Idle'))
  assert(`meshes NOT duplicated (${beforeMeshes} → ${result.meshes})`,
    result.meshes === beforeMeshes)

  // Idempotency: a second run over the SAME base+slot yields the same count.
  const rerun = await mergeClips({ base: out, out, clips: [{ name: 'Idle', path: base }] })
  assert(`idempotent re-run keeps clip count (${rerun.animations.length})`,
    rerun.animations.length === result.animations.length)

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label}`)
  console.log(`\nanimations: [${result.animations.join(', ')}]  meshes: ${result.meshes}`)
  console.log(`(temp output: ${out} — not committed)`)
  if (process.exitCode === 1) console.log('\nSELF-TEST FAILED')
  else console.log('\nSELF-TEST PASSED')
}

// CLI entry — only when run directly, not when imported by a test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    await selfTest()
  } else {
    const opts = parseArgs(argv)
    if (opts.clips.length === 0) {
      console.log('usage: merge-clips.mjs [--base girl.glb] [--out girl.glb] Slot=clip.glb ...')
      console.log('       merge-clips.mjs --self-test')
      process.exit(1)
    }
    const result = await mergeClips(opts)
    console.log(`wrote ${result.out}`)
    console.log(`animations: [${result.animations.join(', ')}]  meshes: ${result.meshes}`)
  }
}
