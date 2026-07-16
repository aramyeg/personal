/**
 * Class linking the server-rendered fallback timeline to the client shell
 * that hides it while the 3D scene is active. Shared as a constant so the
 * coupling survives renames; data-testid stays a test-only hook.
 */
export const FALLBACK_CLASS = 'small-world-fallback'
