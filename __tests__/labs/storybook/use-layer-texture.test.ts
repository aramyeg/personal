import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { loadArtTexture as LoadArtTexture } from '@/components/labs/storybook/book/use-layer-texture'

// E-G4 fix wave item 4 (knob-tier art) diagnosis: live reproduction against
// the running dev server (headed AND headless, exact-parameter-matched to
// the original capture script, repeated across several fresh navigations)
// never reproduced the filed "art never reaches the mesh" bug — the tier's
// baked art loaded and rendered correctly every time, including in the
// original evidence screenshot once cropped to the tier's actual on-screen
// position (the montage script's crop box for that item pointed at the
// neighboring ch3-counter box piece instead). So this suite is not a fix
// for a reproduced defect; it locks down the exact lifecycle property the
// bug report suspected (a cancel-then-dispose/dep-change race in
// `loadArtTexture`) so a REAL regression here — however it might one day be
// introduced — fails a test immediately instead of needing another live
// runtime trace to diagnose.
//
// `art-manifest.ts` caches its fetch in a module-level promise, so every
// test resets the module registry and re-imports fresh — otherwise only
// the first test's mocked manifest would ever be consulted.

// Every wait below is for a MICROTASK chain (manifest promise -> loader call),
// so it resolves in well under a millisecond of actual work. What it waits on in
// practice is this worker finishing its first import of three.js, which on a
// loaded machine has been measured at over 2s — past vi.waitFor's implicit 1s
// timeout, which made this file flake in full-suite runs while passing alone.
// The generous ceiling does not weaken any assertion: each one is a discrete
// "did this fire" check that either happens or never will.
const SETTLE = { timeout: 15000 } as const

type ManifestResponse = { ok: boolean; json: () => Promise<string[]> }

function mockManifestFetch(ids: readonly string[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (): Promise<ManifestResponse> => ({ ok: true, json: async () => [...ids] }))
  )
}

/** Replaces TextureLoader.load with a controllable stand-in: `resolvers` are
 *  queued in call order, so test bodies can resolve/reject each load exactly
 *  when they want to, independent of the manifest fetch's own microtask
 *  timing. */
function stubTextureLoader(): {
  resolve: (index: number, texture?: THREE.Texture) => void
  reject: (index: number) => void
  callCount: () => number
} {
  const pending: { onLoad: (t: THREE.Texture) => void; onError: () => void }[] = []
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
    // @ts-expect-error - test stub narrows three's overloaded signature
    (_url: string, onLoad?: (t: THREE.Texture) => void, _onProgress?: unknown, onError?: () => void) => {
      pending.push({ onLoad: onLoad!, onError: onError! })
      return new THREE.Texture()
    }
  )
  return {
    resolve: (index, texture = new THREE.Texture()) => pending[index]!.onLoad(texture),
    reject: (index) => pending[index]!.onError(),
    callCount: () => pending.length,
  }
}

async function freshLoadArtTexture(): Promise<typeof LoadArtTexture> {
  vi.resetModules()
  const mod = await import('@/components/labs/storybook/book/use-layer-texture')
  return mod.loadArtTexture
}

