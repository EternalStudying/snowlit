export const auroraVertexShader = `
uniform float time;

varying vec2 vUv;
varying float vIntensity;

void main() {
  vUv = uv;
  vec3 pos = position;
  float wave1 = sin(pos.x * 1.9 + time * 0.38) * 0.22;
  float wave2 = sin(pos.x * 4.3 + time * 0.77) * 0.08;
  pos.y += (wave1 + wave2) * (0.35 + uv.y);
  pos.z += cos(pos.x * 2.4 + time * 0.22) * 0.16;
  vIntensity = smoothstep(0.05, 0.28, uv.y) * smoothstep(1.0, 0.62, uv.y);
  vIntensity *= 0.72 + sin(pos.x * 2.0 + time * 0.26) * 0.18;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const auroraFragmentShader = `
precision highp float;

uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform float opacity;

varying vec2 vUv;
varying float vIntensity;

void main() {
  vec3 color = mix(color2, color1, smoothstep(0.0, 0.48, vUv.y));
  color = mix(color, color3, smoothstep(0.44, 0.94, vUv.y));
  float column = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  float vertical = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
  gl_FragColor = vec4(color * 1.25, vIntensity * column * vertical * opacity);
}
`;

export const auroraWashVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const auroraWashFragmentShader = `
precision highp float;

uniform float opacity;
uniform float topCoverage;

varying vec2 vUv;

void main() {
  vec2 centered = vUv - 0.5;
  float upper = smoothstep(1.0 - topCoverage, 0.92, vUv.y);
  float centerReadability = smoothstep(0.16, 0.58, length(centered));
  vec3 color = mix(vec3(0.012, 0.018, 0.055), vec3(0.018, 0.04, 0.095), upper);
  gl_FragColor = vec4(color, opacity * (0.42 + upper * 0.42) * mix(0.32, 1.0, centerReadability));
}
`;

