export const cloudSkyVertexShader = `
uniform float rotation;
uniform vec2 center;

varying vec2 vUv;

void main() {
  vUv = uv;

  vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale;
  scale.x = length(vec3(modelMatrix[0].x, modelMatrix[0].y, modelMatrix[0].z));
  scale.y = length(vec3(modelMatrix[1].x, modelMatrix[1].y, modelMatrix[1].z));

  vec2 alignedPosition = (position.xy - (center - vec2(0.5))) * scale;
  vec2 rotatedPosition;
  rotatedPosition.x = cos(rotation) * alignedPosition.x - sin(rotation) * alignedPosition.y;
  rotatedPosition.y = sin(rotation) * alignedPosition.x + cos(rotation) * alignedPosition.y;

  mvPosition.xy += rotatedPosition;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const cloudSkyFragmentShader = `
precision highp float;

uniform sampler2D uTxtShape;
uniform sampler2D uTxtCloudNoise;
uniform float uTime;

uniform float uFac1;
uniform float uFac2;
uniform float uTimeFactor1;
uniform float uTimeFactor2;
uniform float uDisplStrenght1;
uniform float uDisplStrenght2;
uniform float uOpacity;
uniform float uBrightness;

varying vec2 vUv;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float snoise3(vec3 p) {
  return valueNoise3(p) * 2.0 - 1.0;
}

float fbm3d(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int index = 0; index < 4; index++) {
    value += valueNoise3(p) * amplitude;
    p *= 2.02;
    p += vec3(17.1, 3.7, 9.2);
    amplitude *= 0.5;
  }

  return value;
}

vec4 levels(vec4 color, float inputMin, float gamma, float inputMax) {
  vec4 leveled = clamp((color - vec4(inputMin)) / max(inputMax - inputMin, 0.0001), 0.0, 1.0);
  return pow(leveled, vec4(1.0 / max(gamma, 0.0001)));
}

void main() {
  vec2 newUv = vUv;

  vec4 txtNoise1 = texture2D(
    uTxtCloudNoise,
    vec2(vUv.x + uTime * 0.0001, vUv.y - uTime * 0.00014)
  );
  vec4 txtNoise2 = texture2D(
    uTxtCloudNoise,
    vec2(vUv.x - uTime * 0.00002, vUv.y + uTime * 0.000017 + 0.2)
  );

  float noiseBig = fbm3d(vec3(vUv * uFac1, uTime * uTimeFactor1), 4) + 1.0 * 0.5;
  newUv += noiseBig * uDisplStrenght1;

  float noiseSmall = snoise3(vec3(newUv * uFac2, uTime * uTimeFactor2));
  newUv += noiseSmall * uDisplStrenght2;

  vec4 txtShape = texture2D(uTxtShape, newUv);

  float originalAlpha = levels((txtNoise1 + txtNoise2) * 0.6, 0.2, 0.4, 0.7).r;
  originalAlpha *= txtShape.r;
  float alpha = originalAlpha;
  float shapeFeather = smoothstep(0.02, 0.34, txtShape.r);
  float shapeCore = smoothstep(0.08, 0.72, txtShape.r);
  float shapeHalo = smoothstep(0.0, 0.14, txtShape.r) * (1.0 - smoothstep(0.22, 0.44, txtShape.r));
  alpha = max(alpha, shapeHalo * 0.045);
  alpha = max(alpha, shapeFeather * 0.22);
  alpha = max(alpha, shapeCore * 0.28);

  gl_FragColor = vec4(vec3(0.95, 0.95, 0.95) * uBrightness, alpha * uOpacity);
}
`;
