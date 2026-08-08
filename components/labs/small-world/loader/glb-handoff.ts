/** The prefetched girl GLB, carried across the dynamic() split by hand.
 *
 *  The eager loader shell streams the GLB for its honest byte arc; the lazy
 *  scene needs the same bytes moments later. HTTP-cache revalidation is NOT a
 *  reliable bridge here — measured on the production server, the scene's second
 *  request re-downloaded the whole GLB (max-age=0 + a gzip-chunked stream defeats
 *  the conditional GET), doubling the slow-network wait. So the shell parks the
 *  assembled ArrayBuffer in this three-free module, and girl.tsx (inside the 3D
 *  chunk, where three already lives) primes THREE.Cache with it before useGLTF
 *  ever asks, then releases it once the mesh is parsed.
 *
 *  Deliberately a mutable module-scope singleton: it is a transport channel
 *  between two sides of a code split, not app state — nothing renders from it.
 */
export const girlGlbHandoff: { buffer: ArrayBuffer | null } = { buffer: null }
