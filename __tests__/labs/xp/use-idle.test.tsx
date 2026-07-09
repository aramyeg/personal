import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdle } from '@/components/labs/xp/use-idle'

describe('useIdle', () => {
  it('fires after the idle window and resets on activity', () => {
    vi.useFakeTimers()
    const onIdle = vi.fn()
    renderHook(() => useIdle(1000, onIdle, true))
    act(() => vi.advanceTimersByTime(600))
    act(() => { window.dispatchEvent(new Event('pointermove')) })
    act(() => vi.advanceTimersByTime(600))
    expect(onIdle).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(500))
    expect(onIdle).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('never fires when disabled', () => {
    vi.useFakeTimers()
    const onIdle = vi.fn()
    renderHook(() => useIdle(1000, onIdle, false))
    act(() => vi.advanceTimersByTime(5000))
    expect(onIdle).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
