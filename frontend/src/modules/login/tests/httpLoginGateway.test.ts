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
import { createHttpLoginGateway } from '../internal/httpLoginGateway';

describe('HttpLoginGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken('stale-token');
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('匿名提交精确登录 JSON 契约', async () => {
    const session = {
      token: 'jwt-token',
      user: {
        id: 1,
        username: 'lover',
        displayName: '小夏'
      }
    };
    const adapter = vi.fn<HttpAdapter>(async () =>
      jsonResponse(session)
    );
    const gateway = createHttpLoginGateway({ adapter });

    await expect(gateway.authenticate({
      username: 'lover',
      password: 'secret'
    })).resolves.toEqual(session);

    expect(adapter).toHaveBeenCalledWith(
      '/api/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'lover',
          password: 'secret'
        })
      }
    );
  });

  it('拒绝无效凭据时保留登录领域错误且不清除现有会话', async () => {
    const adapter = vi.fn<HttpAdapter>(async () =>
      jsonResponse(
        {
          code: 'INVALID_CREDENTIALS',
          message: 'backend detail'
        },
        401
      )
    );
    const gateway = createHttpLoginGateway({ adapter });

    await expect(gateway.authenticate({
      username: 'lover',
      password: 'wrong'
    })).rejects.toThrow('账号或密码错误');
    expect(localStorage.getItem('snowlit_token'))
      .toBe('stale-token');
  });
});

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
