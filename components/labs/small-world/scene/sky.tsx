import { PALETTE } from '../palette'

/** Butter-cream to pink-horizon gradient, drawn as a screen-space backdrop. */
export function Sky() {
  return (
    <mesh position={[0, 0, -20]} scale={[60, 40, 1]}>
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
            vec3 col = mix(horizon, sky, smoothstep(0.15, 0.75, vUv.y));
            float vig = smoothstep(1.25, 0.45, distance(vUv, vec2(0.5)));
            gl_FragColor = vec4(col * (0.92 + 0.08 * vig), 1.0);
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
