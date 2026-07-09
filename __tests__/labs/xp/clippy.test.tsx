import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Clippy } from '@/components/labs/xp/clippy'
import { BalloonTip } from '@/components/labs/xp/balloon-tip'
import { useXpStore } from '@/components/labs/xp/store'

const initial = useXpStore.getState()

describe('Clippy', () => {
  beforeEach(() => {
    useXpStore.setState({ ...initial, phase: 'desktop' }, true)
    window.sessionStorage.clear()
    vi.useFakeTimers()
  })

  it('pops up after 10s with the hiring line and opens projects', () => {
    render(<Clippy />)
    expect(screen.queryByText(/trying to hire/)).toBeNull()
    act(() => vi.advanceTimersByTime(10_500))
    expect(screen.getByText(/trying to hire/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show me the projects' }))
    expect(useXpStore.getState().windows.some((w) => w.app === 'my-projects')).toBe(true)
  })

  it('dismiss hides it for the session', () => {
    render(<Clippy />)
    act(() => vi.advanceTimersByTime(10_500))
    fireEvent.click(screen.getByRole('button', { name: "Don't show tips" }))
    expect(useXpStore.getState().clippyDismissed).toBe(true)
    expect(window.sessionStorage.getItem('xp-clippy-dismissed')).toBe('1')
    expect(screen.queryByText(/trying to hire/)).toBeNull()
  })

  it('one follow-up tip fires 45s after the first bubble is actioned, then quiet', () => {
    render(<Clippy />)
    act(() => vi.advanceTimersByTime(10_500))
    fireEvent.click(screen.getByRole('button', { name: 'Show me the projects' }))
    expect(screen.queryByText(/trying to hire/)).toBeNull()
    act(() => vi.advanceTimersByTime(45_500))
    expect(screen.getByText(/Recycle Bin has history/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.queryByText(/Recycle Bin has history/)).toBeNull()
    expect(screen.queryByText(/trying to hire/)).toBeNull()
  })
})

describe('BalloonTip', () => {
  beforeEach(() => {
    useXpStore.setState({ ...initial, phase: 'desktop' }, true)
    window.sessionStorage.clear()
    vi.useFakeTimers()
  })

  it('appears after 25s, auto-hides after 8s, marks the session', () => {
    render(<BalloonTip />)
    expect(screen.queryByText(/Portfolio is up to date/)).toBeNull()
    act(() => vi.advanceTimersByTime(25_500))
    expect(screen.getByText(/Portfolio is up to date/)).toBeInTheDocument()
    expect(window.sessionStorage.getItem('xp-balloon-shown')).toBe('1')
    act(() => vi.advanceTimersByTime(8_500))
    expect(screen.queryByText(/Portfolio is up to date/)).toBeNull()
  })

  it('never appears twice in a session', () => {
    window.sessionStorage.setItem('xp-balloon-shown', '1')
    render(<BalloonTip />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.queryByText(/Portfolio is up to date/)).toBeNull()
  })
})
