import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

/**
 * Regression coverage for the boot beat's fixed-duration window (the E6 fix).
 *
 * The beat's countdown MUST be a single deterministic window anchored to first
 * appearance. An earlier version kept the visibility + timer effect keyed on
 * `[actions]`, so when the lazily-built audio instance settled from its NOOP
 * stand-in to the real one (a commit or two after mount — see `audio.ts`), the
 * effect tore down and re-armed a fresh 3s timer mid-beat. That coupled the
 * beat's true length to audio-init timing and let any parent re-render that
 * changed `actions` identity restart the countdown.
 *
 * This test forces that exact NOOP→real transition to a controllable moment (a
 * swappable audio identity behind the provider) and asserts the beat still ends
 * on its original 3s clock. It FAILS on the old `[actions]`-coupled code (the
 * restarted timer keeps the beat up past 3s) and passes once the lifecycle is
 * mount-anchored.
 */

vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// A swappable audio identity: the provider reads `holder.current` on every
// render, so replacing it and re-rendering hands BootBeat a fresh `actions`
// object — the real-world NOOP→real settle, on demand.
const holder = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => holder.current,
}))

import { BootBeat } from '@/components/labs/memory-card/boot'
import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'

function makeAudio() {
  return {
    resume: vi.fn(),
    blip: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    bootMusic: vi.fn(() => true),
    stopBoot: vi.fn(),
    fadeOutBoot: vi.fn(),
    setRoomTone: vi.fn(),
    setEnabled: vi.fn(),
    enabled: vi.fn(() => false),
    dispose: vi.fn(),
  }
}

// A FRESH element each call — reusing one constant element lets React bail out
// of re-rendering the provider (same reference), so the audio swap would never
// actually reach it and the test would pass vacuously on both old and new code.
const ui = () => (
  <MemoryCardAudioProvider>
    <BootBeat />
  </MemoryCardAudioProvider>
)

describe('BootBeat — the 3s window is anchored to first appearance', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.clearAllMocks()
    holder.current = makeAudio()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('an audio-actions identity change mid-beat does not restart the fixed 3s window', () => {
    vi.useFakeTimers()
    const { rerender } = render(ui())
    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()

    // 1.5s into the beat, the lazily-built audio instance settles — the provider
    // hands BootBeat a brand-new `actions` identity.
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    holder.current = makeAudio()
    act(() => {
      rerender(ui())
    })
    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()

    // Advance to just past the ORIGINAL 3s window (3.1s total from first paint).
    // A restarted timer would fire at 1.5s + 3s = 4.5s, leaving the beat up here;
    // the anchored window ends at 3.0s.
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(screen.queryByTestId('boot-beat')).toBeNull()
    expect(window.sessionStorage.getItem('memory-card-booted')).toBe('1')
  })
})
