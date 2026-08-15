/**
 * WILD lane — "Lamplight": the single owner of the diorama's geometry.
 *
 * Massing, apertures, window slots and cascade order all live here. Builders import these
 * numbers; they never restate them. If a wall moves, it moves in this file and every consumer
 * follows — that is the point of the file existing.
 *
 * Frame: local to <PopupSpread>. y = 0 is the page surface, x = 0 is the spine, -z is far and
 * +z is toward the reader. The open spread spans x [-1.15, 1.15], z [-0.75, 0.75]. The reading
 * camera sits at [0, 1.85, 3.05] looking at [0, 0.38, 0.05], fov 34 — so the visible faces of
 * anything left of the spine are its FRONT (+z) and its RIGHT (+x); the -x faces never render.
 *
 * Composition contract: mass high-left, moon high-right, courtyard empty low-right.
 */

export type Vec3 = readonly [number, number, number]

/** An axis-aligned volume. `min`/`max` are corners in the frame described above. */
export type MassBox = {
  readonly id: string
  readonly min: Vec3
  readonly max: Vec3
  /** Which painter dresses it. */
  readonly skin: 'stone' | 'plaster' | 'timber' | 'shingle' | 'brick'
}

// ---------------------------------------------------------------------------------------------
// MASSING
// ---------------------------------------------------------------------------------------------

/** Ground floor of the main range — rubble stone, bored through by the carriage arch. */
export const HALL: MassBox = {
  id: 'hall',
  min: [-0.74, 0, -0.5],
  max: [0.1, 0.35, -0.1],
  skin: 'stone',
}

/**
 * First floor, jettied out over the ground floor on all visible sides. The overhang is the
 * volume proof: it throws a hard shadow band across the stone below, which a billboard cannot.
 */
export const JETTY: MassBox = {
  id: 'jetty',
  min: [-0.78, 0.35, -0.545],
  max: [0.14, 0.63, -0.055],
  skin: 'timber',
}

export const JETTY_OVERHANG = { x: 0.04, z: 0.045 } as const

/** The stair tower — frame-left, the tallest thing, and the vertical run the cascade climbs. */
export const TOWER = {
  min: [-0.96, 0, -0.5] as Vec3,
  max: [-0.72, 0.84, -0.26] as Vec3,
  /** Steep pyramidal cap; its base oversails the shaft by this much on every side. */
  cap: { baseY: 0.84, apexY: 1.0, oversail: 0.022 },
  skin: 'stone' as const,
}

/** Main roof: ridge running along x, steep (about 44 degrees), eaves oversailing the jetty. */
export const ROOF = {
  ridgeY: 0.87,
  ridgeZ: -0.3,
  eaveY: 0.63,
  minX: -0.78,
  maxX: 0.14,
  frontEaveZ: -0.025,
  backEaveZ: -0.575,
  skin: 'shingle' as const,
}

/**
 * Two dormer gables facing the reader. Deliberately unequal in size and unevenly spaced —
 * a matched pair would read as a diagram.
 */
export const DORMERS = [
  { id: 'dormer-big', cx: -0.55, halfW: 0.11, apexY: 0.79, frontZ: -0.02, sillY: 0.635 },
  { id: 'dormer-small', cx: -0.12, halfW: 0.085, apexY: 0.75, frontZ: -0.02, sillY: 0.635 },
] as const

/**
 * Chimney stack, at the right-hand end of the ridge, riding the gutter so it masks the spine.
 *
 * Its plan is centred ON the spine rather than pushed right, and that is load-bearing: the shaft
 * runs all the way to the ground, so any part of it standing outboard of HALL's right wall is a
 * breast across the KITCHEN's face — the one wall the moon actually lights. Kept inboard, the
 * stack is buried in the hall below the roof and is a silhouette only where it should be, above
 * it. Do not widen it past HALL's right wall without moving the kitchen windows.
 */
export const CHIMNEY = {
  min: [-0.065, 0, -0.4] as Vec3,
  max: [0.065, 0.9, -0.27] as Vec3,
  /** Corbelled cap flares beyond the shaft. */
  cap: { baseY: 0.9, topY: 0.94, oversail: 0.018 },
  /** Smoke leaves here once the kitchen is lit. */
  vent: [0, 0.94, -0.335] as Vec3,
  skin: 'brick' as const,
}

// ---------------------------------------------------------------------------------------------
// THE CARRIAGE ARCH — the aperture, and the chapter's name
// ---------------------------------------------------------------------------------------------

