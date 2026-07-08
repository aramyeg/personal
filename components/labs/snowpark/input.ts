import type { RiderInput } from './rider'

export type InputController = {
  attach: (target: HTMLElement) => () => void
  sample: () => RiderInput
  consumeEscape: () => boolean
  setPlaying: (playing: boolean) => void
}

const SWIPE_THRESHOLD = 30

export function createInput(): InputController {
  let jumpHeld = false
  let grabHeld = false
  let jumpPressed = false
  let spinLeftPressed = false
  let spinRightPressed = false
  let retryPressed = false
  let pendingEscape = false
  let playing = false

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
        if (!e.repeat) spinLeftPressed = true
        break
      case 'ArrowRight':
        e.preventDefault()
        if (!e.repeat) spinRightPressed = true
        break
      case 'ArrowUp':
        e.preventDefault()
        grabHeld = true
        break
      case 'KeyR':
        if (!e.repeat) retryPressed = true
        break
      case 'Escape':
        if (playing) {
          e.preventDefault()
          pendingEscape = true
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
        grabHeld = false
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
        grabHeld = true
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
        spinRightPressed = true
        touchStartX = t.clientX
      } else if (dx <= -SWIPE_THRESHOLD) {
        spinLeftPressed = true
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
        grabHeld = false
      }
    }
  }

  const attach = (target: HTMLElement): (() => void) => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove', onTouchMove, { passive: true })
    target.addEventListener('touchend', onTouchEnd, { passive: true })
    target.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      target.removeEventListener('touchcancel', onTouchEnd)
    }
  }

  const sample = (): RiderInput => {
    const frame: RiderInput = {
      jumpHeld,
      jumpPressed,
      spinLeftPressed,
      spinRightPressed,
      grabHeld,
      retryPressed,
    }
    jumpPressed = false
    spinLeftPressed = false
    spinRightPressed = false
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
  }

  return { attach, sample, consumeEscape, setPlaying }
}
