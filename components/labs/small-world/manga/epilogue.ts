import type { MangaPage } from './types'

/**
 * epilogue — One full-page panel, silent by design — the site's 3D desk scene picks up
 * from here, so no balloon and no caption.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const EPILOGUE: MangaPage = {
  id: 'epilogue',
  size: { w: 1024, h: 1536 },
  panels: [
    { x: 0.0078, y: 0.0059, w: 0.9854, h: 0.9883 },
  ],
  balloons: [],
  captions: [],
}
