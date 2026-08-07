/**
 * THE INK ARRIVAL (Task 76, phase 1) — the last page of the book she was drawn in.
 *
 * ============================================================================
 * WHY A DRAWING AND NOT A MODEL
 * ============================================================================
 * Aram's direction was that Alwina should be behind the desk, human-scale: "it is
 * her office." Two measurements said the 3D girl cannot carry that, and both are
 * in `task-76-ending-report.md` with captures:
 *
 *  - the GLB HAS NO FACE. Rendered at the pixel density a behind-desk head would
 *    demand (~100 px), she is hair, a blank oval and a white band. At 93 px total
 *    — today — her head is 15 px and nobody can tell. Behind the desk her head IS
 *    the frame.
 *  - and the frame could not hold her anyway: the ending has 0.36 m of headroom
 *    above the desk and a standing adult needs 0.90 m. Depth does not converge
 *    (at forty units outside the scene her head is still 0.67 ndc over the edge)
 *    and the pull-back that would admit her costs the note three quarters of its
 *    width, below the legibility floor T73 established.
 *
 * So she arrives in INK instead, on the one page of this story where her face is
 * perfect — the epilogue Aram generated, the closest thing anyone has to his
 * mental image of the ending. The manga carried the six chapters; this is its last
 * page, and the beat is a rhyme rather than a substitute: the drawing shows her at
 * her desk, and then the camera pulls back to find that desk actually there.
 *
 * The 3D girl still leaves the world — the crest walk is untouched and gated
 * (`girl-exit.ts`). She simply does not reappear in three dimensions this phase.
 *
 * ============================================================================
 * SCROLL PURITY, AND A CLOCK DELIBERATELY NOT TAKEN
 * ============================================================================
 * `MangaPageArt` inks its panels on a wall clock, which is right for a chapter
 * card arriving at a checkpoint. It is passed `instant` here, so the page prints
 * complete and its ARRIVAL is a pure function of the ending's `t` instead. That
 * costs nothing: the epilogue is a SINGLE full-page panel with no balloons and no
 * captions, so the per-panel ink cascade the clock exists to drive has exactly one
 * thing to drive, and the scroll-driven entrance already does it. The coffee steam
 * stays the ending's only wall clock.
 *
 * Every value below is exact at both ends of its window (`(1−s)·a + s·b`), so a
 * reader who scrubs back un-arrives the page through the identical arithmetic.
 */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
/**
 * Linear ramp across a window, clamped — and TOTAL on a degenerate one.
 *
 * `b <= a` is not hypothetical here: a placement that never leaves says so by
 * setting `outFrom = outTo = 2`, which makes the fade window zero-wide. Without
 * this branch that divides by zero, `clamp01(NaN)` returns NaN (NaN fails both
 * comparisons), and the page's opacity becomes NaN — invisible in a picture,
 * caught immediately by a gate.
 */
const across = (t: number, a: number, b: number): number =>
  b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a))
const mix = (a: number, b: number, s: number): number => (1 - s) * a + s * b

/** Zero in the first and second derivative at both ends — a page should not be
 *  caught starting or stopping any more than the stand should. */
const smootherstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** Where the page sits, and how big: everything a pose needs. */
export type InkPose = {
  /** Page height as a fraction of the viewport's SHORTER axis. */
  readonly height: number
  /** Position as a fraction of the viewport (0.5, 0.5 is centred). */
  readonly at: readonly [number, number]
  /** Tilt in degrees — a page set down is never square. */
  readonly tilt: number
}

