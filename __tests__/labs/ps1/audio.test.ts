import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPS1Audio } from '@/components/labs/ps1/audio'

/**
 * A hand-rolled AudioContext mock — no WebAudio implementation exists in
 * jsdom, and this is the repo's first synth. Every node factory returns a
 * plain object with vi.fn() collaborators and pushes itself onto a tracking
 * array so tests can assert the exact node graph without a real audio
 * pipeline. Cast to AudioContext only at the ctxFactory boundary.
 */
type MockParam = {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
}

type MockOscillator = {
  type: OscillatorType
  frequency: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended: (() => void) | null
}

type MockGain = {
  gain: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

type MockFilter = {
  type: BiquadFilterType
  frequency: MockParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

type MockBufferSource = {
  buffer: unknown
  loop: boolean
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onended: (() => void) | null
}

function makeParam(initial: number): MockParam {
  return { value: initial, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
}

function makeMockAudioContext() {
  const oscillators: MockOscillator[] = []
  const gains: MockGain[] = []
  const filters: MockFilter[] = []
  const sources: MockBufferSource[] = []

  const ctx = {
    state: 'suspended' as 'suspended' | 'running' | 'closed',
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createOscillator: vi.fn((): MockOscillator => {
      const node: MockOscillator = {
        type: 'sine',
        frequency: makeParam(440),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      oscillators.push(node)
      return node
    }),
    createGain: vi.fn((): MockGain => {
      const node: MockGain = { gain: makeParam(1), connect: vi.fn(), disconnect: vi.fn() }
      gains.push(node)
      return node
    }),
    createBiquadFilter: vi.fn((): MockFilter => {
      const node: MockFilter = {
        type: 'lowpass',
        frequency: makeParam(350),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      filters.push(node)
      return node
    }),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const data = new Float32Array(length)
      return { length, getChannelData: vi.fn(() => data) }
    }),
    createBufferSource: vi.fn((): MockBufferSource => {
      const node: MockBufferSource = {
        buffer: null,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      sources.push(node)
      return node
    }),
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    close: vi.fn(async () => {
      ctx.state = 'closed'
    }),
  }

  return { ctx, oscillators, gains, filters, sources }
}

describe('createPS1Audio', () => {
  let mock: ReturnType<typeof makeMockAudioContext>
  let ctxFactory: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.localStorage.clear()
    mock = makeMockAudioContext()
    ctxFactory = vi.fn(() => mock.ctx as unknown as AudioContext)
  })

  it('does not construct an AudioContext until resume()', () => {
    createPS1Audio(ctxFactory as unknown as () => AudioContext)
    expect(ctxFactory).not.toHaveBeenCalled()
  })

  it('resume() lazily constructs the context exactly once', () => {
    const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
    audio.resume()
    audio.resume()
    expect(ctxFactory).toHaveBeenCalledTimes(1)
  })

  it('defaults muted with no persisted preference', () => {
    const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
    expect(audio.enabled()).toBe(false)
  })

  it('reads a persisted "on" preference from localStorage on construction', () => {
    window.localStorage.setItem('ps1-sound', 'on')
    const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
    expect(audio.enabled()).toBe(true)
  })

  it('treats any non-"on" persisted value as muted', () => {
    window.localStorage.setItem('ps1-sound', 'off')
    expect(createPS1Audio(ctxFactory as unknown as () => AudioContext).enabled()).toBe(false)
  })

  it('setEnabled persists the preference and round-trips through a fresh factory', () => {
    const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)

    audio.setEnabled(true)
    expect(window.localStorage.getItem('ps1-sound')).toBe('on')
    expect(createPS1Audio(ctxFactory as unknown as () => AudioContext).enabled()).toBe(true)

    audio.setEnabled(false)
    expect(window.localStorage.getItem('ps1-sound')).toBe('off')
    expect(createPS1Audio(ctxFactory as unknown as () => AudioContext).enabled()).toBe(false)
  })

  describe('blip()', () => {
    it('creates no oscillator when disabled', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.resume()
      audio.blip()
      expect(mock.oscillators).toHaveLength(0)
    })

    it('creates no oscillator before resume(), even when enabled', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.blip()
      expect(mock.oscillators).toHaveLength(0)
    })

    it('plays a square 880Hz blip through a gain envelope, 40ms', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.blip()

      expect(mock.oscillators).toHaveLength(1)
      const osc = mock.oscillators[0]
      expect(osc.type).toBe('square')
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, expect.any(Number))
      expect(osc.start).toHaveBeenCalled()
      expect(osc.stop).toHaveBeenCalledWith(expect.closeTo(0.04, 5))
      expect(mock.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled()
    })
  })

  describe('select()', () => {
    it('steps a square tone from 440Hz to 660Hz over 90ms', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.select()

      const osc = mock.oscillators[0]
      expect(osc.type).toBe('square')
      expect(osc.frequency.setValueAtTime).toHaveBeenNthCalledWith(1, 440, expect.any(Number))
      expect(osc.frequency.setValueAtTime).toHaveBeenNthCalledWith(2, 660, expect.any(Number))
      expect(osc.stop).toHaveBeenCalledWith(expect.closeTo(0.09, 5))
    })
  })

  describe('back()', () => {
    it('plays a square 330Hz tone, 60ms', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.back()

      const osc = mock.oscillators[0]
      expect(osc.type).toBe('square')
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(330, expect.any(Number))
      expect(osc.stop).toHaveBeenCalledWith(expect.closeTo(0.06, 5))
    })
  })

  describe('boot()', () => {
    it('only sounds when enabled', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.resume()
      audio.boot()
      expect(mock.oscillators).toHaveLength(0)
    })

    it('plays a soft triangle fifth (220Hz + 330Hz) fading over 700ms', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.boot()

      expect(mock.oscillators).toHaveLength(2)
      expect(mock.oscillators.map((o) => o.type)).toEqual(['triangle', 'triangle'])
      const freqs = mock.oscillators
        .map((o) => o.frequency.setValueAtTime.mock.calls[0][0] as number)
        .sort((a, b) => a - b)
      expect(freqs).toEqual([220, 330])
      for (const osc of mock.oscillators) {
        expect(osc.stop).toHaveBeenCalledWith(expect.closeTo(0.7, 5))
      }
    })
  })

  describe('setRoomTone()', () => {
    it('does nothing while disabled, even after resume()', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setRoomTone(true)
      expect(mock.sources).toHaveLength(0)
      audio.resume()
      audio.setRoomTone(true)
      expect(mock.sources).toHaveLength(0)
    })

    it('starts a looping filtered-noise source at 400Hz lowpass, -40dB, when enabled', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.setRoomTone(true)

      expect(mock.sources).toHaveLength(1)
      expect(mock.sources[0].loop).toBe(true)
      expect(mock.sources[0].start).toHaveBeenCalled()
      expect(mock.filters[0].type).toBe('lowpass')
      expect(mock.filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(
        400,
        expect.any(Number)
      )
      const expectedGain = Math.pow(10, -40 / 20)
      expect(mock.gains.at(-1)?.gain.setValueAtTime).toHaveBeenCalledWith(
        expect.closeTo(expectedGain, 6),
        expect.any(Number)
      )
    })

    it('stops the loop cleanly with no dangling nodes, and rebuilds fresh on re-enable', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.setRoomTone(true)
      audio.setRoomTone(false)

      expect(mock.sources[0].stop).toHaveBeenCalled()
      expect(mock.sources[0].disconnect).toHaveBeenCalled()
      expect(mock.filters[0].disconnect).toHaveBeenCalled()

      expect(() => audio.setRoomTone(false)).not.toThrow()

      audio.setRoomTone(true)
      expect(mock.sources).toHaveLength(2)
    })

    it('setEnabled(false) kills an active room tone immediately', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.setRoomTone(true)
      audio.setEnabled(false)
      expect(mock.sources[0].stop).toHaveBeenCalled()
    })
  })

  describe('dispose()', () => {
    it('closes the context', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.resume()
      audio.dispose()
      expect(mock.ctx.close).toHaveBeenCalled()
    })

    it('is a no-op when the context was never resumed', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      expect(() => audio.dispose()).not.toThrow()
      expect(mock.ctx.close).not.toHaveBeenCalled()
    })

    it('stops an active room tone', () => {
      const audio = createPS1Audio(ctxFactory as unknown as () => AudioContext)
      audio.setEnabled(true)
      audio.resume()
      audio.setRoomTone(true)
      audio.dispose()
      expect(mock.sources[0].stop).toHaveBeenCalled()
    })
  })
})
