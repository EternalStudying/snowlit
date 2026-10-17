<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';

interface DatePointSnapshot {
  y: number;
}

interface GlowRibbon {
  color: string;
  haloColor: string;
  phase: number;
  radius: number;
  width: number;
  speed: number;
}

interface RibbonEndMarkerPoint {
  x: number;
  y: number;
}

interface GlowPetal {
  x: number;
  documentY: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  age: number;
  life: number;
  sway: number;
  color: string;
}

const props = withDefaults(
  defineProps<{
    timelineElement: HTMLElement | null;
    monthKey: string;
    disabled?: boolean;
  }>(),
  {
    disabled: false
  }
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const reducedMotion = ref(false);

const VIEWPORT_GLOW_END_RATIO = 0.52;
const MAX_RIBBON_RADIUS = 7;
const RIBBON_SCROLL_HOLD_MS = 120;
const RIBBON_CENTER_CHASE_DURATION = 0.46;
const RIBBON_ENTRY_FALLBACK_START_Y = 0;
const RIBBON_ENTRY_CHASE_DURATION = 0.72;
const RIBBON_END_MARKER_RADIUS = 6;
const RIBBON_END_PETAL_MAX_COUNT = 32;
const RIBBON_END_PETAL_MAX_PER_FRAME = 5;
const RIBBON_END_PETAL_TRAIL_SPACING = 8.5;
const RIBBON_END_PETAL_GRAVITY = 28;
const RIBBON_END_PETAL_COLORS = ['#f3a6b4', '#f1bcc4', '#e8ad8a', '#efcf91'];

const ribbons: GlowRibbon[] = [
  {
    color: 'rgba(248, 92, 118, 0.46)',
    haloColor: 'rgba(248, 92, 118, 0.07)',
    phase: 0,
    radius: MAX_RIBBON_RADIUS * 0.52,
    width: 1.4,
    speed: 0.55
  },
  {
    color: 'rgba(235, 168, 54, 0.42)',
    haloColor: 'rgba(235, 168, 54, 0.06)',
    phase: 84,
    radius: MAX_RIBBON_RADIUS * 0.78,
    width: 1.3,
    speed: 0.42
  },
  {
    color: 'rgba(78, 180, 129, 0.4)',
    haloColor: 'rgba(78, 180, 129, 0.06)',
    phase: 158,
    radius: MAX_RIBBON_RADIUS * 0.64,
    width: 1.25,
    speed: 0.48
  },
  {
    color: 'rgba(77, 160, 223, 0.38)',
    haloColor: 'rgba(77, 160, 223, 0.06)',
    phase: 236,
    radius: MAX_RIBBON_RADIUS,
    width: 1.2,
    speed: 0.38
  },
  {
    color: 'rgba(157, 113, 216, 0.36)',
    haloColor: 'rgba(157, 113, 216, 0.05)',
    phase: 312,
    radius: MAX_RIBBON_RADIUS * 0.72,
    width: 1.15,
    speed: 0.5
  }
];

let canvasWidth = 0;
let canvasHeight = 0;
let context: CanvasRenderingContext2D | null = null;
let datePoints: DatePointSnapshot[] = [];
let lineX = 0;
let lineTop = 0;
let lineBottom = 0;
let scrollY = 0;
let scrollVelocity = 0;
let flowDirection = 1;
let flowOffset = 0;
let ribbonEndDocumentY = 0;
let ribbonEndInitialized = false;
let ribbonEntranceActive = true;
let lastRibbonEndMarkerY = 0;
let ribbonEndPetalCarry = 0;
let ribbonEndPetalSeed = 0;
let ribbonEndPetals: GlowPetal[] = [];
let canvasAlpha = 0;
let lastTime = 0;
let lastScrollAt = 0;
let tickerActive = false;
let resizeObserver: ResizeObserver | null = null;
let mediaQuery: MediaQueryList | null = null;
let mediaQueryListener: (() => void) | null = null;
let measureFrame = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getViewportGlowEndY() {
  return canvasHeight * VIEWPORT_GLOW_END_RATIO;
}

function getTargetRibbonEndDocumentY() {
  const viewportTargetDocumentY = scrollY + getViewportGlowEndY();

  return Math.max(viewportTargetDocumentY, getRibbonEntryStartDocumentY());
}

function resetRibbonEndPetalAnchor() {
  lastRibbonEndMarkerY = 0;
  ribbonEndPetalCarry = 0;
}

function getRibbonEntryStartDocumentY() {
  const firstTimelinePointY = datePoints[0]?.y ?? lineTop;

  if (Number.isFinite(firstTimelinePointY) && firstTimelinePointY > 0) {
    return firstTimelinePointY;
  }

  return scrollY + RIBBON_ENTRY_FALLBACK_START_Y;
}

function initializeRibbonEndAtFirstDatePoint() {
  ribbonEndDocumentY = getRibbonEntryStartDocumentY();
  ribbonEndInitialized = true;
  ribbonEntranceActive = true;
  resetRibbonEndPetalAnchor();
}

function syncRibbonEndToCenter() {
  ribbonEndDocumentY = getTargetRibbonEndDocumentY();
  ribbonEndInitialized = true;
  ribbonEntranceActive = false;
  resetRibbonEndPetalAnchor();
}

function ensureRibbonEndInitialized() {
  if (!ribbonEndInitialized) {
    if (!datePoints.length && lineTop <= 0) {
      return false;
    }

    initializeRibbonEndAtFirstDatePoint();
  }

  return true;
}

function isScrollHoldActive(nowMs: number) {
  return lastScrollAt > 0 && nowMs - lastScrollAt < RIBBON_SCROLL_HOLD_MS;
}

function updateRibbonEndPosition(delta: number, nowMs: number) {
  if (!ensureRibbonEndInitialized()) {
    return;
  }

  if (isScrollHoldActive(nowMs)) {
    return;
  }

  const targetDocumentEndY = getTargetRibbonEndDocumentY();
  const chaseDuration = ribbonEntranceActive ? RIBBON_ENTRY_CHASE_DURATION : RIBBON_CENTER_CHASE_DURATION;
  const chase = clamp(1 - Math.pow(0.001, delta / chaseDuration), 0, 1);
  ribbonEndDocumentY += (targetDocumentEndY - ribbonEndDocumentY) * chase;

  if (Math.abs(targetDocumentEndY - ribbonEndDocumentY) < 0.5) {
    ribbonEndDocumentY = targetDocumentEndY;
  }
}

function getRibbonEndCanvasY() {
  if (!ensureRibbonEndInitialized()) {
    return lineTop - scrollY;
  }

  return ribbonEndDocumentY - scrollY;
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas || typeof window === 'undefined') {
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;
  canvas.width = Math.max(1, Math.floor(canvasWidth * pixelRatio));
  canvas.height = Math.max(1, Math.floor(canvasHeight * pixelRatio));
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  context = getCanvasContext(canvas);

  if (context) {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  if (ribbonEndInitialized) {
    syncRibbonEndToCenter();
  }
}

function clearCanvas() {
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvasWidth, canvasHeight);
}

function measureTimeline() {
  if (typeof window === 'undefined' || !props.timelineElement) {
    datePoints = [];
    lineX = canvasWidth / 2;
    lineTop = 0;
    lineBottom = canvasHeight;
    return;
  }

  const timelineRect = props.timelineElement.getBoundingClientRect();
  const documentScrollY = window.scrollY || window.pageYOffset || 0;

  lineX = timelineRect.left + timelineRect.width / 2;
  lineBottom = timelineRect.bottom + documentScrollY - 28;

  datePoints = Array.from(props.timelineElement.querySelectorAll('.diary-date-point'))
    .filter((point): point is HTMLElement => point instanceof HTMLElement)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        y: rect.top + documentScrollY + rect.height / 2
      };
    });

  const firstDatePoint = datePoints[0];
  lineTop = firstDatePoint ? firstDatePoint.y : timelineRect.top + documentScrollY;

  if (!ribbonEndInitialized) {
    initializeRibbonEndAtFirstDatePoint();
  }
}

