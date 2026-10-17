export const fogSpriteVertexShader = `
  precision mediump float;

  uniform float time;
  uniform vec2 viewportSize;
  uniform vec2 windOffset;

  attribute vec2 aOrigin;
  attribute float aScale;
  attribute float aAlpha;
  attribute vec4 aDrift;
  attribute vec2 aPhase;

  varying vec2 vUv;
  varying vec2 vFogCoord;
  varying float vAlpha;
  varying float vVisibility;

  vec2 wrapFogCoord(vec2 coord) {
    return mod(coord + vec2(1.1), vec2(2.2)) - vec2(1.1);
  }

  void main() {
    vUv = uv;
    vAlpha = aAlpha;

    vec2 drift = vec2(
      sin(time * aDrift.z + aPhase.x) * aDrift.x,
      cos(time * aDrift.w + aPhase.y) * aDrift.y
    );
    vec2 wrapped = wrapFogCoord(aOrigin + windOffset + drift);
    vFogCoord = wrapped;

    vec2 xVisibility = vec2(
      smoothstep(-1.1, -0.96, wrapped.x),
      1.0 - smoothstep(0.96, 1.1, wrapped.x)
    );
    vec2 yVisibility = vec2(
      smoothstep(-1.1, -0.96, wrapped.y),
      1.0 - smoothstep(0.96, 1.1, wrapped.y)
    );
    vVisibility = xVisibility.x * xVisibility.y * yVisibility.x * yVisibility.y;

    vec2 spriteSize = vec2(viewportSize.x * 0.38, viewportSize.y * 0.31) * aScale;
    vec2 localPosition = wrapped * viewportSize * 0.5 + position.xy * spriteSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(localPosition, 0.0, 1.0);
  }
`;

export const fogSpriteFragmentShader = `
  precision mediump float;

  uniform sampler2D fogMap;
  uniform vec3 fogTint;
  uniform float globalOpacity;
  uniform float centerProtection;
  uniform float readabilityRadius;

  varying vec2 vUv;
  varying vec2 vFogCoord;
  varying float vAlpha;
  varying float vVisibility;

  void main() {
    vec4 fogSample = texture2D(fogMap, vUv);
    vec2 readableCoord = (vFogCoord - vec2(0.0, -0.04)) * vec2(1.0, 0.78);
    float centerDistance = length(readableCoord);
    float centerClear = smoothstep(readabilityRadius * 0.48, readabilityRadius, centerDistance);
    float centerMask = mix(centerProtection, 1.0, centerClear);
    float softAlpha = pow(fogSample.a, 0.88);
    float alpha = softAlpha * vAlpha * globalOpacity * vVisibility * centerMask;

    if (alpha < 0.003) {
      discard;
    }

    vec3 color = mix(fogTint, fogSample.rgb, 0.18);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.58));
  }
`;
