import type { MangaPage } from './types'

/**
 * page-3 — Splash page. Panel 0 is the full-page panorama; panels 1 and 2 are the
 * insets drawn ON TOP of its bottom corners, so panel 0's rect contains both.
 * They still ink in after it, which is what the reading order encodes.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const PAGE_3: MangaPage = {
  id: 'page-3',
  size: { w: 1024, h: 1536 },
  panels: [
    { x: 0.0078, y: 0.0039, w: 0.9844, h: 0.9909 },
    { x: 0.0205, y: 0.6927, w: 0.4395, h: 0.2962 },
    { x: 0.5811, y: 0.75, w: 0.3965, h: 0.2396 },
  ],
  balloons: [
    {
      panel: 1,
      text: 'Build it once. Build it right.',
      at: { x: 0.1108, y: 0.7546 },
      box: { w: 0.1201, h: 0.0677 },
      voice: 'speech',
    },
  ],
  captions: [
    {
      panel: 0,
      text: 'One design. Thirteen colors.',
      at: { x: 0.0391, y: 0.0293 },
      width: 0.2637,
    },
  ],
}
