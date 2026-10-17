<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

type ParticleKind = 'heart' | 'trail';
type TrailShape = 'heart' | 'dot' | 'spark';

type PointerParticle = {
  id: number;
  kind: ParticleKind;
  shape: TrailShape;
  label: string;
  style: Record<string, string>;
};

const particles = ref<PointerParticle[]>([]);
const enabled = ref(false);

const colors = ['#df5145', '#f28a2e', '#214f3f', '#c78a19'];
const trailShapes: TrailShape[] = ['heart', 'dot', 'spark'];
const trailLimit = 40;
const trailInterval = 36;
let idSeed = 0;
let lastTrailAt = -trailInterval;
let finePointerQuery: MediaQueryList | undefined;
let reducedMotionQuery: MediaQueryList | undefined;
const timers = new Set<ReturnType<typeof setTimeout>>();

const visibleParticles = computed(() => particles.value);

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function updateEnabled() {
  enabled.value = Boolean(finePointerQuery?.matches) && !reducedMotionQuery?.matches;
  if (!enabled.value) {
    particles.value = [];
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  }
}

function removeParticle(id: number) {
  particles.value = particles.value.filter((particle) => particle.id !== id);
}

function scheduleRemoval(id: number, delay: number) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    removeParticle(id);
  }, delay);
  timers.add(timer);
}

function addParticle(particle: Omit<PointerParticle, 'id'>, lifetime: number) {
  const nextParticle = { ...particle, id: idSeed++ };
  particles.value = [...particles.value, nextParticle];
  scheduleRemoval(nextParticle.id, lifetime);
}

function createHeartBurst(event: MouseEvent) {
  if (!enabled.value) return;

  const count = 3 + Math.floor(Math.random() * 3);
  for (let index = 0; index < count; index += 1) {
    addParticle(
      {
        kind: 'heart',
        shape: 'heart',
        label: '♥',
        style: {
          left: `${event.clientX}px`,
          top: `${event.clientY}px`,
          '--pointer-color': pick(colors),
          '--pointer-size': `${randomBetween(14, 22)}px`,
          '--pointer-rotate': `${randomBetween(-26, 26)}deg`,
          '--pointer-dx': `${randomBetween(-26, 26)}px`,
          '--pointer-dy': `${randomBetween(-72, -38)}px`
        }
      },
      860
    );
  }
}

function createTrail(event: MouseEvent) {
  if (!enabled.value) return;

  const now = Date.now();
  if (now - lastTrailAt < trailInterval) return;
  lastTrailAt = now;

  const shape = pick(trailShapes);
  addParticle(
    {
      kind: 'trail',
      shape,
      label: shape === 'spark' ? '✦' : shape === 'heart' ? '♥' : '',
      style: {
        left: `${event.clientX}px`,
        top: `${event.clientY}px`,
        '--pointer-color': pick(colors),
        '--pointer-size': `${randomBetween(7, 13)}px`,
        '--pointer-rotate': `${randomBetween(-35, 35)}deg`
      }
    },
    620
  );

  const trails = particles.value.filter((particle) => particle.kind === 'trail');
  if (trails.length > trailLimit) {
    const removeIds = trails.slice(0, trails.length - trailLimit).map((particle) => particle.id);
    particles.value = particles.value.filter((particle) => !removeIds.includes(particle.id));
  }
}

onMounted(() => {
  finePointerQuery = window.matchMedia?.('(pointer: fine)');
  reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  updateEnabled();

  finePointerQuery?.addEventListener('change', updateEnabled);
  reducedMotionQuery?.addEventListener('change', updateEnabled);
  window.addEventListener('pointerdown', createHeartBurst);
  window.addEventListener('pointermove', createTrail);
});

onUnmounted(() => {
  finePointerQuery?.removeEventListener('change', updateEnabled);
  reducedMotionQuery?.removeEventListener('change', updateEnabled);
  window.removeEventListener('pointerdown', createHeartBurst);
  window.removeEventListener('pointermove', createTrail);
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
});
</script>

<template>
  <div v-if="enabled" class="pointer-effects-layer" aria-hidden="true">
    <span
      v-for="particle in visibleParticles"
      :key="particle.id"
      :class="[
        particle.kind === 'heart' ? 'pointer-heart' : 'pointer-trail',
        particle.kind === 'trail' ? `pointer-trail--${particle.shape}` : ''
      ]"
      :style="particle.style"
    >
      {{ particle.label }}
    </span>
  </div>
</template>
