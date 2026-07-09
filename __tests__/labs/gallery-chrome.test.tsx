import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

function pressEscape(prevented: boolean) {
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
  if (prevented) {
    const preventer = (e: Event) => e.preventDefault()
    window.addEventListener('keydown', preventer, { capture: true, once: true })
  }
  window.dispatchEvent(event)
}

describe('GalleryChrome Escape handling', () => {
  beforeEach(() => push.mockClear())

  it('navigates to /labs on a plain Escape', () => {
    render(<GalleryChrome>lab</GalleryChrome>)
    pressEscape(false)
    expect(push).toHaveBeenCalledWith('/labs')
  })

  it('does nothing when another handler already prevented the Escape', () => {
    render(<GalleryChrome>lab</GalleryChrome>)
    pressEscape(true)
    expect(push).not.toHaveBeenCalled()
  })
})
