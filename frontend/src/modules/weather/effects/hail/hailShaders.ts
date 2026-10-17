export const hailVertexShader = `
attribute vec4 aSeed;

uniform float time;
uniform float intensity;
uniform vec3 windForce;
uniform float spawnHeight;
uniform float spawnRadius;
uniform float fallSpeed;
uniform float pointSize;
uniform vec3 cameraPos;

varying float vAlpha;
varying float vFlash;

void main() {
  float seed = aSeed.x;
  float phase = aSeed.y;
  float size = aSeed.z;
  float depth = aSeed.w;

  vec3 pos = position;
  float t = time * (0.72 + seed * 0.26) + phase * 8.0;
  vec3 direction = normalize(vec3(windForce.x * 0.12, -fallSpeed, windForce.z * 0.12));
  float travel = mod(t * fallSpeed + seed * spawnHeight * 2.0, spawnHeight * 2.0);
  pos += direction * travel;
  pos.x = mod(pos.x + spawnRadius, spawnRadius * 2.0) - spawnRadius;
  pos.y = mod(pos.y + spawnHeight, spawnHeight * 2.0) - spawnHeight;
  pos.z = -0.65 - depth * 8.6;

  float gate = step(seed, intensity);
  float dist = length(pos.xy * vec2(0.8, 0.55));
  vAlpha = gate * smoothstep(spawnRadius * 1.18, spawnRadius * 0.36, dist);
  vFlash = pow(max(0.0, sin(t * 7.0 + seed * 21.0)), 9.0);

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = pointSize * size * (120.0 / max(-mvPos.z, 0.1));
}
`;

export const hailFragmentShader = `
precision highp float;

uniform float opacity;

varying float vAlpha;
varying float vFlash;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  float hardCore = smoothstep(0.48, 0.18, dist);
  float rim = smoothstep(0.46, 0.38, dist) * 0.55;
  if (hardCore < 0.02) {
    discard;
  }

  vec3 ice = mix(vec3(0.72, 0.84, 0.94), vec3(0.96, 1.0, 1.0), rim + vFlash * 0.28);
  gl_FragColor = vec4(ice, hardCore * vAlpha * opacity);
}
`;
