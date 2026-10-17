import {
  afterEach,
  describe,
  expect,
  it
} from 'vitest';
import { createBrowserNoticeDismissalStore } from '../internal/browserNoticeDismissalStore';
import type { UpdateNotice } from '../model';

describe('BrowserNoticeDismissalStore', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('容忍损坏存储，并按公告 ID、版本和发布时间区分关闭记录', () => {
    sessionStorage.setItem(
      'snowlit:update-notice:dismissed',
      '{broken'
    );
    const store = createBrowserNoticeDismissalStore();
    const notice = createNotice(1);

    expect(store.isDismissed(notice)).toBe(false);
    store.remember(notice);

    expect(store.isDismissed(notice)).toBe(true);
    expect(store.isDismissed({
      ...notice,
      version: '2026.05.18'
    })).toBe(false);
  });

  it('只保留最近二十条公告关闭记录', () => {
    const store = createBrowserNoticeDismissalStore();
    const notices = Array.from(
      { length: 22 },
      (_, index) => createNotice(index + 1)
    );

    notices.forEach((notice) => store.remember(notice));

    expect(store.isDismissed(notices[0])).toBe(false);
    expect(store.isDismissed(notices[1])).toBe(false);
    expect(store.isDismissed(notices[2])).toBe(true);
    expect(JSON.parse(
      sessionStorage.getItem(
        'snowlit:update-notice:dismissed'
      ) ?? '[]'
    )).toHaveLength(20);
  });
});

function createNotice(id: number): UpdateNotice {
  return {
    id,
    title: `更新 ${id}`,
    version: `2026.05.${String(id).padStart(2, '0')}`,
    publishedAt: `2026-05-${String(id).padStart(2, '0')}T20:00:00`,
    items: []
  };
}
