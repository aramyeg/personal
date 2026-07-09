import { describe, expect, it } from 'vitest'
import { resolveSbView } from '@/components/labs/storybook/resolve-view'

const base = { param: null, reducedMotion: false, webglSupported: true }

describe('resolveSbView', () => {
  it('defaults to the book', () => expect(resolveSbView(base)).toBe('book'))
  it('honors explicit params', () => {
    expect(resolveSbView({ ...base, param: 'plain' })).toBe('plain')
    expect(resolveSbView({ ...base, param: 'book', reducedMotion: true })).toBe('book')
    expect(resolveSbView({ ...base, param: 'book', webglSupported: false })).toBe('plain')
  })
  it('falls back to plain on reduced motion or no WebGL', () => {
    expect(resolveSbView({ ...base, reducedMotion: true })).toBe('plain')
    expect(resolveSbView({ ...base, webglSupported: false })).toBe('plain')
  })
})
