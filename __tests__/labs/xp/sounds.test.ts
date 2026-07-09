import { beforeEach, describe, expect, it, vi } from 'vitest'
import { playSound, resetSoundsForTest, unlockSounds } from '@/components/labs/xp/sounds'
import { useXpStore } from '@/components/labs/xp/store'

const play = vi.fn().mockResolvedValue(undefined)
const initial = useXpStore.getState()

describe('xp sounds', () => {
  beforeEach(() => {
    useXpStore.setState(initial, true)
    resetSoundsForTest()
    play.mockClear()
    class MockAudio {
      volume = 0.5
      play = play
    }
    vi.stubGlobal('Audio', MockAudio as any)
  })

  it('does not play before unlock', () => {
    playSound('error')
    expect(play).not.toHaveBeenCalled()
  })

  it('plays after unlock', () => {
    unlockSounds()
    playSound('error')
    expect(play).toHaveBeenCalledOnce()
  })

  it('respects mute', () => {
    unlockSounds()
    useXpStore.getState().toggleMuted()
    playSound('error')
    expect(play).not.toHaveBeenCalled()
  })
})
