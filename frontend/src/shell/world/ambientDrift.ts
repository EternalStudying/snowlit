import {
  BufferAttribute,
  BufferGeometry,
  Color,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer
} from 'three';
import { gsap } from '../../motionKit';

/*
 * Ambience over the whole page: sakura petals that turn over as they fall, and a light snow.
 * Real weather has its own layer (modules/weather); this one is only the mood of the place.
 * Near flakes are larger and faster, and move more with scrolling and with the pointer, which gives the
 * page a little depth. Petals can also burst from a point (the cover heart, the wish plaque).
 */

type Layer = {
  geometry: BufferGeometry;
  material: ShaderMaterial;
  position: Float32Array;
  data: Float32Array; // size, depth, spin, phase
  vx: Float32Array;
  vy: Float32Array;
  life: Float32Array;
  count: number;
};

const VERTEX = /* glsl */ `
  attribute vec4 data;
  uniform float uDpr;
  uniform float uTime;
  varying float vDepth;
  varying float vSpin;
  varying float vFlutter;
  void main() {
    vDepth = data.y;
    vSpin = data.z + uTime * (0.6 + data.w * 0.8);
    vFlutter = 0.35 + 0.65 * abs(cos(uTime * 1.7 + data.w * 6.28));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = data.x * uDpr;
  }`;

const SNOW = /* glsl */ `
  uniform vec3 uTint;
  varying float vDepth;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * (0.4 + vDepth * 0.5);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uTint, a);
  }`;

const PETAL = /* glsl */ `
  uniform vec3 uTint;
  varying float vDepth;
  varying float vSpin;
  varying float vFlutter;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    p = mat2(c, -s, s, c) * p;
    p.x /= vFlutter;
    float body = length(vec2(p.x * 1.6, p.y + 0.06)) - 0.3;
    float notch = length(vec2(p.x * 3.0, p.y - 0.34)) - 0.12;
    float a = smoothstep(0.02, -0.02, max(body, -notch)) * (0.75 + vDepth * 0.25);
    if (a < 0.01) discard;
    vec3 col = mix(uTint, vec3(1.0, 0.93, 0.95), smoothstep(0.1, -0.3, p.y) * 0.6);
    gl_FragColor = vec4(col, a);
  }`;

export type AmbientDrift = {
  burst(x: number, y: number): void;
  stop(): void;
};

let active: AmbientDrift | null = null;

/** Scatter petals from a point on screen; does nothing when the ambience is not running. */
export function burstPetals(x: number, y: number) {
  active?.burst(x, y);
}

export function startAmbientDrift(canvas: HTMLCanvasElement): AmbientDrift | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, -10, 10);
  let width = 0;
  let height = 0;

  function makeLayer(count: number, fragment: string, tint: string): Layer {
    const geometry = new BufferGeometry();
    const position = new Float32Array(count * 3);
    const data = new Float32Array(count * 4);
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('data', new BufferAttribute(data, 4));
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uDpr: { value: dpr }, uTint: { value: new Color(tint) } },
      vertexShader: VERTEX,
      fragmentShader: fragment
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    return { geometry, material, position, data, count, vx: new Float32Array(count), vy: new Float32Array(count), life: new Float32Array(count) };
  }

  const snow = makeLayer(Math.round(Math.min(260, (window.innerWidth * window.innerHeight) / 5200)), SNOW, '#ffffff');
  const petals = makeLayer(72, PETAL, '#ef9fb0');
  const AMBIENT_PETALS = 30; // the rest wait for bursts

  function seed(layer: Layer, i: number, anywhere: boolean, petal: boolean) {
    const depth = Math.random();
    layer.position[i * 3] = Math.random() * width;
    layer.position[i * 3 + 1] = anywhere ? Math.random() * height : -20;
    layer.data[i * 4] = petal ? 10 + depth * 14 : 2 + depth * depth * 6;
    layer.data[i * 4 + 1] = depth;
    layer.data[i * 4 + 2] = Math.random() * 6.28;
    layer.data[i * 4 + 3] = Math.random();
    layer.vx[i] = (Math.random() - 0.5) * 0.3;
    layer.vy[i] = (petal ? 0.4 : 0.32) + depth * (petal ? 0.55 : 0.85);
    layer.life[i] = 1;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.right = width;
    camera.bottom = height;
    camera.updateProjectionMatrix();
  }
  resize();
  for (let i = 0; i < snow.count; i++) seed(snow, i, true, false);
  for (let i = 0; i < petals.count; i++) {
    seed(petals, i, true, true);
    if (i >= AMBIENT_PETALS) {
      petals.life[i] = 0;
      petals.position[i * 3 + 1] = -999;
    }
  }

  let wind = 0;
  let windTarget = 0;
  const onPointer = (event: PointerEvent) => {
    windTarget = (event.clientX / Math.max(width, 1) - 0.5) * 1.2;
  };
  let lastScroll = window.scrollY;
  let scrollVelocity = 0;
  let visible = !document.hidden;
  const onVisibility = () => {
    visible = !document.hidden;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  function step(layer: Layer, petal: boolean, time: number, dt: number) {
    for (let i = 0; i < layer.count; i++) {
      const burstPetal = petal && i >= AMBIENT_PETALS;
      if (burstPetal && layer.life[i] <= 0) continue;
      const depth = layer.data[i * 4 + 1];
      const sway = Math.sin(time * (0.6 + depth) + layer.data[i * 4 + 3] * 20) * (petal ? 0.9 : 0.35);
      layer.position[i * 3] += (layer.vx[i] + wind * (0.4 + depth) + sway) * dt;
      layer.position[i * 3 + 1] += layer.vy[i] * dt - scrollVelocity * (0.15 + depth * 0.55);
      if (burstPetal) {
        layer.vy[i] += 0.02 * dt;
        layer.vx[i] *= 0.985;
        layer.life[i] -= 0.004 * dt;
        if (layer.life[i] <= 0) layer.position[i * 3 + 1] = -999;
        continue;
      }
      const x = layer.position[i * 3];
      const y = layer.position[i * 3 + 1];
      if (y > height + 30 || y < -60 || x < -40 || x > width + 40) {
        seed(layer, i, false, petal);
        if (y < -60) layer.position[i * 3 + 1] = height + 20;
      }
    }
    (layer.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    layer.material.uniforms.uTime.value = time;
  }

  const tick = (time: number, deltaMs: number) => {
    if (!visible) return;
    const dt = Math.min(deltaMs, 50) / 16.67;
    const scroll = window.scrollY;
    scrollVelocity += (scroll - lastScroll - scrollVelocity) * 0.35;
    lastScroll = scroll;
    wind += (windTarget - wind) * 0.02;
    step(snow, false, time, dt);
    step(petals, true, time, dt);
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);

  const drift: AmbientDrift = {
    burst(x, y) {
      let spawned = 0;
      for (let i = AMBIENT_PETALS; i < petals.count && spawned < 26; i++) {
        if (petals.life[i] > 0) continue;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        petals.position[i * 3] = x;
        petals.position[i * 3 + 1] = y;
        petals.vx[i] = Math.cos(angle) * speed;
        petals.vy[i] = Math.sin(angle) * speed - 3;
        petals.data[i * 4] = 12 + Math.random() * 12;
        petals.data[i * 4 + 1] = Math.random();
        petals.life[i] = 1;
        spawned++;
      }
    },
    stop() {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const layer of [snow, petals]) {
        layer.geometry.dispose();
        layer.material.dispose();
      }
      renderer.dispose();
      if (active === drift) active = null;
    }
  };
  active = drift;
  return drift;
}
