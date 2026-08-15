import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

// A stateful audio double — real enough that toggling actually flips
// `enabled()`, so the arming effect below (which reads `audio.enabled()` on
// mount) can be driven from a plain boolean instead of a fixed mock return.
let mockAudioEnabled = false
const mockAudio = {
  resume: vi.fn(),
  blip: vi.fn(),
  select: vi.fn(),
  back: vi.fn(),
  bootMusic: vi.fn(),
  stopBoot: vi.fn(),
  fadeOutBoot: vi.fn(),
  setRoomTone: vi.fn(),
  setEnabled: vi.fn((on: boolean) => {
    mockAudioEnabled = on
  }),
  enabled: vi.fn(() => mockAudioEnabled),
  dispose: vi.fn(),
}
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => mockAudio,
}))

import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'

describe('MemoryCardAudioProvider — returning-visitor gesture arming', () => {
  it('arms resume() on the first user gesture when sound is already persisted on', () => {
    mockAudioEnabled = true // simulates a fresh page load with 'memory-card-sound' = 'on'

    render(
      <MemoryCardAudioProvider>
        <div>content</div>
      </MemoryCardAudioProvider>
    )
    expect(mockAudio.resume).not.toHaveBeenCalled()

    fireEvent.click(window)

    expect(mockAudio.resume).toHaveBeenCalledTimes(1)
  })

  it('does not eagerly arm resume() when sound was never enabled', () => {
    mockAudioEnabled = false

    render(
      <MemoryCardAudioProvider>
        <div>content</div>
      </MemoryCardAudioProvider>
    )
    fireEvent.click(window)

    expect(mockAudio.resume).not.toHaveBeenCalled()
  })

  it('only arms once — a second gesture does not call resume() again', () => {
    mockAudioEnabled = true

    render(
      <MemoryCardAudioProvider>
        <div>content</div>
      </MemoryCardAudioProvider>
    )
    fireEvent.click(window)
    fireEvent.keyDown(window, { key: 'a' })

    expect(mockAudio.resume).toHaveBeenCalledTimes(1)
  })
})
