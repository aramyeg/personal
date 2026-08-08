/** The girl GLB's URL, alone in its own module ON PURPOSE.
 *
 *  The eager loader shell (small-world-loader.tsx) stream-prefetches this URL to
 *  drive the honest byte arc, and the lazy scene (scene/girl.tsx) loads the same
 *  URL through useGLTF — one constant, two consumers on opposite sides of the
 *  dynamic() split. Importing it from girl.tsx would pull the whole three/drei
 *  graph into the page's initial chunk (measured: first-load JS 112kB → 395kB),
 *  so the constant lives here where either side can import it for free.
 */
export const GIRL_URL = '/labs/small-world/girl.glb'

/** The GLB's on-disk size. The loader's byte arc needs a denominator, and the
 *  production server gzips the GLB as a chunked stream — the browser response
 *  carries NO content-length (curl shows one; the negotiated browser transfer
 *  does not — measured on the t95 isolated server). The streamed reader yields
 *  DECOMPRESSED bytes, so the file's own size is the correct total either way.
 *  Pinned to the real file by girl-url.test.ts — re-export the girl and that
 *  test tells you to update this number. */
export const GIRL_GLB_BYTES = 8_121_684
