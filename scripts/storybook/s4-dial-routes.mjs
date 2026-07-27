/**
 * THE FOUR CROSSINGS — the s4 route plate's sector contract.
 *
 * WHY THIS IS A MODULE AND NOT A LITERAL INSIDE THE PAINTER.
 *
 * A blind reader spent forty minutes on spread 4 and reported the dial marked
 * "SPIN — ROUTE THE RAVENS" as stone dead: `grab` cursor, `grabbing` cursor,
 * then "the disc region changed by zero" after 450 degrees of circular drag.
 * The systems lane then proved the input was not merely alive but had MORE
 * travel than any other handle in the book. The dial was turning the whole time.
 *
 * ROUND 2 answered that with EIGHT DISTINCT DESTINATIONS, so that a detent step
 * could not render pixel-identically any more. A second blind reader, on the
 * re-review, found it had fixed the wrong half:
 *
 *   "It takes the drag and its inner card ring turns a few degrees. NOTHING
 *    ELSE IN THE SPREAD CHANGES. I diffed the full frame after 3, 6 and 12
 *    flicks in both directions: the only changed pixels in the entire 1600x900
 *    frame were four 32-px blocks on the dial itself."
 *
 * Eight badges cycling through three 23 x 13 px windows is an INDEX. It reports
 * a state; it cannot mean anything. And the reader who set this brief had
 * already described the mechanism he wanted, from a book he had handled: "a big
 * circle cutout in the paper which had a spinning wheel... when spinning it
 * created a new meaning, for example a bridge appeared over a river."
 *
 * So the eight destinations become FOUR CROSSINGS, and the wheel stops being a
 * lookup table and becomes a picture that changes. Behind one big die-cut arch
 * in the plate lies the raven canyon — the drop between the crooked tower and
 * the terraced roosts this whole spread is composed around — and each quarter
 * turn strings one more stage of the route across it:
 *
 *   THE GULF    nothing crosses. The gorge is black, the far roosts dark.
 *   THE CAST    one raven crosses trailing the first thread. There is a line.
 *   THE LAMPS   the thread is a wire now, hung with lit lanterns, and the far
 *               roosts catch enough light to answer.
 *   THE FLIGHT  the wire carries baskets and the birds pour across it.
 *
 * That is the bridge over the river in this chapter's own vocabulary, and it is
 * the sentence the story text on the facing page ends on: "he wrought them so
 * well that the sky itself seemed orderly."
 *
 * FIELDS, and what each one buys the reader. Every one is a COUNT or a
 * PRESENCE, never a tint: the aperture projects about 70 x 62 screen px, which
 * is a real picture but not a detailed one, and what survives at that size is
 * how many bright things there are and whether the gap is bridged.
 *   key       the stage, for the ledger and for the gates.
 *   span      is there a crossing at all? THE headline difference — the whole
 *             "a bridge appeared over a river" beat lives in this one bit.
 *   taut      0 = a slack thread, 1 = a strung wire. Reads as the line's shape.
 *   lamps     lit lanterns hung on the line.
 *   ravens    birds in the picture.
 *   carriers  letter baskets riding the wire.
 *   glow      how lit the far roost cliff is, 0-3 — the picture's light level,
 *             which is what makes the last stage read as arrival, not traffic.
 *
 * ORDER IS THE STORY'S ORDER, NOT THE WHEEL'S. Sector k sits at math-angle k*90
 * and the plate's single aperture sits at 180, so an UNTOUCHED wheel (theta 0)
 * frames sector 2, and each positive click walks the framed sector DOWN. Laying
 * the stages out in story order and mapping them onto sectors — rather than
 * writing the table in wheel order — is what makes two things true at once:
 * the reader's plate rests on THE GULF (nothing crosses yet, so their first
 * click is the moment the route comes into existence), and winding the wheel
 * the way its cue chevrons point walks the story forward. `s4StageForSector`
 * below is the one place that arithmetic lives; the painter and the gate both
 * read it.
 */

/** @typedef {{key: string, span: number, taut: number, lamps: number, ravens: number, carriers: number, glow: number}} DialStage */

/** @type {readonly DialStage[]} */
export const S4_DIAL_ROUTES = [
  // 0 — THE GULF. The canyon as it was before the rookery strung it: two black
  //     lips, a drop between them, and nothing at all in the air.
  { key: 'GULF', span: 0, taut: 0, lamps: 0, ravens: 0, carriers: 0, glow: 0 },
  // 1 — THE CAST. One bird carries the first thread over. The line exists, and
  //     it hangs slack, because nobody has hauled it tight yet.
  { key: 'CAST', span: 1, taut: 0, lamps: 0, ravens: 1, carriers: 0, glow: 1 },
  // 2 — THE LAMPS. The thread is a strung wire with lanterns on it, and the far
  //     roosts have woken up enough to answer.
  { key: 'LAMPS', span: 1, taut: 1, lamps: 3, ravens: 2, carriers: 0, glow: 2 },
  // 3 — THE FLIGHT. Baskets running, and as much of four billion ravens' worth
  //     of traffic as one window can hold.
  { key: 'FLIGHT', span: 1, taut: 1, lamps: 3, ravens: 6, carriers: 2, glow: 3 },
]

/** The sector count the plate must be built with (content.ts `sectors`). */
export const S4_DIAL_SECTORS = S4_DIAL_ROUTES.length

/**
 * WHICH STAGE IS PAINTED ON SECTOR k. The aperture sits at math-angle 180 and a
 * wheel at detent d frames sector (2 - d) mod 4, so mapping stage j onto sector
 * (2 - j) mod 4 puts stage 0 (THE GULF) under the window at rest and advances
 * one stage per positive click. Its own inverse, which is why one function
 * serves the painter (sector -> stage) and the gate (stage -> sector) alike.
 * @param {number} k
 */
export const s4StageForSector = (k) => ((2 - k) % S4_DIAL_SECTORS + S4_DIAL_SECTORS) % S4_DIAL_SECTORS

/**
 * A STAGE'S SILHOUETTE SIGNATURE — the parts of a crossing a reader can tell
 * apart at 1x on a dark page, in the order they carry weight. Two stages that
 * share this tuple render as the same picture, which is the defect this whole
 * module exists to make impossible.
 * @param {DialStage} r
 */
export const dialRouteSignature = (r) => [r.span, r.taut, r.lamps, r.ravens, r.carriers]
