import { afterEach, describe, expect, it } from 'vitest'
import { createInput } from '@/components/labs/snowpark/input'

function escapeEvent(repeat = false): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    code: 'Escape',
    key: 'Escape',
    cancelable: true,
    bubbles: true,
    repeat,
  })
}

describe('createInput Escape handling', () => {
  let detach: (() => void) | null = null

  afterEach(() => {
    detach?.()
    detach = null
  })

  it('prevents default and arms consumeEscape exactly once while playing', () => {
    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)
    input.setPlaying(true)

    const event = escapeEvent()
    document.body.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(input.consumeEscape()).toBe(true)
    expect(input.consumeEscape()).toBe(false)
  })

  it('does not re-arm consumeEscape on auto-repeat Escape keydowns', () => {
    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)
    input.setPlaying(true)

    document.body.dispatchEvent(escapeEvent())
    expect(input.consumeEscape()).toBe(true)

    const repeatEvent = escapeEvent(true)
    document.body.dispatchEvent(repeatEvent)

    expect(repeatEvent.defaultPrevented).toBe(true)
    expect(input.consumeEscape()).toBe(false)
  })

  it('does not prevent default or arm consumeEscape while not playing', () => {
    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)
    input.setPlaying(false)

    const event = escapeEvent()
    document.body.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(input.consumeEscape()).toBe(false)
  })

  it('prevents default before a pre-existing bubble-phase listener runs (capture ordering)', () => {
    // Simulates GalleryChrome mounting first and registering a bubble-phase
    // window keydown listener before the game's input controller attaches.
    let seenDefaultPrevented: boolean | null = null
    const bubbleListener = (e: KeyboardEvent): void => {
      if (e.code === 'Escape') seenDefaultPrevented = e.defaultPrevented
    }
    window.addEventListener('keydown', bubbleListener)

    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)
    input.setPlaying(true)

    try {
      document.body.dispatchEvent(escapeEvent())
      expect(seenDefaultPrevented).toBe(true)
    } finally {
      window.removeEventListener('keydown', bubbleListener)
    }
  })
})
