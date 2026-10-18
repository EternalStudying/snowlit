const TOKEN_KEY = 'snowlit_token';
const SESSION_INVALIDATED_EVENT = 'snowlit:logout';

let epoch = 0;
const sessionChangeListeners = new Set<() => void>();

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token: string): void {
  const changed = token !== getAuthToken();
  localStorage.setItem(TOKEN_KEY, token);
  if (changed) {
    markSessionChanged();
  }
}

export function clearAuthToken(): void {
  const changed = getAuthToken() !== '';
  localStorage.removeItem(TOKEN_KEY);
  if (changed) {
    markSessionChanged();
  }
}

/**
 * Identifies the current business session; it changes whenever a member signs in, signs out or is
 * signed out, so work started under an earlier session can recognise itself as stale.
 */
export function sessionEpoch(): number {
  return epoch;
}

/**
 * Runs the callback after every session change, so caches can forget the previous member's data.
 */
export function onSessionChange(callback: () => void): () => void {
  sessionChangeListeners.add(callback);
  return () => sessionChangeListeners.delete(callback);
}

function markSessionChanged(): void {
  epoch += 1;
  sessionChangeListeners.forEach((callback) => callback());
}

export function invalidateSession(): void {
  clearAuthToken();
  window.dispatchEvent(
    new CustomEvent(SESSION_INVALIDATED_EVENT)
  );
}

export function onSessionInvalidated(
  callback: () => void
): () => void {
  window.addEventListener(
    SESSION_INVALIDATED_EVENT,
    callback
  );
  return () =>
    window.removeEventListener(
      SESSION_INVALIDATED_EVENT,
      callback
    );
}
