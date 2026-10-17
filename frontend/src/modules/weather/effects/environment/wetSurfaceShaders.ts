export const wetSurfaceVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const wetSurfaceFragmentShader = `
precision highp float;

uniform float time;
uniform float intensity;
uniform float opacity;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  float bottomBand = smoothstep(0.72, 0.02, vUv.y);
  float cornerRestraint = 0.72 + max(smoothstep(0.18, 0.0, vUv.x), smoothstep(0.82, 1.0, vUv.x)) * 0.28;
  float sheen = smoothstep(0.0, 0.012, abs(fract((vUv.x + time * 0.018) * 12.0 + hash(vec2(floor(vUv.y * 12.0), 1.0))) - 0.5));
  float glint = sheen * bottomBand * 0.18;
  vec3 color = mix(vec3(0.07, 0.09, 0.12), vec3(0.36, 0.48, 0.58), glint);
  float alpha = bottomBand * cornerRestraint * opacity * intensity * (0.62 + glint);
  gl_FragColor = vec4(color, alpha);
}
`;
