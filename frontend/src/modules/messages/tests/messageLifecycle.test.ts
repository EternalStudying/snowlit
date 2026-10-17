import {
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { useMessageLifecycle } from '../internal/useMessageLifecycle';
import type {
  MessageCreateInput,
  MessageEntry,
  MessagePageDto
} from '../model';
import { createMemoryMessageGateway } from './support/memoryMessageGateway';

const message = createMessage({ id: 8 });

describe('useMessageLifecycle', () => {
  it('加载第一页并只保留前 20 条留言', async () => {
    const messages = Array.from(
      { length: 24 },
      (_, index) => createMessage({ id: index + 1 })
    );
    const fetchPage = vi.fn(async () => pageOf(messages));
    const lifecycle = useMessageLifecycle({
      gateway: createMemoryMessageGateway({
        overrides: { fetchPage }
      })
    });

    await expect(lifecycle.loadMessages()).resolves.toBe(true);

    expect(fetchPage).toHaveBeenCalledWith({
      page: 1,
      size: 20
    });
    expect(lifecycle.state.messages.value).toHaveLength(20);
    expect(lifecycle.state.loading.value).toBe(false);
  });

  it('加载采用最后意图，较慢旧响应不能覆盖新列表', async () => {
    const older = deferred<MessagePageDto>();
    const newer = deferred<MessagePageDto>();
    const fetchPage = vi.fn()
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    const lifecycle = useMessageLifecycle({
      gateway: createMemoryMessageGateway({
        overrides: { fetchPage }
      })
    });

    const oldLoad = lifecycle.loadMessages();
    const newLoad = lifecycle.loadMessages();
    newer.resolve(pageOf([createMessage({ id: 9 })]));
    await expect(newLoad).resolves.toBe(true);
    older.resolve(pageOf([message]));
    await expect(oldLoad).resolves.toBe(false);

    expect(lifecycle.state.messages.value.map(({ id }) => id))
      .toEqual([9]);
  });

  it('空白内容被拒绝，成功创建会裁剪文字、插入顶部并重置编辑器', async () => {
    const createMessageRequest = vi.fn(async ({ content }: MessageCreateInput) =>
      createMessage({ id: 9, content })
    );
    const lifecycle = useMessageLifecycle({
      gateway: createMemoryMessageGateway({
        messages: [message],
        overrides: { createMessage: createMessageRequest }
      })
    });
    await lifecycle.loadMessages();

    await expect(
      lifecycle.submitMessage({ content: '   ' })
    ).resolves.toBeNull();
    expect(lifecycle.state.submitError.value)
      .toBe('先写一点想说的话');
    expect(createMessageRequest).not.toHaveBeenCalled();

    await expect(
      lifecycle.submitMessage({ content: '  新写下的一句话  ' })
    ).resolves.toMatchObject({ id: 9 });
    expect(createMessageRequest).toHaveBeenCalledWith(
      { content: '新写下的一句话' },
      null
    );
    expect(lifecycle.state.messages.value[0].id).toBe(9);
    expect(lifecycle.state.composerResetSignal.value).toBe(1);
  });

  it('进行中的创建会拒绝重复提交', async () => {
    const pending = deferred<MessageEntry>();
    const createMessageRequest = vi.fn(() => pending.promise);
    const lifecycle = useMessageLifecycle({
      gateway: createMemoryMessageGateway({
        overrides: { createMessage: createMessageRequest }
      })
    });

    const first = lifecycle.submitMessage({ content: '第一条' });
    await expect(
      lifecycle.submitMessage({ content: '第二条' })
    ).resolves.toBeNull();
    pending.resolve(message);
    await expect(first).resolves.toEqual(message);

    expect(createMessageRequest).toHaveBeenCalledTimes(1);
  });

  it('选择会清理旧删除错误，删除成功会同步列表和当前详情', async () => {
    const deleteMessageRequest = vi.fn()
      .mockRejectedValueOnce(new Error('暂时不能删除'))
      .mockResolvedValueOnce(undefined);
    const lifecycle = useMessageLifecycle({
      gateway: createMemoryMessageGateway({
        messages: [message],
        overrides: { deleteMessage: deleteMessageRequest }
      })
    });
    await lifecycle.loadMessages();
    lifecycle.selectMessage(message);

    await expect(
      lifecycle.deleteMessage(message)
    ).resolves.toBe(false);
    expect(lifecycle.state.deleteError.value)
      .toBe('暂时不能删除');
    lifecycle.clearSelection();
    lifecycle.selectMessage(message);
    expect(lifecycle.state.deleteError.value).toBe('');

    await expect(
      lifecycle.deleteMessage(message)
    ).resolves.toBe(true);
    expect(lifecycle.state.messages.value).toEqual([]);
    expect(lifecycle.state.selectedMessage.value).toBeNull();
  });

  it('加载失败保留可重试错误并结束加载状态', async () => {
    const lifecycle = useMessageLifecycle({
      gateway: createMemoryMessageGateway({
        overrides: {
          fetchPage: vi.fn()
            .mockRejectedValue(new Error('留言请求失败'))
        }
      })
    });

    await expect(lifecycle.loadMessages()).resolves.toBe(false);

    expect(lifecycle.state.loadError.value)
      .toBe('留言请求失败');
    expect(lifecycle.state.loading.value).toBe(false);
  });
});

function createMessage(
  overrides: Partial<MessageEntry>
): MessageEntry {
  return {
    id: 1,
    authorUserId: 1,
    authorName: 'Luna',
    content: '今天买了白色洋桔梗。',
    imageUrl: null,
    createdAt: '2026-05-27T10:28:00',
    canDelete: true,
    ...overrides
  };
}

function pageOf(items: MessageEntry[]): MessagePageDto {
  return {
    items,
    total: items.length,
    page: 1,
    size: 20,
    hasMore: false
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
