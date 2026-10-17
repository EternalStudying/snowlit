export const rainbowVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const rainbowFragmentShader = `
precision highp float;

uniform float time;
uniform float opacity;

varying vec2 vUv;

vec3 spectrum(float t) {
  vec3 red = vec3(1.0, 0.18, 0.1);
  vec3 orange = vec3(1.0, 0.58, 0.12);
  vec3 yellow = vec3(1.0, 0.92, 0.22);
  vec3 green = vec3(0.18, 0.82, 0.38);
  vec3 blue = vec3(0.18, 0.46, 1.0);
  vec3 violet = vec3(0.62, 0.32, 1.0);
  vec3 color = mix(red, orange, smoothstep(0.02, 0.18, t));
  color = mix(color, yellow, smoothstep(0.18, 0.34, t));
  color = mix(color, green, smoothstep(0.34, 0.52, t));
  color = mix(color, blue, smoothstep(0.52, 0.72, t));
  color = mix(color, violet, smoothstep(0.72, 0.95, t));
  return color;
}

void main() {
  float band = smoothstep(0.05, 0.22, vUv.y) * smoothstep(0.96, 0.58, vUv.y);
  float edge = smoothstep(0.02, 0.1, vUv.x) * smoothstep(0.98, 0.9, vUv.x);
  float shimmer = 0.9 + sin(time * 0.28 + vUv.x * 7.0) * 0.1;
  gl_FragColor = vec4(spectrum(vUv.x) * shimmer, band * edge * opacity);
}
`;
