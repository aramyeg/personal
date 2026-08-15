import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// A stateful audio double — real enough that toggling actually flips
// `enabled()`, so the provider's optimistic label update can be asserted
// against a real setEnabled(true) call, not just a fixed mock return.
let mockAudioEnabled = false
const mockAudio = {
  resume: vi.fn(),
  blip: vi.fn(),
  select: vi.fn(),
  back: vi.fn(),
  bootMusic: vi.fn(),
  stopBoot: vi.fn(),
  fadeOutBoot: vi.fn(),
  setRoomTone: vi.fn(),
  setEnabled: vi.fn((on: boolean) => {
    mockAudioEnabled = on
  }),
  enabled: vi.fn(() => mockAudioEnabled),
  dispose: vi.fn(),
}
vi.mock('@/components/labs/memory-card/audio', () => ({
  useMemoryCardAudio: () => mockAudio,
}))

// The lab fonts pull in `next/font/google`, whose call sites are compiled away
// by Next's loader — not available under vitest. Chrome only reads `monoFamily`
// but importing it evaluates the whole module, so stub it with inert style
// objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

import { MemoryCardChrome, MemoryCardFooter } from '@/components/labs/memory-card/sections/chrome'
import { MemoryCardAudioProvider } from '@/components/labs/memory-card/audio-context'

describe('MemoryCardChrome', () => {
  it('no longer renders the retired section anchors', () => {
    render(<MemoryCardChrome />)
    for (const label of ['work', 'skills', 'about', 'contact']) {
      expect(screen.queryByRole('link', { name: label })).toBeNull()
    }
  })

  it('renders a skip link that jumps to the save index list', () => {
    render(<MemoryCardChrome />)
    expect(
      screen.getByRole('link', { name: /skip to the content/i })
    ).toHaveAttribute('href', '#save-index')
  })

  it('keeps both asset attribution lines in the credits footer (license law)', () => {
    render(<MemoryCardFooter />)
    expect(screen.getByText(/crt model by meipal \(cc by 4\.0\)/i)).toBeInTheDocument()
    expect(
      screen.getByText(/character base by quaternius \(cc0\)/i)
    ).toBeInTheDocument()
  })

  it('the footer flows in document order (not fixed) on mobile — static, fixed only at lg', () => {
    const { container } = render(<MemoryCardFooter />)
    const footer = container.querySelector('footer')!
    // Base position is static (flows after the list on mobile); desktop pins it.
    expect(footer.className).toContain('static')
    expect(footer.className).toContain('lg:fixed')
    expect(footer.className).not.toMatch(/(^|\s)fixed(\s|$)/)
  })

  it('no longer credits the retired character asset', () => {
    render(<MemoryCardFooter />)
    expect(screen.queryByText(/humans of the world/i)).toBeNull()
  })

  // T6 review N2 (routed to Task 10): the toggle used to render aria-disabled
  // + cursor-not-allowed while onClick was already wired but inert. Sound is
  // live now, so the disabled affordance is gone — this test is deliberately
  // updated to assert the real thing (no aria-disabled, aria-pressed reflects
  // state) instead of the placeholder it replaced.
  it('renders the wordmark and a live, enabled sound toggle', () => {
    render(<MemoryCardChrome />)
    expect(screen.getByText(/memory card/i)).toBeInTheDocument()
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: off')
    expect(sound).not.toHaveAttribute('aria-disabled')
    expect(sound).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects the soundOn prop in the toggle label', () => {
    render(<MemoryCardChrome soundOn />)
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: on')
    expect(sound).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks the sound toggle (header) and the gallery link (footer) for the glyph cursor', () => {
    const { unmount } = render(<MemoryCardChrome />)
    expect(screen.getByRole('button', { name: /sound/i })).toHaveAttribute(
      'data-cursor',
      'triangle'
    )
    unmount()
    render(<MemoryCardFooter />)
    expect(screen.getByRole('link', { name: /gallery/i })).toHaveAttribute(
      'data-cursor',
      'triangle'
    )
  })

  it('toggling the sound button calls setEnabled(true) and flips the label live', () => {
    render(
      <MemoryCardAudioProvider>
        <MemoryCardChrome />
      </MemoryCardAudioProvider>
    )
    const sound = screen.getByRole('button', { name: /sound/i })
    expect(sound).toHaveTextContent('sound: off')

    fireEvent.click(sound)

    expect(mockAudio.setEnabled).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: /sound/i })).toHaveTextContent('sound: on')
  })
})
