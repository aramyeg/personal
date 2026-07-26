/**
 * The high-frequency scrub channel for grabbed handles (hand-interaction-
 * laws.md, law H2): while a tab/flap/knob/keepsake is grabbed, the pointer
 * handler writes a new drive value here every frame. It NEVER flows through
 * React/zustand state — a store dispatch per pointermove would fight the
 * r3f render loop the value is meant to drive, and in practice desyncs by a
 * frame under React's batching (the same reasoning book.tsx's frame loop
 * already uses for prints). zustand (store.ts) holds only the LOW-FREQUENCY
 * grab identity (which piece, what kind) so React can render cursor/
 * affordance state without touching this channel.
 *
 * Writers: the pointer handlers wired to each handle mesh (the popup-*-layer
 * files, arriving in a later wave). Readers: the frame loop and the solvers
 * that turn a drive value into vertex positions (popup-mechanics.ts). This
 * module only stores and clamps — it doesn't know what a value MEANS (lift
 * angle vs. rotation vs. slide translate is entirely the solver's domain),
 * so a caller that needs bounds-checking passes its own [min, max].
 *
 * No three.js, no react: importable from both the plain-DOM input layer and
 * the r3f book/ layer without pulling either into the other's bundle.
 */

const drive = new Map<string, number>()
let grabbedId: string | null = null

export function readUserDrive(id: string): number | undefined {
  return drive.get(id)
}

/** Stores `value` for `id`. If `bounds` is given, clamps into [min, max]
 *  first — the caller (a solver) owns what those bounds mean; this module
 *  just enforces them mechanically. */
export function writeUserDrive(id: string, value: number, bounds?: readonly [number, number]): void {
  const clamped = bounds ? Math.min(bounds[1], Math.max(bounds[0], value)) : value
  drive.set(id, clamped)
}

export function clearUserDrive(id: string): void {
  drive.delete(id)
}

/**
 * Drops EVERY scrub channel and any active grab identity — the spread-exit
 * reset (E3 BW-19).
 *
 * A blind reader turned away from spread 7 and back and found the vault lid
 * still standing open: "Whether intended or not, the spread does not reset."
 * The house answer is that a reopened page is a FRESH pop-up. Real paper does
 * hold a lifted flap, and it holds it for as long as the page is open — but the
 * page here has been closed and reopened in between, which is exactly the
 * gesture that flattens every mechanism (the E(beta) envelope drives them all
 * to zero at beta = 0 anyway; this makes the state agree with the geometry
 * instead of springing back open behind the reader's back).
 *
 * Clearing ALL ids rather than one spread's is deliberate and safe: only the
 * live spread's pieces can hold a reader value, and the neighbours mounted
 * either side of it are at rest by construction.
 */
export function resetUserDrives(): void {
  drive.clear()
  grabbedId = null
}

export function listUserDriveIds(): readonly string[] {
  return Array.from(drive.keys())
}

/** Dev-only static drive override for the D6 capture deck: `?sbdrive=<id>:<v>`
 *  freezes the handle of layer `id` at raw value `v` in the piece's OWN domain
 *  (strip draw s for tabs, degrees for flaps). Read where each layer computes
 *  its lift, analogous to ?sbknob / ?sbpose; compiled out of production. */
export function readDriveOverride(id: string): number | null {
  if (process.env.NODE_ENV === 'production') return null
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('sbdrive')
  if (!raw) return null
  const sep = raw.lastIndexOf(':')
  if (sep < 0 || raw.slice(0, sep) !== id) return null
  const v = Number(raw.slice(sep + 1))
  return Number.isFinite(v) ? v : null
}

/** Grab bookkeeping the frame loop needs synchronously, alongside the drive
 *  values themselves — kept in this module (not store.ts) so a per-frame
 *  read never touches zustand. */
export function beginGrabChannel(id: string): void {
  grabbedId = id
}

export function endGrabChannel(id: string): void {
  if (grabbedId === id) grabbedId = null
}

export function activeGrabId(): string | null {
  return grabbedId
}

// Dev-only escape hatch for the D6 bench probes, mirroring store.ts's
// __sbStore: lets a Playwright page peek at (or drive) the scrub channel
// directly. Compiled out of production builds.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  ;(
    window as unknown as {
      __sbUserDrive?: {
        readUserDrive: typeof readUserDrive
        writeUserDrive: typeof writeUserDrive
        clearUserDrive: typeof clearUserDrive
        listUserDriveIds: typeof listUserDriveIds
        resetUserDrives: typeof resetUserDrives
        beginGrabChannel: typeof beginGrabChannel
        endGrabChannel: typeof endGrabChannel
        activeGrabId: typeof activeGrabId
      }
    }
  ).__sbUserDrive = {
    readUserDrive,
    writeUserDrive,
    clearUserDrive,
    listUserDriveIds,
    resetUserDrives,
    beginGrabChannel,
    endGrabChannel,
    activeGrabId,
  }
}
