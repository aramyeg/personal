import type { MangaPage } from './types'

/**
 * page-4 — Tall full-height panel on the left, two stacked on the right. The art gave
 * the RIGHT-BOTTOM panel a balloon and left the RIGHT-TOP one (the foundation
 * stone) bare, so that line is `drawn` onto the quiet cave wall beside her.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const PAGE_4: MangaPage = {
  id: 'page-4',
  size: { w: 1024, h: 1536 },
  panels: [
    { x: 0.0039, y: 0.002, w: 0.4619, h: 0.9961 },
    { x: 0.4727, y: 0.002, w: 0.5234, h: 0.5 },
    { x: 0.4727, y: 0.5052, w: 0.5234, h: 0.4928 },
  ],
  balloons: [
    {
      panel: 0,
      text: 'How deep does this thing go?',
      at: { x: 0.2954, y: 0.2715 },
      box: { w: 0.3115, h: 0.1315 },
      voice: 'thought',
    },
    {
      panel: 1,
      text: 'There. Now it holds.',
      at: { x: 0.8638, y: 0.1364 },
      box: { w: 0.1455, h: 0.0775 },
      voice: 'speech',
      drawn: { tail: { x: 0.7188, y: 0.1549 } },
    },
    {
      panel: 2,
      text: 'Careful — heavier than it looks.',
      at: { x: 0.8599, y: 0.5993 },
      box: { w: 0.1338, h: 0.1035 },
      voice: 'speech',
    },
  ],
  captions: [],
}
