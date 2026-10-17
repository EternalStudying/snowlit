export const nightSkyPlaneVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const nightSkyDomeFragmentShader = `
precision highp float;

uniform float time;
uniform float opacity;
uniform float horizonGlow;
uniform float centerProtection;
uniform vec3 zenithColor;
uniform vec3 midColor;
uniform vec3 horizonColor;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float elevation = smoothstep(0.0, 1.0, vUv.y);
  vec3 color = mix(horizonColor, midColor, smoothstep(0.0, 0.54, elevation));
  color = mix(color, zenithColor, smoothstep(0.42, 1.0, elevation));

  float horizonBand = exp(-vUv.y * 5.8) * horizonGlow;
  float topGlow = smoothstep(0.34, 1.0, vUv.y) * 0.08;
  float starsDust = pow(hash(vUv * 220.0 + time * 0.02), 18.0) * 0.04;
  vec2 centered = vUv - 0.5;
  float centerReadable = smoothstep(0.16, centerProtection, length(centered));
  float edgeLift = smoothstep(0.2, 0.72, length(centered));
  float alpha = opacity * (0.18 + horizonBand + topGlow + starsDust) * mix(0.22, 1.0, max(centerReadable, edgeLift));

  gl_FragColor = vec4(color + vec3(horizonBand * 0.18), alpha);
}
`;

export const starfieldVertexShader = `
attribute vec4 aStarData;
attribute float aTwinkleSeed;

uniform float time;
uniform float opacity;
uniform float twinkleStrength;
uniform float baseSizePx;
uniform float exposure;

varying vec3 vColor;
varying float vBrightness;
varying float vAlpha;

void main() {
  float magnitude = aStarData.w;
  float brightness = pow(2.512, -magnitude) * exposure;
  float twinkle1 = sin(time * (1.1 + aTwinkleSeed * 0.8) + aTwinkleSeed * 17.0) * 0.18;
  float twinkle2 = sin(time * (3.4 + aTwinkleSeed) + aTwinkleSeed * 41.0) * 0.08;
  float twinkle = 1.0 + (twinkle1 + twinkle2) * twinkleStrength;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

  vColor = aStarData.rgb;
  vBrightness = brightness * twinkle;
  vAlpha = opacity * clamp(0.32 + brightness * 1.35, 0.18, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = clamp(baseSizePx * (0.72 + brightness * 2.1) * twinkle * (90.0 / max(-mvPos.z, 0.1)), 0.65, 5.6);
}
`;

export const starfieldFragmentShader = `
precision highp float;

uniform float glowFalloff;

varying vec3 vColor;
varying float vBrightness;
varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  float core = smoothstep(0.48, 0.05, dist);
  float glow = exp(-dist * dist / max(glowFalloff * glowFalloff, 0.001)) * 0.42;
  float alpha = (core + glow) * vAlpha;

  if (alpha <= 0.01) {
    discard;
  }

  gl_FragColor = vec4(vColor * vBrightness * 1.35, alpha);
}
`;

export const milkyWayFragmentShader = `
precision highp float;

uniform float time;
uniform float opacity;
uniform float bandWidth;
uniform float bandTilt;
uniform float dustLanes;
uniform float centerProtection;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += noise(p) * amp;
    p *= 2.08;
    amp *= 0.52;
  }
  return sum;
}

void main() {
  vec2 centered = vUv - 0.5;
  float x = centered.x * cos(bandTilt) - centered.y * sin(bandTilt);
  float y = centered.x * sin(bandTilt) + centered.y * cos(bandTilt);
  float band = exp(-(y * y) / max(bandWidth * bandWidth, 0.001));
  float structure = fbm(vec2(x * 3.0 + time * 0.01, y * 9.0));
  float dust = smoothstep(0.44, 0.68, fbm(vec2(x * 5.4 + 2.1, y * 14.0 - 1.7))) * dustLanes;
  float core = exp(-x * x * 8.0) * band * 0.32;
  vec3 coolTint = vec3(0.48, 0.62, 0.95);
  vec3 warmTint = vec3(1.0, 0.78, 0.52);
  vec3 color = mix(coolTint, warmTint, core * 2.2 + 0.12);
  float centerReadable = smoothstep(0.2, centerProtection, length(centered));
  float alpha = opacity * band * (0.34 + structure * 0.88) * (1.0 - dust) * mix(0.18, 1.0, centerReadable);

  gl_FragColor = vec4(color * (alpha + core), alpha);
}
`;

export const moonFragmentShader = `
precision highp float;

uniform float opacity;
uniform float moonPhase;
uniform vec3 moonColor;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 centered = vUv - 0.5;
  float dist = length(centered);
  float disc = smoothstep(0.5, 0.47, dist);
  float phaseOffset = (moonPhase - 0.5) * 0.34;
  float lightSide = smoothstep(-0.18, 0.18, centered.x + phaseOffset);
  float craters = hash(floor((vUv + vec2(0.0, moonPhase)) * 24.0)) * 0.08;
  vec3 shadow = vec3(0.09, 0.11, 0.16);
  vec3 color = mix(shadow, moonColor * (0.9 + craters), 0.22 + lightSide * 0.78);
  float limb = smoothstep(0.52, 0.3, dist);

  gl_FragColor = vec4(color, disc * limb * opacity);
}
`;

export const moonGlowFragmentShader = `
precision highp float;

uniform float opacity;
uniform vec3 moonColor;

varying vec2 vUv;

void main() {
  float dist = length(vUv - 0.5);
  float glow = exp(-dist * dist * 9.0);
  gl_FragColor = vec4(moonColor * 0.8, glow * opacity * 0.26);
}
`;