describe('loadArtTexture cancel/dispose lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a normal (uncancelled) load resolves to onLoad with a texture whose colorSpace is set', async () => {
    mockManifestFetch(['piece-a'])
    const loader = stubTextureLoader()
    const loadArtTexture = await freshLoadArtTexture()
    const onLoad = vi.fn()
    const onError = vi.fn()
    loadArtTexture('piece-a', onLoad, onError)

    await vi.waitFor(() => expect(loader.callCount()).toBe(1), SETTLE)
    const texture = new THREE.Texture()
    loader.resolve(0, texture)

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledWith(texture)
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(onError).not.toHaveBeenCalled()
    // 15s, not the 5s default: this is the FILE'S FIRST test, so it pays the
    // cold dynamic re-import of the whole use-layer-texture module (INFRA-1
    // grew it ~3x), which under a fully parallel suite run intermittently
    // blows the default budget (observed flaking at full-suite load only —
    // standalone it runs in milliseconds).
  }, 15_000)

  it('onError fires (not onLoad) when the id is missing from the manifest — no network request at all', async () => {
    mockManifestFetch(['some-other-id'])
    const loader = stubTextureLoader()
    const loadArtTexture = await freshLoadArtTexture()
    const onLoad = vi.fn()
    const onError = vi.fn()
    loadArtTexture('piece-a', onLoad, onError)

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1), SETTLE)
    expect(onLoad).not.toHaveBeenCalled()
    expect(loader.callCount()).toBe(0)
  })

  it('THE STRICT-MODE-DOUBLE-MOUNT CASE: cancelling synchronously (before the manifest promise ever settles), then starting a second (real) load for the same id — the cancelled call never reaches the texture loader at all, and only the second call ever settles', async () => {
    // This is the exact sequence React 18 StrictMode produces for a mounting
    // effect: setup() -> cleanup() -> setup() again, all synchronously,
    // before either loadArtTexture call's promise chain gets a chance to
    // run a single microtask. `cancelled` is already true by the time
    // call 1's `artManifest().then(...)` callback runs, so it returns
    // before ever constructing a TextureLoader — no wasted image request,
    // and nothing for it to leak or double-fire.
    mockManifestFetch(['piece-a'])
    const loader = stubTextureLoader()
    const loadArtTexture = await freshLoadArtTexture()

    const onLoad1 = vi.fn()
    const onError1 = vi.fn()
    const { cancel: cancel1 } = loadArtTexture('piece-a', onLoad1, onError1)
    cancel1() // synchronous — happens before call 1's manifest .then() ever fires

    const onLoad2 = vi.fn()
    const onError2 = vi.fn()
    loadArtTexture('piece-a', onLoad2, onError2)

    // Only the live (second) call ever reaches the image loader.
    await vi.waitFor(() => expect(loader.callCount()).toBe(1), SETTLE)
    expect(onLoad1).not.toHaveBeenCalled()
    expect(onError1).not.toHaveBeenCalled()

    const texture2 = new THREE.Texture()
    loader.resolve(0, texture2)

    expect(onLoad2).toHaveBeenCalledTimes(1)
    expect(onLoad2).toHaveBeenCalledWith(texture2)
    expect(onError2).not.toHaveBeenCalled()
    // The cancelled call's callbacks stay silent even after the live call's
    // own image resolves — cancellation isn't a one-shot guard that a later
    // unrelated resolution could accidentally re-trigger.
    expect(onLoad1).not.toHaveBeenCalled()
    expect(onError1).not.toHaveBeenCalled()
  })

  it('THE LATE-CANCEL CASE: cancelling AFTER the texture loader was already issued (manifest resolved, image still in flight) disposes the texture it is handed instead of leaking it, and never calls onLoad', async () => {
    // Models a real (not synchronous-StrictMode) unmount: the manifest
    // lookup already resolved and the image request is genuinely in
    // flight when cleanup runs. This is the `if (cancelled) { loaded.dispose(); return }`
    // branch inside the image loader's own onLoad callback.
    mockManifestFetch(['piece-a'])
    const loader = stubTextureLoader()
    const loadArtTexture = await freshLoadArtTexture()

    const onLoad = vi.fn()
    const onError = vi.fn()
    const { cancel } = loadArtTexture('piece-a', onLoad, onError)

    await vi.waitFor(() => expect(loader.callCount()).toBe(1), SETTLE) // manifest resolved, image request issued
    cancel() // unmount while the image is still decoding

    const texture = new THREE.Texture()
    const disposeSpy = vi.spyOn(texture, 'dispose')
    loader.resolve(0, texture) // image finishes loading AFTER cancel

    expect(onLoad).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(disposeSpy).toHaveBeenCalledTimes(1) // disposed, not leaked
  })

  it('cancelling after the image already resolved is a no-op for a call whose onLoad already fired (no double-invoke, no throw)', async () => {
    mockManifestFetch(['piece-a'])
    const loader = stubTextureLoader()
    const loadArtTexture = await freshLoadArtTexture()
    const onLoad = vi.fn()
    const { cancel } = loadArtTexture('piece-a', onLoad, vi.fn())

    await vi.waitFor(() => expect(loader.callCount()).toBe(1), SETTLE)
    loader.resolve(0)
    expect(onLoad).toHaveBeenCalledTimes(1)

    expect(() => cancel()).not.toThrow()
    expect(onLoad).toHaveBeenCalledTimes(1) // still exactly once
  })

  it('an image load error after a LATE cancel (issued after the texture loader was already called) does not call onError', async () => {
    mockManifestFetch(['piece-a'])
    const loader = stubTextureLoader()
    const loadArtTexture = await freshLoadArtTexture()
    const onError = vi.fn()
    const { cancel } = loadArtTexture('piece-a', vi.fn(), onError)

    await vi.waitFor(() => expect(loader.callCount()).toBe(1), SETTLE)
    cancel()
    loader.reject(0)

    expect(onError).not.toHaveBeenCalled()
  })

  it('an EARLY cancel (before the manifest promise settles) suppresses onError too — a missing-id resolution never fires after cancellation', async () => {
    mockManifestFetch(['some-other-id'])
    const loadArtTexture = await freshLoadArtTexture()
    const onError = vi.fn()
    const { cancel } = loadArtTexture('piece-a', vi.fn(), onError)
    cancel()

    // Give the manifest promise a turn to settle; onError must stay silent.
    await new Promise((r) => setTimeout(r, 0))
    expect(onError).not.toHaveBeenCalled()
  })
})
