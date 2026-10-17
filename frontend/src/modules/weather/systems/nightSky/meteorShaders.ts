export const meteorTrailVertexShader = `
  attribute float aAlpha;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const meteorTrailFragmentShader = `
  uniform vec3 tint;
  uniform float opacity;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(tint, opacity * vAlpha);
  }
`;

export const meteorHeadVertexShader = `
  attribute float aAlpha;
  attribute float aSize;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const meteorHeadFragmentShader = `
  uniform vec3 tint;
  uniform float opacity;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float radius = length(uv);
    float core = smoothstep(0.48, 0.05, radius);
    float glow = smoothstep(0.5, 0.0, radius) * 0.38;
    float alpha = (core + glow) * vAlpha * opacity;
    gl_FragColor = vec4(tint, alpha);
  }
`;
