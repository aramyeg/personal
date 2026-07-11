import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

// next/font/google is unavailable under vitest — stub with an inert style object.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// GalleryChrome (used by the Escape-ownership regression test below) routes
// through next/navigation — same mock shape as esc-ordering.test.tsx.
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

// Mock the one React seam (`useMemoryCardAudio`) rather than the context
// module, so these tests exercise the REAL `MemoryCardAudioProvider` wiring
// (`boot` -> `bootMusic`, `stopBoot` -> `stopBoot`, `fadeOutBoot` -> `fadeOutBoot`)
// and not a re-implemented stand-in of it.
const mockAudio = {
  resume: vi.fn(),
  blip: vi.fn(),
  select: vi.fn(),
  back: vi.fn(),
  bootMusic: vi.fn(() => true),
  stopBoot: vi.fn(),
  fadeOutBoot: vi.fn(),
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
import { GalleryChrome } from '@/components/labs/gallery-chrome'

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
    push.mockClear()
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

  it('shows the overlay on a fresh session, fires boot(), and sets the sessionStorage guard once the timer ends — fading the audio out rather than cutting it', () => {
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
    // Natural end fades the recording out — it does NOT use the instant cut.
    expect(mockAudio.fadeOutBoot).toHaveBeenCalledTimes(1)
    expect(mockAudio.stopBoot).not.toHaveBeenCalled()
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
    // Skip is the instant cut — it does NOT use the fade.
    expect(mockAudio.stopBoot).toHaveBeenCalledTimes(1)
    expect(mockAudio.fadeOutBoot).not.toHaveBeenCalled()
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
    expect(mockAudio.stopBoot).toHaveBeenCalledTimes(1)
    expect(mockAudio.fadeOutBoot).not.toHaveBeenCalled()
  })

  // Regression test for a real bug found in review: BootBeat's skip handler
  // ran in the capture phase but never called stopPropagation()/preventDefault(),
  // so GalleryChrome's bubble-phase window Escape listener (gallery-chrome.tsx)
  // then saw an un-cancelled Escape and navigated to /labs — ejecting the
  // visitor instead of just revealing the screen, AND silently spending the
  // session's one boot beat on the way out. Mirrors the XP lab's own
  // esc-ordering.test.tsx precedent: wrap in the real GalleryChrome, dispatch
  // a real bubbling Escape on document.body, assert push('/labs') never fires.
  it('Escape during the beat is owned by the overlay — skips without GalleryChrome ejecting the visitor to /labs', () => {
    vi.useFakeTimers()
    render(
      <GalleryChrome>
        <MemoryCardAudioProvider>
          <BootBeat />
        </MemoryCardAudioProvider>
      </GalleryChrome>
    )
    expect(screen.getByTestId('boot-beat')).toBeInTheDocument()

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    })

    expect(screen.queryByTestId('boot-beat')).toBeNull()
    expect(window.sessionStorage.getItem('memory-card-booted')).toBe('1')
    expect(mockAudio.stopBoot).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
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
