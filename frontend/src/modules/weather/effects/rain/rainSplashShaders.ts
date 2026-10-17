export const rainSplashVertexShader = `
attribute vec4 aSeed;

uniform float time;
uniform float intensity;
uniform float pointSize;

varying float vAlpha;
varying float vRingPhase;

void main() {
  float seed = aSeed.x;
  float phase = aSeed.y;
  float size = aSeed.z;
  float lane = aSeed.w;
  vec3 pos = position;

  float cycle = fract(time * (0.42 + seed * 0.18) + phase);
  pos.x += sin(time * 0.65 + seed * 12.0) * 0.16;
  pos.y += cycle * 0.2;

  float bottomOnly = 1.0 - smoothstep(-1.0, -0.42, pos.y);
  float edgeFade = smoothstep(-3.4, -0.25, pos.z);
  float activity = step(seed, intensity);
  vAlpha = activity * bottomOnly * edgeFade * smoothstep(1.0, 0.0, cycle);
  vRingPhase = cycle + lane * 0.08;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = pointSize * size * (180.0 / max(-mvPos.z, 0.1));
}
`;

export const rainSplashFragmentShader = `
precision highp float;

uniform float opacity;

varying float vAlpha;
varying float vRingPhase;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  center.y *= 1.85;
  float dist = length(center);
  float ringRadius = mix(0.16, 0.46, vRingPhase);
  float ring = smoothstep(ringRadius + 0.035, ringRadius, dist) * smoothstep(ringRadius - 0.045, ringRadius, dist);
  float glint = smoothstep(0.18, 0.02, length(center - vec2(0.12, -0.04))) * 0.45;
  float alpha = (ring + glint) * vAlpha * opacity;
  if (alpha < 0.01) {
    discard;
  }
  gl_FragColor = vec4(0.76, 0.84, 0.92, alpha);
}
`;
