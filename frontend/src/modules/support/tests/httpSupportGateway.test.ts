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
import type { HttpAdapter } from '../../../http/sessionRequest';
import { createHttpSupportGateway } from '../internal/httpSupportGateway';
import type { FeedbackSubmission } from '../model';

describe('HttpSupportGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken('support-token');
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('读取更新公告时保留认证头与 GET 契约', async () => {
    const response = {
      shouldShow: false,
      notice: null
    };
    const adapter = vi.fn<HttpAdapter>(async () =>
      jsonResponse(response)
    );
    const gateway = createHttpSupportGateway({ adapter });

    await expect(gateway.fetchUpdateNotice())
      .resolves.toEqual(response);
    expect(adapter).toHaveBeenCalledWith(
      '/api/update-notice',
      {
        headers: {
          Authorization: 'Bearer support-token'
        }
      }
    );
  });

  it('今日静音保留 POST 与认证契约', async () => {
    const adapter = vi.fn<HttpAdapter>(async () =>
      jsonResponse({
        mutedUntil: '2026-05-17T23:59:59'
      })
    );
    const gateway = createHttpSupportGateway({ adapter });

    await gateway.muteUpdateNoticeToday();

    expect(adapter).toHaveBeenCalledWith(
      '/api/update-notice/mute-today',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer support-token'
        }
      }
    );
  });

  it('截图上传保留 file multipart 字段', async () => {
    const adapter = vi.fn<HttpAdapter>(async () =>
      jsonResponse({
        url: 'https://cdn.example.com/feedback/shot.webp'
      })
    );
    const gateway = createHttpSupportGateway({ adapter });
    const screenshot = new File(
      ['image'],
      'shot.webp',
      { type: 'image/webp' }
    );

    await gateway.uploadFeedbackScreenshot(screenshot);

    const [, request] = adapter.mock.calls[0];
    const body = request?.body as FormData;
    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer support-token'
      }
    });
    expect(body.get('file')).toBe(screenshot);
  });

  it('反馈提交保留精确 JSON payload', async () => {
    const adapter = vi.fn<HttpAdapter>(async () =>
      jsonResponse({
        id: 8,
        status: 'pending',
        createdAt: '2026-05-17T20:30:00'
      })
    );
    const gateway = createHttpSupportGateway({ adapter });
    const submission: FeedbackSubmission = {
      type: 'bug',
      title: '相册按钮问题',
      content: '点击后没有反应',
      contact: '微信：abc',
      imageUrls: [
        'https://cdn.example.com/feedback/shot.webp'
      ],
      pageUrl: 'https://snowlit.xyz/album',
      userAgent: 'Support Test'
    };

    await gateway.submitFeedback(submission);

    expect(adapter).toHaveBeenCalledWith('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer support-token'
      },
      body: JSON.stringify(submission)
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
