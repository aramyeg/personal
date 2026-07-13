/**
 * WebAudio synth layer for the PS1 lab, plus one real recording. `blip` /
 * `select` / `back` / room tone are generated on the fly and stay silent
 * until `resume()` runs on the first user gesture (the browser autoplay
 * law); `bootMusic` is the one asset file the lab ships, an HTMLAudio
 * element gated the same way. The factory itself is pure: no React, no
 * three.js. `ctxFactory` is injectable so tests build the node graph
 * against a mock AudioContext and never touch a real one in jsdom.
 *
 * `useMemoryCardAudio` (bottom of file) is the one React seam: it lazily
 * builds a single module-level `PS1Audio` instance the first time any
 * component mounts, and only inside an effect — never during render, so
 * nothing SSR-visible depends on it and no AudioContext is ever touched at
 * module-import time.
 */

import { useEffect, useState } from 'react'

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
  /** Boot: plays the original PS1 BIOS boot recording once, from the start.
   *  Muted the same way every other sound is, plus gated on the browser's own
   *  sticky user-activation flag (not `resume()` — this is HTMLAudio, not
   *  WebAudio) and a sticky failure latch if the asset ever errors. Returns
   *  whether playback actually started; callers that latch a "played once"
   *  flag must key it off this, not off having merely called the function. */
  bootMusic(): boolean
  /** Pauses the boot recording and resets it to the start — an instant cut,
   *  used when a visitor skips the boot beat. Also cancels an in-flight
   *  `fadeOutBoot()` ramp, resetting volume back to its normal level, so a
   *  skip landing mid-fade still cuts immediately rather than finishing the
   *  ramp. No-ops if it was never started. */
  stopBoot(): void
  /** Ramps the boot recording's volume down to silence over ~400ms, then
   *  pauses and resets it (start position, normal volume) — the boot beat's
   *  own timer end, never its skip path (that's `stopBoot()`, instant).
   *  No-ops if it was never started or is already paused. */
  fadeOutBoot(): void
  /** Filtered brown-noise loop at -40dB, 400Hz lowpass. */
  setRoomTone(on: boolean): void
  /** Master gate — also persists the preference to localStorage. */
  setEnabled(on: boolean): void
  enabled(): boolean
  dispose(): void
}

/** The original PS1 BIOS boot recording — a 17s capture; only its opening
 *  swell is ever heard since `fadeOutBoot()`/`stopBoot()` cut it when the
 *  boot beat ends (see `boot.tsx`). */
const BOOT_MUSIC_SRC = '/labs/memory-card/sounds/ps1-boot.mp3'
const BOOT_MUSIC_VOLUME = 0.6
/** `fadeOutBoot()`'s ramp — ~400ms in even steps, timer-end only. */
const BOOT_FADE_MS = 400
const BOOT_FADE_STEPS = 8
const ROOM_TONE_LOWPASS_HZ = 400
const ROOM_TONE_LOOP_SECONDS = 2

/** -dB (0 or negative) → linear gain multiplier. */
function fromDb(db: number): number {
  return Math.pow(10, db / 20)
}

/**
 * The browser's own sticky user-activation flag — true from the moment the
 * current *document* first receives any gesture (click/key/tap), and stays
 * true for the rest of that document's life. Unlike `resume()`'s AudioContext
 * (armed only by a listener THIS app attaches, which can't retroactively
 * catch a gesture that already finished dispatching before it was attached),
 * this is exactly what a same-document SPA soft-nav needs: the click that
 * carries a visitor from the gallery into this lab already sets it, so it
 * reads `true` the instant the lab's first component mounts — no listener
 * required, no race with effect timing. A hard load/direct URL starts a
 * fresh document with no gesture yet, so this reads `false` until the
 * visitor's first interaction. Undefined in jsdom and any browser without
 * the User Activation API — treated as "not armed", the safe default. */
