<template>
  <div class="composer-container">
    <div class="composer-box">
      <textarea
        v-model="textDraft"
        placeholder="写下你想说的话..."
        class="input-area"
        rows="1"
        maxlength="500"
        data-message-input
        :disabled="submitting"
      ></textarea>

      <div class="composer-actions">
        <div class="file-action">
          <input
            ref="fileInputRef"
            type="file"
            :accept="IMAGE_ACCEPT"
            class="hidden-input"
            data-message-image-input
            :disabled="submitting"
            @change="handleFileChange"
          />
          <button class="icon-btn" type="button" title="添加图片" :disabled="submitting" @click="triggerFileInput">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>

          <div v-if="fileDraft" class="file-preview-chip" data-message-image-chip>
            <span class="file-name">{{ fileDraft.name }}</span>
            <button class="remove-file-btn" type="button" :disabled="submitting" @click="removeFile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <button
          class="submit-btn"
          type="button"
          data-message-submit
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '发送中...' : '放飞留言' }}
        </button>
      </div>

      <p v-if="submitError || pickError" class="composer-error">{{ submitError || pickError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IMAGE_ACCEPT, pickImages } from '../../../imageFiles';
import { ref, watch } from 'vue';
import type { MessageDraft } from '../model';

const props = defineProps<{
  submitting?: boolean;
  submitError?: string;
  resetSignal?: number;
}>();

const emit = defineEmits<{
  (e: 'submit', draft: MessageDraft): void;
}>();

const textDraft = ref('');
const fileDraft = ref<File | null>(null);
const pickError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.resetSignal,
  () => {
    textDraft.value = '';
    removeFile();
  }
);

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const picked = pickImages(Array.from(target.files ?? []).slice(0, 1));
  pickError.value = picked.rejection;
  if (picked.accepted.length > 0) {
    fileDraft.value = picked.accepted[0];
  } else {
    target.value = '';
  }
};

const removeFile = () => {
  fileDraft.value = null;
  pickError.value = '';
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const submit = () => {
  emit('submit', {
    content: textDraft.value,
    imageFile: fileDraft.value
  });
};
</script>

<style scoped>
.composer-container {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 10px 20px 12px;
  box-sizing: border-box;
}

.composer-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  width: 100%;
  max-width: 780px;
  padding: 12px 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.input-area {
  width: 100%;
  min-height: 40px;
  max-height: 54px;
  border: none;
  background: transparent;
  resize: none;
  font-size: 15px;
  line-height: 1.55;
  color: var(--ink);
  outline: none;
  font-family: inherit;
  margin: 0;
  padding: 8px 0;
}

.input-area::placeholder {
  color: var(--frost);
}

.composer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  min-width: max-content;
}

.file-action {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.hidden-input {
  display: none;
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--ink-faint);
  padding: 6px;
  border-radius: 8px;
  display: flex;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--ink-soft);
}

.icon-btn svg {
  width: 20px;
  height: 20px;
}

.file-preview-chip {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  color: var(--ink-soft);
  border: 1px solid rgba(0, 0, 0, 0.05);
  max-width: 150px;
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 6px;
}

.remove-file-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--ink-faint);
  padding: 0;
  display: flex;
}

.remove-file-btn:hover {
  color: var(--camellia-wash);
}

.remove-file-btn svg {
  width: 14px;
  height: 14px;
}

.submit-btn {
  background: var(--sheet);
  border: 1px solid var(--snow);
  color: var(--ink-faint);
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(var(--ink-rgb), 0.1);
}

.submit-btn:hover:not(:disabled) {
  background: var(--snow);
  border-color: var(--frost);
  transform: translateY(-1px);
}

.submit-btn:disabled,
.icon-btn:disabled,
.remove-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.composer-error {
  grid-column: 1 / -1;
  margin: 10px 0 0;
  color: var(--camellia);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 760px) {
  .composer-box {
    grid-template-columns: 1fr;
  }

  .composer-actions {
    min-width: 0;
  }
}
</style>
