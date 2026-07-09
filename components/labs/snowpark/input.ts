import type { RiderInput } from './rider'
import type { Grab } from './tricks'

export type InputController = {
  attach: (target: HTMLElement) => () => void
  sample: () => RiderInput
  consumeEscape: () => boolean
  setPlaying: (playing: boolean) => void
}

const SWIPE_THRESHOLD = 30
/** how long a touch swipe holds its spin direction (ms) */
const SWIPE_HOLD_MS = 400

export function createInput(): InputController {
  let jumpHeld = false
  let jumpPressed = false
  let leftHeld = false
  let rightHeld = false
  let retryPressed = false
  let pendingEscape = false
  let playing = false

  // Grabs: ArrowUp reaches to the nose, ArrowDown back over the tail. Both held
  // → the most recently pressed wins (tracked in `lastGrabKey`). A second touch
  // finger is a nose grab.
  let noseHeld = false
  let tailHeld = false
  let lastGrabKey: 'nose' | 'tail' | null = null
  let grabTouchHeld = false

  // Touch spin: a swipe sets a held direction that expires after SWIPE_HOLD_MS.
  let touchSpinDir: -1 | 0 | 1 = 0
  let touchSpinExpiry = 0

  const now = (): number =>
    typeof performance !== 'undefined' ? performance.now() : Date.now()

  // Touch bookkeeping: primary finger for jump + swipe, second finger for grab.
  let touchStartX: number | null = null
  let primaryTouchId: number | null = null
  let grabTouchId: number | null = null

  const onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'Space':
        e.preventDefault()
        if (!jumpHeld) jumpPressed = true
        jumpHeld = true
        break
      case 'ArrowLeft':
        e.preventDefault()
        leftHeld = true
        break
      case 'ArrowRight':
        e.preventDefault()
        rightHeld = true
        break
      case 'ArrowUp':
        e.preventDefault()
        noseHeld = true
        lastGrabKey = 'nose'
        break
      case 'ArrowDown':
        e.preventDefault()
        tailHeld = true
        lastGrabKey = 'tail'
        break
      case 'KeyR':
        if (!e.repeat) retryPressed = true
        break
      case 'Escape':
        if (playing) {
          e.preventDefault()
          if (!e.repeat) pendingEscape = true
        }
        break
      default:
        break
    }
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'Space':
        jumpHeld = false
        break
      case 'ArrowUp':
        noseHeld = false
        if (lastGrabKey === 'nose') lastGrabKey = tailHeld ? 'tail' : null
        break
      case 'ArrowDown':
        tailHeld = false
        if (lastGrabKey === 'tail') lastGrabKey = noseHeld ? 'nose' : null
        break
      case 'ArrowLeft':
        leftHeld = false
        break
      case 'ArrowRight':
        rightHeld = false
        break
      default:
        break
    }
  }

  const onTouchStart = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (primaryTouchId === null) {
        primaryTouchId = t.identifier
        touchStartX = t.clientX
        if (!jumpHeld) jumpPressed = true
        jumpHeld = true
      } else if (grabTouchId === null) {
        grabTouchId = t.identifier
        grabTouchHeld = true
      }
    }
  }

  const onTouchMove = (e: TouchEvent): void => {
    if (primaryTouchId === null || touchStartX === null) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier !== primaryTouchId) continue
      const dx = t.clientX - touchStartX
      if (dx >= SWIPE_THRESHOLD) {
        touchSpinDir = 1
        touchSpinExpiry = now() + SWIPE_HOLD_MS
        touchStartX = t.clientX
      } else if (dx <= -SWIPE_THRESHOLD) {
        touchSpinDir = -1
        touchSpinExpiry = now() + SWIPE_HOLD_MS
        touchStartX = t.clientX
      }
    }
  }

  const onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier === primaryTouchId) {
        primaryTouchId = null
        touchStartX = null
        jumpHeld = false
      } else if (t.identifier === grabTouchId) {
        grabTouchId = null
        grabTouchHeld = false
      }
    }
  }

  const attach = (target: HTMLElement): (() => void) => {
    // Capture phase: must run before GalleryChrome's bubble-phase Escape
    // handler regardless of which mounts first, or the pause preventDefault
    // loses the race and Esc navigates away instead of pausing.
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp)
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove', onTouchMove, { passive: true })
    target.addEventListener('touchend', onTouchEnd, { passive: true })
    target.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp)
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      target.removeEventListener('touchcancel', onTouchEnd)
    }
  }

  const sample = (): RiderInput => {
    // Both arrows held cancel; keyboard wins over a still-live touch swipe.
    const keyDir: -1 | 0 | 1 = leftHeld === rightHeld ? 0 : leftHeld ? -1 : 1
    const touchDir: -1 | 0 | 1 = now() < touchSpinExpiry ? touchSpinDir : 0
    // Grab: with both grab keys down the most recent wins; a lone touch is nose.
    const keyGrab: Grab = noseHeld && tailHeld ? (lastGrabKey ?? 'nose') : noseHeld ? 'nose' : tailHeld ? 'tail' : 'none'
    const grab: Grab = keyGrab !== 'none' ? keyGrab : grabTouchHeld ? 'nose' : 'none'
    const frame: RiderInput = {
      jumpHeld,
      jumpPressed,
      grab,
      spinDir: keyDir !== 0 ? keyDir : touchDir,
      retryPressed,
    }
    jumpPressed = false
    retryPressed = false
    return frame
  }

  const consumeEscape = (): boolean => {
    if (!pendingEscape) return false
    pendingEscape = false
    return true
  }

  const setPlaying = (next: boolean): void => {
    playing = next
    // Leaving play discards buffered one-shot intents: an Escape that raced
    // a same-frame phase change must not pause the NEXT run, and an R pressed
    // while paused must not respawn the rider on resume (final-review LOW-1/2).
    if (!next) {
      pendingEscape = false
      retryPressed = false
      jumpPressed = false
    }
  }

  return { attach, sample, consumeEscape, setPlaying }
}