function scheduleMeasure() {
  if (typeof window === 'undefined') {
    return;
  }

  if (measureFrame) {
    window.cancelAnimationFrame(measureFrame);
  }

  measureFrame = window.requestAnimationFrame(() => {
    measureFrame = 0;
    measureTimeline();
  });
}

function getRibbonVisibleRange() {
  if (!ensureRibbonEndInitialized()) {
    return {
      top: 0,
      bottom: 0,
      endY: 0,
      visible: false
    };
  }

  const canvasMinY = -80;
  const canvasMaxY = canvasHeight + 80;
  const lineLimitY = Math.min(lineBottom - scrollY + 24, canvasMaxY);
  const lineStartY = clamp(lineTop - scrollY, canvasMinY, lineLimitY);
  const ribbonEndY = clamp(getRibbonEndCanvasY(), lineStartY, lineLimitY);
  const visibleTop = lineStartY;
  const visibleBottom = ribbonEndY;

  return {
    top: visibleTop,
    bottom: visibleBottom,
    endY: ribbonEndY,
    visible: visibleBottom > visibleTop + 12
  };
}

function traceRibbonPath(
  ctx: CanvasRenderingContext2D,
  ribbon: GlowRibbon,
  time: number
) {
  const visibleRange = getRibbonVisibleRange();

  if (!visibleRange.visible) {
    return false;
  }

  ctx.beginPath();

  let hasPoint = false;

  for (let y = visibleRange.top; y <= visibleRange.bottom; y += 12) {
    const travelingY = y - flowOffset * 64;
    const ribbonWave = travelingY * 0.02 + ribbon.phase * 0.03 + time * ribbon.speed;
    const x = lineX + Math.sin(ribbonWave) * ribbon.radius + Math.sin(ribbonWave * 0.43) * 1.8;

    if (!hasPoint) {
      ctx.moveTo(x, y);
      hasPoint = true;
    } else {
      ctx.lineTo(x, y);
    }
  }

  return hasPoint;
}

