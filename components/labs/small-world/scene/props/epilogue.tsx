'use client'
import { PALETTE } from '../../palette'
import { GatedProp } from './gated-prop'
import type { JourneyRef } from '../use-journey'
import {
  ClayBoulder,
  ClayFox,
  ClayIgloo,
  ClayMammoth,
  ClayRock,
  ClaySnowConifer,
  ClaySnowHare,
} from './clay-kit'

/**
 * THE EPILOGUE SET (Task 60) — what stands in the snow the journey ends facing.
 *
 * These props live in the same band the desert does, and they are gated on the THIRD world state
 * (`variant={2}`, see renewal.sceneVariantAt): while the girl is walking chapter 4 this set does
 * not exist and the camels do, and they trade places behind the horizon during chapters 5-6. So
 * this is not "extra winter props added to the desert" — it is the same ground, restaged, by the
 * same machine that restages everything else in this world.
 *
 * PLACEMENT RULES, all three load-bearing (checked by bench/task60-props.mjs, which fails the
 * build of a report rather than the build of the app, so they are stated here too):
 *  - |x| ≥ 0.55 world. The girl's lane is the chapter sets' stage and the contact budget's
 *    business; nothing that flips may stand in it.
 *  - |x| ≤ 1.05 world (|nx| ≤ 0.48). Past that latitude renewal-scan.mjs models a flipping prop's
 *    tip at only 0.05R, which none of these fit under — so they stay where the 0.25R band covers
 *    them.
 *  - Seated where the terrain is gentle (bump ≤ 0.06). The scan gives a prop on steep ground NO
 *    tip margin at all, on the grounds that the dressing skips such ground; a dune crest is
 *    exactly that case.
 *
 * AND ONE TRAP, learned next door (Task 61, whose yeti was found standing in the icy lake): the
 * instanced scatters reject underwater candidates for THEMSELVES, so "there are trees around here"
 * is not evidence that a hand-placed prop is on dry land. A hand-placed anchor gets none of the
 * scatter's checks — it is checked here, by the bench, or not at all.
 *
 * Longitudes run 0.6 → 2.35, which is the face on screen at the final dwell (thetaC 0.348 up to
 * the limb at 2.609) with room at both ends — the camp reads as a place, not as a row.
 */
export function EpilogueSet({ journeyRef }: { journeyRef: JourneyRef }) {
  return (
    <>
      {/* the camp — three igloos of different sizes, turned to face out of the slope */}
      <GatedProp theta={1.12} x={-0.92} variant={2} journeyRef={journeyRef}>
        <ClayIgloo r={0.24} rotation={[0, 0.4, 0]} />
      </GatedProp>
      <GatedProp theta={1.3} x={-0.95} variant={2} journeyRef={journeyRef}>
        <ClayIgloo r={0.19} rotation={[0, -0.9, 0]} />
      </GatedProp>
      <GatedProp theta={0.86} x={-0.9} variant={2} journeyRef={journeyRef}>
        <ClayIgloo r={0.165} rotation={[0, 2.1, 0]} />
      </GatedProp>

      {/* the mammoth, alone and across the valley from the camp — the ending's one dark mass */}
      <GatedProp theta={1.32} x={0.88} variant={2} journeyRef={journeyRef}>
        <ClayMammoth rotation={[0, -2.2, 0]} />
      </GatedProp>

      {/* a snow hare near the camp, the small life that says the place is lived in */}
      <GatedProp theta={0.94} x={-0.6} variant={2} journeyRef={journeyRef}>
        <ClaySnowHare rotation={[0, 1.1, 0]} scale={0.9} />
      </GatedProp>

      {/* conifers scattered across both flanks — the dressing that replaces the desert's palms */}
      <GatedProp theta={0.64} x={0.7} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.46} />
      </GatedProp>
      <GatedProp theta={1.58} x={0.62} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.38} rotation={[0, 1.3, 0]} />
      </GatedProp>
      <GatedProp theta={2.34} x={0.64} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.46} rotation={[0, 2.4, 0]} />
      </GatedProp>
      <GatedProp theta={1.78} x={-0.68} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.42} rotation={[0, 0.6, 0]} />
      </GatedProp>
      <GatedProp theta={2.3} x={-0.8} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.34} rotation={[0, 3.1, 0]} />
      </GatedProp>

      {/* A fox, the way the winter biome keeps one warm note in a cold field. Placed away from the
          camp so the ending has two things to find rather than one cluster. */}
      <GatedProp theta={2.12} x={0.8} variant={2} journeyRef={journeyRef}>
        <ClayFox rotation={[0, -1.2, 0]} />
      </GatedProp>
      <GatedProp theta={2.5} x={-0.66} variant={2} journeyRef={journeyRef}>
        <ClaySnowHare rotation={[0, 2.7, 0]} scale={0.85} />
      </GatedProp>

      {/* wind-scoured drift boulders and ice rubble, so the open field is not empty */}
      <GatedProp theta={0.74} x={-1.02} variant={2} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.snow} r={0.12} />
      </GatedProp>
      <GatedProp theta={1.5} x={-0.88} variant={2} journeyRef={journeyRef}>
        <ClayRock color={PALETTE.ice} r={0.09} />
      </GatedProp>
      <GatedProp theta={1.94} x={0.6} variant={2} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.frostShadow} r={0.085} />
      </GatedProp>
      <GatedProp theta={2.22} x={0.94} variant={2} journeyRef={journeyRef}>
        <ClayRock color={PALETTE.snow} r={0.1} />
      </GatedProp>

      {/* Second wave. The desert this replaces carried roughly fifty draw calls of scatter, and a
          fourteen-prop field read thin against it — the ending was measured 66 draws BELOW the
          world it replaced, which is budget going unspent. These fill the open ground between the
          camp, the mammoth and the limb. */}
      <GatedProp theta={0.7} x={0.96} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.36} rotation={[0, 1.9, 0]} />
      </GatedProp>
      <GatedProp theta={0.52} x={0.88} variant={2} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.snow} r={0.1} />
      </GatedProp>
      <GatedProp theta={1.02} x={0.66} variant={2} journeyRef={journeyRef}>
        <ClayRock color={PALETTE.frostShadow} r={0.075} />
      </GatedProp>
      <GatedProp theta={1.16} x={0.98} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.42} rotation={[0, 0.3, 0]} />
      </GatedProp>
      <GatedProp theta={1.44} x={1.0} variant={2} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.ice} r={0.11} />
      </GatedProp>
      <GatedProp theta={1.66} x={-0.98} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.4} rotation={[0, 2.2, 0]} />
      </GatedProp>
      <GatedProp theta={1.86} x={-0.62} variant={2} journeyRef={journeyRef}>
        <ClayRock color={PALETTE.snow} r={0.085} />
      </GatedProp>
      <GatedProp theta={2.06} x={-0.98} variant={2} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.frostShadow} r={0.095} />
      </GatedProp>
      <GatedProp theta={2.44} x={0.86} variant={2} journeyRef={journeyRef}>
        <ClaySnowConifer height={0.32} rotation={[0, 1.1, 0]} />
      </GatedProp>
      <GatedProp theta={0.98} x={-1.02} variant={2} journeyRef={journeyRef}>
        <ClayRock color={PALETTE.ice} r={0.08} />
      </GatedProp>
      <GatedProp theta={2.46} x={-0.92} variant={2} journeyRef={journeyRef}>
        <ClayBoulder color={PALETTE.snow} r={0.09} />
      </GatedProp>
    </>
  )
}
