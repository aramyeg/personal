/** Which /labs experience to show. */
export type LabsView = 'list' | '3d'

/**
 * Decide the default /labs experience.
 * Explicit ?view= wins (but 3d still requires WebGL); otherwise 3D is
 * reserved for wide, fine-pointer, motion-ok, WebGL-capable devices.
 */
export function resolveLabsView(opts: {
  param: string | null
  coarsePointer: boolean
  reducedMotion: boolean
  webglSupported: boolean
  wideViewport: boolean
}): LabsView {
  if (opts.param === 'list') return 'list'
  if (opts.param === '3d') return opts.webglSupported ? '3d' : 'list'
  if (!opts.webglSupported) return 'list'
  if (opts.reducedMotion) return 'list'
  if (opts.coarsePointer) return 'list'
  if (!opts.wideViewport) return 'list'
  return '3d'
}
