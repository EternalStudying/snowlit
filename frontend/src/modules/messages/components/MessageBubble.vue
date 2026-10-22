<template>
  <div
    class="bubble-wrapper"
    :class="{
      'is-paused': paused,
      'is-static': duration === 0,
      'is-hovered': hovered
    }"
    :style="{
      '--x': x + '%',
      '--y': y + '%',
      '--size': size + 'px',
      '--duration': duration + 's',
      '--delay': delay + 's'
    }"
    :data-message-bubble-wrapper="message.id"
  >
    <button
      class="bubble-content"
      :class="{
        'is-hovered': hovered,
        'is-dimmed': dimmed,
        'is-bursting': bursting
      }"
      type="button"
      :data-message-bubble="message.id"
      @mouseenter="$emit('hover', message.id)"
      @mouseleave="$emit('hover', null)"
      @click="handleBurst"
    >
      <div class="bubble-inner">
        <div v-if="message.imageUrl" class="attachment-mark" data-message-attachment>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </div>

        <div class="message-text">{{ message.content }}</div>

        <div class="meta-info">
          <span class="author">{{ message.authorName }}</span>
          <time :datetime="message.createdAt">{{ formatBubbleTime(message.createdAt) }}</time>
        </div>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FloatingMessage } from '../internal/useMessageBubbleLayout';

const props = defineProps<{
  message: FloatingMessage;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  hovered: boolean;
  dimmed: boolean;
  paused: boolean;
  bursting: boolean;
}>();

const emit = defineEmits<{
  (e: 'hover', id: number | null): void;
  (e: 'burst', message: FloatingMessage): void;
}>();

const handleBurst = () => {
  if (props.bursting) return;
  emit('burst', props.message);
};

const formatBubbleTime = (dateStr: string) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};
</script>

<style scoped>
.bubble-wrapper {
  position: absolute;
  left: var(--x);
  bottom: -30%;
  width: var(--size);
  height: var(--size);
  animation: float-up var(--duration) linear var(--delay) infinite;
  z-index: 1;
}

.bubble-wrapper.is-hovered {
  z-index: 10;
}

.bubble-wrapper.is-static {
  bottom: var(--y);
  animation: none;
}

.bubble-wrapper.is-paused {
  animation-play-state: paused;
}

.bubble-content {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05), inset 0 0 20px rgba(255, 255, 255, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  box-sizing: border-box;
  animation: drift 5s ease-in-out infinite alternate;
  transition:
    transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    opacity 0.4s ease,
    filter 0.4s ease,
    background 0.3s ease;
}

.bubble-content.is-hovered {
  transform: scale(1.15);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  animation-play-state: paused;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
}

.bubble-content.is-dimmed {
  opacity: 0.3;
  filter: blur(3px);
  transform: scale(0.95);
}

.bubble-content.is-bursting {
  transform: scale(1.6);
  opacity: 0;
  filter: blur(15px);
  pointer-events: none;
}

.bubble-inner {
  width: 100%;
  text-align: center;
  position: relative;
  color: var(--ink-soft);
}

.message-text {
  font-size: 14px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  margin-bottom: 8px;
}

.meta-info {
  display: grid;
  gap: 2px;
  font-size: 11px;
  color: var(--ink-faint);
  opacity: 0.8;
}

.author {
  color: var(--ink-soft);
  font-weight: 700;
}

.attachment-mark {
  position: absolute;
  top: -12px;
  right: -6px;
  color: var(--frost);
}

.attachment-mark svg {
  width: 14px;
  height: 14px;
}

@keyframes float-up {
  0% {
    transform: translateY(0);
  }

  100% {
    transform: translateY(-150vh);
  }
}

@keyframes drift {
  0% {
    transform: translateX(-15px) rotate(-3deg);
  }

  100% {
    transform: translateX(15px) rotate(3deg);
  }
}
</style>
