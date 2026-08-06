import type { MangaPage } from './types'

/**
 * page-0 — Three stacked strips. Panel 2 (her hands + seedling) is the silent beat —
 * no balloon in the art, none in the script.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const PAGE_0: MangaPage = {
  id: 'page-0',
  size: { w: 1024, h: 1536 },
  panels: [
    { x: 0.0117, y: 0.0078, w: 0.9766, h: 0.3893 },
    { x: 0.0117, y: 0.403, w: 0.9766, h: 0.3099 },
    { x: 0.0117, y: 0.7174, w: 0.9766, h: 0.2754 },
  ],
  balloons: [
    {
      panel: 0,
      text: 'Charts can tell me what people want…',
      at: { x: 0.7935, y: 0.0889 },
      box: { w: 0.1729, h: 0.097 },
      voice: 'thought',
    },
    {
      panel: 1,
      text: '…but I’d rather build it for them.',
      at: { x: 0.144, y: 0.4691 },
      box: { w: 0.1553, h: 0.0788 },
      voice: 'thought',
    },
  ],
  captions: [],
}
