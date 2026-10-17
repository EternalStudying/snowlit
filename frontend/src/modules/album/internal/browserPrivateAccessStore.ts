import type { AlbumPrivateToken } from '../model';
import type { AlbumPrivateAccessStore } from './ports';

const PRIVATE_TOKEN_KEY_PREFIX = 'snowlit_album_private_token_';

export function createBrowserPrivateAccessStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
  now: () => number = Date.now
): AlbumPrivateAccessStore {
  function tokenKey(albumId: number) {
    return `${PRIVATE_TOKEN_KEY_PREFIX}${albumId}`;
  }

  return {
    get(albumId) {
      const raw = storage.getItem(tokenKey(albumId));
      if (!raw) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as AlbumPrivateToken;
        if (!parsed.token || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= now()) {
          storage.removeItem(tokenKey(albumId));
          return null;
        }
        return parsed.token;
      } catch {
        storage.removeItem(tokenKey(albumId));
        return null;
      }
    },
    set(albumId, value) {
      storage.setItem(tokenKey(albumId), JSON.stringify(value));
    },
    clear(albumId) {
      storage.removeItem(tokenKey(albumId));
    }
  };
}
