import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createAlbumUploadQueue } from '../internal/uploadQueue';
import { deferred, draftPhoto as publicPhoto } from './fixtures';

describe('album upload queue', () => {
  it('exposes generating, uploading, and completed progress as observable state', async () => {
    const original = new File(['original'], 'lake-day.jpg', { type: 'image/jpeg' });
    const preview = new File(['preview'], 'lake-day.webp', { type: 'image/webp' });
    const previewResult = deferred<{ file: File; width: number; height: number }>();
    const uploadResult = deferred<typeof publicPhoto>();
    const generatePreview = vi.fn(() => previewResult.promise);
    const uploadPhoto = vi.fn(() => uploadResult.promise);
    const queue = createAlbumUploadQueue({
      generatePreview,
      isMobileUpload: () => false,
      now: () => new Date('2026-07-25T08:09:10.000Z')
    });

    expect(queue.addFiles([original])).toBe(true);
    const start = queue.start(uploadPhoto);

    expect(queue.uploading.value).toBe(true);
    expect(queue.items.value[0]).toMatchObject({
      status: 'generating',
      message: '生成 WebP 预览中',
      progress: 0
    });

    previewResult.resolve({ file: preview, width: 1200, height: 800 });
    await flushPromises();

    expect(queue.items.value[0]).toMatchObject({
      status: 'uploading',
      message: '上传中',
      progress: 50,
      metadata: {
        caption: 'lake-day',
        takenAt: '2026-07-25',
        location: '地球',
        width: 1200,
        height: 800,
        sortOrder: 1
      }
    });

    uploadResult.resolve({
      ...publicPhoto,
      id: 'opaque-903',
      url: '/uploads/lake-day.webp'
    });
    await start;

    expect(queue.uploading.value).toBe(false);
    expect(queue.successCount.value).toBe(1);
    expect(queue.blockingCount.value).toBe(0);
    expect(queue.items.value[0]).toMatchObject({
      status: 'success',
      message: '已上传',
      progress: 100
    });
    expect(uploadPhoto).toHaveBeenCalledWith(
      original,
      preview,
      expect.objectContaining({
        caption: 'lake-day',
        sortOrder: 1
      })
    );
  });

  it('keeps a failed item retryable and removes only non-active items', async () => {
    const original = new File(['original'], 'retry.jpg', { type: 'image/jpeg' });
    const preview = new File(['preview'], 'retry.webp', { type: 'image/webp' });
    const uploadPhoto = vi
      .fn()
      .mockRejectedValueOnce(new Error('上传通道暂时不可用'))
      .mockResolvedValueOnce(publicPhoto);
    const queue = createAlbumUploadQueue({
      generatePreview: vi.fn().mockResolvedValue({
        file: preview,
        width: 800,
        height: 600
      }),
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    queue.addFiles([original]);
    const itemId = queue.items.value[0].id;

    await queue.start(uploadPhoto);

    expect(queue.items.value[0]).toMatchObject({
      status: 'failed',
      message: '上传通道暂时不可用',
      progress: 0
    });
    expect(queue.blockingCount.value).toBe(1);

    await queue.retry(itemId, uploadPhoto);

    expect(queue.items.value[0]).toMatchObject({
      status: 'success',
      message: '已上传',
      progress: 100
    });

    queue.addFiles([new File(['x'], 'remove-me.jpg', { type: 'image/jpeg' })]);
    const waitingId = queue.items.value[1].id;
    queue.remove(waitingId);
    expect(queue.items.value.map((item) => item.id)).not.toContain(waitingId);
  });

  it('enforces the 300-image and per-file validation boundaries', () => {
    const queue = createAlbumUploadQueue({
      generatePreview: vi.fn(),
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });
    const validFiles = Array.from(
      { length: 300 },
      (_, index) => new File(['x'], `photo-${index + 1}.jpg`, { type: 'image/jpeg' })
    );

    expect(queue.addFiles(validFiles)).toBe(true);
    expect(queue.items.value).toHaveLength(300);
    expect(
      queue.addFiles([new File(['x'], 'photo-301.jpg', { type: 'image/jpeg' })])
    ).toBe(false);
    expect(queue.error.value).toBe('最多选择 300 张照片');
    expect(queue.items.value).toHaveLength(300);

    queue.clear();
    expect(queue.addFiles([new File(['text'], 'notes.txt', { type: 'text/plain' })])).toBe(
      false
    );
    expect(queue.error.value).toBe('只支持 jpg、png、webp、gif，单张不超过 10MB');
  });

  it('queues the good images of a mixed selection and names the rule for the rest', () => {
    const queue = createAlbumUploadQueue({
      generatePreview: vi.fn(),
      now: () => new Date('2026-07-25T08:00:00.000Z')
    });

    expect(
      queue.addFiles([
        new File(['x'], 'beach.jpg', { type: 'image/jpeg' }),
        new File(['text'], 'notes.txt', { type: 'text/plain' }),
        new File(['x'], 'sunset.png', { type: 'image/png' })
      ])
    ).toBe(true);
    expect(queue.items.value.map((item) => item.file.name)).toEqual(['beach.jpg', 'sunset.png']);
    expect(queue.error.value).toBe('只支持 jpg、png、webp、gif，单张不超过 10MB');
  });
});
