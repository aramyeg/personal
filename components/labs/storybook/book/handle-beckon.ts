/**
 * THE IDLE BECKON (E3 BW-1, third leg of the affordance system).
 *
 * Hover response tells a reader who is already touching the right thing that
 * they are. It does nothing for the reader who has not touched anything yet —
 * and that was every one of the five blind readers: "as a reader I would have
 * finished this spread believing it was a static diorama", "I found this
 * mechanism only by scripting drags across the entire spread."
 *
 * So the spread's PRIMARY playable moves on its own, once, a few seconds in: the
 * same tap nudge (handle-nudge.ts) the reader would get by pressing it. A page
 * of paper that twitches once, quietly, is the oldest invitation in the medium.
 *
 * THREE RESTRAINTS, because a beckon that nags is worse than none:
 *  - ONE piece per spread. Never a chorus.
 *  - It STOPS after BECKON_LIMIT invitations. If the reader is reading rather
 *    than playing, the book leaves them alone.
 *  - Any real interaction cancels the rest for good. Once a reader has taken a
 *    grab on this spread they have understood the offer.
 *
 * The primary playable is derived from content.ts rather than tagged, so a
 * scene lane cannot forget to keep the tag in step with the art: pick the
 * highest-ranked handle FAMILY on the spread, ties broken by content order (the
 * author's own reading order).
 */

import { popupContentForSpread } from '../content'
import { pulseHandle } from './handle-nudge'

/**
 * How playable a family reads, for picking a spread's headline mechanism. A
 * numbered door the reader lifts is the most self-explanatory thing in the
 * book; a dial's own affordance is its shape; a keepsake is a one-way door and
 * must never be the thing that invites a first touch.
 */
const FAMILY_RANK: Readonly<Record<string, number>> = {
  liftflap: 6,
  dissolve: 5,
  tabpiece: 5,
  swarmarc: 4,
  volvelle: 4,
  keepwinch: 4,
  knobtower: 4,
  stripflap: 3,
}

/** Seconds of no interaction before the first invitation. */
export const BECKON_FIRST_S = 6
/** Seconds between invitations after that. */
export const BECKON_EVERY_S = 9
/** How many invitations a spread will ever offer. */
export const BECKON_LIMIT = 3
/**
 * How much louder an invitation is than a tap answer (E3 s2 round-2, S2R2-1).
 *
 * A tap answers a finger already on the paper; an invitation has to be caught
 * by an eye that is somewhere else on the spread — s2's blind re-reader
 * recorded this beckon as "one ~2 px whole-board twitch roughly once every 5 s"
 * in the same report that says "the spread gives a reader no reason to touch
 * it". At 2x a lift-flap leaf cracks about a fifth of its travel: large enough
 * to be seen from the narration column, and still capped by `nudgeOffset` at
 * the piece's own remaining room, so it can neither pass a stop nor be mistaken
 * for the mechanism having been worked.
 */
export const BECKON_GAIN = 2

/**
 * The pulse channel of the spread's primary playable, or null if the spread has
 * no handle at all. The channel — not the layer id — because the two differ for
 * the families that key their drive per sub-part (a lift flap's doors, the swarm
 * tab), and the nudge is read on the channel.
 */
export function primaryPlayableChannel(spread: number): string | null {
  const layers = popupContentForSpread(spread)?.layers
  if (!layers) return null
  let best: { rank: number; id: string; mech: string } | null = null
  for (const layer of layers) {
    const rank = FAMILY_RANK[layer.mech]
    if (rank === undefined) continue
    if (best === null || rank > best.rank) best = { rank, id: layer.id, mech: layer.mech }
  }
  if (best === null) return null
  if (best.mech === 'liftflap') return `${best.id}~0` // the first door, nearest the reader's eye
  if (best.mech === 'swarmarc') return `${best.id}~stir`
  return best.id
}

export type BeckonState = {
  /** Seconds of uninterrupted stillness on this spread. */
  idle: number
  /** Invitations already offered here. */
  offered: number
  /** The spread this state belongs to; a change resets everything. */
  spread: number
  /** True once the reader has taken a grab here — the offer is withdrawn. */
  answered: boolean
}

export const initialBeckonState = (): BeckonState => ({
  idle: 0,
  offered: 0,
  spread: -1,
  answered: false,
})

/**
 * Advances `state` in place by `delta` seconds and fires at most one invitation.
 * Returns the channel it beckoned, or null. `live` is false whenever beckoning
 * would be wrong — mid-turn, before boot, or while the reader's hand is down.
 *
 * In place because this runs in the frame loop; the state lives in a ref.
 */
export function stepBeckon(
  state: BeckonState,
  spread: number,
  delta: number,
  live: boolean,
  grabbing: boolean
): string | null {
  if (state.spread !== spread) {
    state.spread = spread
    state.idle = 0
    state.offered = 0
    state.answered = false
  }
  if (grabbing) {
    state.answered = true
    state.idle = 0
    return null
  }
  if (!live || state.answered || state.offered >= BECKON_LIMIT) return null
  state.idle += delta
  const due = state.offered === 0 ? BECKON_FIRST_S : BECKON_EVERY_S
  if (state.idle < due) return null
  state.idle = 0
  const channel = primaryPlayableChannel(spread)
  if (channel === null) {
    // Nothing to offer here: stop counting rather than spinning the clock.
    state.offered = BECKON_LIMIT
    return null
  }
  state.offered += 1
  pulseHandle(channel, undefined, BECKON_GAIN)
  return channel
}
