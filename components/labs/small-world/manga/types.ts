/**
 * The manga page manifest contract.
 *
 * Alwina's story ships as seven inked pages (`.superpowers/manga/` → the webp
 * pipeline in `scripts/small-world/prepare-manga.mjs`). The art carries the
 * panels, the linework and BLANK balloons; everything with letters in it — the
 * dialogue, the narrator's caption boxes, and the two balloons the generator
 * never drew — is typeset by the site, so the lettering stays crisp at any
 * card size, animates, and is in our font rather than a model's guess at one.
 *
 * Every coordinate here is a FRACTION OF THE PAGE BOX (0→1, origin top-left),
 * never a pixel: the same manifest has to place lettering over a 420px card, a
 * near-full-height lightbox and a 360px phone, and a pixel would only be right
 * at one of them.
 */

/** A box in page fractions: `x`/`y` is its top-left corner. */
export type Rect = { x: number; y: number; w: number; h: number }

/** A point in page fractions. */
export type Point = { x: number; y: number }

/**
 * One balloon's worth of lettering.
 *
 * `panel` is what makes the reveal read as a page being drawn rather than a
 * slideshow: the line types in a beat after the panel that owns it has inked,
 * so the eye is already inside the frame when the words arrive.
 */
export type Balloon = {
  /** Index into `MangaPage.panels` — the panel this line is spoken inside. */
  panel: number
  text: string
  /** Center of the balloon's blank interior. */
  at: Point
  /**
   * The blank interior's usable size. Text is laid out inside this box and
   * scaled with the card, so a line that fits here fits at every card size.
   */
  box: { w: number; h: number }
  /** Italic for interior monologue, upright for speech. Typography only. */
  voice: 'thought' | 'speech'
  /**
   * Present ONLY for the two lines whose balloon is missing from the art
   * (page-1's big panel, page-4's foundation panel — the generator dropped
   * both). The site draws a balloon in the art's style at `at`/`box`, with its
   * tail pointing at `tail`. Absent means the art already has a blank balloon
   * there and the site only sets the words.
   */
  drawn?: { tail: Point }
}

/** A narrator box. Never in the art (the pack's rule) — always drawn here. */
export type Caption = {
  /** Index into `MangaPage.panels` — the panel it lands with. */
  panel: number
  text: string
  /** Top-left corner of the box. */
  at: Point
  /** Box width; the height follows the text. */
  width: number
}

export type MangaPage = {
  /** File stem, e.g. `page-0` — also the public path stem. */
  id: string
  /** Intrinsic pixel size of the shipped webp, for aspect + `<img>` sizing. */
  size: { w: number; h: number }
  /**
   * The page's panel rectangles IN READING ORDER — the order they ink in.
   * Each rect includes the panel's black border, so a page assembles itself
   * frame by frame against the blank paper of the card.
   */
  panels: Rect[]
  balloons: Balloon[]
  captions: Caption[]
}

/** Public path of a prepared page. */
export const mangaPageSrc = (id: string): string => `/labs/small-world/manga/${id}.webp`
