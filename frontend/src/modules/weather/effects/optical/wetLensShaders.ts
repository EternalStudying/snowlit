export const wetLensVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const wetLensFragmentShader = `
precision highp float;

uniform float time;
uniform float intensity;
uniform float opacity;
uniform float centerProtection;
uniform float readabilityRadius;
uniform float edgeWetness;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  float droplets = 0.0;

  vec2 grid = floor(uv * vec2(26.0, 18.0));
  for (float y = -1.0; y <= 1.0; y += 1.0) {
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      vec2 cell = grid + vec2(x, y);
      float h = hash(cell + floor(time * 0.22));
      vec2 dropPos = (cell + vec2(0.5) + vec2(hash(cell * 1.7), hash(cell * 2.3)) * 0.62 - 0.31) / vec2(26.0, 18.0);
      float dist = length((uv - dropPos) * vec2(1.0, 1.55));
      float radius = 0.008 + h * 0.016;
      float drop = smoothstep(radius, radius * 0.28, dist) * step(1.0 - intensity * 0.42, h);
      droplets = max(droplets, drop);
    }
  }

  float streakColumn = hash(vec2(floor(uv.x * 54.0), 2.0));
  float streakY = fract(uv.y * 2.4 - time * 0.16 + streakColumn);
  float streak = smoothstep(0.0, 0.018, streakY) * smoothstep(0.22, 0.05, streakY);
  streak *= step(0.88, streakColumn) * smoothstep(0.32, 0.78, intensity);
  streak *= edgeWetness;

  float edgeRestraint = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
  vec2 readableUv = (uv - vec2(0.5, 0.48)) * vec2(1.0, 0.78);
  float centerDistance = length(readableUv);
  float centerClear = smoothstep(readabilityRadius * 0.55, readabilityRadius, centerDistance);
  float centerMask = mix(1.0 - centerProtection, 1.0, centerClear);
  float alpha = (droplets * 0.5 + streak * 0.28) * opacity * edgeRestraint * centerMask;
  vec3 highlight = mix(vec3(0.64, 0.72, 0.8), vec3(0.95, 0.98, 1.0), droplets);

  gl_FragColor = vec4(highlight, alpha);
}
`;
