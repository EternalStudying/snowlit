<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open && message" class="modal-backdrop" data-message-detail-modal @click.self="close">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-meta">
              <span class="author-name">{{ message.authorName }}</span>
              <span class="created-at">{{ formatDate(message.createdAt) }}</span>
            </div>
            <button class="close-btn" type="button" data-message-detail-close @click="close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="modal-body">
            <p class="full-message">{{ message.content }}</p>

            <figure v-if="message.imageUrl" class="detail-image-frame">
              <img
                class="detail-image"
                data-message-detail-image
                :src="message.imageUrl"
                :alt="`${message.authorName} 的留言图片`"
              />
            </figure>

            <p v-if="deleteError" class="modal-error">{{ deleteError }}</p>
          </div>

          <div v-if="message.canDelete" class="modal-footer">
            <button class="delete-btn" type="button" data-message-detail-delete :disabled="deleting" @click="handleDelete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              {{ deleting ? '删除中...' : '删除这条留言' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { MessageEntry } from '../model';

const props = defineProps<{
  open: boolean;
  message: MessageEntry | null;
  deleting?: boolean;
  deleteError?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'delete', message: MessageEntry): void;
}>();

const close = () => {
  emit('close');
};

const handleDelete = () => {
  if (props.message) {
    emit('delete', props.message);
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-card {
  background: rgba(255, 255, 255, 0.9);
  width: 90%;
  max-width: 500px;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
}

.modal-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.author-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.created-at {
  font-size: 12px;
  color: #999;
}

.close-btn {
  background: rgba(0, 0, 0, 0.03);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #333;
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 0 24px 32px;
}

.full-message {
  font-size: 15px;
  line-height: 1.8;
  color: #444;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.detail-image-frame {
  margin: 20px 0 0;
  padding: 8px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(210, 198, 188, 0.7);
  border-radius: 16px;
}

.detail-image {
  display: block;
  width: 100%;
  max-height: min(48vh, 420px);
  object-fit: contain;
  border-radius: 12px;
  background: rgba(245, 239, 234, 0.86);
}

.modal-error {
  margin: 18px 0 0;
  color: #b65f5a;
  font-size: 13px;
}

.modal-footer {
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.02);
  border-top: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  justify-content: flex-end;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #ff6b6b;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.delete-btn:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.1);
}

.delete-btn:disabled {
  opacity: 0.55;
  cursor: progress;
}

.delete-btn svg {
  width: 16px;
  height: 16px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
  transform: scale(0.9) translateY(20px);
}
</style>
