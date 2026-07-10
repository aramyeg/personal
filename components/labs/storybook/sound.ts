'use client'

/**
 * Procedural paper sounds — zero audio assets. One lazily-created
 * AudioContext and one shared 1s white-noise buffer feed every effect;
 * each play() just wires a fresh BufferSource/filter/gain chain off that
 * buffer and lets it tear itself down when it stops, so there's no network
 * fetch and no asset to ship.
 *
 * Autoplay policies keep the context suspended until a user gesture, so
 * `unlock()` must run from a pointerdown/keydown listener. Hard-won lesson
 * from the XP lab: register *both*, once, on mount — a returning visitor's
 * first interaction can be a keypress instead of a click/tap, and a
 * pointerdown-only listener misses that session entirely.
 *
 * All state lives in module scope (not a class) since the lab only ever
 * needs one context; every export below no-ops unless the store's
 * `soundOn` flag is set, so importing this file is always safe even before
 * the user has opted in.
 */

import { useStorybookStore } from './store'

const NOISE_SECONDS = 1

let ctx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

type AudioContextCtor = typeof AudioContext

function resolveCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  // `AudioContext` is a global `declare var` in lib.dom, not a `Window`
  // interface member, so it's referenced directly rather than off `window`.
  if (typeof AudioContext !== 'undefined') return AudioContext
  const legacy = (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  return legacy ?? null
}

function getContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = resolveCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

/** One second of white noise, built once and reused (with a random read
 *  offset per play, below) so every effect is carved from real noise
 *  without allocating a new buffer per call. */
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(context.sampleRate * NOISE_SECONDS)
    noiseBuffer = context.createBuffer(1, length, context.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function makeNoiseSource(context: AudioContext): AudioBufferSourceNode {
  const source = context.createBufferSource()
  source.buffer = getNoiseBuffer(context)
  return source
}

/** Random offset into the shared buffer so back-to-back plays of the same
 *  effect don't replay the identical "random" waveform. */
function randomOffset(duration: number): number {
  return Math.random() * Math.max(0, NOISE_SECONDS - duration)
}

function play(build: (context: AudioContext, now: number) => void): void {
  if (!useStorybookStore.getState().soundOn) return
  const context = getContext()
  if (!context) return
  try {
    build(context, context.currentTime)
  } catch {
    // WebAudio node setup can throw in unusual browser states — never let a
    // page-turn sound effect break the turn itself.
  }
}

function unlock(): void {
  const context = getContext()
  if (context && context.state === 'suspended') {
    void context.resume().catch(() => {})
  }
}

/** 90ms bandpass-swept noise (1200 -> 2600 Hz), gain 0 -> 0.4 -> 0: a soft
 *  paper whoosh for every turn, cover or interior page alike. */
function flip(): void {
  play((context, now) => {
    const duration = 0.09
    const source = makeNoiseSource(context)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(1200, now)
    filter.frequency.linearRampToValueAtTime(2600, now + duration)

    const gain = context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.4, now + duration * 0.4)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    source.connect(filter).connect(gain).connect(context.destination)
    source.start(now, randomOffset(duration))
    source.stop(now + duration)
  })
}

/** 60ms lowpass(300 Hz) noise, gain 0.25: the dull thud of a page landing. */
function thump(): void {
  play((context, now) => {
    const duration = 0.06
    const source = makeNoiseSource(context)
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 300

    const gain = context.createGain()
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    source.connect(filter).connect(gain).connect(context.destination)
    source.start(now, randomOffset(duration))
    source.stop(now + duration)
  })
}

/** 320ms bandpass(320 Hz) noise with 8 Hz tremolo, gain 0.2: the leather
 *  hinge creak on a cover turn. The tremolo is a second gain stage whose
 *  `.gain` AudioParam is modulated by a low-frequency oscillator — the LFO's
 *  -1..1 output adds onto the stage's intrinsic value, producing the
 *  wavering, hinge-like texture on top of the envelope below. */
function creak(): void {
  play((context, now) => {
    const duration = 0.32
    const source = makeNoiseSource(context)
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 320
    filter.Q.value = 4

    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0.2, now)
    envelope.gain.linearRampToValueAtTime(0, now + duration)

    const tremolo = context.createGain()
    tremolo.gain.value = 1
    const lfo = context.createOscillator()
    lfo.frequency.value = 8
    const lfoDepth = context.createGain()
    lfoDepth.gain.value = 0.5
    lfo.connect(lfoDepth).connect(tremolo.gain)

    source.connect(filter).connect(envelope).connect(tremolo).connect(context.destination)
    source.start(now, randomOffset(duration))
    lfo.start(now)
    source.stop(now + duration)
    lfo.stop(now + duration)
  })
}

export const sbSound = { unlock, flip, thump, creak }
