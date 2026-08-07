import type { MangaPage } from './types'

/**
 * page-1 — Four panels, not the pack's three: the hero strip, the WIDE handover panel
 * (which carries both speech balloons the pack put in a "small left" panel),
 * then two small panels side by side. Panel 0 has no balloon in the art, so
 * its thought is `drawn` into the sky gap between her hair and the tree.
 *
 * Panel rects and balloon boxes were measured off the source PNG (gutter scan +
 * largest blank rectangle inside each balloon's white interior), not eyeballed.
 */
export const PAGE_1: MangaPage = {
  id: 'page-1',
  size: { w: 1023, h: 1537 },
  panels: [
    { x: 0.0059, y: 0.0026, w: 0.9873, h: 0.4275 },
    { x: 0.0059, y: 0.4353, w: 0.9873, h: 0.324 },
    { x: 0.0059, y: 0.7625, w: 0.5826, h: 0.2329 },
    { x: 0.5934, y: 0.7625, w: 0.3998, h: 0.2323 },
  ],
  balloons: [
    {
      panel: 0,
      text: 'It should be as easy as stacking blocks.',
      // Nudged down from the quiet-region solve's 0.0618: this balloon is DRAWN,
      // and the ink the site draws around the box needs a √2 margin to contain
      // it (manga-lettering), which at 0.0618 hung the top of the ellipse off
      // the page. Still sky, still clear of her and of the tree.
      at: { x: 0.7502, y: 0.079 },
      box: { w: 0.2199, h: 0.0976 },
      voice: 'thought',
      drawn: { tail: { x: 0.5083, y: 0.039 } },
    },
    {
      panel: 1,
      text: 'Me? I can’t build—',
      at: { x: 0.2023, y: 0.487 },
      box: { w: 0.2698, h: 0.0839 },
      voice: 'speech',
    },
    {
      panel: 1,
      text: 'Try dragging that one.',
      at: { x: 0.8456, y: 0.5527 },
      box: { w: 0.1799, h: 0.1451 },
      voice: 'speech',
    },
  ],
  captions: [
    {
      panel: 2,
      text: 'It worked in every browser. Eventually.',
      at: { x: 0.0391, y: 0.7807 },
      width: 0.2933,
    },
  ],
}
