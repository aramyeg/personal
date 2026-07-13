import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  Curtain,
  CURTAIN_MAX_WAIT_MS,
  CURTAIN_MIN_HOLD_MS,
  CURTAIN_OPEN_MS,
} from '@/components/labs/museum/curtain'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Curtain', () => {
  it('shows the visitor guide and live progress while closed', () => {
    render(<Curtain ready={false} progress={42} />)
    expect(screen.getByText(/visitor.s guide/i)).toBeInTheDocument()
    expect(screen.getByText(/42%/)).toBeInTheDocument()
    expect(screen.getByText(/shift/i)).toBeInTheDocument()
    expect(document.querySelector('[data-phase="closed"]')).toBeTruthy()
  })

  it('holds the minimum, then parts and unmounts once ready', () => {
    const { rerender } = render(<Curtain ready={false} progress={0} />)
    rerender(<Curtain ready progress={100} />)
    act(() => vi.advanceTimersByTime(CURTAIN_MIN_HOLD_MS - 1))
    expect(document.querySelector('[data-phase="closed"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector('[data-phase="opening"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(CURTAIN_OPEN_MS))
    expect(document.querySelector('[data-phase]')).toBeNull()
  })

  it('gives up waiting at the failsafe and opens anyway', () => {
    render(<Curtain ready={false} progress={10} />)
    act(() => vi.advanceTimersByTime(CURTAIN_MAX_WAIT_MS))
    expect(document.querySelector('[data-phase="opening"]')).toBeTruthy()
  })
})
