import { describe, expect, it, vi } from 'vitest';
import {
  RequestFailure,
  createSessionRequest,
  type HttpAdapter
} from '../src/http/sessionRequest';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const fixedFailure = {
  message: '请求失败',
  networkMessage: '网络不可用',
  responseMessage: 'ignore'
} as const;

describe('session request', () => {
  it('通过注入 adapter 发送 JSON，并合并保留的会话头与领域头', async () => {
    const adapter = vi.fn().mockResolvedValue(jsonResponse({ id: 7 }, 201)) as unknown as HttpAdapter;
    const request = createSessionRequest({
      adapter,
      readToken: () => 'jwt-token'
    });

    await expect(
      request.json<{ id: number }>({
        path: '/api/example',
        method: 'POST',
        body: { kind: 'json', value: { title: '晚安' } },
        headers: {
          Authorization: 'caller-token',
          'X-Album-Access-Token': 'private-token'
        },
        failure: fixedFailure
      })
    ).resolves.toEqual({ id: 7 });

    expect(adapter).toHaveBeenCalledTimes(1);
    const [path, init] = vi.mocked(adapter).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(path).toBe('/api/example');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ title: '晚安' }));
    expect(headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Album-Access-Token')).toBe('private-token');
  });

  it('无 token 时不生成 Authorization，显式匿名请求也不会携带现有会话', async () => {
    const adapter = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true })) as unknown as HttpAdapter;
    const withoutToken = createSessionRequest({ adapter, readToken: () => '' });
    const anonymous = createSessionRequest({ adapter, readToken: () => 'jwt-token' });

    await withoutToken.json({
      path: '/api/public',
      failure: fixedFailure
    });
    await anonymous.json({
      path: '/api/auth/login',
      session: 'omit',
      failure: fixedFailure
    });

    for (const [, init] of vi.mocked(adapter).mock.calls) {
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    }
  });

  it('发送 FormData 时不设置 Content-Type，并将无内容响应解析为 void', async () => {
    const json = vi.fn();
    const adapter = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json
    } as unknown as Response) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter, readToken: () => 'jwt-token' });
    const form = new FormData();
    form.append('file', new File(['image'], 'photo.jpg', { type: 'image/jpeg' }));

    await expect(
      request.noContent({
        path: '/api/uploads',
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: fixedFailure
      })
    ).resolves.toBeUndefined();

    const [, init] = vi.mocked(adapter).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(init?.body).toBe(form);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(json).not.toHaveBeenCalled();
  });

  it('把结构化 HTTP 错误统一为保留 status、code 和服务端文案的 RequestFailure', async () => {
    const adapter = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'WISH_ALREADY_COMPLETED', message: '这个清单已经完成了' }, 409)) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter });

    const promise = request.json({
      path: '/api/wishes/1/complete',
      failure: {
        message: '清单请求失败',
        responseMessage: 'prefer'
      }
    });

    await expect(promise).rejects.toBeInstanceOf(RequestFailure);
    await expect(promise).rejects.toMatchObject({
      kind: 'http',
      status: 409,
      code: 'WISH_ALREADY_COMPLETED',
      message: '这个清单已经完成了'
    });
  });

  it('错误响应不是合法 JSON 时使用领域默认文案', async () => {
    const adapter = vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 })) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter });

    await expect(
      request.json({
        path: '/api/diary',
        failure: {
          message: '日记操作失败',
          responseMessage: 'prefer'
        }
      })
    ).rejects.toMatchObject({
      kind: 'http',
      status: 502,
      message: '日记操作失败'
    });
  });

  it('把 adapter 拒绝映射为领域网络错误', async () => {
    const adapter = vi.fn().mockRejectedValue(new TypeError('offline')) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter });

    await expect(
      request.json({
        path: '/api/home',
        failure: {
          message: '首页请求失败',
          networkMessage: '首页数据加载失败'
        }
      })
    ).rejects.toMatchObject({
      kind: 'network',
      status: 0,
      message: '首页数据加载失败'
    });
  });

  it('普通 401 只失效一次会话，并保留统一的过期文案', async () => {
    const invalidateSession = vi.fn();
    const adapter = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' }, 401)) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter, invalidateSession });

    await expect(
      request.json({
        path: '/api/auth/me',
        failure: { message: '用户资料加载失败' }
      })
    ).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      code: 'UNAUTHORIZED',
      message: '登录已过期，请重新登录'
    });
    expect(invalidateSession).toHaveBeenCalledTimes(1);
  });

  it('私密相册授权失败不会失效全局会话', async () => {
    const invalidateSession = vi.fn();
    const adapter = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          {
            code: 'PRIVATE_ALBUM_TOKEN_INVALID',
            message: '私密相册访问无效，请重新输入密码'
          },
          401
        )
      ) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter, invalidateSession });

    await expect(
      request.json({
        path: '/api/albums/2',
        failure: {
          message: '相册请求失败',
          responseMessage: 'prefer'
        }
      })
    ).rejects.toMatchObject({
      code: 'PRIVATE_ALBUM_TOKEN_INVALID',
      message: '私密相册访问无效，请重新输入密码'
    });
    expect(invalidateSession).not.toHaveBeenCalled();
  });

  it('成功响应不是合法 JSON 时报告 invalid-response', async () => {
    const adapter = vi.fn().mockResolvedValue(new Response('', { status: 200 })) as unknown as HttpAdapter;
    const request = createSessionRequest({ adapter });

    await expect(
      request.json({
        path: '/api/example',
        failure: fixedFailure
      })
    ).rejects.toMatchObject({
      kind: 'invalid-response',
      status: 200,
      message: '请求失败'
    });
  });
});
