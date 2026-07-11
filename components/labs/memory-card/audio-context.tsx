'use client'

/**
 * MemoryCardAudioProvider — the one place chrome and every section share the
 * lab's single audio instance. Wraps `useMemoryCardAudio()` (the lazy,
 * effect-built instance from `audio.ts`) in a small context so a click on the
 * chrome toggle is visible to every section without prop-drilling a callback
 * through five files.
 *
 * `soundOn` is local React state, reconciled ONE way: read from the factory's
 * already-persisted preference once the real instance exists, never written
 * back except through `toggleSound` (the factory owns persistence — see
 * `setEnabled`'s doc comment in audio.ts). Nothing here renders differently
 * between server and first client paint: `soundOn` starts `false` on both,
 * matching the muted default `useMemoryCardAudio` reports before its effect
 * runs.
 *
 * Two contexts, not one, split on churn: `soundOn` flips on every toggle
 * click, but the call sites (`blip`/`select`/`back`/`boot`/`stopBoot`/
 * `fadeOutBoot`/`toggleSound`) don't need to change identity when it does — `audio` is
 * stable once built, and `toggleSound` is a `useCallback` keyed only on
 * `audio`. Consumers that only fire sounds (`BootBeat`'s one-shot boot on
 * mount, work's hover/flip handlers, contact's copy button) read
 * `useMemoryCardAudioActions()`, a context whose value is memoized on
 * `[audio, toggleSound]` — no `soundOn` — so it never tears down anything
 * built around it on a toggle. Only chrome, which also renders the on/off
 * label, needs `useMemoryCardAudioContext()`'s merged shape.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useMemoryCardAudio } from './audio'

export type MemoryCardAudioActions = {
  toggleSound: () => void
  blip: () => void
  select: () => void
  back: () => void
  /** Plays the PS1 boot recording — outcome-aware, see `audio.ts#bootMusic`. */
  boot: () => boolean
  /** Cuts the boot recording instantly — `BootBeat`'s skip path (keydown/pointerdown). */
  stopBoot: () => void
  /** Ramps the boot recording out over ~400ms then pauses it — `BootBeat`'s own
   *  timer-end path only; skip stays instant via `stopBoot`. */
  fadeOutBoot: () => void
}

export type MemoryCardAudioContextValue = MemoryCardAudioActions & {
  soundOn: boolean
}

const noop = () => {}

/** Standalone default — components render fine without a provider (unit
 *  tests mount sections in isolation); every call is simply a no-op. */
const DEFAULT_ACTIONS: MemoryCardAudioActions = {
  toggleSound: noop,
  blip: noop,
  select: noop,
  back: noop,
  boot: () => false,
  stopBoot: noop,
  fadeOutBoot: noop,
}

const MemoryCardAudioActionsContext = createContext<MemoryCardAudioActions>(DEFAULT_ACTIONS)
const MemoryCardSoundOnContext = createContext<boolean>(false)

export function MemoryCardAudioProvider({ children }: { children: ReactNode }) {
  const audio = useMemoryCardAudio()
  const [soundOn, setSoundOn] = useState(false)

  useEffect(() => {
    setSoundOn(audio.enabled())
  }, [audio])

  const toggleSound = useCallback(() => {
    audio.resume()
    const next = !audio.enabled()
    audio.setEnabled(next)
    setSoundOn(next)
  }, [audio])

  // A returning visitor whose preference is already "on" gets a page load
  // where the toggle correctly reads "sound: on" from localStorage, but the
  // real AudioContext has never been created — resume() only ever ran inside
  // a click on the toggle itself, which this visitor has no reason to press.
  // Every call site would silently no-op until they happened to double-click
  // it. Arm the actual resume() on the page's first qualifying user gesture
  // instead: click/keydown/touchend are valid WebAudio user-activation
  // events, scroll is not, so scroll is deliberately not listened for here.
  // Capture phase + a shared AbortController so whichever of the three fires
  // first tears down all three — one resume() call, not up to three. If the
  // toggle itself is that first gesture, its own onClick already calls
  // resume() too; the factory's resume() is idempotent (`if (!ctx) ctx =
  // ctxFactory()`), so the harmless double call never double-creates a
  // context.
  useEffect(() => {
    if (!audio.enabled()) return
    const controller = new AbortController()
    const arm = () => {
      audio.resume()
      controller.abort()
    }
    const opts = { capture: true, once: true, signal: controller.signal }
    window.addEventListener('click', arm, opts)
    window.addEventListener('keydown', arm, opts)
    window.addEventListener('touchend', arm, opts)
    return () => controller.abort()
  }, [audio])

  const actions = useMemo<MemoryCardAudioActions>(
    () => ({
      toggleSound,
      blip: audio.blip,
      select: audio.select,
      back: audio.back,
      boot: audio.bootMusic,
      stopBoot: audio.stopBoot,
      fadeOutBoot: audio.fadeOutBoot,
    }),
    [audio, toggleSound]
  )

  return (
    <MemoryCardAudioActionsContext.Provider value={actions}>
      <MemoryCardSoundOnContext.Provider value={soundOn}>
        {children}
      </MemoryCardSoundOnContext.Provider>
    </MemoryCardAudioActionsContext.Provider>
  )
}

/** Stable across `soundOn` toggles — the hook to reach for when a consumer
 *  only ever fires sounds and never renders the on/off label (hero, work,
 *  contact). Safe to depend on directly in an effect's dependency array. */
export function useMemoryCardAudioActions(): MemoryCardAudioActions {
  return useContext(MemoryCardAudioActionsContext)
}

/** Merged shape for consumers that also need `soundOn` (chrome's label +
 *  aria-pressed). Re-renders on every toggle by design; do not depend on
 *  this in an effect that must survive a toggle — use the actions-only hook
 *  above instead. */
export function useMemoryCardAudioContext(): MemoryCardAudioContextValue {
  const actions = useContext(MemoryCardAudioActionsContext)
  const soundOn = useContext(MemoryCardSoundOnContext)
  return useMemo(() => ({ ...actions, soundOn }), [actions, soundOn])
}

export default MemoryCardAudioProvider
