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
  getAuthToken,
  invalidateSession,
  onSessionInvalidated,
  setAuthToken
} from '../src/auth';

describe('browser session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('保存、读取和清除本地 token', () => {
    setAuthToken('jwt-token');
    expect(getAuthToken()).toBe('jwt-token');
    expect(localStorage.getItem('snowlit_token')).toBe('jwt-token');

    clearAuthToken();
    expect(getAuthToken()).toBe('');
    expect(localStorage.getItem('snowlit_token')).toBeNull();
  });

  it('会话失效会清除 token、通知订阅者并支持取消订阅', () => {
    setAuthToken('jwt-token');
    const onInvalidated = vi.fn();
    const stop = onSessionInvalidated(onInvalidated);

    invalidateSession();

    expect(getAuthToken()).toBe('');
    expect(onInvalidated).toHaveBeenCalledTimes(1);

    stop();
    invalidateSession();
    expect(onInvalidated).toHaveBeenCalledTimes(1);
  });
});