function drawRibbon(ribbon: GlowRibbon, time: number) {
  if (!context) {
    return;
  }

  const ctx = context;

  if (!traceRibbonPath(ctx, ribbon, time)) {
    return;
  }

  ctx.strokeStyle = ribbon.haloColor;
  ctx.lineWidth = ribbon.width + 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 9;
  ctx.shadowColor = ribbon.color;
  ctx.stroke();

  traceRibbonPath(ctx, ribbon, time);
  ctx.strokeStyle = ribbon.color;
  ctx.lineWidth = ribbon.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 5;
  ctx.shadowColor = ribbon.color;
  ctx.stroke();
}

function getRibbonEndMarkerPoint(): RibbonEndMarkerPoint | null {
  const visibleRange = getRibbonVisibleRange();

  if (!visibleRange.visible) {
    return null;
  }

  return {
    x: lineX,
    y: visibleRange.endY
  };
}

function seededPetalNoise(offset = 0) {
  const value = Math.sin((ribbonEndPetalSeed + offset) * 12.9898) * 43758.5453;

  return value - Math.floor(value);
}

function createRibbonEndPetal(x: number, canvasY: number, movement: number): GlowPetal {
  ribbonEndPetalSeed += 1;

  const drift = seededPetalNoise(1) - 0.5;
  const inheritedMotion = clamp(movement, -8, 8) * 0.18;

  return {
    x: x + (seededPetalNoise(2) - 0.5) * 9,
    documentY: scrollY + canvasY + seededPetalNoise(3) * 5,
    vx: drift * 20 + inheritedMotion,
    vy: 22 + seededPetalNoise(4) * 18,
    size: 3.9 + seededPetalNoise(5) * 2.4,
    rotation: seededPetalNoise(6) * Math.PI * 2,
    spin: (seededPetalNoise(7) - 0.5) * 4.2,
    age: 0,
    life: 0.82 + seededPetalNoise(8) * 0.38,
    sway: seededPetalNoise(9) * Math.PI * 2,
    color: RIBBON_END_PETAL_COLORS[ribbonEndPetalSeed % RIBBON_END_PETAL_COLORS.length]
  };
}

function addRibbonEndPetal(petal: GlowPetal) {
  if (ribbonEndPetals.length >= RIBBON_END_PETAL_MAX_COUNT) {
    ribbonEndPetals.shift();
  }

  ribbonEndPetals.push(petal);
}

function syncRibbonEndPetals(x: number, y: number, suspended: boolean) {
  if (!lastRibbonEndMarkerY || suspended) {
    lastRibbonEndMarkerY = y;
    ribbonEndPetalCarry = 0;
    return;
  }

  const previousMarkerY = lastRibbonEndMarkerY;
  const movement = y - previousMarkerY;
  lastRibbonEndMarkerY = y;

  if (Math.abs(movement) <= 0.18) {
    return;
  }

  ribbonEndPetalCarry += Math.abs(movement) / RIBBON_END_PETAL_TRAIL_SPACING;

  const spawnCount = Math.min(Math.floor(ribbonEndPetalCarry), RIBBON_END_PETAL_MAX_PER_FRAME);

  if (spawnCount <= 0) {
    return;
  }

  for (let index = 0; index < spawnCount; index += 1) {
    const segmentProgress = (index + 0.25 + seededPetalNoise(index + 10) * 0.5) / spawnCount;
    const pathProgress = clamp(segmentProgress, 0.08, 0.94);
    const pathY = previousMarkerY + movement * pathProgress;

    addRibbonEndPetal(createRibbonEndPetal(x, pathY, movement));
  }

  ribbonEndPetalCarry = Math.max(0, ribbonEndPetalCarry - spawnCount);
}

