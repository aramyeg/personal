/**
 * Committed registry of delivered art. Loaders consult this BEFORE any
 * network request — absent ids render fallbacks with zero 404 noise.
 * Update this list when files land in public/labs/small-world/.
 */
export const DELIVERED_ART: ReadonlySet<string> = new Set<string>(['girl'])

export const hasArt = (id: string): boolean => DELIVERED_ART.has(id)

/**
 * THE MANGA PAGES ARE NOT REGISTERED HERE, and that is deliberate.
 *
 * This registry exists for art that might be MISSING: a loader checks it so an
 * undelivered id costs no request and no console noise. The seven pages are
 * committed files under `public/labs/small-world/manga/`, produced and gated by
 * `scripts/small-world/prepare-manga.mjs`, and each is addressed through the
 * typed page manifest in `components/labs/small-world/manga/` — which already
 * carries its path AND its real pixel size. A second, weaker registry of the
 * same fact could only ever drift out of step with it.
 *
 * (The `panelArtSrc(chapterId)` helper that used to live here pointed at a
 * placeholder scheme, `panels/<chapterId>-1.png`, that no art was ever
 * delivered under. It went with the placeholder card that consumed it.)
 */
