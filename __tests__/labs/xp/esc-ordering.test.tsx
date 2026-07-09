import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { GalleryChrome } from '@/components/labs/gallery-chrome'
import { XpDesktop } from '@/components/labs/xp/xp-desktop'
import { useXpStore } from '@/components/labs/xp/store'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const initial = useXpStore.getState()
const pressEscOnBody = () =>
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  })

describe('esc ordering with GalleryChrome', () => {
  beforeEach(() => {
    useXpStore.setState({ ...initial, phase: 'desktop' }, true)
    window.sessionStorage.setItem('xp-booted', '1')
    push.mockClear()
  })

  it('esc with the start menu open closes the menu and does NOT navigate', () => {
    render(<GalleryChrome><XpDesktop /></GalleryChrome>)
    act(() => useXpStore.getState().setStartOpen(true))
    pressEscOnBody()
    expect(useXpStore.getState().startOpen).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('esc with the screensaver up dismisses it and does NOT navigate', () => {
    render(<GalleryChrome><XpDesktop /></GalleryChrome>)
    act(() => useXpStore.getState().setScreensaver(true))
    pressEscOnBody()
    expect(useXpStore.getState().screensaver).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('esc on a quiet desktop falls through to GalleryChrome and navigates', () => {
    render(<GalleryChrome><XpDesktop /></GalleryChrome>)
    pressEscOnBody()
    expect(push).toHaveBeenCalledWith('/labs')
  })
})
