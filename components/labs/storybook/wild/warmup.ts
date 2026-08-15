'use client'

/**
 * WILD lane — idle-time warmup.
 *
 * The diorama's first mount used to pay for everything at once: five 1024-square procedural
 * skins plus their Sobel-derived normal/roughness maps, the window atlases and the night
 * stage's sky/cobble/mist paintings — ~15M canvas pixel ops on the main thread, landing as a
 * 700ms–2.5s dead frame exactly as the reader turned the page (production profile,
 * scratch/perf/). Every painter is cached at module level, so the fix is scheduling: run one
 * paint job per idle slice starting at book load, and the reader's page-turn finds the cache
 * warm. A mount that arrives before its job simply pays for that one job inline — the queue
 * is idempotent.
 */

type Job = () => void

let started = false

const schedule = (fn: () => void): void => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => fn(), { timeout: 800 })
  } else {
    setTimeout(fn, 40)
  }
}

/** Run each job in its own idle slice, in order. Safe to call once; later calls no-op. */
export function scheduleWildWarmup(jobs: readonly Job[]): void {
  if (started || typeof window === 'undefined') return
  started = true
  const queue = [...jobs]
  const next = (): void => {
    const job = queue.shift()
    if (!job) return
    try {
      job()
    } catch {
      // A failed warm job is only a lost head start — the mount path repaints on demand.
    }
    schedule(next)
  }
  schedule(next)
}
