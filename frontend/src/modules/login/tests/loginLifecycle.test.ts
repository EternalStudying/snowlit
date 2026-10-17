import {
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { createLoginLifecycle } from '../internal/useLoginLifecycle';
import type {
  LoginCredentials,
  LoginSession
} from '../model';
import { createMemoryLoginGateway } from './support/memoryLoginGateway';

const session: LoginSession = {
  token: 'jwt-token',
  user: {
    id: 1,
    username: 'lover',
    displayName: '小夏'
  }
};

describe('LoginLifecycle', () => {
  it('账号或密码为空时保留校验错误且不请求认证', async () => {
    const authenticate = vi.fn();
    const onAuthenticated = vi.fn();
    const lifecycle = createLoginLifecycle({
      gateway: createMemoryLoginGateway({
        authenticate
      }),
      onAuthenticated
    });

    await expect(lifecycle.submit())
      .resolves.toBe(false);

    expect(authenticate).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(lifecycle.state.error.value)
      .toBe('请输入账号和密码');
  });

  it('裁剪账号但保留密码原值，并把成功会话交给应用壳', async () => {
    const authenticate = vi.fn(
      async (_credentials: LoginCredentials) => session
    );
    const onAuthenticated = vi.fn();
    const lifecycle = createLoginLifecycle({
      gateway: createMemoryLoginGateway({
        authenticate
      }),
      onAuthenticated
    });
    lifecycle.state.credentials.username = '  lover  ';
    lifecycle.state.credentials.password = ' secret ';

    await expect(lifecycle.submit())
      .resolves.toBe(true);

    expect(authenticate).toHaveBeenCalledWith({
      username: 'lover',
      password: ' secret '
    });
    expect(onAuthenticated).toHaveBeenCalledWith(session);
    expect(lifecycle.state.error.value).toBe('');
    expect(lifecycle.state.submitting.value).toBe(false);
  });

  it('认证失败后保留凭据并结束提交状态以便重试', async () => {
    const lifecycle = createLoginLifecycle({
      gateway: createMemoryLoginGateway({
        authenticate: vi.fn().mockRejectedValue(
          new Error('账号或密码错误')
        )
      }),
      onAuthenticated: vi.fn()
    });
    lifecycle.state.credentials.username = 'lover';
    lifecycle.state.credentials.password = 'wrong';

    await expect(lifecycle.submit())
      .resolves.toBe(false);

    expect(lifecycle.state.error.value)
      .toBe('账号或密码错误');
    expect(lifecycle.state.credentials).toEqual({
      username: 'lover',
      password: 'wrong'
    });
    expect(lifecycle.state.submitting.value).toBe(false);
  });

  it('提交进行中忽略重复认证意图', async () => {
    let resolveAuthentication:
      | ((session: LoginSession) => void)
      | undefined;
    const authenticate = vi.fn(
      () => new Promise<LoginSession>((resolve) => {
        resolveAuthentication = resolve;
      })
    );
    const onAuthenticated = vi.fn();
    const lifecycle = createLoginLifecycle({
      gateway: createMemoryLoginGateway({
        authenticate
      }),
      onAuthenticated
    });
    lifecycle.state.credentials.username = 'lover';
    lifecycle.state.credentials.password = 'secret';

    const firstSubmission = lifecycle.submit();
    await expect(lifecycle.submit())
      .resolves.toBe(false);
    expect(authenticate).toHaveBeenCalledTimes(1);

    resolveAuthentication?.(session);
    await expect(firstSubmission).resolves.toBe(true);
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });
});
