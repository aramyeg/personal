import { PALETTE } from '../palette'

/**
 * Butter-cream to pink-horizon gradient backdrop.
 *
 * Sized with generous margin so the pitched camera's frustum can never see
 * past its edges (the visible band at z=-20 spans roughly y in [-19, 4],
 * x in [-20, 20] at wide aspects — the plane spans [-55, 35] x [-70, 70]).
 * The gradient band is mapped to the slice of the plane the camera actually
 * frames, so the horizon glow sits low in the composition.
 */
export function Sky() {
  return (
    <mesh position={[0, -10, -20]} scale={[140, 90, 1]}>
      <planeGeometry />
      <shaderMaterial
        depthWrite={false}
        uniforms={{}}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`
          varying vec2 vUv;
          void main(){
            vec3 sky = vec3(${hexToGlsl(PALETTE.sky)});
            vec3 horizon = vec3(${hexToGlsl(PALETTE.horizon)});
            vec3 col = mix(horizon, sky, smoothstep(0.42, 0.66, vUv.y));
            float vig = smoothstep(0.55, 0.28, distance(vUv, vec2(0.5, 0.55)));
            gl_FragColor = vec4(col * (0.94 + 0.06 * vig), 1.0);
          }`}
      />
    </mesh>
  )
}

function hexToGlsl(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [16, 8, 0].map((s) => (((n >> s) & 255) / 255).toFixed(4))
  return c.join(',')
}
