export const snowVeilVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const snowVeilFragmentShader = `
  precision mediump float;

  uniform float time;
  uniform vec3 veilColor;
  uniform float opacity;
  uniform float windStrength;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float side = smoothstep(0.54, 0.0, abs(vUv.x - 0.5));
    float upper = smoothstep(0.08, 0.78, vUv.y);
    float drift = sin((vUv.x + time * (0.025 + windStrength * 0.012)) * 18.0 + vUv.y * 8.0);
    float grain = hash(floor((vUv + vec2(time * 0.018, time * 0.006)) * 42.0));
    float streak = smoothstep(0.86, 1.0, sin((vUv.x * 16.0 + vUv.y * 34.0) - time * (0.34 + windStrength * 0.08)) * 0.5 + 0.5);
    float veil = 0.52 + upper * 0.22 + side * 0.16 + drift * 0.045 + grain * 0.035 + streak * clamp(windStrength / 3.0, 0.0, 1.0) * 0.13;

    gl_FragColor = vec4(veilColor, opacity * veil);
  }
`;

export const snowVertexShader = `
  precision mediump float;

  attribute vec4 aSeed;

  uniform float time;
  uniform float intensity;
  uniform vec3 windForce;
  uniform float gravity;
  uniform float spawnHeight;
  uniform float spawnRadius;
  uniform float flutterAmp;
  uniform float pointSize;
  uniform float windTravelScale;
  uniform float windStretch;
  uniform vec3 cameraPos;

  varying float vAlpha;
  varying float vSize;
  varying float vDepth;
  varying float vSeed;

  void main() {
    float seed = aSeed.x;
    float phase = aSeed.y;
    float sizeVar = aSeed.z;
    float depth = aSeed.w;
    float t = time + phase * 8.0;
    vec3 pos = position;

    float fallSpeed = abs(gravity) * (0.58 + seed * 0.58);
    float fallOffset = mod((position.y + spawnHeight * 0.5) - fallSpeed * t, spawnHeight);
    pos.y = fallOffset - spawnHeight * 0.5;

    float life = 1.0 - clamp((pos.y + spawnHeight * 0.5) / spawnHeight, 0.0, 1.0);
    float flutter = sin(t * (1.12 + seed * 1.65) + phase * 6.2831) * flutterAmp;
    float flutterCross = cos(t * (0.88 + seed * 1.25) + phase * 9.0) * flutterAmp * 0.62;
    float gust = sin(time * 0.43 + phase * 11.0) * 0.16;
    vec3 snowDrift = vec3(windForce.x + gust, windForce.y * 0.18, windForce.z);

    pos.x += flutter * (0.54 + depth * 0.72);
    pos.z += flutterCross * (0.48 + depth * 0.42);
    pos.x += snowDrift.x * t * windTravelScale * (0.72 + depth * 1.34);
    pos.z += snowDrift.z * t * windTravelScale * (0.38 + depth * 0.58);
    pos.y += snowDrift.y * life * 0.32;

    pos.x = mod(pos.x + spawnRadius, spawnRadius * 2.0) - spawnRadius;
    pos.z = mod(pos.z + spawnRadius, spawnRadius * 2.0) - spawnRadius;

    float horizontalFade = smoothstep(spawnRadius, spawnRadius * 0.62, length(pos.xz));
    float topFade = 1.0 - smoothstep(spawnHeight * 0.36, spawnHeight * 0.5, pos.y);
    float bottomFade = smoothstep(-spawnHeight * 0.5, -spawnHeight * 0.34, pos.y);
    float distanceFade = max(smoothstep(spawnRadius * 1.28, spawnRadius * 0.28, length((pos - cameraPos).xz)), 0.34);
    float depthFade = mix(1.0, 0.5, depth);

    vAlpha = step(seed, intensity) * horizontalFade * topFade * bottomFade * distanceFade * depthFade;
    vSize = sizeVar;
    vDepth = depth;
    vSeed = seed;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = pointSize * sizeVar * mix(1.08, 0.64, depth) * (44.0 / max(-mvPos.z, 0.6));
  }
`;

export const snowFragmentShader = `
  precision mediump float;

  uniform float opacity;
  uniform float windStretch;
  varying float vAlpha;
  varying float vSize;
  varying float vDepth;
  varying float vSeed;

  void main() {
    if (vAlpha < 0.01) {
      discard;
    }

    vec2 center = gl_PointCoord - 0.5;
    vec2 windSkew = vec2(center.x / (1.0 + windStretch), center.y * (1.0 + windStretch * 0.22));
    float dist = length(windSkew);
    float softCircle = smoothstep(0.5, 0.16, dist);
    float core = smoothstep(0.22, 0.0, dist) * 0.24;
    float sparkle = max(sin((gl_PointCoord.x + gl_PointCoord.y + vSeed) * 22.0 + vSize * 5.5) * 0.12, 0.0);
    vec3 coldWhite = mix(vec3(0.86, 0.92, 1.0), vec3(1.0), 1.0 - vDepth * 0.36);
    float alpha = min(softCircle * (0.76 + core) + sparkle * 0.14, 1.0) * vAlpha * opacity;

    gl_FragColor = vec4(coldWhite + sparkle * 0.08, alpha);
  }
`;
