'use client'

/**
 * SaveStage — the single-object 3D preview beside the "select file" strip index.
 *
 * It shows exactly ONE hero object for the highlighted save, inside the shared
 * `VignetteCanvas` studio rig (which owns the IO gate, RoomEnvironment, and
 * context-loss recovery — none of that is re-implemented here):
 *  - card kinds (project / written-with / contact) → `SaveCard`, lit dim so the
 *    printed sticker reads as label stock; each card carries its own floor pool,
 *    so the stage pool is pulled to near-zero.
 *  - the bio kind → the character GLB posed by its baked idle, lit bright with a
 *    broad contact shadow, the same look-dev framing the hero used.
 *
 * `onTap` fires from a card tap (the screen toggles `flipped` or opens the save);
 * the character has nothing to flip, so its slot ignores `onTap` entirely.
 */

import type { JSX } from 'react'
import { MC, GLYPH_ORDER, type GlyphName } from '../tokens'
import { VignetteCanvas } from './stage'
import { GltfVignette } from './gltf-vignette'
import { SaveCard } from './save-card'
import type { SaveSlot } from '../save-select/saves'

/**
 * The character GLB and the idle clip baked into it. Named for its role, never
 * its identity — the asset is drop-in swappable and nothing here assumes one.
 * This is the single canonical definition of the clip name for the lab.
 */
const CHARACTER_SRC = '/labs/memory-card/models/character.glb'
export const CHARACTER_IDLE_CLIP = 'Armature.F|bashful'

/** Reverse the accent cycle back to a glyph name for the no-WebGL fallback mark. */
function glyphForAccent(accent: string): GlyphName {
  return GLYPH_ORDER.find((g) => MC.glyphs[g] === accent) ?? 'triangle'
}

export type SaveStageProps = {
  save: SaveSlot
  flipped: boolean
  reduced: boolean
  onTap?: () => void
}

export function SaveStage({ save, flipped, reduced, onTap }: SaveStageProps): JSX.Element {
  const fallbackGlyph = glyphForAccent(save.accent)

  if (save.kind === 'bio') {
    return (
      <VignetteCanvas
        reduced={reduced}
        envIntensity={1.15}
        shadowRadius={1.5}
        fallbackGlyph={fallbackGlyph}
      >
        <GltfVignette
          src={CHARACTER_SRC}
          fitHeight={2.3}
          yaw={0.7}
          spin={false}
          animation={CHARACTER_IDLE_CLIP}
        />
      </VignetteCanvas>
    )
  }

  return (
    <VignetteCanvas
      reduced={reduced}
      envIntensity={0.35}
      shadowRadius={0.001}
      fallbackGlyph={fallbackGlyph}
    >
      <SaveCard save={save} flipped={flipped} reduced={reduced} onTap={onTap} />
    </VignetteCanvas>
  )
}

export default SaveStage
