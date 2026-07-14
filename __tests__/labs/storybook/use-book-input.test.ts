import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBookInput } from '@/components/labs/storybook/use-book-input'
import { useStorybookStore } from '@/components/labs/storybook/store'

const s = () => useStorybookStore.getState()
const initial = useStorybookStore.getState()

const swipe = (dx: number, dy = 0) => {
  window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, clientY: 300 }))
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: 300 + dx, clientY: 300 + dy }))
}

describe('useBookInput — grab suppression (law H1)', () => {
  beforeEach(() => useStorybookStore.setState(initial, true))
  beforeEach(() => useStorybookStore.setState({ spread: 5, booted: true }))

  it('a qualifying swipe fires a turn when no grab is active', () => {
    renderHook(() => useBookInput(true))
    swipe(-100) // moved left -> 'next'
    expect(s().turning).toBe('next')
  })

  it('a qualifying swipe does NOT fire a turn when a grab is active at pointerdown time', () => {
    useStorybookStore.setState({ grab: { id: 'tab-1', kind: 'tab' } })
    renderHook(() => useBookInput(true))
    swipe(-100)
    expect(s().turning).toBeNull()
  })

  it('once the grab ends, a fresh swipe fires normally again', () => {
    useStorybookStore.setState({ grab: { id: 'tab-1', kind: 'tab' } })
    renderHook(() => useBookInput(true))
    swipe(-100)
    expect(s().turning).toBeNull()

    useStorybookStore.setState({ grab: null })
    swipe(-100)
    expect(s().turning).toBe('next')
  })

  it('keyboard turns are unaffected by an active grab (H2: turns are never blocked)', () => {
    useStorybookStore.setState({ grab: { id: 'knob-1', kind: 'knob' } })
    renderHook(() => useBookInput(true))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(s().turning).toBe('next')
    expect(s().grab).toBeNull() // requestTurn force-released it
  })

  it('wheel turns are unaffected by an active grab (H2: turns are never blocked)', () => {
    useStorybookStore.setState({ grab: { id: 'flap-1', kind: 'flap' } })
    renderHook(() => useBookInput(true))
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 80 }))
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 80 }))
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 80 }))
    expect(s().turning).toBe('next')
    expect(s().grab).toBeNull()
  })
})