/**
 * A real hole bored front-to-back through HALL. The reader sees a lit passage through it, and
 * once the inn wakes this is where light floods out straight at the camera.
 */
export const ARCH = {
  cx: -0.42,
  halfW: 0.135,
  /** Wall height where the arch head springs, and the crown of the head. */
  springY: 0.19,
  apexY: 0.3,
  frontZ: -0.1,
  backZ: -0.5,
  /** Depth of the moulded surround standing proud of the wall face. */
  reveal: 0.018,
} as const

/**
 * The hundred keys. A board of hooked keys on the passage's far inner wall — visible only
 * through the arch, catching the passage light. The camera sits right of the arch, so the far
 * wall is the one at low x, facing +x.
 */
export const KEY_BOARD = {
  /** Wall plane the board is fixed to, and its outward normal. */
  x: ARCH.cx - ARCH.halfW + 0.006,
  facing: [1, 0, 0] as Vec3,
  /** Board extents in the passage's z/y plane. */
  minY: 0.1,
  maxY: 0.26,
  minZ: -0.44,
  maxZ: -0.18,
  cols: 20,
  rows: 5,
  /** 100 keys, hung on hooks, each a tiny brass sliver. Instanced — one draw call. */
  get count() {
    return this.cols * this.rows
  },
} as const

/** Worn stone step at the mouth of the arch. */
export const STEP: MassBox = {
  id: 'step',
  min: [-0.63, 0, -0.1],
  max: [-0.21, 0.032, 0.0],
  skin: 'stone',
}

// ---------------------------------------------------------------------------------------------
// DRESSING — few, large, each doing a job
// ---------------------------------------------------------------------------------------------

/** Hanging sign on a wrought bracket, out over the empty courtyard: the lone right-side accent. */
export const SIGN = {
  bracketRoot: [0.15, 0.55, -0.06] as Vec3,
  bracketReach: 0.15,
  pivot: [0.29, 0.5, -0.055] as Vec3,
  halfW: 0.08,
  height: 0.16,
  /** Idle sway amplitude in radians, and the period in seconds. */
  sway: { amp: 0.055, period: 4.7 },
}

/** Iron lantern beside the arch. The first warm thing to move when the key turns. */
export const LANTERN = { pos: [-0.2, 0.3, -0.075] as Vec3, radius: 0.028 }

/** The one gable window left burning all night — the only warm note while the inn sleeps. */
export const NIGHT_WINDOW_ID = 'attic-0'

export const WELL = { center: [0.62, 0, -0.1] as Vec3, radius: 0.1, wallY: 0.15, archY: 0.3 }

export const BARRELS = [
  { center: [0.2, 0, -0.14] as Vec3, radius: 0.05, height: 0.11 },
  { center: [0.3, 0, -0.17] as Vec3, radius: 0.045, height: 0.095 },
] as const

// ---------------------------------------------------------------------------------------------
// THE STAGE — sky, moon, distance, weather
// ---------------------------------------------------------------------------------------------

export const STAGE = {
  /** Moon high-right, opposite the mass. It rims the inn and lands its shadow down-left. */
  moon: { pos: [0.74, 0.92, -2.1] as Vec3, radius: 0.15, haloRadius: 0.62 },
  /** Key light is the moon; direction is from the moon toward the inn. */
  moonlight: { color: '#9fc0e8', intensity: 1.5 },
  ambient: { color: '#2b3f60', intensity: 0.55 },
  /**
   * Moonlight bounce: a dim cool fill from high camera-left, aimed at the facades the moon
   * can never touch (it sits behind the inn, so every camera-facing wall is in its shadow).
   * This is what keeps the SLEEPING inn legible on a dim screen — silhouette, sign, shuttered
   * windows — without warming the frame. It eases off as the inn wakes and the lamps take
   * over the job of drawing the building.
   */
  fill: { pos: [-1.6, 1.5, 2.4] as Vec3, color: '#5f7bad', intensity: 0.85, wakeCut: 0.55 },
  /** Distant town, pure silhouette with a scatter of far-off specks. */
  skyline: { z: -1.3, minX: -1.8, maxX: 1.8, maxY: 0.34 },
  sky: { z: -2.6, halfW: 3.2, top: 1.9, bottom: -0.4 },
  /** Three drifting mist cards. Cool while asleep, warm where light hits them once woken. */
  mist: [
    { z: -0.95, y: 0.12, halfW: 1.7, height: 0.5, speed: 0.011, opacity: 0.3 },
    { z: -0.55, y: 0.08, halfW: 1.5, height: 0.38, speed: -0.017, opacity: 0.22 },
    { z: 0.3, y: 0.06, halfW: 1.4, height: 0.3, speed: 0.023, opacity: 0.07 },
  ],
  cobbleY: 0.004,
} as const

