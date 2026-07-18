/** Small World color system — spec: docs/superpowers/specs/2026-07-16-labs-small-world-design.md */
export const PALETTE = {
  meadow: '#7BC47F',
  leaf: '#4E9A51',
  sprout: '#A8DCA0',
  blossom: '#F7A8C4',
  blossomDeep: '#E86FA4',
  river: '#6FB7D9',
  riverDeep: '#4E9EC7',
  sky: '#FFF3D6',
  horizon: '#FFE3EC',
  clayPath: '#D98E6A',
  ink: '#2B2B33',
  // chapter accents (tints of the base system)
  honey: '#F7C948',
  dune: '#E8C58A',
  tuff: '#DE8E9E',
  // authored-biome tones (Task 15)
  snow: '#F5F2EA',
  earth: '#7E4E2E',
  pine: '#3B7A46',
  // per-wedge scene accents (Task 20)
  springGreen: '#59C56A', // A0 vivid spring
  petal: '#FF9DC2', // A1 flower-drift pink
  sand: '#E9D4A0', // A2 delta / B0 dune light sand
  goldSand: '#E6B24C', // B0 rich golden dune body
  earthDeep: '#5A3216', // B1 canyon channel floor / deep walls
  rust: '#A85A32', // B1 canyon terracotta bank
  ice: '#DCEAF2', // B2 frozen water rim
  // per-FIGURE identity (Task 23) — deeper SATURATION, still pastel daylight
  blossomRose: '#E8659B', // A1 deep-rose petal blob (the flower riot's richest bloom)
  bluebell: '#A79BE8', // periwinkle bell flower (A0/A1 — a cool note among the pinks)
  lupine: '#CE79CE', // spike flower (violet-magenta lupine/foxglove)
  foliageDeep: '#3F9A55', // deeper broadleaf crown (spring woods, lobed silhouette)
  pineDeep: '#357E48', // deep conifer green for pinched-cone crowns
  stone: '#94745C', // canyon boulder clay-stone (faceted pinch)
} as const
