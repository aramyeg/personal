import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { XpDesktop } from '@/components/labs/xp/xp-desktop'
import { useXpStore } from '@/components/labs/xp/store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const initial = useXpStore.getState()

describe('boot flow', () => {
  beforeEach(() => {
    useXpStore.setState(initial, true)
    window.sessionStorage.clear()
    vi.useRealTimers()
  })

  it('fresh session boots: boot screen → any key skips to welcome → login reaches desktop', () => {
    render(<XpDesktop />)
    expect(screen.getByTestId('boot-screen')).toBeInTheDocument()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(useXpStore.getState().phase).toBe('welcome')
    fireEvent.click(screen.getByRole('button', { name: 'Log on as Aram' }))
    expect(useXpStore.getState().phase).toBe('desktop')
    expect(window.sessionStorage.getItem('xp-booted')).toBe('1')
  })

  it('already-booted session skips straight to the desktop', () => {
    window.sessionStorage.setItem('xp-booted', '1')
    render(<XpDesktop />)
    expect(useXpStore.getState().phase).toBe('desktop')
  })

  it('boot auto-advances to welcome after 2.5s', () => {
    vi.useFakeTimers()
    render(<XpDesktop />)
    act(() => vi.advanceTimersByTime(2600))
    expect(useXpStore.getState().phase).toBe('welcome')
    vi.useRealTimers()
  })
})
