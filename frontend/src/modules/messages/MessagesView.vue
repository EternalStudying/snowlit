<script setup lang="ts">
import './messages.css';
import { onMounted } from 'vue';
import { NAlert, NButton, NSpin } from 'naive-ui';
import MessageBubbleWall from './components/MessageBubbleWall.vue';
import MessageDetailModal from './components/MessageDetailModal.vue';
import { useMessageLifecycle } from './internal/useMessageLifecycle';

const lifecycle = useMessageLifecycle();
const {
  messages,
  loading,
  submitting,
  deletingId,
  selectedMessage,
  composerResetSignal,
  loadError,
  submitError,
  deleteError
} = lifecycle.state;
const {
  loadMessages,
  submitMessage,
  selectMessage,
  clearSelection,
  deleteMessage
} = lifecycle;

onMounted(() => {
  loadMessages();
});
</script>

<template>
  <main class="messages-page" data-page="messages">
    <section class="messages-stage" aria-label="气泡漂流留言墙">
      <div v-if="loading" class="message-state message-state--floating">
        <NSpin size="small" />
        <span>正在打捞漂浮留言...</span>
      </div>
      <div v-else-if="loadError" class="message-state message-state--error">
        <NAlert type="error" :show-icon="false">{{ loadError || '留言加载失败' }}</NAlert>
        <NButton data-message-retry secondary @click="loadMessages">重新加载</NButton>
      </div>
      <template v-else>
        <NAlert v-if="deleteError" class="message-form-error" type="error" :show-icon="false">
          {{ deleteError }}
        </NAlert>
        <MessageBubbleWall
          :messages="messages"
          :submitting="submitting"
          :submit-error="submitError"
          :composer-reset-signal="composerResetSignal"
          @submit="submitMessage"
          @open="selectMessage"
        />
      </template>
    </section>

    <MessageDetailModal
      :open="!!selectedMessage"
      :message="selectedMessage"
      :deleting="selectedMessage ? deletingId === selectedMessage.id : false"
      :delete-error="deleteError"
      @close="clearSelection"
      @delete="deleteMessage"
    />
  </main>
</template>
