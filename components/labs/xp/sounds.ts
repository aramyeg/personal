import { useXpStore } from './store'

const NAMES = ['startup', 'error', 'balloon', 'nudge', 'recycle', 'click', 'shutdown'] as const
export type SoundName = (typeof NAMES)[number]

let unlocked = false

export function unlockSounds() { unlocked = true }
export function resetSoundsForTest() { unlocked = false }

/** Silently no-ops when locked, muted, or the asset is missing. */
export function playSound(name: SoundName) {
  if (!unlocked || useXpStore.getState().muted) return
  try {
    const audio = new Audio(`/labs/xp/sounds/${name}.mp3`)
    audio.volume = 0.5
    void audio.play().catch(() => {})
  } catch {
    // jsdom or missing Audio — never break the desktop over a sound
  }
}
