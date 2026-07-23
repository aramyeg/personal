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
  ice: '#DCEAF2', // B2 frozen water rim / icy-lake sheet (Task 40)
  iceDeep: '#6E97AE', // B2 icy-lake pressed crack veins (Task 40) — darker blue-grey in the pale ice
  // field mottling (Task 29) — a drier, desaturated sage for the meadow's
  // "high-touch" smudges (variance WITHIN the green, still pastel, never muddy)
  meadowDry: '#A3BE96',
  // per-FIGURE identity (Task 23) — deeper SATURATION, still pastel daylight
  blossomRose: '#E8659B', // A1 deep-rose petal blob (the flower riot's richest bloom)
  bluebell: '#A79BE8', // periwinkle bell flower (A0/A1 — a cool note among the pinks)
  lupine: '#CE79CE', // spike flower (violet-magenta lupine/foxglove)
  foliageDeep: '#3F9A55', // deeper broadleaf crown (spring woods, lobed silhouette)
  pineDeep: '#357E48', // deep conifer green for pinched-cone crowns
  stone: '#94745C', // canyon boulder clay-stone (faceted pinch)
  // girl blend (Task 24) — contact-shadow pool at the ramp floor, warm ink so
  // she grounds into the clay rather than casting a cool neutral disc
  shadowClay: '#3A2F30',
  // Task 42 — jungle (A1, the 2nd green wedge): deep saturated jungle greens for the
  // ground AND the dense flora, so the wedge reads "very green". The ground base is
  // jungleFloor; the accent deepens to jungleDeep in the shadow pockets and lifts to
  // jungleMoss on the fern-lit highlights (the shared green field-mottle then layers its
  // foliageDeep pockets + pineDeep veins on top for a lush, mottled floor).
  jungleFloor: '#3C9450', // rich jungle ground green (A1 accent base)
  jungleCanopy: '#2E7D46', // broad-leaf canopy crowns
  jungleDeep: '#1F6236', // deep understory shadow-green (crowns + ground pockets)
  jungleMoss: '#4FA85C', // bright fern/moss highlight (ground + ferns)
  jungleVine: '#37703F', // hanging vine loops
  jungleLeaf: '#245E36', // dark understory big leaves
  jungleBark: '#6E4A32', // broad-leaf trunks
  // lurking jungle animals (Task 42) — one accent colour each
  snakeBody: '#3FA65A', // emerald snake coil
  snakeBelly: '#B7D98A', // pale snake underside
  jaguarFur: '#D9A24A', // golden cat fur
  jaguarEye: '#F2D65C', // amber glowing eyes
  parrotBody: '#E24B3A', // scarlet parrot
  parrotWing: '#3FA6C4', // teal wing + tail
  frogBody: '#5FBE4A', // bright green frog
  frogThroat: '#D7E7A0', // pale frog throat
} as const