export type InkPlacement = {
  readonly id: string
  /** The ending-t window over which the page comes in. */
  readonly inFrom: number
  readonly inTo: number
  /** ...and goes out again. `outFrom >= 1` means it never leaves. */
  readonly outFrom: number
  readonly outTo: number
  /**
   * How far below its pose it starts, in fractions of the viewport height —
   * FAR ENOUGH TO BE OFF THE FRAME, and that is a correctness requirement rather
   * than a taste one. See `INK_OPACITY_SHARE`.
   */
  readonly rise: number
  /** The pose it arrives in. */
  readonly pose: InkPose
  /**
   * PORTRAIT DOES NOT HANG IT. A phone's ending frame has no wall: the globe
   * fills the middle and the desk owns the bottom, so a settled page lands ON the
   * globe and reads as a sticker rather than as a print in the room. Where a
   * placement gives portrait its own exit, the phone keeps the HELD beat — the
   * page is still the story's last page, held up in the gap — and then it leaves,
   * which is the honest answer for a frame with nothing to hang it on.
   */
  readonly portraitOut?: { readonly from: number; readonly to: number }
  /**
   * ...and an OPTIONAL second pose it travels to. This is what lets one placement
   * be a beat AND a fixture: the page is held up while there is nothing else in
   * the frame, then it shrinks away to the wall as the desk arrives, instead of
   * having to choose between the two.
   */
  readonly settle?: { readonly from: number; readonly to: number; readonly pose: InkPose }
}

export const INK_PLACEMENTS: readonly InkPlacement[] = [
  {
    id: 'spread',
    inFrom: 0.05,
    inTo: 0.16,
    outFrom: 0.3,
    outTo: 0.375,
    rise: 0.1,
    pose: { height: 0.66, at: [0.5, 0.48], tilt: -1.4 },
  },
  {
    id: 'rest',
    inFrom: 0.6,
    inTo: 0.78,
    outFrom: 2,
    outTo: 2,
    rise: 0.06,
    pose: { height: 0.34, at: [0.185, 0.35], tilt: -3.2 },
  },
  {
    id: 'hang',
    // AFTER the exit (it ends at GIRL_WALK_END = 0.32) and BEFORE the desk's back
    // edge reaches the frame (t ~ 0.52). That window is the one stretch of this
    // ending with nothing in it but a shrinking globe, which is exactly what a
    // held-up page can have.
    inFrom: 0.34,
    inTo: 0.44,
    outFrom: 2,
    outTo: 2,
    rise: 0.95,
    pose: { height: 0.62, at: [0.5, 0.46], tilt: -1.6 },
    settle: { from: 0.52, to: 0.68, pose: { height: 0.3, at: [0.175, 0.33], tilt: -3.2 } },
    portraitOut: { from: 0.55, to: 0.66 },
  },
]

/**
 * WHAT SHARE OF THE ENTRY WINDOW THE OPACITY SPENDS — and the defect it fixes.
 *
 * The page is a DOM overlay, so the canvas CANNOT occlude it. At any partial
 * opacity it is therefore an X-ray: the first cut faded in over 10% of the ending
 * and a capture caught the page at ~6% opacity showing her face THROUGH the
 * planet's snow, mid-globe, on the phone. It read as a rendering artefact, which
 * is exactly what it was.
 *
 * The fix is the one paper itself suggests: **paper does not fade, it moves.** The
 * opacity is spent in the first third of the entry while `rise` still has the page
 * entirely BELOW the frame, so by the time any of it crosses the bottom edge it is
 * fully opaque and simply slides up. Nothing is ever seen through it.
 *
 * That is why `rise` has to clear the frame rather than merely suggest a lift: at
 * 0.95 of viewport height the page's top edge starts below the bottom edge at both
 * aspects (it needs 0.85 on a 1440×900 laptop and 0.68 on a 390×844 phone).
 */
export const INK_OPACITY_SHARE = 0.22

/**
 * The placement in force: `hang`, and the captures are why.
 *
 * `spread` put the page up during the still beat as briefed — and covered the
 * crest walk, which is the one beat of this ending that has been approved twice
 * and is now gated (`girl-exit.ts`). A full-frame page over the thing it was
 * meant to follow is not a beat, it is an interruption. The window the brief
 * named is simply occupied.
 *
 * `rest` avoided that by arriving late and small, and reads as a framed print on
 * the studio wall — which is genuinely good, and gives her face about 60 px.
 * After a round spent proving the 3D girl has no face at 100 px, spending the one
 * image where her face is right at 60 px is the wrong economy.
 *
 * `hang` is both, and it costs nothing extra because the ending has a gap nobody
 * was using: she is gone by t = 0.32 and the desk's back edge does not reach the
 * frame until t ≈ 0.52. The page is HELD UP in that gap, full size, with only a
 * shrinking globe behind it — then it travels and settles to the wall as the desk
 * arrives, ending as a picture in her office rather than a card over the render.
 * "It is her office" was the direction; a drawing of her hanging on its wall is a
 * more literal answer to it than a figurine ever was.
 */
