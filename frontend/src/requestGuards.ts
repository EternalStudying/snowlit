import { sessionEpoch } from './auth';

export interface LatestRequest {
  /**
   * Starts a request and returns a check that stays true while it is the newest request of its kind and
   * the session has not changed. Apply a response only while the check passes.
   */
  begin(): () => boolean;
  /** Makes every request started so far stale. */
  cancel(): void;
}

export function createLatestRequest(): LatestRequest {
  let version = 0;
  return {
    begin() {
      const mine = ++version;
      const startedIn = sessionEpoch();
      return () => mine === version && startedIn === sessionEpoch();
    },
    cancel() {
      version += 1;
    }
  };
}

export interface SharedRequests<K, T> {
  /**
   * Returns the in-flight request for this key when there is one from the current session, otherwise
   * starts it. The request is forgotten once it settles.
   */
  run(key: K, request: () => Promise<T>): Promise<T>;
}

export function createSharedRequests<K, T>(): SharedRequests<K, T> {
  const pending = new Map<K, { session: number; promise: Promise<T> }>();
  return {
    run(key, request) {
      const existing = pending.get(key);
      if (existing && existing.session === sessionEpoch()) {
        return existing.promise;
      }
      const promise: Promise<T> = request().finally(() => {
        if (pending.get(key)?.promise === promise) {
          pending.delete(key);
        }
      });
      pending.set(key, { session: sessionEpoch(), promise });
      return promise;
    }
  };
}
