import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, CustomEase);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const settle = CustomEase.create('settle', 'M0,0 C0.14,0.86 0.26,1 1,1');
const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const $$ = <T extends Element = HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));

/* ------------------------------------------------------------------------------------------------
 * Weather: snow and sakura petals drifting over the whole page (Three.js).
 * Flakes have depth: near ones are bigger, faster and move more with scroll and with the pointer.
 * ---------------------------------------------------------------------------------------------- */

type Weather = { burst(x: number, y: number): void };

function startWeather(canvas: HTMLCanvasElement): Weather {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);

  let width = 0;
  let height = 0;

  function makeLayer(count: number, fragment: string, tint: THREE.Color) {
    const geometry = new THREE.BufferGeometry();
    const position = new Float32Array(count * 3);
    const data = new Float32Array(count * 4); // size, depth, spin, phase
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('data', new THREE.BufferAttribute(data, 4));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uDpr: { value: dpr }, uTint: { value: tint } },
      vertexShader: /* glsl */ `
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
        }`,
      fragmentShader: fragment
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    return { geometry, material, position, data, count, vx: new Float32Array(count), vy: new Float32Array(count), life: new Float32Array(count) };
  }

  const snowFrag = /* glsl */ `
    uniform vec3 uTint;
    varying float vDepth;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.05, d) * (0.45 + vDepth * 0.5);
      if (a < 0.01) discard;
      gl_FragColor = vec4(uTint, a);
    }`;
  const petalFrag = /* glsl */ `
    uniform vec3 uTint;
    varying float vDepth;
    varying float vSpin;
    varying float vFlutter;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float c = cos(vSpin), s = sin(vSpin);
      p = mat2(c, -s, s, c) * p;
      p.x /= vFlutter;                       // the petal turns over as it falls
      float body = length(vec2(p.x * 1.6, p.y + 0.06)) - 0.3;
      float notch = length(vec2(p.x * 3.0, p.y - 0.34)) - 0.12;
      float shape = max(body, -notch);
      float a = smoothstep(0.02, -0.02, shape) * (0.75 + vDepth * 0.25);
      if (a < 0.01) discard;
      vec3 col = mix(uTint, vec3(1.0, 0.93, 0.95), smoothstep(0.1, -0.3, p.y) * 0.6);
      gl_FragColor = vec4(col, a);
    }`;

  const area = window.innerWidth * window.innerHeight;
  const snow = makeLayer(Math.round(Math.min(520, area / 2600)), snowFrag, new THREE.Color('#ffffff'));
  const petals = makeLayer(70, petalFrag, new THREE.Color('#ef9fb0'));
  const ambientPetals = 34; // the rest are kept for bursts

  function resetFlake(layer: typeof snow, i: number, anywhere: boolean, petal: boolean) {
    const depth = Math.random();
    layer.position[i * 3] = Math.random() * width;
    layer.position[i * 3 + 1] = anywhere ? Math.random() * height : -20;
    layer.data[i * 4] = petal ? 10 + depth * 14 : 2 + depth * depth * 7;
    layer.data[i * 4 + 1] = depth;
    layer.data[i * 4 + 2] = Math.random() * 6.28;
    layer.data[i * 4 + 3] = Math.random();
    layer.vx[i] = (Math.random() - 0.5) * 0.3;
    layer.vy[i] = (petal ? 0.45 : 0.35) + depth * (petal ? 0.6 : 0.9);
    layer.life[i] = petal && i >= ambientPetals ? 0 : 1;
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
  for (let i = 0; i < snow.count; i++) resetFlake(snow, i, true, false);
  for (let i = 0; i < petals.count; i++) {
    resetFlake(petals, i, true, true);
    if (i >= ambientPetals) petals.position[i * 3 + 1] = -999;
  }
  window.addEventListener('resize', resize);

  let wind = 0;
  let windTarget = 0;
  window.addEventListener('pointermove', (event) => {
    windTarget = (event.clientX / width - 0.5) * 1.2;
  });

  let lastScroll = window.scrollY;
  let scrollVelocity = 0;

  function step(layer: typeof snow, petal: boolean, time: number, dt: number) {
    for (let i = 0; i < layer.count; i++) {
      if (petal && i >= ambientPetals && layer.life[i] <= 0) continue;
      const depth = layer.data[i * 4 + 1];
      const sway = Math.sin(time * (0.6 + depth) + layer.data[i * 4 + 3] * 20) * (petal ? 0.9 : 0.35);
      layer.position[i * 3] += (layer.vx[i] + wind * (0.4 + depth) + sway) * dt;
      // Scrolling moves near flakes with the page and far ones barely: a little parallax depth.
      layer.position[i * 3 + 1] += layer.vy[i] * dt - scrollVelocity * (0.15 + depth * 0.55);
      if (petal && i >= ambientPetals) {
        layer.vy[i] += 0.02 * dt;           // burst petals fall back under gravity
        layer.vx[i] *= 0.985;
        layer.life[i] -= 0.004 * dt;
        if (layer.life[i] <= 0) layer.position[i * 3 + 1] = -999;
        continue;
      }
      const x = layer.position[i * 3];
      const y = layer.position[i * 3 + 1];
      if (y > height + 30 || y < -60 || x < -40 || x > width + 40) {
        resetFlake(layer, i, false, petal);
        if (y < -60) layer.position[i * 3 + 1] = height + 20;
      }
    }
    (layer.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    layer.material.uniforms.uTime.value = time;
  }

  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  gsap.ticker.add((time, deltaMs) => {
    if (!running) return;
    const dt = Math.min(deltaMs, 50) / 16.67;
    const scroll = window.scrollY;
    scrollVelocity += (scroll - lastScroll - scrollVelocity) * 0.35;
    lastScroll = scroll;
    wind += (windTarget - wind) * 0.02;
    step(snow, false, time, dt);
    step(petals, true, time, dt);
    renderer.render(scene, camera);
  });

  return {
    burst(x: number, y: number) {
      let spawned = 0;
      for (let i = ambientPetals; i < petals.count && spawned < 26; i++) {
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
    }
  };
}

const weather: Weather = reduced ? { burst() {} } : startWeather($<HTMLCanvasElement>('canvas.weather'));

/* ------------------------------------------------------------------------------------------------
 * Cover: the two paintings take turns, each slowly drifting closer. Touching the heart scatters petals.
 * ---------------------------------------------------------------------------------------------- */

const paintings = $$('.cover__painting');
if (!reduced) {
  gsap.from('.cover__frame', { scale: 1.04, duration: 2.2, ease: settle });
  gsap.from('.cover__person, .cover__heart', { y: 40, autoAlpha: 0, duration: 1.1, ease: settle, stagger: 0.12, delay: 0.5 });
  let current = 0;
  const drift = (image: HTMLElement) => gsap.fromTo(image, { scale: 1.08 }, { scale: 1, duration: 9, ease: 'none' });
  drift(paintings[0]);
  setInterval(() => {
    const next = (current + 1) % paintings.length;
    gsap.to(paintings[current], { opacity: 0, duration: 1.6, ease: 'power1.inOut' });
    gsap.to(paintings[next], { opacity: 1, duration: 1.6, ease: 'power1.inOut' });
    drift(paintings[next]);
    current = next;
  }, 8000);

  // The cover sinks a little slower than the page as you leave it.
  gsap.to('.cover__painting', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.cover', start: 'top top', end: 'bottom top', scrub: true } });
}

const heart = $('.cover__heart');
heart.addEventListener('click', (event) => {
  weather.burst(event.clientX, event.clientY);
  gsap.fromTo(heart, { scale: 0.8 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
});
heart.style.cursor = 'pointer';
gsap.to(heart, { scale: 1.08, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });

/* ------------------------------------------------------------------------------------------------
 * Navigation: a plaque hanging from the cover. It docks by itself (position: sticky); scrolling only
 * pulls its cords in. The lantern slides behind whichever page you choose.
 * ---------------------------------------------------------------------------------------------- */

const board = $('.plaque__board');
const lantern = $('.plaque__lantern');
const links = $$<HTMLAnchorElement>('[data-nav]');

function moveLantern(link: HTMLElement, instant = false) {
  const boardRect = board.getBoundingClientRect();
  const rect = link.getBoundingClientRect();
  gsap.to(lantern, {
    x: rect.left - boardRect.left,
    width: rect.width,
    duration: instant || reduced ? 0 : 0.6,
    ease: 'elastic.out(1, 0.75)'
  });
  links.forEach((item) => {
    item.classList.toggle('is-active', item === link);
    item.toggleAttribute('aria-current', item === link);
  });
}

links.forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); moveLantern(link); }));
document.fonts.ready.then(() => moveLantern(links.find((link) => link.classList.contains('is-active'))!, true));
window.addEventListener('resize', () => moveLantern(links.find((link) => link.classList.contains('is-active'))!, true));

gsap.to('.plaque__string', {
  scaleY: 0,
  ease: 'none',
  scrollTrigger: { trigger: '.cover', start: 'bottom 160px', end: 'bottom 40px', scrub: true }
});
gsap.to(board, {
  scale: 0.92,
  ease: 'none',
  scrollTrigger: { trigger: '.cover', start: 'bottom 160px', end: 'bottom 40px', scrub: true }
});
// Over the painting the brand is light; once the paper takes over it turns to ink.
ScrollTrigger.create({
  trigger: '.cover',
  start: 'bottom 64px',
  end: 'max',
  onToggle: (self) => document.body.classList.toggle('is-past-cover', self.isActive)
});

/* ------------------------------------------------------------------------------------------------
 * Days: lanterns are hung along the cord and light up one by one as the count climbs to today.
 * ---------------------------------------------------------------------------------------------- */

const cord = $<SVGPathElement>('.days__cord');
const lanternList = $('.days__lanterns');
const LANTERNS = 11;
function hangLanterns() {
  lanternList.innerHTML = '';
  const length = cord.getTotalLength();
  for (let i = 0; i < LANTERNS; i++) {
    const point = cord.getPointAtLength((length * (i + 0.5)) / LANTERNS);
    const item = document.createElement('li');
    item.className = `lantern${i % 3 === 1 ? ' is-sakura' : ''}`;
    item.style.left = `${(point.x / 1200) * 100}%`;
    item.style.top = `${point.y + 14}px`;
    item.innerHTML = '<span class="lantern__glow"></span><span class="lantern__body"></span>';
    lanternList.appendChild(item);
  }
}
hangLanterns();

const lanterns = $$('.lantern');
const number = $('.days__number');
const target = Number(number.textContent);
const counter = { value: reduced ? target : 0 };
number.textContent = String(counter.value);

if (!reduced) {
  lanterns.forEach((item, i) => {
    gsap.to(item, { rotation: i % 2 ? 4 : -4, duration: 2.4 + (i % 4) * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.2 });
  });
  gsap.from('.days__cord', { drawSVG: '0%', duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: '.days', start: 'top 85%' } });
  gsap.from(lanterns, { y: -60, autoAlpha: 0, duration: 1, ease: settle, stagger: 0.06, scrollTrigger: { trigger: '.days', start: 'top 80%' } });

  const lighting = gsap.timeline({
    scrollTrigger: { trigger: '.days', start: 'top 75%', end: 'top 15%', scrub: 0.6 }
  });
  lighting
    .to(counter, {
      value: target,
      ease: 'power1.out',
      duration: 1,
      onUpdate: () => {
        number.textContent = String(Math.round(counter.value));
      }
    }, 0)
    .to(lanterns.map((item) => item.querySelector('.lantern__glow')), { opacity: 1, duration: 0.12, stagger: 0.08 }, 0)
    .to(number, { textShadow: '0 0 38px rgba(246, 180, 92, 0.55)', duration: 0.3 }, 0.7);

  gsap.from('.days__lead, .days__quote', { y: 30, autoAlpha: 0, duration: 1, ease: settle, stagger: 0.15, scrollTrigger: { trigger: '.days', start: 'top 65%' } });
  gsap.from('.days__tag', { rotation: -30, y: -30, autoAlpha: 0, duration: 1.4, ease: 'elastic.out(1, 0.45)', scrollTrigger: { trigger: '.days__tag', start: 'top 90%' } });
}

