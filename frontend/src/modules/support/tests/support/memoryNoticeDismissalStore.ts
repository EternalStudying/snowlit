import type {
  NoticeDismissalStore
} from '../../internal/ports';
import type { UpdateNotice } from '../../model';

export function createMemoryNoticeDismissalStore(
  initialNotices: UpdateNotice[] = []
): NoticeDismissalStore {
  const keys = new Set(
    initialNotices.map(noticeDismissalKey)
  );

  return {
    isDismissed(notice) {
      return keys.has(noticeDismissalKey(notice));
    },

    remember(notice) {
      keys.add(noticeDismissalKey(notice));
    }
  };
}

function noticeDismissalKey(notice: UpdateNotice): string {
  return `${notice.id}:${notice.version}:${notice.publishedAt}`;
}
