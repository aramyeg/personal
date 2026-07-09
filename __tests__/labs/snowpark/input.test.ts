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

function keyEvent(type: 'keydown' | 'keyup', code: string): KeyboardEvent {
  return new KeyboardEvent(type, { code, key: code, cancelable: true, bubbles: true })
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

  it('latches a tail grab while ArrowDown is held and releases it on keyup', () => {
    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)

    expect(input.sample().grab).toBe('none')

    document.body.dispatchEvent(keyEvent('keydown', 'ArrowDown'))
    expect(input.sample().grab).toBe('tail')

    document.body.dispatchEvent(keyEvent('keyup', 'ArrowDown'))
    expect(input.sample().grab).toBe('none')
  })

  it('latches a nose grab on ArrowUp, distinct from the tail grab', () => {
    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)

    document.body.dispatchEvent(keyEvent('keydown', 'ArrowUp'))
    expect(input.sample().grab).toBe('nose')

    document.body.dispatchEvent(keyEvent('keyup', 'ArrowUp'))
    expect(input.sample().grab).toBe('none')
  })

  it('with both grab keys held, the most recently pressed wins', () => {
    const input = createInput()
    const target = document.createElement('div')
    detach = input.attach(target)

    document.body.dispatchEvent(keyEvent('keydown', 'ArrowUp'))
    document.body.dispatchEvent(keyEvent('keydown', 'ArrowDown'))
    expect(input.sample().grab).toBe('tail') // ArrowDown pressed most recently

    // Releasing the newer key falls back to the one still held.
    document.body.dispatchEvent(keyEvent('keyup', 'ArrowDown'))
    expect(input.sample().grab).toBe('nose')
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
