import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { CuratorTour } from '@/components/labs/curator/tour'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()

// The global test setup mocks matchMedia with matches: false, which reads as
// mobile for the tour's desktop gate. Stub per-test for the desktop path.
function stubDesktopMatchMedia() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === '(min-width: 1024px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  )
}

function renderAnchors(): HTMLDivElement {
  const div = document.createElement('div')
  div.innerHTML = `
    <nav data-tour="workspace-nav"></nav>
    <button data-tour="spec-chip"></button>
    <button data-tour="nav-engineering"></button>
    <button data-tour="nav-settings"></button>
  `
  document.body.appendChild(div)
  return div
}

beforeEach(() => {
  useCuratorStore.setState(initial, true)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const tourDialog = () => screen.queryByRole('dialog', { name: 'Product tour' })

describe('CuratorTour', () => {
  it('renders nothing when tourDone', () => {
    useCuratorStore.getState().markTourDone()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(1000))
    expect(tourDialog()).not.toBeInTheDocument()
  })

  it('does not open on mobile and does not mark the tour done', () => {
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(1000))
    expect(tourDialog()).not.toBeInTheDocument()
    expect(useCuratorStore.getState().tourDone).toBe(false)
    expect(useCuratorStore.getState().tourOpen).toBe(false)
  })

  it('opens on desktop after the delay', () => {
    stubDesktopMatchMedia()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    expect(tourDialog()).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    expect(useCuratorStore.getState().tourOpen).toBe(true)
  })

  it('Next advances the step', () => {
    stubDesktopMatchMedia()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('Back returns to the previous step', () => {
    stubDesktopMatchMedia()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
  })

  it('skips a step whose anchor is missing', () => {
    stubDesktopMatchMedia()
    const div = renderAnchors()
    div.querySelector('[data-tour="spec-chip"]')?.remove()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument()
  })

  it('"Get started" on the last step finishes the tour', () => {
    stubDesktopMatchMedia()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    expect(useCuratorStore.getState().tourDone).toBe(true)
    expect(useCuratorStore.getState().tourOpen).toBe(false)
    expect(tourDialog()).not.toBeInTheDocument()
  })

  it('"Skip tour" sets both tourDone and tourOpen false', () => {
    stubDesktopMatchMedia()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(useCuratorStore.getState().tourDone).toBe(true)
    expect(useCuratorStore.getState().tourOpen).toBe(false)
    expect(tourDialog()).not.toBeInTheDocument()
  })

  it('Escape finishes the tour', () => {
    stubDesktopMatchMedia()
    renderAnchors()
    render(<CuratorTour />)
    act(() => vi.advanceTimersByTime(600))
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      window.dispatchEvent(escape)
    })
    expect(escape.defaultPrevented).toBe(true)
    expect(useCuratorStore.getState().tourDone).toBe(true)
    expect(tourDialog()).not.toBeInTheDocument()
  })
})
