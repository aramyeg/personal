import type { MangaPage } from './types'

/**
 * page-2 — Tall left panel running the full height, two stacked on the right.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const PAGE_2: MangaPage = {
  id: 'page-2',
  size: { w: 1024, h: 1536 },
  panels: [
    { x: 0.0107, y: 0.0072, w: 0.4863, h: 0.985 },
    { x: 0.5068, y: 0.0072, w: 0.4824, h: 0.4941 },
    { x: 0.5068, y: 0.5078, w: 0.4824, h: 0.4844 },
  ],
  balloons: [
    {
      panel: 0,
      text: '…wobbly.',
      at: { x: 0.1411, y: 0.3669 },
      box: { w: 0.1201, h: 0.0736 },
      voice: 'thought',
    },
    {
      panel: 1,
      text: 'If they can feel the seam, it isn’t done.',
      at: { x: 0.8877, y: 0.0892 },
      box: { w: 0.1172, h: 0.0898 },
      voice: 'speech',
    },
  ],
  captions: [
    {
      panel: 2,
      text: 'Nobody notices a perfect stone. Everybody feels it.',
      at: { x: 0.5322, y: 0.5247 },
      width: 0.293,
    },
  ],
}
