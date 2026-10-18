import { computed, ref, type Ref } from 'vue';
import { useReducedMotion } from '../../../motion';
import type { MessageEntry } from '../model';

export type BubbleConfig = {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
};

export type FloatingMessage = MessageEntry & BubbleConfig;

type CachedBubbleLayout = Omit<BubbleConfig, 'size'>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function useMessageBubbleLayout(messages: Ref<MessageEntry[]>) {
  const isGlobalPaused = ref(false);
  const hoveredId = ref<number | null>(null);
  const burstingId = ref<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const layoutCache = new Map<number, CachedBubbleLayout>();

  const togglePause = () => {
    isGlobalPaused.value = !isGlobalPaused.value;
  };

  const setHovered = (id: number | null) => {
    hoveredId.value = id;
  };

  const floatingMessages = computed<FloatingMessage[]>(() => {
    const displayMessages = messages.value.slice(0, 20);
    const count = Math.max(displayMessages.length, 1);
    const visibleIds = new Set(displayMessages.map((message) => message.id));

    for (const id of layoutCache.keys()) {
      if (!visibleIds.has(id)) {
        layoutCache.delete(id);
      }
    }

    return displayMessages.map((message, index) => {
      let cachedLayout = layoutCache.get(message.id);
      if (!cachedLayout) {
        const sectionWidth = 100 / count;
        const randomXOffset = randomRange(0.08, 0.82) * sectionWidth;
        cachedLayout = {
          x: clamp(index * sectionWidth + randomXOffset, 4, 88),
          y: randomRange(10, 70),
          duration: randomRange(18, 30),
          delay: -randomRange(0, 25)
        };
        layoutCache.set(message.id, cachedLayout);
      }

      const size = clamp(130 + Math.min(message.content.length, 100) * 0.9, 130, 220);

      return {
        ...message,
        x: cachedLayout.x,
        y: cachedLayout.y,
        size,
        duration: prefersReducedMotion.value ? 0 : cachedLayout.duration,
        delay: prefersReducedMotion.value ? 0 : cachedLayout.delay
      };
    });
  });

  return {
    floatingMessages,
    isGlobalPaused,
    hoveredId,
    burstingId,
    prefersReducedMotion,
    togglePause,
    setHovered
  };
}