export const INK_PLACEMENT: InkPlacement = INK_PLACEMENTS[2]

export type InkState = {
  /** Whether the page is drawn at all — false costs nothing, not even a decode. */
  readonly shown: boolean
  /** 0 → 1 → 0 across its windows. Drives opacity and everything eased. */
  readonly present: number
  /** Fractions of viewport height BELOW its pose. */
  readonly lift: number
  readonly scale: number
  /** The pose it is in RIGHT NOW — interpolated when a placement settles. */
  readonly height: number
  readonly x: number
  readonly y: number
  readonly tilt: number
}

const HIDDEN: InkState = Object.freeze({
  shown: false,
  present: 0,
  lift: 0,
  scale: 1,
  height: 0,
  x: 0.5,
  y: 0.5,
  tilt: 0,
})

export function inkArrivalAt(
  t: number,
  reduced: boolean,
  portrait = false,
  place = INK_PLACEMENT
): InkState {
  const out = portrait && place.portraitOut ? place.portraitOut : { from: place.outFrom, to: place.outTo }
  if (t <= place.inFrom || t >= out.to) return HIDDEN
  const rising = smootherstep(across(t, place.inFrom, place.inTo))
  const leaving = smootherstep(across(t, out.from, out.to))
  // OPACITY IS NOT THE TRAVEL. It is spent in the first third of the entry, while
  // the page is still below the frame — see INK_OPACITY_SHARE for the X-ray this
  // exists to prevent.
  const opaqueIn = smootherstep(
    across(t, place.inFrom, place.inFrom + (place.inTo - place.inFrom) * INK_OPACITY_SHARE)
  )
  // ...and symmetrically on the way out: it slides fully off and only then lets go
  // of its opacity, so an exit is no more of an X-ray than an entrance was.
  const fadeOut = smootherstep(
    across(t, out.to - (out.to - out.from) * INK_OPACITY_SHARE, out.to)
  )
  // CLAMPED, because it is an opacity and the arithmetic can overshoot by an ulp:
  // smootherstep's `x³·(6x²−15x+10)` rounds to 1.000000000000001 for x a hair
  // under 1, and a gate that says "an opacity is an opacity" should not have to
  // accept that.
  const present = clamp01(opaqueIn * (1 - fadeOut))
  if (present <= 0) return HIDDEN
  // A portrait placement that leaves never settles: it holds the pose it was held
  // up in and goes, so the phone gets the beat and keeps its money shot clear.
  const settling =
    place.settle && !(portrait && place.portraitOut)
      ? smootherstep(across(t, place.settle.from, place.settle.to))
      : 0
  const to = place.settle?.pose ?? place.pose
  return {
    shown: true,
    present,
    lift: reduced ? 0 : mix(place.rise, 0, rising) + place.rise * leaving,
    scale: reduced ? 1 : mix(0.985, 1, rising),
    height: mix(place.pose.height, to.height, settling),
    x: mix(place.pose.at[0], to.at[0], settling),
    y: mix(place.pose.at[1], to.at[1], settling),
    tilt: reduced
      ? mix(place.pose.tilt, to.tilt, settling)
      : mix(mix(place.pose.tilt * 1.9, place.pose.tilt, rising), to.tilt, settling),
  }
}

/**
 * The first ending t at which the art is wanted on screen. The page is a ~250 kB
 * webp that must NOT be on the first-paint route — the whole manga pipeline is
 * built around that (T73) — so the component mounts the image one beat early and
 * lets the browser fetch it while it is still invisible, rather than at the
 * instant it is needed.
 */
export const INK_PRELOAD_T = Math.max(0.02, INK_PLACEMENT.inFrom - 0.2)
