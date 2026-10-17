import { ref, type Ref } from 'vue';
import type {
  MessageDraft,
  MessageEntry
} from '../model';
import { createHttpMessageGateway } from './httpMessageGateway';
import type { MessageGateway } from './ports';

const PAGE_SIZE = 20;

export interface MessageLifecycleState {
  messages: Readonly<Ref<MessageEntry[]>>;
  loading: Readonly<Ref<boolean>>;
  submitting: Readonly<Ref<boolean>>;
  deletingId: Readonly<Ref<number | null>>;
  selectedMessage: Readonly<Ref<MessageEntry | null>>;
  composerResetSignal: Readonly<Ref<number>>;
  loadError: Readonly<Ref<string>>;
  submitError: Readonly<Ref<string>>;
  deleteError: Readonly<Ref<string>>;
}

export interface MessageLifecycle {
  state: MessageLifecycleState;
  loadMessages(): Promise<boolean>;
  submitMessage(draft: MessageDraft): Promise<MessageEntry | null>;
  selectMessage(message: MessageEntry): void;
  clearSelection(): void;
  deleteMessage(message: MessageEntry): Promise<boolean>;
}

export interface MessageLifecycleOptions {
  gateway?: MessageGateway;
}

export function useMessageLifecycle({
  gateway: providedGateway
}: MessageLifecycleOptions = {}): MessageLifecycle {
  const gateway = providedGateway ?? createHttpMessageGateway();
  const messages = ref<MessageEntry[]>([]);
  const loading = ref(true);
  const submitting = ref(false);
  const deletingId = ref<number | null>(null);
  const selectedMessage = ref<MessageEntry | null>(null);
  const composerResetSignal = ref(0);
  const loadError = ref('');
  const submitError = ref('');
  const deleteError = ref('');
  let loadIntent = 0;

  async function loadMessages(): Promise<boolean> {
    const intent = ++loadIntent;
    loading.value = true;
    loadError.value = '';

    try {
      const page = await gateway.fetchPage({
        page: 1,
        size: PAGE_SIZE
      });
      if (intent !== loadIntent) {
        return false;
      }
      messages.value = page.items.slice(0, PAGE_SIZE);
      synchronizeSelection();
      return true;
    } catch (error) {
      if (intent === loadIntent) {
        loadError.value = errorMessage(
          error,
          '留言加载失败'
        );
      }
      return false;
    } finally {
      if (intent === loadIntent) {
        loading.value = false;
      }
    }
  }

  async function submitMessage(
    draft: MessageDraft
  ): Promise<MessageEntry | null> {
    if (submitting.value) {
      return null;
    }

    submitError.value = '';
    const content = draft.content.trim();
    if (!content) {
      submitError.value = '先写一点想说的话';
      return null;
    }

    submitting.value = true;
    try {
      const created = await gateway.createMessage(
        { content },
        draft.imageFile ?? null
      );
      messages.value = [created, ...messages.value]
        .slice(0, PAGE_SIZE);
      composerResetSignal.value += 1;
      return created;
    } catch (error) {
      submitError.value = errorMessage(error, '发布失败');
      return null;
    } finally {
      submitting.value = false;
    }
  }

  function selectMessage(message: MessageEntry): void {
    deleteError.value = '';
    selectedMessage.value = message;
  }

  function clearSelection(): void {
    selectedMessage.value = null;
  }

  async function deleteMessage(
    message: MessageEntry
  ): Promise<boolean> {
    if (deletingId.value !== null) {
      return false;
    }

    deleteError.value = '';
    deletingId.value = message.id;
    try {
      await gateway.deleteMessage(message.id);
      messages.value = messages.value.filter(
        ({ id }) => id !== message.id
      );
      if (selectedMessage.value?.id === message.id) {
        selectedMessage.value = null;
      }
      return true;
    } catch (error) {
      deleteError.value = errorMessage(error, '删除失败');
      return false;
    } finally {
      deletingId.value = null;
    }
  }

  function synchronizeSelection(): void {
    if (!selectedMessage.value) {
      return;
    }
    selectedMessage.value =
      messages.value.find(
        ({ id }) => id === selectedMessage.value?.id
      ) ?? null;
  }

  return {
    state: {
      messages,
      loading,
      submitting,
      deletingId,
      selectedMessage,
      composerResetSignal,
      loadError,
      submitError,
      deleteError
    },
    loadMessages,
    submitMessage,
    selectMessage,
    clearSelection,
    deleteMessage
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