function hasStickyUserActivation(): boolean {
  return typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === true
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
  let bootAudio: HTMLAudioElement | null = null
  /** Sticky — set by the element's `onerror`, so a failed asset never keeps
   *  retrying a doomed `play()` on every subsequent boot. */
  let bootAudioFailed = false
  /** The in-flight `fadeOutBoot()` ramp's interval id, if one is running —
   *  `stopBoot()` cancels it so a skip landing mid-fade still cuts instantly
   *  instead of riding the ramp out. */
  let bootFadeHandle: ReturnType<typeof setInterval> | null = null

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

  /**
   * HTMLAudio, not WebAudio — a real recording, not a synth, so it doesn't
   * gate on `ctx`/`resume()` (that pair is WebAudio-specific — see `tone()`).
   * "Armed" here means `hasStickyUserActivation()`: the browser's own
   * document-level gesture flag, which is what actually determines whether
   * `play()` will be allowed to make sound, and — unlike this app's own
   * resume()-on-first-gesture listener — is already `true` the instant this
   * mounts after a same-document soft-nav (the click that navigated here
   * set it), not just after a fresh gesture on this page.
   */
  function bootMusic(): boolean {
    if (!isEnabled || bootAudioFailed || !hasStickyUserActivation()) return false
    cancelBootFade()
    if (!bootAudio) {
      bootAudio = new Audio(BOOT_MUSIC_SRC)
      bootAudio.onerror = () => {
        bootAudioFailed = true
      }
    }
    bootAudio.volume = BOOT_MUSIC_VOLUME
    bootAudio.currentTime = 0
    void bootAudio.play().catch(() => {
      // Autoplay block or a mid-flight decode error — the gate above already
      // reported `true` to the caller; a silent boot beat is fine, a thrown
      // rejection is not.
    })
    return true
  }

  function cancelBootFade(): void {
    if (bootFadeHandle === null) return
    clearInterval(bootFadeHandle)
    bootFadeHandle = null
  }

  function stopBoot(): void {
    cancelBootFade()
    if (!bootAudio) return
    bootAudio.pause()
    bootAudio.currentTime = 0
    bootAudio.volume = BOOT_MUSIC_VOLUME
  }

  function fadeOutBoot(): void {
    if (!bootAudio || bootAudio.paused || bootFadeHandle !== null) return
    const startVolume = bootAudio.volume
    let step = 0
    bootFadeHandle = setInterval(() => {
      step += 1
      if (!bootAudio) {
        cancelBootFade()
        return
      }
      if (step >= BOOT_FADE_STEPS) {
        cancelBootFade()
        bootAudio.pause()
        bootAudio.currentTime = 0
        bootAudio.volume = BOOT_MUSIC_VOLUME
        return
      }
      bootAudio.volume = Math.max(0, startVolume * (1 - step / BOOT_FADE_STEPS))
    }, BOOT_FADE_MS / BOOT_FADE_STEPS)
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
    stopBoot()
    if (ctx) {
      void ctx.close()
      ctx = null
    }
  }

  return {
    resume,
    blip,
    select,
    back,
    bootMusic,
    stopBoot,
    fadeOutBoot,
    setRoomTone,
    setEnabled,
    enabled,
    dispose,
  }
}

/** Inert stand-in returned before the real instance exists (SSR + the first
 *  client render, both of which must agree — hydration-safe). Every call is
 *  a no-op; `enabled()` reports muted, matching the factory's own default. */
const NOOP_AUDIO: PS1Audio = {
  resume() {},
  blip() {},
  select() {},
  back() {},
  bootMusic: () => false,
  stopBoot() {},
  fadeOutBoot() {},
  setRoomTone() {},
  setEnabled() {},
  enabled: () => false,
  dispose() {},
}

/** The one memory-card audio instance, shared by every consumer of the hook
 *  below. Stays null until the first component mounts and its effect builds
 *  it — never at module load, never during render. */
let sharedAudio: PS1Audio | null = null

/**
 * One lazily-created `PS1Audio` instance, shared module-wide. The instance is
 * built inside an effect on first mount (never during render/SSR, per the
 * browser autoplay law and to keep server/first-client-paint output
 * identical); every consumer thereafter reads the same shared object, so a
 * toggle flipped from the chrome is immediately visible to every call site.
 */
export function useMemoryCardAudio(): PS1Audio {
  const [instance, setInstance] = useState<PS1Audio | null>(sharedAudio)

  useEffect(() => {
    if (!sharedAudio) sharedAudio = createPS1Audio()
    setInstance(sharedAudio)
  }, [])

  return instance ?? NOOP_AUDIO
}
