/**
 * THE EIGHT RAVEN ROUTES — the s4 sorting-desk dial's sector contract.
 *
 * WHY THIS IS A MODULE AND NOT A LITERAL INSIDE THE PAINTER.
 *
 * A blind reader spent forty minutes on spread 4 and reported the dial marked
 * "SPIN — ROUTE THE RAVENS" as stone dead: `grab` cursor, `grabbing` cursor,
 * then "the disc region changed by zero" after 450 degrees of circular drag.
 * The systems lane then proved the input was not merely alive but had MORE
 * travel than any other handle in the book. The dial was turning the whole time.
 *
 * What it was not doing was LOOKING different. The dial snaps to 45-degree
 * detents and its eight sectors were painted as six near-identical raven
 * roundels plus two glyphs — so a detent step, which is exactly one sector,
 * mostly swapped a roundel for a roundel and rendered pixel-identically. The
 * reader measured after release, which is precisely when the snap has landed.
 * A mechanism whose observable output is periodic at its own detent period is,
 * from the reader's chair, indistinguishable from a dead one.
 *
 * So the eight sectors are now eight DESTINATIONS, and their distinctness is a
 * contract rather than an intention: this table is the single source of truth
 * for the painter (`dispatchDial` in generate-art.mjs) and for the gate
 * (`popup-volvelle.test.ts`), which asserts that no two sectors share a
 * silhouette. Deriving the gate from the painter's own constants is the house
 * rule — eyeballed luminance boxes produce false findings.
 *
 * FIELDS, and what each one buys the reader:
 *   key         the destination, engraved on the sector as two or three glyphs.
 *   mark        the sector's PRINCIPAL device — the thing that changes shape,
 *               not just tone, when the dial clicks. Unique across all eight.
 *   ravens      how many birds are on this route: 1, 2 or 3. A count is the one
 *               difference that survives being 20px tall on a night page.
 *   field       the wedge's tint key into the DUSK palette. Tone alone was the
 *               old design's mistake, so it is a supporting difference here.
 *   bearingDeg  the heading painted on the sector's rim tick — the reason a
 *               reader can tell the dial has a POSITION and not just a state.
 *   weight      route traffic, drawn as the tally band's length. Distinct per
 *               sector so even the two tally-ish sectors read apart.
 *
 * ORDER IS THE READING ORDER: sector k sits at math-angle k*45 on the wheel,
 * and the card's three windows at 45/90/135 frame sectors (k+1, k+2, k+3) for a
 * dial spun to detent k. One click moves every window onto a new destination.
 */

/** @typedef {{key: string, mark: string, ravens: number, field: string, bearingDeg: number, weight: number}} DialRoute */

/** @type {readonly DialRoute[]} */
export const S4_DIAL_ROUTES = [
  // 0 — the home board: the rookery's own yard, the shortest hop on the wheel.
  { key: 'ROOST', mark: 'sigil', ravens: 1, field: 'amberLit', bearingDeg: 0, weight: 3 },
  // 1 — the river run. Two birds, and a needle because it is the route the
  //     desk actually navigates by.
  { key: 'RIVER', mark: 'needle', ravens: 2, field: 'slateLit', bearingDeg: 45, weight: 5 },
  // 2 — the north post road: the heaviest traffic on the desk, hence the tally.
  { key: 'NORTH', mark: 'tally', ravens: 3, field: 'parchDim', bearingDeg: 90, weight: 12 },
  // 3 — the sea gate. A crescent for the harbour.
  { key: 'PORT', mark: 'crescent', ravens: 2, field: 'amber', bearingDeg: 135, weight: 7 },
  // 4 — the mountain route, one bird and a chevron pass.
  { key: 'PASS', mark: 'chevron', ravens: 1, field: 'slateDim', bearingDeg: 180, weight: 2 },
  // 5 — the courts: sealed correspondence only, so the mark is a wax seal.
  { key: 'COURT', mark: 'seal', ravens: 3, field: 'slate', bearingDeg: 225, weight: 9 },
  // 6 — the far stations, marked with a star because nobody has mapped them.
  { key: 'STAR', mark: 'star', ravens: 2, field: 'amberDeep', bearingDeg: 270, weight: 4 },
  // 7 — the vault run south, a crossed mark: escorted birds.
  { key: 'VAULT', mark: 'cross', ravens: 3, field: 'slateDeep', bearingDeg: 315, weight: 6 },
]

/** The sector count the dial must be built with (content.ts `sectors`). */
export const S4_DIAL_SECTORS = S4_DIAL_ROUTES.length

/**
 * A sector's SILHOUETTE SIGNATURE — the parts of a route a reader can tell
 * apart at 1x on a dark page, in the order they carry weight. Two sectors that
 * share this tuple render as the same picture, which is the defect this whole
 * module exists to make impossible.
 * @param {DialRoute} r
 */
export const dialRouteSignature = (r) => [r.mark, r.ravens, r.field]
