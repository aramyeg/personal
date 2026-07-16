/**
 * Committed registry of delivered art. Loaders consult this BEFORE any
 * network request — absent ids render fallbacks with zero 404 noise.
 * Update this list when files land in public/labs/small-world/.
 */
export const DELIVERED_ART: ReadonlySet<string> = new Set<string>([
  'girl',
  // 'panel-bluenet-1', ...
])

export const hasArt = (id: string): boolean => DELIVERED_ART.has(id)

/** Panel art ships as public/labs/small-world/panels/<chapterId>-1.png,
 * gated by a `panel-<chapterId>` entry in DELIVERED_ART. */
export function panelArtSrc(chapterId: string): string | null {
  return DELIVERED_ART.has(`panel-${chapterId}`)
    ? `/labs/small-world/panels/${chapterId}-1.png`
    : null
}
