import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import {
  clearAuthToken,
  setAuthToken
} from '../../../auth';
import { createHttpMessageGateway } from '../internal/httpMessageGateway';
import type { MessageEntry } from '../model';

const message: MessageEntry = {
  id: 8,
  authorUserId: 1,
  authorName: 'Luna',
  content: '今天买了白色洋桔梗。',
  imageUrl: null,
  createdAt: '2026-05-27T10:28:00',
  canDelete: true
};

describe('HttpMessageGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken('message-token');
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('保留分页 query 与认证头', async () => {
    const page = {
      items: [message],
      total: 1,
      page: 2,
      size: 7,
      hasMore: false
    };
    const adapter = viAdapter([jsonResponse(page)]);
    const gateway = createHttpMessageGateway({ adapter });

    await expect(
      gateway.fetchPage({ page: 2, size: 7 })
    ).resolves.toEqual(page);
    expect(adapter).toHaveBeenCalledWith(
      '/api/messages?page=2&size=7',
      {
        headers: {
          Authorization: 'Bearer message-token'
        }
      }
    );
  });

  it('创建保留 payload JSON Blob 与可选 image multipart 字段', async () => {
    const adapter = viAdapter([jsonResponse(message)]);
    const gateway = createHttpMessageGateway({ adapter });
    const image = new File(['image'], 'flower.webp', {
      type: 'image/webp'
    });

    await gateway.createMessage(
      { content: '今天买了白色洋桔梗。' },
      image
    );

    const [, request] = adapter.mock.calls[0];
    const body = request?.body as FormData;
    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer message-token'
      }
    });
    expect(JSON.parse(
      await readBlob(body.get('payload') as Blob)
    )).toEqual({
      content: '今天买了白色洋桔梗。'
    });
    expect(body.get('image')).toBe(image);
  });

  it('删除保留精确 ID 与 204 契约', async () => {
    const adapter = viAdapter([
      new Response(null, { status: 204 })
    ]);
    const gateway = createHttpMessageGateway({ adapter });

    await expect(gateway.deleteMessage(8)).resolves.toBeUndefined();
    expect(adapter).toHaveBeenCalledWith(
      '/api/messages/8',
      {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer message-token'
        }
      }
    );
  });
});

function viAdapter(responses: Response[]) {
  return vi.fn(async (_path: string, _init?: RequestInit) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected Message request');
    }
    return response;
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(String(reader.result ?? ''));
    });
    reader.addEventListener('error', () => {
      reject(reader.error);
    });
    reader.readAsText(blob);
  });
}
