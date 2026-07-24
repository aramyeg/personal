import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { loadOutline as LoadOutline, Outline } from '@/components/labs/storybook/book/use-layer-outline'

// The shaped-mesh outline loader (E2.1). Same manifest-gated contract as
// loadArtTexture: consult `outlines.json` first so a missing sidecar costs zero
// requests, and a missing sidecar must resolve to onError (=> the caller keeps
// the rectangle quad). The manifest is cached in a module-level promise, so each
// test resets the registry and re-imports fresh.

type Resp = { ok: boolean; json: () => Promise<unknown> }

function mockFetch(
  manifest: readonly string[],
  outlines: Record<string, Outline>,
  opts: { outlineOk?: boolean } = {}
): { calls: string[] } {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string): Promise<Resp> => {
      calls.push(url)
      if (url.endsWith('outlines.json')) return { ok: true, json: async () => [...manifest] }
      const id = url.match(/([^/]+)\.outline\.json$/)?.[1]
      if (id && outlines[id] && (opts.outlineOk ?? true)) return { ok: true, json: async () => outlines[id] }
      return { ok: false, json: async () => Promise.reject(new Error('404')) }
    })
  )
  return { calls }
}

async function freshLoadOutline(): Promise<typeof LoadOutline> {
  vi.resetModules()
  return (await import('@/components/labs/storybook/book/use-layer-outline')).loadOutline
}

const SAMPLE: Outline = [
  [0, 0],
  [0, 0.5],
  [0.5, 0.9],
  [1, 0.5],
  [1, 0],
]

describe('loadOutline manifest gating + fallback', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('an id present in the manifest resolves onLoad with the parsed outline (two fetches: manifest then sidecar)', async () => {
    const { calls } = mockFetch(['piece-a'], { 'piece-a': SAMPLE })
    const loadOutline = await freshLoadOutline()
    const onLoad = vi.fn()
    const onError = vi.fn()
    loadOutline('piece-a', onLoad, onError)

    await vi.waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1))
    expect(onLoad).toHaveBeenCalledWith(SAMPLE)
    expect(onError).not.toHaveBeenCalled()
    expect(calls.some((u) => u.endsWith('outlines.json'))).toBe(true)
    expect(calls.some((u) => u.endsWith('piece-a.outline.json'))).toBe(true)
  })

  it('an id MISSING from the manifest resolves onError and never requests the sidecar (rectangle fallback path)', async () => {
    const { calls } = mockFetch(['some-other-id'], {})
    const loadOutline = await freshLoadOutline()
    const onLoad = vi.fn()
    const onError = vi.fn()
    loadOutline('piece-a', onLoad, onError)

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onLoad).not.toHaveBeenCalled()
    expect(calls.some((u) => u.endsWith('piece-a.outline.json'))).toBe(false) // no wasted request
  })

  it('a sidecar that fails to fetch resolves onError (not onLoad)', async () => {
    mockFetch(['piece-a'], { 'piece-a': SAMPLE }, { outlineOk: false })
    const loadOutline = await freshLoadOutline()
    const onLoad = vi.fn()
    const onError = vi.fn()
    loadOutline('piece-a', onLoad, onError)

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(onLoad).not.toHaveBeenCalled()
  })

  it('an EARLY cancel (before the manifest settles) suppresses both callbacks', async () => {
    mockFetch(['piece-a'], { 'piece-a': SAMPLE })
    const loadOutline = await freshLoadOutline()
    const onLoad = vi.fn()
    const onError = vi.fn()
    const { cancel } = loadOutline('piece-a', onLoad, onError)
    cancel()

    await new Promise((r) => setTimeout(r, 0))
    expect(onLoad).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('a missing-id EARLY cancel suppresses onError too', async () => {
    mockFetch(['other'], {})
    const loadOutline = await freshLoadOutline()
    const onError = vi.fn()
    const { cancel } = loadOutline('piece-a', vi.fn(), onError)
    cancel()

    await new Promise((r) => setTimeout(r, 0))
    expect(onError).not.toHaveBeenCalled()
  })
})
