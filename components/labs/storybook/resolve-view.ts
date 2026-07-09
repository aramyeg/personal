export type SbView = 'book' | 'plain'

export function resolveSbView(i: {
  param: string | null
  reducedMotion: boolean
  webglSupported: boolean
}): SbView {
  if (i.param === 'plain') return 'plain'
  if (i.param === 'book') return i.webglSupported ? 'book' : 'plain'
  if (i.reducedMotion || !i.webglSupported) return 'plain'
  return 'book'
}
