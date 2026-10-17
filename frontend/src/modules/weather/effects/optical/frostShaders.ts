export const frostVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const frostFragmentShader = `
precision highp float;

uniform float time;
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

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.58;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amp;
    p *= 2.1;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float edgeDist = max(abs(centered.x), abs(centered.y));
  float n = fbm(vUv * 16.0 + vec2(time * 0.012, -time * 0.006));
  float frostLine = mix(1.16, 0.58, intensity);
  float edgeFrost = smoothstep(frostLine, frostLine + 0.18, edgeDist + n * 0.22);
  float centerDistance = length(centered * vec2(1.0, 0.78));
  float centerClear = smoothstep(readabilityRadius, centerProtection, centerDistance);
  float crystal = fbm(vUv * 42.0 + n) * 0.3;
  float sparkle = max(0.0, sin((n + vUv.x) * 64.0 + time * 0.8)) * 0.12;
  float alpha = edgeFrost * centerClear * (0.48 + crystal + sparkle) * opacity;

  gl_FragColor = vec4(vec3(0.84, 0.92, 1.0) + sparkle, alpha);
}
`;
