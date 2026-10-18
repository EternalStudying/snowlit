import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAuthToken, onSessionChange, setAuthToken } from '../src/auth';
import { createLatestRequest, createSharedRequests } from '../src/requestGuards';

afterEach(() => {
  clearAuthToken();
});

describe('request guards', () => {
  it('only the newest request in the current session counts', () => {
    const latest = createLatestRequest();
    const first = latest.begin();
    const second = latest.begin();

    expect(first()).toBe(false);
    expect(second()).toBe(true);

    setAuthToken('other-member');
    expect(second()).toBe(false);

    const third = latest.begin();
    latest.cancel();
    expect(third()).toBe(false);
  });

  it('shares an in-flight request per key until it settles or the session changes', async () => {
    const shared = createSharedRequests<number, string>();
    const resolvers: Array<(value: string) => void> = [];
    const request = vi.fn(() => new Promise<string>((done) => resolvers.push(done)));

    const a = shared.run(1, request);
    const b = shared.run(1, request);
    expect(a).toBe(b);
    expect(request).toHaveBeenCalledTimes(1);

    setAuthToken('next-member');
    shared.run(1, request);
    expect(request).toHaveBeenCalledTimes(2);

    resolvers.forEach((done) => done('done'));
    await expect(a).resolves.toBe('done');
  });

  it('notifies listeners on sign-in and sign-out but not on repeated tokens', () => {
    const listener = vi.fn();
    const stop = onSessionChange(listener);

    setAuthToken('token');
    setAuthToken('token');
    clearAuthToken();
    clearAuthToken();
    stop();
    setAuthToken('later');

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
