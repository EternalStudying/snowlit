export const rainHazeVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const rainHazeFragmentShader = `
  precision mediump float;

  uniform float time;
  uniform vec3 hazeColor;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    float upperMist = smoothstep(0.04, 0.78, vUv.y);
    float sideMoisture = smoothstep(0.52, 0.0, abs(vUv.x - 0.5));
    float breath = 0.92 + sin(time * 0.18 + vUv.x * 5.0) * 0.08;
    float alpha = opacity * breath * (0.5 + upperMist * 0.24 + sideMoisture * 0.12);

    gl_FragColor = vec4(hazeColor, alpha);
  }
`;

export const rainVertexShader = `
  precision mediump float;

  attribute vec4 aDrop;

  uniform float time;
  uniform float intensity;
  uniform vec3 windForce;
  uniform float gravity;
  uniform float spawnHeight;
  uniform float spawnRadius;
  uniform float dropLength;
  uniform vec3 cameraPos;

  varying float vAlpha;
  varying float vDepth;

  void main() {
    float seed = aDrop.x;
    float phase = aDrop.y;
    float depth = aDrop.z;
    float lineEnd = aDrop.w;
    vec3 pos = position;

    float fallSpeed = abs(gravity) * (0.5 + seed * 0.28);
    float t = time + phase * 9.0;
    float gust = sin(time * 0.52 + phase * 6.2831) * 0.12;
    vec3 rainDrift = vec3(windForce.x * 0.56 + gust, 0.0, windForce.z * 0.18);
    float maxRainDrift = 0.95;
    vec3 clampedDrift = vec3(clamp(rainDrift.x, -maxRainDrift, maxRainDrift), 0.0, clamp(rainDrift.z, -0.35, 0.35));
    vec3 travelDirection = normalize(vec3(clampedDrift.x * (0.62 + depth * 0.18), -1.0, clampedDrift.z * 0.3));
    float visibleTop = spawnHeight * 0.5;
    float visibleBottom = -spawnHeight * 0.5;
    float cyclePadding = spawnHeight * 0.22;
    float cycleDistance = (spawnHeight + cyclePadding * 2.0) / max(abs(travelDirection.y), 0.2);
    float motionDistance = mod(fallSpeed * t, cycleDistance);
    pos.y = visibleTop + cyclePadding;
    pos.x += (position.y / spawnHeight) * travelDirection.x * cyclePadding;
    pos += travelDirection * motionDistance;

    if (lineEnd > 0.5) {
      float stretch = dropLength * (0.85 + depth * 0.45 + length(windForce) * 0.035);
      pos -= travelDirection * stretch;
    }

    float horizontalFade = smoothstep(spawnRadius, spawnRadius * 0.66, abs(pos.x));
    float fadeIn = 1.0 - smoothstep(visibleTop, visibleTop + cyclePadding, pos.y);
    float fadeOut = smoothstep(visibleBottom - cyclePadding, visibleBottom, pos.y);
    float respawnFade = fadeIn * fadeOut;
    float cameraDistance = length((pos - cameraPos).xz);
    float distanceFade = max(smoothstep(spawnRadius * 1.35, spawnRadius * 0.28, cameraDistance), 0.38);
    float depthFade = mix(1.0, 0.42, depth);

    vAlpha = step(seed, intensity) * horizontalFade * respawnFade * distanceFade * depthFade * mix(1.0, 0.72, lineEnd);
    vDepth = depth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const rainFragmentShader = `
  precision mediump float;

  uniform float opacity;
  varying float vAlpha;
  varying float vDepth;

  void main() {
    if (vAlpha < 0.01) {
      discard;
    }

    vec3 nearColor = vec3(0.72, 0.8, 0.94);
    vec3 farColor = vec3(0.46, 0.56, 0.72);
    vec3 color = mix(nearColor, farColor, vDepth);

    gl_FragColor = vec4(color, vAlpha * opacity);
  }
`;
