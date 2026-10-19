<script setup lang="ts">
import { formatDottedDate } from '../../../display';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { useMotionSlots } from '../../../motion';
import { STORY_CATEGORY_LABELS, type StoryMoment } from '../model';

const props = defineProps<{
  moments: StoryMoment[];
  selectedId: number | null;
  motionFeedbackId: number | null;
  removingMotionId: number | null;
  reducedMotion: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', id: number): void;
}>();

const sortedMoments = computed(() =>
  [...props.moments].sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())
);

const trackWidth = computed(() => `${Math.max(sortedMoments.value.length * 178, 620)}px`);
const timelineRoot = ref<HTMLElement | null>(null);
const playedNodeIds = new Set<number>();
let timelineContext: gsap.Context | undefined;
let drawTl: gsap.core.Timeline | undefined;
let feedbackTl: gsap.core.Timeline | undefined;
const slots = useMotionSlots<'timelineContext' | 'drawTl' | 'feedbackTl'>();
let hasPlayedInitial = false;

onMounted(() => {
  nextTick(playTimelineMotion);
});

watch(
  () => sortedMoments.value.map((moment) => moment.id).join('|'),
  () => {
    nextTick(playTimelineMotion);
  },
  { flush: 'post' }
);

watch(
  () => [props.selectedId, props.motionFeedbackId, props.removingMotionId, props.reducedMotion] as const,
  () => {
    nextTick(playNodeFeedback);
  },
  { flush: 'post' }
);

function playTimelineMotion() {
  if (!timelineRoot.value) {
    return;
  }
  const root = timelineRoot.value;
  const line = root.querySelector<HTMLElement>('.story-timeline__line');
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.story-timeline__node'));
  if (!line) {
    return;
  }

  slots.stop('drawTl');
  slots.stop('timelineContext');
  timelineContext = slots.hold('timelineContext', gsap.context(() => {
    if (props.reducedMotion) {
      gsap.set([line, ...nodes], { autoAlpha: 1, scale: 1, scaleX: 1, y: 0, clearProps: 'transform,visibility' });
      return;
    }

    if (!hasPlayedInitial) {
      drawTl = slots.hold('drawTl', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }));
      drawTl.addLabel('timelineDraw', 0).fromTo(line, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.52, ease: 'power2.inOut' }, 'timelineDraw');
      if (nodes.length) {
        drawTl.fromTo(
          nodes,
          { autoAlpha: 0, scale: 0.72, y: 6 },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 0.18,
            stagger: { each: 0.035, from: 'start' },
            clearProps: 'transform,visibility'
          },
          'timelineDraw+=0.06'
        );
      }
      nodes.forEach((node) => playedNodeIds.add(Number(node.dataset.storyMotionId)));
      hasPlayedInitial = true;
      return;
    }

    const newNodes = nodes.filter((node) => !playedNodeIds.has(Number(node.dataset.storyMotionId)));
    if (!newNodes.length) {
      gsap.set(line, { scaleX: 1, clearProps: 'visibility' });
      return;
    }
    newNodes.forEach((node) => playedNodeIds.add(Number(node.dataset.storyMotionId)));
    drawTl = slots.hold('drawTl', gsap
      .timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } })
      .fromTo(newNodes, { autoAlpha: 0, scale: 0.55, y: 4 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.26, stagger: { each: 0.035, from: 'start' }, clearProps: 'transform,visibility' }));
  }, root));
}

function playNodeFeedback() {
  slots.stop('feedbackTl');
  if (props.reducedMotion || !timelineRoot.value) {
    return;
  }
  const root = timelineRoot.value;
  feedbackTl = slots.hold('feedbackTl', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }));

  if (props.removingMotionId) {
    const removing = root.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${props.removingMotionId}"]`);
    if (removing) {
      feedbackTl.to(removing, { autoAlpha: 0, scale: 0.72, y: 4, duration: 0.2, ease: 'power2.inOut' }, 0);
    }
  }

  const feedbackId = props.motionFeedbackId ?? props.selectedId;
  if (!feedbackId) {
    return;
  }
  const node = root.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${feedbackId}"]`);
  const dot = node?.querySelector<HTMLElement>('.story-timeline__dot');
  if (!node || !dot) {
    return;
  }
  feedbackTl
    .fromTo(node, { scale: 1 }, { scale: 1.04, duration: 0.12, yoyo: true, repeat: 1, clearProps: 'transform' }, 0)
    .fromTo(dot, { scale: 0.88, autoAlpha: 0.82 }, { scale: 1.16, autoAlpha: 1, duration: 0.22, yoyo: true, repeat: 1, clearProps: 'transform,visibility' }, 0.02);
}
</script>

<template>
  <nav ref="timelineRoot" class="story-timeline story-timeline--motion" aria-label="Memory Lane">
    <div class="story-timeline__title">
      <span>Memory Lane</span>
    </div>
    <div class="story-timeline__scroll">
      <div class="story-timeline__track" :style="{ width: trackWidth }">
        <span class="story-timeline__line" aria-hidden="true" />
        <button
          v-for="(moment, index) in sortedMoments"
          :key="moment.id"
          class="story-timeline__node"
          :class="[
            `story-timeline__node--${moment.category}`,
            { 'is-active': selectedId === moment.id, 'is-motion-feedback': motionFeedbackId === moment.id, 'is-removing': removingMotionId === moment.id }
          ]"
          :style="{ '--story-node-index': index }"
          :data-story-motion-id="moment.id"
          type="button"
          :aria-pressed="selectedId === moment.id"
          :aria-label="`查看点滴：${moment.title}，${formatDottedDate(moment.eventTime)}`"
          @click="emit('select', moment.id)"
        >
          <span class="story-timeline__dot" aria-hidden="true" />
          <span class="story-timeline__date">{{ formatDottedDate(moment.eventTime) }}</span>
          <span class="story-timeline__moment-title">{{ moment.title }}</span>
          <span class="story-timeline__category">{{ STORY_CATEGORY_LABELS[moment.category] }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>
