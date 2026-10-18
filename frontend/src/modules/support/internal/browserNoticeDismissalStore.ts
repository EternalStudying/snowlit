import type { UpdateNotice } from '../model';
import type { NoticeDismissalStore } from './ports';

const STORAGE_KEY = 'snowlit:update-notice:dismissed';
const MAX_DISMISSED_NOTICES = 20;

export function createBrowserNoticeDismissalStore(): NoticeDismissalStore {
  return {
    isDismissed(notice) {
      return readDismissedNoticeKeys().includes(
        noticeDismissalKey(notice)
      );
    },

    remember(notice) {
      const keys = new Set(readDismissedNoticeKeys());
      keys.add(noticeDismissalKey(notice));
      writeDismissedNoticeKeys(
        Array.from(keys).slice(-MAX_DISMISSED_NOTICES)
      );
    }
  };
}

function noticeDismissalKey(notice: UpdateNotice): string {
  return `${notice.id}:${notice.version}:${notice.publishedAt}`;
}

function readDismissedNoticeKeys(): string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as unknown)
      : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

function writeDismissedNoticeKeys(keys: string[]): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(keys)
    );
  } catch {
    // The backend mute operation still provides persistent dismissal.
  }
}
