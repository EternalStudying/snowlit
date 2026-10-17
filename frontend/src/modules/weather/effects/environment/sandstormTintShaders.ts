export const sandstormTintVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const sandstormTintFragmentShader = `
precision highp float;

uniform float time;
uniform vec3 tintColor;
uniform float intensity;
uniform float opacity;
uniform float centerProtection;
uniform float readabilityRadius;

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
  vec2 centered = vUv - 0.5;
  float readableCenter = smoothstep(readabilityRadius, centerProtection, length(centered));
  float edgeLift = smoothstep(0.16, 0.86, max(abs(centered.x), abs(centered.y)));
  float dustNoise = noise(vUv * vec2(6.0, 3.0) + vec2(time * 0.08, time * 0.015));
  float alpha = opacity * intensity * mix(0.28, 1.0, readableCenter) * (0.72 + edgeLift * 0.24 + dustNoise * 0.1);
  gl_FragColor = vec4(tintColor, alpha);
}
`;
