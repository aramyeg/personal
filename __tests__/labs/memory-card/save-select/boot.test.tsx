import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/font/google is unavailable under vitest — stub with an inert style object.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// Mock the one React seam (`useMemoryCardAudio`) rather than the context
// module, so these tests exercise the REAL `MemoryCardAudioProvider` wiring
// (`boot` -> `bootMusic`, `stopBoot` -> `stopBoot`) and not a re-implemented
// stand-in of it.
const mockAudio = {
  resume: vi.fn(),
  blip: vi.fn(),
  select: vi.fn(),
  back: vi.fn(),
  bootMusic: vi.fn(() => true),
  stopBoot: vi.fn(),
  setRoomTone: vi.fn(),
  setEnabled: vi.fn(),
  enabled: vi.fn(() => false),
  dispose: vi.fn(),
}
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => mockAudio,
}))

import { BootBeat } from '@/components/labs/memory-card/boot'
import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'

function renderBootBeat() {
  return render(
    <MemoryCardAudioProvider>
      <BootBeat />
    </MemoryCardAudioProvider>
  )
}

describe('BootBeat', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.clearAllMocks()
    mockAudio.bootMusic.mockReturnValue(true)
    mockAudio.enabled.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders null (SSR-safe, no sessionStorage write) when the session already booted', () => {
    window.sessionStorage.setItem('memory-card-booted', '1')
    const { container } = renderBootBeat()

    expect(container).toBeEmptyDOMElement()
    expect(mockAudio.bootMusic).not.toHaveBeenCalled()
  })

  it('shows the overlay on a fresh session, fires boot(), and sets the sessionStorage guard once it completes', () => {
    vi.useFakeTimers()
    renderBootBeat()

    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()
    expect(mockAudio.bootMusic).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem('memory-card-booted')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByTestId('boot-beat')).toBeNull()
    expect(window.sessionStorage.getItem('memory-card-booted')).toBe('1')
    expect(mockAudio.stopBoot).toHaveBeenCalledTimes(1)
  })

  it('any keydown skips instantly — overlay removed and guard set without waiting for the timer', () => {
    vi.useFakeTimers()
    renderBootBeat()
    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })

    expect(screen.queryByTestId('boot-beat')).toBeNull()
    expect(window.sessionStorage.getItem('memory-card-booted')).toBe('1')
    expect(mockAudio.stopBoot).toHaveBeenCalledTimes(1)
  })

  it('any pointerdown skips instantly too', () => {
    vi.useFakeTimers()
    renderBootBeat()
    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()

    act(() => {
      fireEvent.pointerDown(window)
    })

    expect(screen.queryByTestId('boot-beat')).toBeNull()
    expect(window.sessionStorage.getItem('memory-card-booted')).toBe('1')
  })

  it('reduced motion never renders the beat and never writes the sessionStorage guard', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    try {
      const { container } = renderBootBeat()
      expect(container).toBeEmptyDOMElement()
      expect(mockAudio.bootMusic).not.toHaveBeenCalled()
      expect(window.sessionStorage.getItem('memory-card-booted')).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })

  it('produces empty first-paint markup on the server (hydration-safe)', () => {
    const html = renderToStaticMarkup(<BootBeat />)
    expect(html).toBe('')
  })
})
