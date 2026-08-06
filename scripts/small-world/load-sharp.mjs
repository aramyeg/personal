/**
 * Resolve `sharp` for the build-time art scripts.
 *
 * WHY THIS EXISTS. sharp is not a declared dependency of this repo — it arrives
 * as a transitive dependency of Next's image optimizer, so it is present in the
 * pnpm store but NOT linked at the top level of `node_modules`, and a plain
 * `import sharp from 'sharp'` throws ERR_MODULE_NOT_FOUND. Adding it to
 * package.json would mean a lockfile change and a reinstall into a node_modules
 * tree that several git worktrees share by junction — a large, shared-state
 * change to buy one offline script an import. This resolves the copy that is
 * already on disk instead.
 *
 * The plain resolution is tried FIRST, so if sharp is ever promoted to a real
 * dependency this file quietly becomes a no-op wrapper rather than a thing to
 * remember to delete.
 */
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export function loadSharp() {
  const require = createRequire(path.join(REPO_ROOT, 'package.json'))
  try {
    return require('sharp')
  } catch (err) {
    if (err?.code !== 'MODULE_NOT_FOUND') throw err
  }

  const store = path.join(REPO_ROOT, 'node_modules', '.pnpm')
  let candidates
  try {
    candidates = readdirSync(store).filter((d) => /^sharp@/.test(d)).sort()
  } catch {
    candidates = []
  }
  // Newest version last after the lexical sort — good enough here, since every
  // sharp in the store satisfies the small API surface these scripts use.
  for (const dir of candidates.reverse()) {
    try {
      return require(path.join(store, dir, 'node_modules', 'sharp'))
    } catch {
      // try the next one
    }
  }

  throw new Error(
    'sharp not found. It normally arrives with Next; run `pnpm install`, or add sharp to devDependencies if that no longer holds.'
  )
}
