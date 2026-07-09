import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ChaosLayer } from '@/components/labs/xp/chaos-layer'
import { useXpStore } from '@/components/labs/xp/store'

const initial = useXpStore.getState()

describe('ChaosLayer', () => {
  beforeEach(() => useXpStore.setState(initial, true))

  it('closing a dialog spawns more until the blue screen', () => {
    useXpStore.getState().startChaos()
    render(<ChaosLayer />)
    let guard = 0
    while (useXpStore.getState().chaos === 'cascade' && guard++ < 50) {
      fireEvent.click(screen.getAllByRole('button', { name: 'OK' })[0])
    }
    expect(screen.getByTestId('bsod')).toBeInTheDocument()
  })

  it('any key reboots from the bsod back to the intact desktop', () => {
    vi.useFakeTimers()
    useXpStore.getState().openWindow('about')
    useXpStore.setState({ chaos: 'bsod' })
    render(<ChaosLayer />)
    expect(screen.getByTestId('bsod')).toBeInTheDocument()
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
      )
    })
    act(() => vi.advanceTimersByTime(1000))
    expect(useXpStore.getState().chaos).toBe('idle')
    expect(useXpStore.getState().windows).toHaveLength(1)
    vi.useRealTimers()
  })
})
