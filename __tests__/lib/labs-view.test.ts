import { describe, it, expect } from 'vitest'
import { resolveLabsView } from '@/lib/labs-view'

const desktop = {
  param: null as string | null,
  coarsePointer: false,
  reducedMotion: false,
  webglSupported: true,
  wideViewport: true,
}

describe('resolveLabsView', () => {
  it('defaults to 3d on a capable desktop', () => {
    expect(resolveLabsView(desktop)).toBe('3d')
  })

  it('honors ?view=list everywhere', () => {
    expect(resolveLabsView({ ...desktop, param: 'list' })).toBe('list')
  })

  it('honors ?view=3d when WebGL is supported', () => {
    expect(resolveLabsView({ ...desktop, param: '3d', coarsePointer: true })).toBe('3d')
  })

  it('falls back to list for ?view=3d without WebGL', () => {
    expect(resolveLabsView({ ...desktop, param: '3d', webglSupported: false })).toBe('list')
  })

  it('defaults to list on coarse pointers (touch)', () => {
    expect(resolveLabsView({ ...desktop, coarsePointer: true })).toBe('list')
  })

  it('defaults to list on narrow viewports', () => {
    expect(resolveLabsView({ ...desktop, wideViewport: false })).toBe('list')
  })

  it('defaults to list under prefers-reduced-motion', () => {
    expect(resolveLabsView({ ...desktop, reducedMotion: true })).toBe('list')
  })

  it('defaults to list without WebGL', () => {
    expect(resolveLabsView({ ...desktop, webglSupported: false })).toBe('list')
  })
})
