export const sunnyBeamVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const sunnyRadialRayFragmentShader = `
  precision mediump float;

  uniform float time;
  uniform vec2 sunUv;
  uniform vec3 rayColor;
  uniform float opacity;
  varying vec2 vUv;

  float angularDistance(float left, float right) {
    return abs(atan(sin(left - right), cos(left - right)));
  }

  float softRay(float angle, float target, float width) {
    return smoothstep(width, 0.0, angularDistance(angle, target));
  }

  void main() {
    vec2 fromSun = vUv - sunUv;
    float dist = length(fromSun);
    float angle = atan(fromSun.y, fromSun.x);
    float rightward = smoothstep(-0.03, 0.18, fromSun.x);
    float downward = 1.0 - smoothstep(0.04, 0.22, fromSun.y);
    float directionMask = rightward * downward;
    float distanceFade = smoothstep(0.04, 0.18, dist) * smoothstep(1.28, 0.28, dist);
    float edgeFade =
      smoothstep(0.0, 0.08, vUv.x) *
      smoothstep(1.0, 0.9, vUv.x) *
      smoothstep(0.0, 0.08, vUv.y) *
      smoothstep(1.0, 0.9, vUv.y);
    float rays =
      softRay(angle, -0.34, 0.11) * 0.24 +
      softRay(angle, -0.56, 0.15) * 0.42 +
      softRay(angle, -0.82, 0.18) * 0.31 +
      softRay(angle, -1.1, 0.2) * 0.2;
    float wideWash = softRay(angle, -0.72, 0.46) * 0.11;
    float shimmer = 0.88 + sin(time * 0.34 + dist * 18.0 + angle * 3.0) * 0.12;
    float alpha = (rays + wideWash) * distanceFade * directionMask * edgeFade * opacity * shimmer;

    gl_FragColor = vec4(rayColor, alpha);
  }
`;

export const sunnyDustVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute float aDepth;

  uniform float time;
  uniform float pixelRatio;
  uniform vec3 windForce;
  uniform vec2 parallax;

  varying float vDepth;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float drift = time * (0.08 + aDepth * 0.045);
    pos.x += sin(aPhase + drift) * (0.12 + aDepth * 0.08) + windForce.x * drift;
    pos.y += cos(aPhase * 1.7 + drift) * (0.08 + aDepth * 0.05) + windForce.y * drift;
    pos.z += sin(aPhase * 0.9 + drift) * 0.08;
    pos.xy += parallax * (0.08 + aDepth * 0.12);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * pixelRatio * (1.0 + aDepth * 0.55) * (232.0 / max(90.0, -mvPosition.z));
    vDepth = aDepth;
    vAlpha = 0.22 + aDepth * 0.28;
  }
`;

export const sunnyDustFragmentShader = `
  precision mediump float;

  const float DUST_VISIBILITY_BOOST = 0.88;

  varying float vDepth;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    float core = smoothstep(0.5, 0.02, dist);
    float halo = smoothstep(0.5, 0.18, dist) * 0.45;
    vec3 color = mix(vec3(1.0, 0.72, 0.28), vec3(1.0, 0.92, 0.62), vDepth);
    gl_FragColor = vec4(color, (core + halo) * vAlpha * DUST_VISIBILITY_BOOST);
  }
`;

export const sunnyHaloFragmentShader = `
  precision mediump float;

  uniform float time;
  uniform vec3 haloColor;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv - vec2(0.5);
    float dist = length(uv);
    float breath = 0.92 + sin(time * 0.32) * 0.08;
    float alpha = smoothstep(0.5, 0.0, dist) * opacity * breath;
    gl_FragColor = vec4(haloColor, alpha);
  }
`;

export const sunnyRainbowFragmentShader = `
  precision mediump float;

  uniform float time;
  uniform float opacity;
  varying vec2 vUv;

  vec3 rainbowColor(float t) {
    if (t < 0.14) {
      return vec3(1.0, 0.12, 0.1);
    }
    if (t < 0.28) {
      return vec3(1.0, 0.46, 0.08);
    }
    if (t < 0.42) {
      return vec3(1.0, 0.86, 0.14);
    }
    if (t < 0.57) {
      return vec3(0.34, 0.9, 0.24);
    }
    if (t < 0.71) {
      return vec3(0.16, 0.56, 1.0);
    }
    if (t < 0.85) {
      return vec3(0.34, 0.18, 0.86);
    }
    return vec3(0.76, 0.26, 0.88);
  }

  void main() {
    float band = clamp(vUv.y, 0.0, 1.0);
    float arc = clamp(vUv.x, 0.0, 1.0);
    float bandFade = smoothstep(0.02, 0.16, band) * smoothstep(0.98, 0.84, band);
    float arcFade = smoothstep(0.0, 0.08, arc) * smoothstep(1.0, 0.86, arc);
    float breath = 0.92 + sin(time * 0.22 + arc * 4.2) * 0.08;
    vec3 color = rainbowColor(band);

    gl_FragColor = vec4(color, opacity * bandFade * arcFade * breath);
  }
`;
