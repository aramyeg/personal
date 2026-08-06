import type { MangaPage } from './types'

/**
 * page-5 — Three stacked strips. The top strip is silent and carries the caption.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const PAGE_5: MangaPage = {
  id: 'page-5',
  size: { w: 1023, h: 1537 },
  panels: [
    { x: 0.0039, y: 0.0026, w: 0.9922, h: 0.3865 },
    { x: 0.0039, y: 0.3917, w: 0.9912, h: 0.2739 },
    { x: 0.0039, y: 0.6682, w: 0.9912, h: 0.3286 },
  ],
  balloons: [
    {
      panel: 1,
      text: 'The best parts are the ones nobody sees.',
      at: { x: 0.7155, y: 0.4665 },
      box: { w: 0.2405, h: 0.1054 },
      voice: 'speech',
    },
    {
      panel: 2,
      text: 'Look how far the meadow is from here.',
      at: { x: 0.6588, y: 0.7398 },
      box: { w: 0.1975, h: 0.082 },
      voice: 'thought',
    },
  ],
  captions: [
    {
      panel: 0,
      text: 'These days, she watches everything at once.',
      at: { x: 0.0293, y: 0.026 },
      width: 0.2786,
    },
  ],
}
