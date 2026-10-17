import {
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { createSupportLifecycle } from '../internal/useSupportLifecycle';
import type {
  FeedbackSubmission,
  UpdateNotice
} from '../model';
import { createMemoryNoticeDismissalStore } from './support/memoryNoticeDismissalStore';
import { createMemorySupportGateway } from './support/memorySupportGateway';

const notice: UpdateNotice = {
  id: 1,
  title: '更新小纸条',
  version: '2026.05.17',
  publishedAt: '2026-05-17T20:00:00',
  items: [
    '首页已接入真实数据',
    '日记页支持图片上传'
  ]
};

describe('SupportLifecycle', () => {
  it('加载可见公告，并跳过会话内已经关闭的同一公告', async () => {
    const visibleLifecycle = createLifecycle();
    await visibleLifecycle.initialize();

    expect(visibleLifecycle.state.notice.value)
      .toEqual(notice);
    expect(visibleLifecycle.state.noticeVisible.value)
      .toBe(true);

    const dismissedLifecycle = createLifecycle({
      noticeDismissals:
        createMemoryNoticeDismissalStore([notice])
    });
    await dismissedLifecycle.initialize();

    expect(dismissedLifecycle.state.notice.value)
      .toBeNull();
    expect(dismissedLifecycle.state.noticeVisible.value)
      .toBe(false);
  });

  it('确认公告会记录会话关闭状态并清空提示', async () => {
    const noticeDismissals =
      createMemoryNoticeDismissalStore();
    const remember = vi.spyOn(
      noticeDismissals,
      'remember'
    );
    const lifecycle = createLifecycle({
      noticeDismissals
    });
    await lifecycle.initialize();

    lifecycle.dismissNotice();

    expect(remember).toHaveBeenCalledWith(notice);
    expect(lifecycle.state.noticeVisible.value)
      .toBe(false);
    expect(lifecycle.state.noticeError.value).toBe('');
  });

  it('今日静音失败保留错误，重试成功后关闭并记录公告', async () => {
    const muteUpdateNoticeToday = vi.fn()
      .mockRejectedValueOnce(
        new Error('今日不再提示设置失败')
      )
      .mockResolvedValueOnce({
        mutedUntil: '2026-05-17T23:59:59'
      });
    const noticeDismissals =
      createMemoryNoticeDismissalStore();
    const lifecycle = createLifecycle({
      gateway: createMemorySupportGateway({
        notice: noticeEnvelope(),
        overrides: { muteUpdateNoticeToday }
      }),
      noticeDismissals
    });
    await lifecycle.initialize();

    await expect(lifecycle.muteNoticeToday())
      .resolves.toBe(false);
    expect(lifecycle.state.noticeError.value)
      .toBe('今日不再提示设置失败');
    expect(lifecycle.state.noticeVisible.value)
      .toBe(true);

    await expect(lifecycle.muteNoticeToday())
      .resolves.toBe(true);
    expect(lifecycle.state.noticeVisible.value)
      .toBe(false);
    expect(noticeDismissals.isDismissed(notice))
      .toBe(true);
  });

  it('打开和关闭反馈会清理截图，但保留尚未提交的文字草稿', async () => {
    const lifecycle = createLifecycle();
    lifecycle.state.feedbackForm.title = '暂存标题';
    lifecycle.openFeedback();
    await lifecycle.uploadScreenshots([
      screenshot('shot.webp')
    ]);

    expect(lifecycle.state.uploadedScreenshots.value)
      .toHaveLength(1);
    lifecycle.closeFeedback();
    lifecycle.openFeedback();

    expect(lifecycle.state.feedbackVisible.value)
      .toBe(true);
    expect(lifecycle.state.feedbackForm.title)
      .toBe('暂存标题');
    expect(lifecycle.state.uploadedScreenshots.value)
      .toEqual([]);
  });

  it('截图按选择顺序上传，并拒绝超过三张的选择', async () => {
    const uploadFeedbackScreenshot = vi.fn(
      async (file: File) => ({
        url: `memory://${file.name}`
      })
    );
    const lifecycle = createLifecycle({
      gateway: createMemorySupportGateway({
        notice: noticeEnvelope(),
        overrides: { uploadFeedbackScreenshot }
      })
    });
    const screenshots = [
      screenshot('one.webp'),
      screenshot('two.webp'),
      screenshot('three.webp')
    ];

    await lifecycle.uploadScreenshots(screenshots);
    await lifecycle.uploadScreenshots([
      screenshot('four.webp')
    ]);

    expect(uploadFeedbackScreenshot.mock.calls.map(
      ([file]) => file.name
    )).toEqual([
      'one.webp',
      'two.webp',
      'three.webp'
    ]);
    expect(lifecycle.state.uploadedScreenshots.value)
      .toEqual([
        'memory://one.webp',
        'memory://two.webp',
        'memory://three.webp'
      ]);
    expect(lifecycle.state.feedbackError.value)
      .toBe('最多只能上传 3 张截图');
    expect(lifecycle.state.uploadingScreenshot.value)
      .toBe(false);
  });

  it('截图上传失败会保留已成功结果并结束等待状态', async () => {
    const uploadFeedbackScreenshot = vi.fn()
      .mockResolvedValueOnce({
        url: 'memory://one.webp'
      })
      .mockRejectedValueOnce(
        new Error('截图上传失败')
      );
    const lifecycle = createLifecycle({
      gateway: createMemorySupportGateway({
        notice: noticeEnvelope(),
        overrides: { uploadFeedbackScreenshot }
      })
    });

    await lifecycle.uploadScreenshots([
      screenshot('one.webp'),
      screenshot('two.webp')
    ]);

    expect(lifecycle.state.uploadedScreenshots.value)
      .toEqual(['memory://one.webp']);
    expect(lifecycle.state.feedbackError.value)
      .toBe('截图上传失败');
    expect(lifecycle.state.uploadingScreenshot.value)
      .toBe(false);
  });

  it('提交会校验并裁剪草稿，成功后关闭弹窗和重置状态', async () => {
    const submitFeedback = vi.fn(
      async (_submission: FeedbackSubmission) => ({
        id: 8,
        status: 'pending' as const,
        createdAt: '2026-05-17T20:30:00'
      })
    );
    const lifecycle = createLifecycle({
      gateway: createMemorySupportGateway({
        notice: noticeEnvelope(),
        overrides: { submitFeedback }
      })
    });
    lifecycle.openFeedback();

    await expect(lifecycle.submitFeedback())
      .resolves.toBe(false);
    expect(lifecycle.state.feedbackError.value)
      .toBe('请填写反馈标题和内容');

    lifecycle.state.feedbackForm.type = 'feature';
    lifecycle.state.feedbackForm.title =
      '  新增回忆筛选  ';
    lifecycle.state.feedbackForm.content =
      '  希望支持按地点筛选。  ';
    lifecycle.state.feedbackForm.contact =
      '  微信：abc  ';
    await lifecycle.uploadScreenshots([
      screenshot('shot.webp')
    ]);

    await expect(lifecycle.submitFeedback())
      .resolves.toBe(true);

    expect(submitFeedback).toHaveBeenCalledWith({
      type: 'feature',
      title: '新增回忆筛选',
      content: '希望支持按地点筛选。',
      contact: '微信：abc',
      imageUrls: ['memory://feedback/shot.webp'],
      pageUrl: 'https://snowlit.xyz/album',
      userAgent: 'Support Test'
    });
    expect(lifecycle.state.feedbackVisible.value)
      .toBe(false);
    expect(lifecycle.state.feedbackForm).toMatchObject({
      type: 'bug',
      title: '',
      content: '',
      contact: ''
    });
    expect(lifecycle.state.uploadedScreenshots.value)
      .toEqual([]);
    expect(lifecycle.state.submittingFeedback.value)
      .toBe(false);
  });

  it('提交失败保留草稿、截图和弹窗以便重试', async () => {
    const lifecycle = createLifecycle({
      gateway: createMemorySupportGateway({
        notice: noticeEnvelope(),
        overrides: {
          submitFeedback: vi.fn()
            .mockRejectedValue(
              new Error('反馈提交失败')
            )
        }
      })
    });
    lifecycle.openFeedback();
    lifecycle.state.feedbackForm.title = '相册问题';
    lifecycle.state.feedbackForm.content = '按钮无响应';
    await lifecycle.uploadScreenshots([
      screenshot('shot.webp')
    ]);

    await expect(lifecycle.submitFeedback())
      .resolves.toBe(false);

    expect(lifecycle.state.feedbackVisible.value)
      .toBe(true);
    expect(lifecycle.state.feedbackForm.title)
      .toBe('相册问题');
    expect(lifecycle.state.uploadedScreenshots.value)
      .toEqual(['memory://feedback/shot.webp']);
    expect(lifecycle.state.feedbackError.value)
      .toBe('反馈提交失败');
    expect(lifecycle.state.submittingFeedback.value)
      .toBe(false);
  });
});

function createLifecycle(
  overrides: Parameters<
    typeof createSupportLifecycle
  >[0] = {}
) {
  return createSupportLifecycle({
    gateway: createMemorySupportGateway({
      notice: noticeEnvelope()
    }),
    noticeDismissals:
      createMemoryNoticeDismissalStore(),
    readPageContext: () => ({
      pageUrl: 'https://snowlit.xyz/album',
      userAgent: 'Support Test'
    }),
    ...overrides
  });
}

function noticeEnvelope() {
  return {
    shouldShow: true,
    notice
  };
}

function screenshot(name: string): File {
  return new File(['image'], name, {
    type: 'image/webp'
  });
}
