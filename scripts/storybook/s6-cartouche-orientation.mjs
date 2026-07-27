/**
 * THE S6 STALL'S PRINTED MARKS — which way they are painted, and which way
 * that has to come out at the reader's eye.
 *
 * WHY THIS IS A MODULE AND NOT A LITERAL INSIDE THE PAINTER.
 *
 * A blind reader's re-re-review of spread 6: "The 'RAISE A STALL' plaque is
 * rendered rotated 180 degrees. At every stage of travel — flat, mid-raise,
 * fully raised — the label reads upside-down to the reader. The single
 * discovery cue on the page requires tilting your head to read."
 *
 * Measured at the pinned reading camera before the fix (bench
 * n2-cartouche-capture.mjs, derived crop, 1600x900 reference viewport), the
 * deck band's uv axes projected to:
 *
 *     rest   (lift  7.00 deg)  +u -> ( 20.3, -78.2)   +v -> (-100.1, -5.0)
 *     mid    (lift 44.00 deg)  +u -> ( 22.6, -75.8)   +v -> (-101.8, -5.1)
 *     raised (lift 88.00 deg)  +u -> ( 28.0, -74.4)   +v -> (-102.8, -5.2)
 *
 * (screen pixels, y DOWN). So image-x pointed up-screen and image-up pointed
 * left-screen: a QUARTER turn, ~69-76 degrees counter-clockwise, not the 180
 * the reader guessed — the legend ran bottom-to-top with its glyph tops facing
 * the fore edge, which is exactly the head-tilt they described. It is the
 * lab's known page-flat art failure class in its ROTATION flavour (the disc-art
 * uv law): the tab-piece family's die-cut unfold puts image-x along the SPINE,
 * and at this camera the spine is screen-VERTICAL. Every tab piece's face art
 * is turned that way; on every other one the marks are posts, stripes and
 * wares, which have no reading direction. This piece carries the chapter's
 * only sentence, so it is the only one where the turn is a defect.
 *
 * THE LAW, stated for anything page-flat: author the painting in TRUE SCREEN
 * SPACE — image-x -> page-fore d (screen-right on the RIGHT page, screen-LEFT
 * on the left), image-y -> spine z (screen-down). This piece is on the LEFT
 * page, so its legend has to be painted running image-DOWN with its glyph tops
 * facing image-RIGHT. That is a quarter-turn CLOCKWISE of ordinary text, which
 * is what `plateTurnDeg` applies.
 *
 * The table is the single source of truth for the painter
 * (`bazRaiseStallFace` / `bazRaiseStallTab` in generate-art.mjs) and for the
 * gate (`__tests__/labs/storybook/s6-cartouche-orientation.test.ts`), which
 * re-projects these very vectors through the real solver and the real reading
 * camera at every lift the reader can latch. Deriving the gate from the
 * painter's own constants is the house rule — eyeballed luminance boxes
 * produce false findings.
 *
 * UV CONVENTION for every vector below: [du, dv] with +u = image RIGHT and
 * +v = image UP (three.js's default `flipY`, which is what the layer ships).
 */

/**
 * The woodcut ⟡ RAISE A STALL ⟡ signboard on the deck band of
 * `ch5-raise-stall-face`.
 */
export const S6_STALL_CARTOUCHE = {
  layerId: 'ch5-raise-stall',
  art: 'ch5-raise-stall-face',
  /** The unfolded-die-cut band the plate is painted into (popup-tabpiece-layer
   *  `tabFaceUvs`). The deck is the one band that stays broadside to the reader
   *  at every lift — the legs go nearly edge-on at the 88-degree stop. */
  face: 'deck',
  legend: 'RAISE A STALL',
  /** Degrees the whole plate is turned in image space, CLOCKWISE (SVG's
   *  positive sense, y down). 0 was the defect. */
  plateTurnDeg: 90,
  /** The legend's READING DIRECTION in uv space, after that turn. Must land
   *  screen-RIGHT at the reading camera. */
  baselineUV: [0, -1],
  /** The legend's GLYPH-UP in uv space, after that turn. Must land screen-UP. */
  upUV: [1, 0],
  /** Plate size, as fractions of the deck BAND — length along the band's depth
   *  (image y, the page-fore axis), height across its width (image x, the
   *  spine axis). Chosen so the turned plate clears the valance scallops at
   *  both deck seams (pitch*0.44 = 13.2 px of a 368.64 px band) with ~26 px to
   *  spare, and so the engraved cells come out roughly SQUARE at the reader's
   *  eye: the camera magnifies the fore axis ~500 px/world against the spine
   *  axis's ~289, so the turn that fixes the reading direction also un-stretches
   *  glyphs that were rendering ~3 px wide by ~9 px tall. */
  lengthOfBandDepth: 0.86,
  heightOfBandWidth: 0.203,
}

/**
 * The direction chevrons printed at the tip of `ch5-raise-stall-tab`.
 *
 * The tab card is page-flat too and takes IDENTITY uvs, so it is turned by the
 * same quarter — but its marks are an arrow and a thumb pad, which have a
 * direction rather than a reading order, and that direction came out RIGHT:
 * the chevrons point image-up, image-up is the page-fore axis, and fore is
 * where the card travels. Pinned here anyway because it is a contract the
 * shared `tabFaceUvs` could break silently, and because the next person to
 * "fix" the face's turn must not sweep the tab along with it.
 */
export const S6_STALL_TAB_ARROW = {
  layerId: 'ch5-raise-stall',
  art: 'ch5-raise-stall-tab',
  face: 'tab',
  /** Where the chevrons point, in uv space. Must land along the card's own
   *  travel at the reading camera (fore, i.e. increasing page d). */
  pointUV: [0, 1],
}
