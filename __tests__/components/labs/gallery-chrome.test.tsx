import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GalleryChrome } from '@/components/labs/gallery-chrome'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

describe('GalleryChrome', () => {
  beforeEach(() => push.mockClear())

  it('renders its children', () => {
    render(
      <GalleryChrome>
        <p>lab content</p>
      </GalleryChrome>
    )
    expect(screen.getByText('lab content')).toBeInTheDocument()
  })

  it('renders a back-to-gallery link', () => {
    render(<GalleryChrome>x</GalleryChrome>)
    const link = screen.getByRole('link', { name: /gallery/i })
    expect(link).toHaveAttribute('href', '/labs')
  })

  it('navigates to /labs on Escape', () => {
    render(<GalleryChrome>x</GalleryChrome>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(push).toHaveBeenCalledWith('/labs')
  })
})
