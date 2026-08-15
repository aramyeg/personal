/**
 * Auto-fit math for the Memory Card GLTF vignettes, extracted as pure functions
 * so the framing rule is unit-testable without a WebGL context.
 *
 * Every hero GLB arrives at an arbitrary authoring scale and origin. `fitToStage`
 * turns a model's axis-aligned bounding box into the uniform scale + translation
 * that makes it a fixed world-height, centered on the turntable axis, resting on
 * the stage floor — the framing the studio rig and contact shadow assume.
 */

export type Vec3 = [number, number, number]

export type FitResult = { scale: number; offset: [number, number, number] }

/**
 * Given a bounding box (min/max as tuples) + target height + floorY, return the
 * uniform scale that makes the box `fitHeight` tall and the offset that centers
 * x/z on the origin and rests the box bottom on floorY (post-scale).
 *
 * A raw point `p` on the model maps to `scale * p + offset`.
 */
export function fitToStage(
  min: Vec3,
  max: Vec3,
  fitHeight: number,
  floorY: number
): FitResult {
  const height = max[1] - min[1]
  // Degenerate (flat / inverted) box: no meaningful height to fit → identity scale.
  const scale = height > 0 ? fitHeight / height : 1

  const centerX = (min[0] + max[0]) / 2
  const centerZ = (min[2] + max[2]) / 2

  const offset: Vec3 = [
    -scale * centerX, // center x on the turntable axis
    floorY - scale * min[1], // rest the scaled bottom on the floor plane
    -scale * centerZ, // center z on the turntable axis
  ]

  return { scale, offset }
}