/* ------------------------------------------------------------------------------------------------
 * The sky darkens from snow-light to dusk to lantern-light as you read down the page.
 * ---------------------------------------------------------------------------------------------- */

if (!reduced) {
  gsap.to('.sky__wash--dusk', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '.today', start: 'top bottom', end: 'bottom center', scrub: true } });
  gsap.to('.sky__wash--night', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '.recent', start: 'center center', end: () => `+=${window.innerHeight * 0.9}`, scrub: true } });
} else {
  gsap.set('.sky__wash--dusk', { opacity: 1 });
}

/* ------------------------------------------------------------------------------------------------
 * Today: the shoji doors of both windows slide open, then the red thread draws between them.
 * ---------------------------------------------------------------------------------------------- */

if (!reduced) {
  const opening = gsap.timeline({ scrollTrigger: { trigger: '.today__windows', start: 'top 72%' } });
  opening
    .to('.window__shoji--l', { xPercent: -104, duration: 1.2, ease: 'power3.inOut', stagger: 0.25 }, 0)
    .to('.window__shoji--r', { xPercent: 104, duration: 1.2, ease: 'power3.inOut', stagger: 0.25 }, 0)
    .from('.window__avatar', { scale: 0.6, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.25 }, 0.6)
    .from('.thread__line', { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' }, 0.9)
    .from('.thread__km', { y: 14, autoAlpha: 0, duration: 0.6, ease: settle }, 1.8);

  gsap.from('.letter', {
    rotationX: -75,
    y: 40,
    autoAlpha: 0,
    transformPerspective: 900,
    duration: 1.3,
    ease: settle,
    scrollTrigger: { trigger: '.letter', start: 'top 85%' }
  });
  gsap.from('.letter__petal', { y: -120, x: -60, rotation: -200, autoAlpha: 0, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: '.letter', start: 'top 80%' } });
}

/* ------------------------------------------------------------------------------------------------
 * Recent: the photos fall onto the table in a fan and open out when the pointer comes near.
 * ---------------------------------------------------------------------------------------------- */

const photos = $$('.polaroid');
const fan = [
  { x: -46, y: 18, rotation: -11 },
  { x: 40, y: 8, rotation: 9 },
  { x: 0, y: 0, rotation: -2 }
];
const spread = [
  { x: -120, y: 30, rotation: -16 },
  { x: 118, y: 22, rotation: 15 },
  { x: 0, y: -18, rotation: 0 }
];
gsap.set(photos, { x: (i) => fan[i].x, y: (i) => fan[i].y, rotation: (i) => fan[i].rotation });
if (!reduced) {
  gsap.from(photos, { y: -220, rotation: (i) => fan[i].rotation * 3, autoAlpha: 0, duration: 1.2, ease: settle, stagger: 0.14, scrollTrigger: { trigger: '.recent', start: 'top 70%' } });
  gsap.from('.notebook, .omikuji', { y: 60, autoAlpha: 0, duration: 1.1, ease: settle, stagger: 0.15, scrollTrigger: { trigger: '.recent', start: 'top 72%' } });
  const album = $('.polaroids');
  album.addEventListener('pointerenter', () => gsap.to(photos, { x: (i) => spread[i].x, y: (i) => spread[i].y, rotation: (i) => spread[i].rotation, duration: 0.7, ease: 'elastic.out(1, 0.7)', overwrite: 'auto' }));
  album.addEventListener('pointerleave', () => gsap.to(photos, { x: (i) => fan[i].x, y: (i) => fan[i].y, rotation: (i) => fan[i].rotation, duration: 0.7, ease: settle, overwrite: 'auto' }));
}

/* ------------------------------------------------------------------------------------------------
 * Next: the wish plaque sways on its cord; touching it gives it a push before it opens the list.
 * ---------------------------------------------------------------------------------------------- */

const ema = $('.ema');
if (!reduced) {
  gsap.to(ema, { rotation: 2.5, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.from(ema, { y: -200, duration: 1.6, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: '.next', start: 'top 75%' } });
}
ema.addEventListener('click', (event) => {
  event.preventDefault();
  const rect = ema.getBoundingClientRect();
  weather.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.6);
  gsap.fromTo(ema, { rotation: -18 }, { rotation: 0, duration: 2, ease: 'elastic.out(1, 0.25)' });
});

// The prototype only demonstrates the links; it does not navigate anywhere.
$$<HTMLAnchorElement>('.notebook, .omikuji, .polaroids').forEach((link) => link.addEventListener('click', (event) => event.preventDefault()));