/** Palette. Asleep is a compressed cold range; woken is molten. Nothing else may invent colour. */
export const PALETTE = {
  night: '#0a1020',
  nightRim: '#b9cfe8',
  stoneCold: '#2c3446',
  timberCold: '#232838',
  shingleCold: '#1c2231',
  cobbleCold: '#242b3a',
  lamp: '#ffb457',
  lampHot: '#ffdba6',
  ember: '#ff8c3a',
  brass: '#d9a441',
  glassDark: '#161c2a',
} as const

// ---------------------------------------------------------------------------------------------
// THE TOY — a key standing in an escutcheon at the fore edge of the right page
// ---------------------------------------------------------------------------------------------

export const KEY_TOY = {
  /** Set into the page, well clear of the inn, on the reading diagonal's far end. */
  center: [0.66, 0, 0.44] as Vec3,
  escutcheonRadius: 0.105,
  /** Bow (the handle) lies flat in the page plane and sweeps through this angle. */
  turnDeg: 100,
  bowRadius: 0.072,
  shaftLength: 0.11,
  /** Detents the turn passes through, as fractions of the full sweep. */
  detents: [0, 0.34, 0.68, 1],
  /** Radius within which a pointer grabs the key. The accept gate is this plus bowRadius, and
   *  it must cover the key's own reach — the bow's far rim lies shaftLength + 2*bowRadius =
   *  0.254 from the escutcheon, and the leaned camera grazes the page so shallowly that a
   *  finger-width of screen maps to several centimetres of paving. 0.17 rejected presses ON
   *  the visible handle. */
  grabRadius: 0.25,
}

// ---------------------------------------------------------------------------------------------
// WINDOWS — one instanced mesh, one glow attribute, one cascade
// ---------------------------------------------------------------------------------------------

export type RoomId =
  | 'passage'
  | 'taproom'
  | 'kitchen'
  | 'stair'
  | 'gallery'
  | 'chambers'
  | 'attic'

export type Occupant = 'none' | 'fiddler' | 'dancers' | 'cat' | 'ledger' | 'child'

export type WindowSlot = {
  readonly id: string
  readonly room: RoomId
  /** Centre of the glass, already offset just proud of its wall. */
  readonly pos: Vec3
  /** Outward normal of the wall it is cut into. */
  readonly facing: Vec3
  readonly w: number
  readonly h: number
  readonly shape: 'square' | 'tall' | 'arched' | 'round'
  /** Fraction of the key's turn at which this window ignites. */
  readonly at: number
  readonly occupant: Occupant
}

/** Room ignition windows, as fractions of the key's turn. Rooms overlap slightly; windows
 *  inside a room stagger across its span so it reads as a room filling, not a switch. */
export const ROOM_CASCADE: Record<RoomId, readonly [number, number]> = {
  passage: [0.0, 0.06],
  taproom: [0.1, 0.19],
  kitchen: [0.2, 0.28],
  stair: [0.3, 0.46],
  gallery: [0.48, 0.7],
  chambers: [0.66, 0.8],
  attic: [0.8, 0.92],
}

const FRONT: Vec3 = [0, 0, 1]
const RIGHT: Vec3 = [1, 0, 0]
/** Glass sits this far proud of its wall so it never z-fights the facade. */
const PROUD = 0.006

type Band = {
  room: RoomId
  facing: Vec3
  /** Constant coordinate of the wall plane (z for FRONT walls, x for RIGHT walls). */
  plane: number
  /** Centre height of the band. */
  y: number
  /** Positions along the band's free axis (x for FRONT walls, z for RIGHT walls). */
  along: readonly number[]
  w: number
  h: number
  shape: WindowSlot['shape']
  occupants?: readonly Occupant[]
}

/**
 * Facade bands. Spacing inside a band is authored, not generated — even runs read as a
 * spreadsheet, so the gallery is deliberately clustered three-then-four around the chimney.
 */
