import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, setAuthToken } from '../../../auth';
import type {
  WishCreateInput,
  WishDetailDto,
  WishPageDto,
  WishSummaryDto
} from '../model';
import { createHttpWishGateway } from '../internal/httpWishGateway';

const pendingWish: WishSummaryDto = {
  id: 1,
  title: '去看海',
  category: 'want_go',
  completed: false,
  imageUrl: null,
  createdAt: '2026-07-25T10:00:00',
  completedAt: null
};

describe('HttpWishGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuthToken();
    setAuthToken('wish-token');
  });

  afterEach(() => {
    clearAuthToken();
    vi.restoreAllMocks();
  });

  it('列表和详情保留 query、路径与 Bearer wire 契约', async () => {
    const page: WishPageDto = {
      items: [pendingWish],
      total: 1,
      page: 2,
      size: 8,
      hasMore: false,
      canManage: true
    };
    const detail: WishDetailDto = {
      ...pendingWish,
      description: '一起看日落',
      locationName: '尼斯',
      latitude: null,
      longitude: null,
      note: null,
      expectedCompletedAt: null,
      updatedAt: pendingWish.createdAt,
      lastOperatedByUserId: null,
      lastOperatedAt: null
    };
    const adapter = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page))
      .mockResolvedValueOnce(jsonResponse(detail));
    const gateway = createHttpWishGateway({ adapter });

    await expect(
      gateway.fetchPage({
        category: 'want_go',
        completed: false,
        page: 2,
        size: 8
      })
    ).resolves.toEqual(page);
    await expect(gateway.fetchDetail(1)).resolves.toEqual(detail);

    expect(adapter).toHaveBeenNthCalledWith(
      1,
      '/api/wishes?category=want_go&completed=false&page=2&size=8',
      { headers: { Authorization: 'Bearer wish-token' } }
    );
    expect(adapter).toHaveBeenNthCalledWith(2, '/api/wishes/1', {
      headers: { Authorization: 'Bearer wish-token' }
    });
  });

  it('完成和撤回保留 POST、multipart image 与无 body 契约', async () => {
    const completed = {
      ...pendingWish,
      completed: true,
      completedAt: '2026-07-25T20:00:00'
    };
    const adapter = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completed))
      .mockResolvedValueOnce(jsonResponse(pendingWish));
    const gateway = createHttpWishGateway({ adapter });
    const image = new File(['done'], 'done.jpg', { type: 'image/jpeg' });

    await gateway.completeWish(1, image);
    await gateway.reopenWish(1);

    const completeInit = adapter.mock.calls[0][1] as RequestInit;
    expect(adapter.mock.calls[0][0]).toBe('/api/wishes/1/complete');
    expect(completeInit).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer wish-token' }
    });
    expect(completeInit.body).toBeInstanceOf(FormData);
    expect((completeInit.body as FormData).get('image')).toBe(image);
    expect(adapter).toHaveBeenNthCalledWith(2, '/api/wishes/1/reopen', {
      method: 'POST',
      headers: { Authorization: 'Bearer wish-token' }
    });
  });

  it('创建保留 payload JSON Blob、可选 image 与 POST 契约', async () => {
    const adapter = vi.fn().mockResolvedValue(jsonResponse(pendingWish));
    const gateway = createHttpWishGateway({ adapter });
    const image = new File(['cover'], 'cover.webp', { type: 'image/webp' });
    const input: WishCreateInput = {
      title: '去看海',
      category: 'want_go',
      description: '一起看日落',
      locationName: '尼斯',
      expectedCompletedAt: '2026-08-01T00:00:00',
      note: '带相机'
    };

    await gateway.createWish(input, image);

    const [path, init] = adapter.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/wishes');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer wish-token' }
    });
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('image')).toBe(image);
    expect(await readBlobText(form.get('payload'))).toBe(JSON.stringify(input));
    expect((form.get('payload') as Blob).type).toBe('application/json');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

async function readBlobText(value: FormDataEntryValue | null): Promise<string> {
  if (!(value instanceof Blob)) {
    throw new Error('Expected payload Blob');
  }
  if (typeof value.text === 'function') {
    return value.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Failed to read payload Blob'))
    );
    reader.readAsText(value);
  });
}
