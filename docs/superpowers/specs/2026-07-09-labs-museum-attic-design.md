# Museum Attic — Failed Experiments Wing Design Spec

**Date:** 2026-07-09
**Status:** Approved direction (enclosed stairwell, playable exhibit, v3-only saga, careless drapes)
**Route:** `/labs` (museum extension) · Exhibit: `/labs/snowpark` (unchanged, stays playable)
**Prerequisite:** PR #5 (`feat/labs-snowpark`) merges to main first — the attic exhibits the game that exists on main.

## Why

Powder Lines v3 was rejected (the character and world never escaped the cheap
read). Instead of deleting the work, the museum gains an attic: a wing that
honestly exhibits failed experiments with their verdicts. This is the un-slopping-AI thesis applied to
ourselves — show the process, failures included. The game stays playable; the
plaque tells the truth.

## Data model (`lib/labs-manifest.ts`)

- `LabEntry.status` widens: `'live' | 'wip' | 'attic'`.
- New optional field: `retrospective?: string` — the honest saga shown on the
  attic plaque and in the list view. Only meaningful for attic entries.
- Powder Lines entry: `status: 'attic'`, keeps slug/route/poster/thesis/date.
  Retrospective copy (binding, softened wording user-approved 2026-07-09):

  > Three passes, three verdicts. v1: flat polylines and a stick figure — "a
  > cheap copy of Happy Wheels." v2: Alto-style rebuild — day cycle, parallax,
  > jointed rider — but the ramps were painted on and one button did
  > everything. v3: real ramp physics, flips, spins, grabs — better bones,
  > same cheap read. Retired here, still playable, as evidence.

- Main hall hangs `labs.filter(l => l.status !== 'attic')`; the attic hangs
  the rest. The hall shortens automatically (`hallLength` of the filtered
  count).

## Geometry (`components/labs/museum/layout.ts`)

Three connected regions replace the single hall box:

- **Hall** — existing box, unchanged bounds.
- **Doorway + stair corridor** — a doorway in the end wall at x ≈ +2.5
  (width 1.4, height 2.6), beside the centered draped frame, with a small
  lowercase `attic` sign above the lintel. Behind it a straight corridor
  (width 2) runs 4 units further in −z while the floor ramps linearly from
  0 to 2.8.
- **Attic room** — floor at y = 2.8, footprint ~7 × 6 centered past the
  stair top, gabled: side walls ~1.6 high rising to a ridge ~3.4 above the
  attic floor. Wooden roof planes and 3–4 box beams.

New layout exports:

- `floorY(x, z): number` — 0 in the hall, linear ramp in the corridor, 2.8
  in the attic. Continuous at both seams.
- `clampToRegions(x, z): { x, z }` — replaces the single-box
  `clampToHall` for movement: hall box ∪ corridor ∪ attic box, connected
  only through the doorway spans (no clipping through walls beside the
  door).
- `atticPlacements(atticLabs: LabEntry[])` — painting + plaque positions on
  the attic gable wall.

`player-controls.tsx`: camera y becomes `floorY(x, z) + PLAYER.eyeHeight`
(ramp is continuous; no smoothing needed). Movement math otherwise
unchanged. `FocusProbe` raycasting is elevation-agnostic — untouched.

## Attic contents

- **The exhibit:** the existing `Painting` component hangs Powder Lines on
  the gable wall — focus ring, "Click to enter", and navigation to
  `/labs/snowpark` work exactly as in the hall.
- **The plaque:** a framed text panel beside the painting (canvas-texture
  text, same technique as the hall plaques): heading `failed experiments`,
  body = the retrospective. Not interactive, no focus target.
- **Light:** one dim warm point light at the ridge (within the ~8-light
  scaling budget noted for the museum). The hall's lights are untouched.
- **Set dressing (careless drapes):** the mood is a real attic —
  - A cloth drape hangs carelessly off one top corner of the Powder Lines
    frame, covering roughly a quarter of the poster, pulled aside like
    someone recently looked at it. It must not block the focus raycast to
    the painting's center.
  - 2–3 fully-covered frames lean against the walls in stacks (cloth over a
    rectangle, floor contact, slight lean/rotation variance).
  - 1–2 sheet-covered statues: lumpy vertical forms under cloth (simple
    static geometry — a draped cone/capsule silhouette with fold hints),
    one taller, one shorter.
  - All dressing is inert: no interaction, no focus targets, no physics.
    Cloth rendering extends the existing `DrapedFrame` cloth language
    (same material family, procedural fold geometry or texture).

## Hall changes

- `hall.tsx` end wall gains the doorway opening (two wall segments + lintel)
  and the `attic` sign. The draped "opening soon" frame stays centered on
  the end wall.
- Painting placement code takes the filtered (non-attic) list; no other hall
  behavior changes.

## List view + accessibility

- `/labs?view=list` gains a `failed experiments` section under the live
  labs: attic entries render with their poster thumbnail, title, thesis, AND
  retrospective text. This is the reduced-motion / no-WebGL / assistive-tech
  path to the same honesty.
- The snowpark lab page itself is unchanged (GalleryChrome, Esc → /labs,
  crawlable skills).

## Testing

- **Unit (layout math):** `floorY` continuity at hall→corridor and
  corridor→attic seams; `clampToRegions` blocks wall-clipping beside the
  doorway but allows passage through it (probe points either side of the
  door edges); hall placements exclude attic entries; `atticPlacements`
  positions attic entries on the attic wall.
- **Unit (manifest):** attic filter helpers; retrospective present on attic
  entries.
- **E2E:** list view renders the `failed experiments` section with the
  Powder Lines retrospective (no 3D-walk e2e — pointer-lock automation is
  flaky; the human pass covers the walk).

## Out of scope

Reconstructed v1/v2 posters from git history, dust particles/motes, more
attic exhibits (the manifest structure supports them when they come), moving
labs back out of the attic, Blender-pipeline assets, hall lighting rework.