function updateRibbonEndPetals(delta: number) {
  ribbonEndPetals = ribbonEndPetals.filter((petal) => {
    petal.age += delta;
    petal.vy += RIBBON_END_PETAL_GRAVITY * delta;
    petal.x += (petal.vx + Math.sin(petal.age * 7 + petal.sway) * 10) * delta;
    petal.documentY += petal.vy * delta;
    petal.rotation += petal.spin * delta;

    const canvasY = petal.documentY - scrollY;

    return petal.age < petal.life && canvasY > -96 && canvasY < canvasHeight + 48;
  });
}

function drawRibbonEndPetals(ctx: CanvasRenderingContext2D) {
  ribbonEndPetals.forEach((petal) => {
    const progress = clamp(petal.age / petal.life, 0, 1);
    const alpha = Math.sin(progress * Math.PI) * 0.78;
    const width = petal.size * (0.58 + Math.sin(petal.age * 10 + petal.sway) * 0.08);
    const height = petal.size * 1.35;
    const canvasY = petal.documentY - scrollY;

    ctx.save();
    ctx.globalAlpha = Math.min(0.62, ctx.globalAlpha * alpha * 1.05);
    ctx.translate(petal.x, canvasY);
    ctx.rotate(petal.rotation);
    ctx.fillStyle = petal.color;
    ctx.shadowBlur = 4.6;
    ctx.shadowColor = 'rgba(248, 130, 150, 0.26)';
    ctx.beginPath();
    ctx.moveTo(0, -height);
    ctx.bezierCurveTo(width, -height * 0.34, width * 0.62, height * 0.72, 0, height);
    ctx.bezierCurveTo(-width * 0.62, height * 0.72, -width, -height * 0.34, 0, -height);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 249, 236, 0.38)';
    ctx.lineWidth = 0.52;
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.5);
    ctx.quadraticCurveTo(width * 0.12, 0, 0, height * 0.62);
    ctx.stroke();
    ctx.restore();
  });
}

