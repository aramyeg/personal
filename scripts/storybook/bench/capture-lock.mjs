/**
 * THE SHARED CAPTURE LOCK, ACQUIRED ATOMICALLY.
 *
 * Lanes serialise their live captures on one path under the labs-storybook
 * worktree. The original helper there takes it with existsSync-then-writeFile,
 * which is not atomic and — worse — CRASHES with EISDIR if another lane happens
 * to hold the same path as a directory (mkdir is the other obvious way to write
 * this, and lanes have used both). Measured during S5R2: three of this lane's
 * probe runs died with `capture lock held > 8min` while the holder was perfectly
 * healthy, because the waiter could never take a lock it was able to see.
 *
 * `mkdir` is atomic on every filesystem this runs on, and a directory is exactly
 * what an existsSync waiter is already looking for, so this interoperates in
 * both directions: file-style holders block us, and we block them.
 *
 * The holder writes its tag inside, so a stale lock names the lane that left it.
 */
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const LOCK =
  'C:/Users/GBM/Documents/Projects/personal/.claude/worktrees/labs-storybook/.superpowers/sdd/bench/.capture-lock'

/** Take the lock, waiting up to `waitMs` for whoever has it. */
export async function acquireLock(tag, waitMs = 30 * 60 * 1000) {
  const start = Date.now()
  for (;;) {
    try {
      mkdirSync(LOCK)
      break
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
      if (Date.now() - start > waitMs) {
        throw new Error(`capture lock held > ${Math.round(waitMs / 60000)}min`)
      }
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  try {
    writeFileSync(path.join(LOCK, 'holder.txt'), `${tag} ${new Date().toISOString()}\n`)
  } catch {
    // the tag is a courtesy, never a requirement
  }
}

export function releaseLock() {
  try {
    rmSync(LOCK, { recursive: true, force: true })
  } catch {}
}

export const lockHeld = () => existsSync(LOCK)
