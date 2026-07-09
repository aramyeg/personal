/**
 * Synth-only WebAudio layer for the PS1 lab — no asset files. Everything is
 * generated on the fly and stays silent until `resume()` runs on the first
 * user gesture (the browser autoplay law). A pure factory: no React, no
 * three.js. `ctxFactory` is injectable so tests build the node graph against
 * a mock AudioContext and never touch a real one in jsdom.
 */

const STORAGE_KEY = 'memory-card-sound'

export type PS1Audio = {
  /** Call on the first user gesture — lazily builds the real AudioContext. */
  resume(): void
  /** Menu move: square 880Hz, 40ms, -18dB. */
  blip(): void
  /** Open: two-tone square 440Hz stepping to 660Hz, 90ms. */
  select(): void
  /** Close: square 330Hz, 60ms. */
  back(): void
  /** Boot: soft fifth — triangle 220Hz + 330Hz, 700ms fade. */
  boot(): void
  /** Filtered brown-noise loop at -40dB, 400Hz lowpass. */
  setRoomTone(on: boolean): void
  /** Master gate — also persists the preference to localStorage. */
  setEnabled(on: boolean): void
  enabled(): boolean
  dispose(): void
}

/** The perfect fifth (220Hz, 330Hz) the boot chime plays as a shared triangle pair. */
const BOOT_FIFTH_HZ = [220, 330] as const
const ROOM_TONE_LOWPASS_HZ = 400
const ROOM_TONE_LOOP_SECONDS = 2

/** -dB (0 or negative) → linear gain multiplier. */
function fromDb(db: number): number {
  return Math.pow(10, db / 20)
}

const SFX_GAIN = fromDb(-18)
const ROOM_TONE_GAIN = fromDb(-40)

/** Deterministic PRNG — local copy so this module stays free of the
 * three.js-heavy texture module; never Math.random (repo law). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function readPersistedEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

function writePersistedEnabled(on: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
    }
  } catch {
    // Private-mode localStorage throws on write — sound still gates in-memory.
  }
}

/** A brown-noise buffer (leaky integration of white noise), seeded. */
function makeBrownNoiseBuffer(ctx: AudioContext, rnd: () => number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * ROOM_TONE_LOOP_SECONDS)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < length; i++) {
    const white = rnd() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

type RoomTone = {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
}

export function createPS1Audio(
  ctxFactory: () => AudioContext = () => new AudioContext()
): PS1Audio {
  let ctx: AudioContext | null = null
  let isEnabled = readPersistedEnabled()
  let roomTone: RoomTone | null = null

  function resume(): void {
    if (!ctx) ctx = ctxFactory()
    if (ctx.state === 'suspended') void ctx.resume()
  }

  function stopRoomTone(): void {
    if (!roomTone) return
    roomTone.source.stop()
    roomTone.source.disconnect()
    roomTone.filter.disconnect()
    roomTone.gain.disconnect()
    roomTone = null
  }

  /**
   * A one-shot oscillator tone: attack/release gain envelope, torn down via
   * onended so nothing dangles after it finishes. `stepTo`, when given, steps
   * the frequency to a new value at the envelope's midpoint (the two-tone
   * select() chime).
   */
  function tone(
    type: OscillatorType,
    freqHz: number,
    durationSec: number,
    peakGain: number,
    stepTo?: number
  ): void {
    if (!isEnabled || !ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freqHz, now)
    if (stepTo !== undefined) {
      osc.frequency.setValueAtTime(stepTo, now + durationSec / 2)
    }

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peakGain, now + Math.min(0.01, durationSec / 4))
    gain.gain.linearRampToValueAtTime(0, now + durationSec)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
    osc.start(now)
    osc.stop(now + durationSec)
  }

  function blip(): void {
    tone('square', 880, 0.04, SFX_GAIN)
  }

  function select(): void {
    tone('square', 440, 0.09, SFX_GAIN, 660)
  }

  function back(): void {
    tone('square', 330, 0.06, SFX_GAIN)
  }

  function boot(): void {
    if (!isEnabled || !ctx) return
    const now = ctx.currentTime
    const duration = 0.7
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(SFX_GAIN, now + 0.1)
    gain.gain.linearRampToValueAtTime(0, now + duration)
    gain.connect(ctx.destination)

    const oscs = BOOT_FIFTH_HZ.map((freqHz) => {
      const osc = ctx!.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freqHz, now)
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + duration)
      return osc
    })
    oscs[oscs.length - 1].onended = () => {
      oscs.forEach((osc) => osc.disconnect())
      gain.disconnect()
    }
  }

  function setRoomTone(on: boolean): void {
    if (!on) {
      stopRoomTone()
      return
    }
    if (!isEnabled || !ctx || roomTone) return

    const now = ctx.currentTime
    const buffer = makeBrownNoiseBuffer(ctx, mulberry32(4242))

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(ROOM_TONE_LOWPASS_HZ, now)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(ROOM_TONE_GAIN, now)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()

    roomTone = { source, filter, gain }
  }

  function setEnabled(on: boolean): void {
    isEnabled = on
    writePersistedEnabled(on)
    if (!on) stopRoomTone()
  }

  function enabled(): boolean {
    return isEnabled
  }

  function dispose(): void {
    stopRoomTone()
    if (ctx) {
      void ctx.close()
      ctx = null
    }
  }

  return { resume, blip, select, back, boot, setRoomTone, setEnabled, enabled, dispose }
}
