import type { MessageGateway } from '../../internal/ports';
import type {
  MessageCreateInput,
  MessageEntry
} from '../../model';

export interface MemoryMessageGatewayOptions {
  messages?: MessageEntry[];
  author?: Pick<
    MessageEntry,
    'authorUserId' | 'authorName' | 'canDelete'
  >;
  now?: () => string;
  overrides?: Partial<MessageGateway>;
}

export function createMemoryMessageGateway({
  messages: initialMessages = [],
  author = {
    authorUserId: 1,
    authorName: 'Luna',
    canDelete: true
  },
  now = () => new Date().toISOString(),
  overrides = {}
}: MemoryMessageGatewayOptions = {}): MessageGateway {
  const messages = new Map(
    initialMessages.map((message) => [
      message.id,
      { ...message }
    ])
  );
  let nextId = Math.max(0, ...messages.keys()) + 1;

  return {
    async fetchPage(query = {}) {
      if (overrides.fetchPage) {
        return overrides.fetchPage(query);
      }
      const page = query.page ?? 1;
      const size = query.size ?? 20;
      const allMessages = [...messages.values()]
        .sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            right.id - left.id
        );
      const start = (page - 1) * size;
      return {
        items: allMessages
          .slice(start, start + size)
          .map((message) => ({ ...message })),
        total: allMessages.length,
        page,
        size,
        hasMore: start + size < allMessages.length
      };
    },

    async createMessage(input, image = null) {
      if (overrides.createMessage) {
        return overrides.createMessage(input, image);
      }
      const message = createEntry({
        input,
        id: nextId++,
        image,
        author,
        createdAt: now()
      });
      messages.set(message.id, message);
      return { ...message };
    },

    async deleteMessage(id) {
      if (overrides.deleteMessage) {
        return overrides.deleteMessage(id);
      }
      if (!messages.delete(id)) {
        throw new Error('留言不存在');
      }
    }
  };
}

function createEntry({
  input,
  id,
  image,
  author,
  createdAt
}: {
  input: MessageCreateInput;
  id: number;
  image: File | null;
  author: Pick<
    MessageEntry,
    'authorUserId' | 'authorName' | 'canDelete'
  >;
  createdAt: string;
}): MessageEntry {
  return {
    id,
    ...author,
    content: input.content,
    imageUrl: image
      ? `memory://message-images/${encodeURIComponent(image.name)}`
      : null,
    createdAt
  };
}
