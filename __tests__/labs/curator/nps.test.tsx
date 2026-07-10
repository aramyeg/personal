import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NpsSurvey } from '@/components/labs/curator/nps-survey'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => {
  vi.useFakeTimers()
  useCuratorStore.setState(initial, true)
})
afterEach(() => vi.useRealTimers())

const question = /how likely are you to recommend this cv/i

describe('NpsSurvey', () => {
  it('appears after the third module switch', () => {
    render(<NpsSurvey />)
    expect(screen.queryByText(question)).not.toBeInTheDocument()
    act(() => {
      const s = useCuratorStore.getState()
      s.setModule('rooms'); s.setModule('pipeline'); s.setModule('tickets')
    })
    expect(screen.getByText(question)).toBeInTheDocument()
  })

  it('appears after 90 seconds', () => {
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(90_000))
    expect(screen.getByText(question)).toBeInTheDocument()
  })

  it('thanks on a score and never returns', () => {
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(90_000))
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(screen.queryByText(question)).not.toBeInTheDocument()
    expect(useCuratorStore.getState().npsDone).toBe(true)
    expect(useCuratorStore.getState().toasts[0].title).toBe('Thanks for your feedback')
  })

  it('"Remind me later" also retires it permanently', () => {
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(90_000))
    fireEvent.click(screen.getByRole('button', { name: /remind me later/i }))
    expect(useCuratorStore.getState().npsDone).toBe(true)
    expect(useCuratorStore.getState().toasts).toHaveLength(0)
  })

  it('never arms when already done', () => {
    useCuratorStore.getState().markNpsDone()
    render(<NpsSurvey />)
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.queryByText(question)).not.toBeInTheDocument()
  })
})