function drawRibbonEndMarker(time: number, marker: RibbonEndMarkerPoint | null) {
  if (!context) {
    return;
  }

  if (!marker) {
    lastRibbonEndMarkerY = 0;
    ribbonEndPetalCarry = 0;
    return;
  }

  const ctx = context;
  const pulse = 0.72 + Math.sin(time * 2.2) * 0.14;
  const radius = RIBBON_END_MARKER_RADIUS + pulse;
  const glow = ctx.createRadialGradient(marker.x, marker.y, 0, marker.x, marker.y, radius * 2.6);

  glow.addColorStop(0, 'rgba(255, 236, 194, 0.46)');
  glow.addColorStop(0.34, 'rgba(248, 92, 118, 0.24)');
  glow.addColorStop(0.7, 'rgba(77, 160, 223, 0.12)');
  glow.addColorStop(1, 'rgba(77, 160, 223, 0)');

  ctx.save();

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(marker.x, marker.y, radius * 2.4, radius * 1.55, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 5;
  ctx.shadowColor = 'rgba(248, 92, 118, 0.34)';
  ctx.strokeStyle = `rgba(248, 124, 142, ${0.34 + pulse * 0.08})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(marker.x - 7.5, marker.y - 1.8);
  ctx.bezierCurveTo(marker.x - 2.4, marker.y + 3.2, marker.x + 2.4, marker.y - 3.2, marker.x + 7.5, marker.y + 1.8);
  ctx.stroke();

  ctx.strokeStyle = `rgba(235, 168, 54, ${0.24 + pulse * 0.06})`;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(marker.x - 5.8, marker.y + 3.8);
  ctx.bezierCurveTo(marker.x - 1.4, marker.y + 0.4, marker.x + 1.8, marker.y + 0.6, marker.x + 5.8, marker.y - 3.8);
  ctx.stroke();
  ctx.restore();
}

function drawGlowFrame(time: number) {
  if (!context) {
    return;
  }

  const delta = lastTime ? clamp(time - lastTime, 0.006, 0.05) : 0.016;
  const nowMs = typeof performance === 'undefined' ? time * 1000 : performance.now();
  const holdingScroll = isScrollHoldActive(nowMs);
  lastTime = time;
  scrollVelocity *= 0.88;
  updateRibbonEndPosition(delta, nowMs);
  updateRibbonEndPetals(delta);

  if (Math.abs(scrollVelocity) > 0.08) {
    flowDirection = scrollVelocity > 0 ? 1 : -1;
  }

  flowOffset += flowDirection * (delta * 0.18 + (holdingScroll ? 0 : Math.min(Math.abs(scrollVelocity), 72) * 0.0009));
  canvasAlpha += ((props.disabled ? 0 : 1) - canvasAlpha) * 0.12;
  clearCanvas();

  if (canvasAlpha < 0.02) {
    return;
  }

  context.save();
  context.globalAlpha = 0.58 * canvasAlpha;
  context.globalCompositeOperation = 'source-over';

  const marker = getRibbonEndMarkerPoint();

  if (marker) {
    syncRibbonEndPetals(marker.x, marker.y, holdingScroll || props.disabled);
  } else {
    lastRibbonEndMarkerY = 0;
    ribbonEndPetalCarry = 0;
  }

  ribbons.forEach((ribbon) => drawRibbon(ribbon, time));
  drawRibbonEndPetals(context);
  drawRibbonEndMarker(time, marker);

  context.restore();
}

function handleScroll() {
  const nextScrollY = window.scrollY || window.pageYOffset || 0;
  scrollVelocity = nextScrollY - scrollY;
  scrollY = nextScrollY;
  ribbonEntranceActive = false;
  lastScrollAt = typeof performance === 'undefined' ? Date.now() : performance.now();
}

function handleResize() {
  resizeCanvas();
  scheduleMeasure();
}

function addTicker() {
  if (tickerActive || reducedMotion.value) {
    return;
  }

  gsap.ticker.add(drawGlowFrame);
  tickerActive = true;
}

function removeTicker() {
  if (!tickerActive) {
    return;
  }

  gsap.ticker.remove(drawGlowFrame);
  tickerActive = false;
}

function syncTicker() {
  if (reducedMotion.value) {
    removeTicker();
    ribbonEndPetals = [];
    clearCanvas();
    return;
  }

  addTicker();
}

function setupReducedMotion() {
  if (typeof window.matchMedia !== 'function') {
    reducedMotion.value = false;
    return;
  }

  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.value = mediaQuery.matches;
  mediaQueryListener = () => {
    reducedMotion.value = Boolean(mediaQuery?.matches);
    syncTicker();
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', mediaQueryListener);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(mediaQueryListener);
  }
}

function observeTimeline(element: HTMLElement | null) {
  resizeObserver?.disconnect();
  resizeObserver = null;

  if (!element || typeof ResizeObserver === 'undefined') {
    return;
  }

  resizeObserver = new ResizeObserver(() => scheduleMeasure());
  resizeObserver.observe(element);
}

watch(
  () => props.timelineElement,
  (element) => {
    observeTimeline(element);
    scheduleMeasure();
  }
);

watch(
  () => props.monthKey,
  () => {
    void nextTick(() => scheduleMeasure());
  }
);

onMounted(() => {
  scrollY = window.scrollY || window.pageYOffset || 0;
  setupReducedMotion();
  resizeCanvas();
  observeTimeline(props.timelineElement);
  measureTimeline();
  scheduleMeasure();
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', handleScroll, { passive: true });
  syncTicker();
});

onBeforeUnmount(() => {
  removeTicker();
  ribbonEndPetals = [];
  resizeObserver?.disconnect();
  resizeObserver = null;

  if (measureFrame) {
    window.cancelAnimationFrame(measureFrame);
  }

  window.removeEventListener('resize', handleResize);
  window.removeEventListener('scroll', handleScroll);

  if (mediaQuery && mediaQueryListener) {
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', mediaQueryListener);
    } else if (typeof mediaQuery.removeListener === 'function') {
      mediaQuery.removeListener(mediaQueryListener);
    }
  }
});
</script>

<template>
  <Teleport to="body">
    <canvas
      ref="canvasRef"
      class="diary-timeline-glow-canvas"
      data-diary-timeline-glow="true"
      :data-glow-disabled="String(disabled)"
      :data-reduced-motion="String(reducedMotion)"
      aria-hidden="true"
    ></canvas>
  </Teleport>
</template>
