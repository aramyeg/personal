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

export type MemoryCardAudioContextValue = {
  soundOn: boolean
  toggleSound: () => void
  blip: () => void
  select: () => void
  back: () => void
  boot: () => void
}

const noop = () => {}

/** Standalone default — components render fine without a provider (unit
 *  tests mount sections in isolation); every call is simply a no-op. */
const DEFAULT_VALUE: MemoryCardAudioContextValue = {
  soundOn: false,
  toggleSound: noop,
  blip: noop,
  select: noop,
  back: noop,
  boot: noop,
}

const MemoryCardAudioContext = createContext<MemoryCardAudioContextValue>(DEFAULT_VALUE)

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

  const value = useMemo<MemoryCardAudioContextValue>(
    () => ({
      soundOn,
      toggleSound,
      blip: audio.blip,
      select: audio.select,
      back: audio.back,
      boot: audio.boot,
    }),
    [soundOn, toggleSound, audio]
  )

  return (
    <MemoryCardAudioContext.Provider value={value}>{children}</MemoryCardAudioContext.Provider>
  )
}

export function useMemoryCardAudioContext(): MemoryCardAudioContextValue {
  return useContext(MemoryCardAudioContext)
}

export default MemoryCardAudioProvider
