const TOKEN_KEY = 'snowlit_token';
const SESSION_INVALIDATED_EVENT = 'snowlit:logout';

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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
