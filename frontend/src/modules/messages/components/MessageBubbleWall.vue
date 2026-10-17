<template>
  <div class="wall-container" data-message-bubble-wall>
    <div class="wall-controls">
      <button class="toggle-btn" type="button" data-message-float-toggle @click="togglePause">
        <svg v-if="isGlobalPaused" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        {{ isGlobalPaused ? '继续漂浮' : '暂停漂浮' }}
      </button>
    </div>

    <div class="bubbles-area">
      <div v-if="!messages.length" class="empty-bubble-state">
        <p>还没有留言气泡</p>
        <span>先写第一句，让它慢慢漂起来。</span>
      </div>

      <MessageBubble
        v-for="msg in floatingMessages"
        :key="msg.id"
        :message="msg"
        :x="msg.x"
        :y="msg.y"
        :size="msg.size"
        :duration="msg.duration"
        :delay="msg.delay"
        :paused="isGlobalPaused || hoveredId === msg.id"
        :hovered="hoveredId === msg.id"
        :dimmed="hoveredId !== null && hoveredId !== msg.id"
        :bursting="burstingId === msg.id"
        @hover="setHovered"
        @burst="handleBurst"
      />
    </div>

    <div class="composer-wrapper">
      <MessageComposer
        :submitting="submitting"
        :submit-error="submitError"
        :reset-signal="composerResetSignal"
        @submit="forwardSubmit"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import type {
  MessageDraft,
  MessageEntry
} from '../model';
import {
  useMessageBubbleLayout,
  type FloatingMessage
} from '../internal/useMessageBubbleLayout';
import MessageBubble from './MessageBubble.vue';
import MessageComposer from './MessageComposer.vue';

const props = defineProps<{
  messages: MessageEntry[];
  submitting?: boolean;
  submitError?: string;
  composerResetSignal?: number;
}>();

const emit = defineEmits<{
  (e: 'open', message: MessageEntry): void;
  (e: 'submit', draft: MessageDraft): void;
}>();

const messagesRef = toRef(props, 'messages');
const {
  floatingMessages,
  isGlobalPaused,
  hoveredId,
  burstingId,
  togglePause,
  setHovered
} = useMessageBubbleLayout(messagesRef);

const forwardSubmit = (draft: MessageDraft) => {
  emit('submit', draft);
};

const handleBurst = (message: FloatingMessage) => {
  if (burstingId.value !== null) return;

  burstingId.value = message.id;

  setTimeout(() => {
    emit('open', message);
    burstingId.value = null;
  }, 400);
};
</script>

<style scoped>
.wall-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: transparent;
  display: flex;
  flex-direction: column;
}

.wall-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 20;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.7);
  color: #333;
}

.toggle-btn svg {
  width: 14px;
  height: 14px;
}

.bubbles-area {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  overflow: hidden;
  pointer-events: none;
}

.bubbles-area :deep(.bubble-content) {
  pointer-events: auto;
}

.empty-bubble-state {
  position: absolute;
  top: 34%;
  left: 50%;
  z-index: 2;
  text-align: center;
  color: rgba(82, 68, 60, 0.72);
  transform: translate(-50%, -50%);
}

.empty-bubble-state p {
  margin: 0;
  color: #5a4c45;
  font-size: 20px;
  font-weight: 700;
}

.empty-bubble-state span {
  display: block;
  margin-top: 8px;
  font-size: 13px;
}

.composer-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 30;
}
</style>
