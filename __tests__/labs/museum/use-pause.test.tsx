import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { usePause } from '@/components/labs/museum/use-pause'

function setPointerLock(el: Element | null) {
  Object.defineProperty(document, 'pointerLockElement', {
    value: el,
    configurable: true,
  })
}

function fireLockChange() {
  document.dispatchEvent(new Event('pointerlockchange'))
}

const suppress = createRef<boolean>() as React.MutableRefObject<boolean>

beforeEach(() => {
  suppress.current = false
  setPointerLock(null)
})
afterEach(() => {
  setPointerLock(null)
})

describe('usePause', () => {
  it('opens when pointer lock is lost, not on unrelated lock events', () => {
    const { result } = renderHook(() => usePause(suppress))
    expect(result.current.paused).toBe(false)

    // never-locked → unlocked change: stays closed
    act(() => fireLockChange())
    expect(result.current.paused).toBe(false)

    // locked → unlocked: opens
    act(() => {
      setPointerLock(document.body)
      fireLockChange()
      setPointerLock(null)
      fireLockChange()
    })
    expect(result.current.paused).toBe(true)
  })

  it('does not open when the lock is lost during lab navigation', () => {
    suppress.current = true
    const { result } = renderHook(() => usePause(suppress))
    act(() => {
      setPointerLock(document.body)
      fireLockChange()
      setPointerLock(null)
      fireLockChange()
    })
    expect(result.current.paused).toBe(false)
  })

  it('closes on Escape (capture + preventDefault) while open', () => {
    const { result } = renderHook(() => usePause(suppress))
    act(() => result.current.open())
    expect(result.current.paused).toBe(true)

    const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    act(() => {
      document.body.dispatchEvent(esc)
    })
    expect(esc.defaultPrevented).toBe(true)
    expect(result.current.paused).toBe(false)
  })

  it('toggles on right-click when unlocked', () => {
    const { result } = renderHook(() => usePause(suppress))
    const rc = () =>
      act(() => {
        window.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true, bubbles: true }))
      })
    rc()
    expect(result.current.paused).toBe(true)
    rc()
    expect(result.current.paused).toBe(false)
  })

  it('exits pointer lock and opens on right-click while locked', () => {
    const exitPointerLock = vi.fn()
    document.exitPointerLock = exitPointerLock
    const { result } = renderHook(() => usePause(suppress))
    act(() => {
      setPointerLock(document.body)
      window.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true, bubbles: true }))
    })
    expect(exitPointerLock).toHaveBeenCalled()
    expect(result.current.paused).toBe(true)
  })

  it('suppresses the browser context menu inside the museum', () => {
    renderHook(() => usePause(suppress))
    const e = new MouseEvent('contextmenu', { cancelable: true, bubbles: true })
    act(() => {
      window.dispatchEvent(e)
    })
    expect(e.defaultPrevented).toBe(true)
  })
})