const BANDS: readonly Band[] = [
  // Ground floor either side of the arch. Big, low, and the first thing the reader sees light.
  {
    room: 'taproom',
    facing: FRONT,
    plane: HALL.max[2],
    y: 0.215,
    along: [-0.66, -0.18, -0.02],
    w: 0.1,
    h: 0.12,
    shape: 'arched',
    occupants: ['fiddler', 'dancers', 'none'],
  },
  // Kitchen, on the right return of the ground floor — sells the building's depth.
  {
    room: 'kitchen',
    facing: RIGHT,
    plane: HALL.max[0],
    y: 0.2,
    along: [-0.19, -0.33],
    w: 0.085,
    h: 0.1,
    shape: 'square',
    occupants: ['ledger', 'none'],
  },
  // The tower stair, climbing. These fire bottom-to-top and own the frame's left edge.
  {
    room: 'stair',
    facing: FRONT,
    plane: TOWER.max[2],
    y: 0,
    along: [],
    w: 0.055,
    h: 0.07,
    shape: 'tall',
  },
  // First-floor gallery, clustered rather than evenly ruled.
  {
    room: 'gallery',
    facing: FRONT,
    plane: JETTY.max[2],
    y: 0.5,
    along: [-0.7, -0.6, -0.5, -0.28, -0.18, -0.08, 0.02],
    w: 0.072,
    h: 0.105,
    shape: 'tall',
    occupants: ['none', 'child', 'none', 'dancers', 'none', 'none', 'cat'],
  },
  // Chambers on the jetty's right return.
  {
    room: 'chambers',
    facing: RIGHT,
    plane: JETTY.max[0],
    y: 0.49,
    along: [-0.14, -0.27, -0.4],
    w: 0.07,
    h: 0.1,
    shape: 'tall',
    occupants: ['none', 'cat', 'none'],
  },
]

/** The stair windows spiral, so they are authored as a helix rather than a band. */
const STAIR_STEPS = 5

/**
 * How far the helix wanders across the tower's face, and why it only ever wanders one way.
 *
 * THE TOWER'S RIGHT-HAND FACE IS NOT A FACE. It is the joint: the hall is engaged 0.02 into it
 * below the first floor and the jetty oversails 0.06 past it above, so that whole wall is inside
 * the range and a window cut into it is a window inside a wall. The helix therefore reads on the
 * FRONT face alone, and stays left of the tower's centre line — anything drifting right of it
 * goes behind the hall (low) or the jetty and roof (high). The climb still reads as a spiral,
 * because a spiral seen from outside IS a run of lights wandering across one face as it rises.
 */
const STAIR_SWING = 0.055

function stairSlots(): WindowSlot[] {
  const [lo, hi] = ROOM_CASCADE.stair
  const cxTower = (TOWER.min[0] + TOWER.max[0]) / 2
  const out: WindowSlot[] = []
  for (let i = 0; i < STAIR_STEPS; i += 1) {
    const f = i / (STAIR_STEPS - 1)
    const y = 0.16 + f * 0.52
    const swing = (-STAIR_SWING * (1 - Math.sin(f * Math.PI * 1.6))) / 2
    out.push({
      id: `stair-${i}`,
      room: 'stair',
      pos: [cxTower + swing, y, TOWER.max[2] + PROUD],
      facing: FRONT,
      w: 0.055,
      h: 0.07,
      shape: 'tall',
      at: lo + (hi - lo) * f,
      occupant: 'none',
    })
  }
  return out
}

/**
 * A point on the front roof's weathering surface at this z, and the surface's own normal. The
 * roof lights are the only openings that lie IN a slope instead of in a wall, so their seat is
 * DERIVED from ROOF rather than written down: a hand-placed one sat ten millimetres under the
 * shingles, where the slab covered it completely and no amount of dressing could find it.
 */
function roofSeat(z: number): { y: number; normal: Vec3 } {
  const dz = ROOF.ridgeZ - ROOF.frontEaveZ
  const dy = ROOF.ridgeY - ROOF.eaveY
  const len = Math.hypot(dz, dy)
  return {
    y: ROOF.eaveY + ((z - ROOF.frontEaveZ) * dy) / dz,
    // Of the slope's two normals, the one facing out of the roof: up and toward the reader.
    normal: [0, -dz / len, dy / len],
  }
}

/** The two dormer gables plus a tiny roof light — the last things to wake. */
function atticSlots(): WindowSlot[] {
  const [lo, hi] = ROOM_CASCADE.attic
  const slots: WindowSlot[] = DORMERS.map((d, i) => ({
    id: `attic-${i}`,
    room: 'attic' as const,
    pos: [d.cx, d.sillY + (d.apexY - d.sillY) * 0.42, d.frontZ + PROUD] as Vec3,
    facing: FRONT,
    w: d.halfW * 1.15,
    h: (d.apexY - d.sillY) * 0.6,
    shape: 'arched' as const,
    at: lo + (hi - lo) * (i === 0 ? 0.0 : 0.55),
    occupant: i === 0 ? ('ledger' as const) : ('none' as const),
  }))
  // Set between the two dormers, where the slope is otherwise blank.
  const lightZ = -0.14
  const seat = roofSeat(lightZ)
  slots.push({
    id: 'attic-light-0',
    room: 'attic',
    pos: [-0.33, seat.y + seat.normal[1] * PROUD, lightZ + seat.normal[2] * PROUD],
    facing: seat.normal,
    w: 0.05,
    h: 0.045,
    shape: 'round',
    at: hi,
    occupant: 'none',
  })
  return slots
}

