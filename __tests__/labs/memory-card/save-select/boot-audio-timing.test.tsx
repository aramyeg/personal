import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Regression coverage for a real bug found live: `useMemoryCardAudioActions()`
 * returns a NOOP-shaped `boot` on this component's very first render — the
 * real `PS1Audio` instance is only built lazily, inside `useMemoryCardAudio`'s
 * own effect, one commit later (see `audio.ts`'s `useMemoryCardAudio` doc
 * comment). A `useRef` "fire boot() exactly once" guard latches on THAT first,
 * NOOP call and never calls the real `bootMusic()` once the swap completes —
 * silently killing the boot recording on every real session. These tests use
 * the REAL `audio.ts` / `audio-context.tsx` modules (unlike `boot.test.tsx`,
 * which mocks the seam) so the async NOOP-then-real transition genuinely
 * happens, and stub only the browser primitives (`Audio`, `navigator.userActivation`).
 */

vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

import { BootBeat } from '@/components/labs/memory-card/boot'
import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'

describe('BootBeat + the real audio module — NOOP-to-real actions transition', () => {
  let play: ReturnType<typeof vi.fn>
  let audioCtor: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()

    play = vi.fn().mockResolvedValue(undefined)
    audioCtor = vi.fn(function (this: { src: string }, src: string) {
      this.src = src
    })
    audioCtor.prototype.play = play
    audioCtor.prototype.pause = vi.fn()
    audioCtor.prototype.volume = 1
    audioCtor.prototype.currentTime = 0
    vi.stubGlobal('Audio', audioCtor)

    // Simulates a soft-nav from the gallery: the document already has sticky
    // user activation by the time this component tree mounts.
    Object.defineProperty(window.navigator, 'userActivation', {
      value: { hasBeenActive: true, isActive: true },
      configurable: true,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'userActivation')
    vi.unstubAllGlobals()
  })

  it('plays the real boot recording once useMemoryCardAudio settles from NOOP to the real instance', async () => {
    window.localStorage.setItem('memory-card-sound', 'on')

    render(
      <MemoryCardAudioProvider>
        <BootBeat />
      </MemoryCardAudioProvider>
    )

    // The overlay shows immediately (doesn't wait on the audio instance).
    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()

    // The real PS1Audio instance is built inside useMemoryCardAudio's own
    // effect — async relative to BootBeat's first render. Once it resolves
    // and MemoryCardAudioProvider's `actions` memo picks up the real
    // `bootMusic`, BootBeat's effect (deps: [actions]) must re-fire with it.
    await vi.waitFor(() => {
      expect(audioCtor).toHaveBeenCalledWith('/labs/memory-card/sounds/ps1-boot.mp3')
    })
    expect(play).toHaveBeenCalledTimes(1)
  })
})
