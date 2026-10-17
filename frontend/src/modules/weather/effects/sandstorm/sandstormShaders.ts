export const sandstormParticleVertexShader = `
  precision mediump float;

  attribute vec4 aSeed;

  uniform float time;
  uniform float intensity;
  uniform vec3 windForce;
  uniform float spawnRadius;
  uniform float spawnHeight;
  uniform float pointSize;
  uniform float swirlStrength;
  uniform float windTravelScale;
  uniform vec3 cameraPos;

  varying float vAlpha;
  varying float vSeed;
  varying float vDepth;

  void main() {
    float seed = aSeed.x;
    float phase = aSeed.y;
    float sizeVar = aSeed.z;
    float depth = aSeed.w;
    float t = time + phase * 9.0;
    vec3 pos = position;

    vec3 sandWind = vec3(windForce.x * 0.92, windForce.y * 0.16, windForce.z * 0.34);
    float windSpeed = max(abs(sandWind.x), 0.26) * windTravelScale * (0.74 + depth * 1.16);
    float swirl = sin(t * (1.2 + seed * 1.8) + position.z * 1.7 + phase * 6.2831);
    float crossSwirl = cos(t * (0.86 + seed * 1.2) + position.x * 0.44 + phase * 4.0);
    float verticalFlutter = sin(t * (1.8 + seed * 2.2) + phase * 12.0);

    pos.x = mod(pos.x + spawnRadius + windSpeed * t, spawnRadius * 2.0) - spawnRadius;
    pos.z += sandWind.z * t * 0.36 + crossSwirl * swirlStrength * (0.28 + depth * 0.44);
    pos.z = mod(pos.z + spawnRadius, spawnRadius * 2.0) - spawnRadius;
    pos.y += swirl * swirlStrength * (0.32 + depth * 0.54);
    pos.y += verticalFlutter * swirlStrength * 0.18 + abs(sandWind.x) * 0.06;
    pos.y = mod(pos.y + spawnHeight * 0.5, spawnHeight) - spawnHeight * 0.5;

    float edgeFade = smoothstep(spawnRadius, spawnRadius * 0.7, abs(pos.x));
    float depthEdgeFade = smoothstep(spawnRadius, spawnRadius * 0.58, abs(pos.z));
    float bottomFade = smoothstep(-spawnHeight * 0.5, -spawnHeight * 0.32, pos.y);
    float topFade = 1.0 - smoothstep(spawnHeight * 0.34, spawnHeight * 0.5, pos.y);
    float distanceFade = max(smoothstep(spawnRadius * 1.26, spawnRadius * 0.28, length((pos - cameraPos).xz)), 0.28);
    float depthFade = mix(1.0, 0.5, depth);
    float alphaFade = edgeFade * depthEdgeFade * bottomFade * topFade * distanceFade * depthFade;

    vAlpha = step(seed, intensity) * alphaFade;
    vSeed = seed;
    vDepth = depth;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = pointSize * sizeVar * mix(1.14, 0.64, depth) * (50.0 / max(-mvPos.z, 0.7));
  }
`;

export const sandstormParticleFragmentShader = `
  precision mediump float;

  uniform vec3 dustColor;
  uniform float opacity;

  varying float vAlpha;
  varying float vSeed;
  varying float vDepth;

  void main() {
    if (vAlpha < 0.01) {
      discard;
    }

    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    float softCircle = smoothstep(0.5, 0.08, dist);
    float core = smoothstep(0.16, 0.0, dist) * 0.18;
    float grain = 0.86 + sin((gl_PointCoord.x + gl_PointCoord.y + vSeed) * 28.0) * 0.08;
    vec3 color = dustColor * grain + vec3(core * 0.18);
    float alpha = softCircle * vAlpha * opacity * mix(1.0, 0.72, vDepth);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const sandstormPlaneVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const sandstormPlaneFragmentShader = `
  precision mediump float;

  uniform float time;
  uniform vec3 dustColor;
  uniform vec3 windForce;
  uniform float opacity;
  uniform float bandStrength;
  uniform float noiseScale;
  uniform float centerProtection;
  uniform float layerSeed;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;

    for (int i = 0; i < 4; i++) {
      sum += noise(p) * amp;
      p *= 2.05;
      amp *= 0.5;
    }

    return sum;
  }

  void main() {
    float windOffset = time * (0.11 + abs(windForce.x) * 0.045);
    vec2 seededUv = vUv + vec2(layerSeed, layerSeed * 0.47);
    float sandNoise = fbm(seededUv * noiseScale + vec2(windOffset, time * 0.018));
    float fineNoise = fbm(seededUv * noiseScale * 2.5 - vec2(windOffset * 0.4, 0.0));
    float gustLine = smoothstep(0.56, 0.94, sin((vUv.x - windOffset) * 18.0 + vUv.y * 8.0 + layerSeed * 5.0) * 0.5 + 0.5);
    float verticalFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
    float sideDust = 1.0 + smoothstep(0.22, 0.0, vUv.x) * 0.16 + smoothstep(0.78, 1.0, vUv.x) * 0.1;
    vec2 readableUv = (vUv - vec2(0.5, 0.5)) * vec2(1.0, 0.76);
    float centerClarity = smoothstep(0.18, 0.42, length(readableUv));
    float readableMask = mix(centerProtection, 1.0, centerClarity);
    float alpha = (0.28 + sandNoise * 0.44 + fineNoise * 0.16 + gustLine * bandStrength) * verticalFade;
    alpha *= opacity * sideDust * readableMask;
    alpha = clamp(alpha, 0.0, 0.44);

    gl_FragColor = vec4(dustColor + vec3(fineNoise * 0.035), alpha);
  }
`;