function bandSlots(): WindowSlot[] {
  const out: WindowSlot[] = []
  for (const band of BANDS) {
    if (band.along.length === 0) continue
    const [lo, hi] = ROOM_CASCADE[band.room]
    band.along.forEach((a, i) => {
      const f = band.along.length === 1 ? 0 : i / (band.along.length - 1)
      const onFront = band.facing === FRONT
      out.push({
        id: `${band.room}-${i}`,
        room: band.room,
        pos: onFront
          ? [a, band.y, band.plane + PROUD]
          : [band.plane + PROUD, band.y, a],
        facing: band.facing,
        w: band.w,
        h: band.h,
        shape: band.shape,
        at: lo + (hi - lo) * f,
        occupant: band.occupants?.[i] ?? 'none',
      })
    })
  }
  return out
}

/**
 * Every window on the inn, in one list. Consumers build ONE InstancedMesh from this and drive
 * a per-instance glow attribute; do not create a mesh or a light per window.
 */
export const WINDOWS: readonly WindowSlot[] = [
  ...bandSlots(),
  ...stairSlots(),
  ...atticSlots(),
]

/**
 * Real point lights, one per room cluster, standing in for the spill of every window in that
 * room. Four lights, not thirty.
 */
export const ROOM_LIGHTS = [
  // Kept on a short leash: point lights cast no shadow here (D6, one shadow map), so a wide
  // passage light bleeds straight through the hall walls and paints the OUTSIDE of the facade.
  { room: 'passage' as RoomId, pos: [-0.42, 0.16, -0.3] as Vec3, distance: 0.85, intensity: 1.45 },
  { room: 'taproom' as RoomId, pos: [-0.36, 0.24, -0.05] as Vec3, distance: 0.95, intensity: 1.7 },
  { room: 'gallery' as RoomId, pos: [-0.32, 0.5, 0.0] as Vec3, distance: 0.85, intensity: 1.2 },
  { room: 'stair' as RoomId, pos: [-0.84, 0.5, -0.22] as Vec3, distance: 0.8, intensity: 1.1 },
] as const

/**
 * Light spilling out of the arch and washing the cobbles toward the reader. Authored as an
 * additive cone rather than a screen-space effect so it can be shaped and cheaply faded.
 */
export const ARCH_SHAFT = {
  origin: [ARCH.cx, (ARCH.springY + ARCH.apexY) / 2, ARCH.frontZ] as Vec3,
  /** Points at the reader and slightly down, following the camera's depression. */
  direction: [0.08, -0.24, 1] as Vec3,
  length: 0.66,
  startHalfW: ARCH.halfW * 0.92,
  endHalfW: ARCH.halfW * 1.9,
}

/** Warm pools painted on the cobbles under the lit openings. Opacity follows their room. */
export const LIGHT_POOLS = [
  { room: 'passage' as RoomId, center: [-0.4, 0.16] as const, rx: 0.22, rz: 0.34, strength: 0.6 },
  { room: 'taproom' as RoomId, center: [-0.64, 0.02] as const, rx: 0.14, rz: 0.18, strength: 0.7 },
  { room: 'taproom' as RoomId, center: [-0.1, 0.02] as const, rx: 0.16, rz: 0.2, strength: 0.7 },
  { room: 'kitchen' as RoomId, center: [0.24, -0.16] as const, rx: 0.16, rz: 0.14, strength: 0.5 },
] as const

/** Highest point of the built mass — the reveal's clipping plane sweeps from 0 to here. */
export const MASS_APEX_Y = TOWER.cap.apexY

/**
 * Curtain-up: which reveal event owns which slice of `open`. Four separated events, so the
 * page turn reads as a build rather than one simultaneous inflate.
 */
export const REVEAL = {
  night: [0.0, 0.34] as const,
  /** The inn rises through a clipping plane at the page surface. */
  rise: [0.18, 0.68] as const,
  courtyard: [0.46, 0.8] as const,
  dressing: [0.72, 1.0] as const,
} as const
