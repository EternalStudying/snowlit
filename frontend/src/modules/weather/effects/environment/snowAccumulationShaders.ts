export const snowAccumulationVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const snowAccumulationFragmentShader = `
precision highp float;

uniform float time;
uniform float intensity;
uniform float opacity;
uniform float centerProtection;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float bottomBand = smoothstep(0.62, 0.0, vUv.y);
  float side = max(smoothstep(0.24, 0.0, vUv.x), smoothstep(0.76, 1.0, vUv.x));
  float cornerSnow = side * smoothstep(0.78, 0.02, vUv.y);
  float centerReadability = smoothstep(0.0, centerProtection, length(vUv - vec2(0.5, 0.28)));
  float uneven = noise(vec2(vUv.x * 18.0, time * 0.025)) * 0.14;
  float coverage = smoothstep(0.46 + uneven, 0.02, vUv.y) + cornerSnow * 0.32;
  float alpha = min(coverage, 1.0) * bottomBand * mix(0.42, 1.0, centerReadability) * intensity * opacity;
  vec3 color = mix(vec3(0.78, 0.86, 0.94), vec3(0.98, 1.0, 1.0), noise(vUv * 30.0));
  gl_FragColor = vec4(color, alpha);
}
`;
