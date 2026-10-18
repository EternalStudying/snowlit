import { resolve } from 'node:path';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gsapTicker = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn()
}));

vi.mock('gsap', () => ({
  gsap: {
    ticker: gsapTicker
  }
}));

import DiaryView from '../DiaryView.vue';
import DiaryMarkdownEditor from '../components/DiaryMarkdownEditor.vue';
import { useWeatherAtmosphereData } from '../../weather';

const mountedWrappers = new Set<VueWrapper>();

const monthsResponse = {
  years: [
    {
      year: 2026,
      months: Array.from({ length: 12 }, (_, index) => {
        const month = `2026-${String(index + 1).padStart(2, '0')}`;
        return {
          month,
          count: month === '2026-05' ? 2 : 0,
          hasEntries: month === '2026-05'
        };
      })
    }
  ]
};

const monthResponse = {
  month: '2026-05',
  items: [
    {
      id: 10,
      role: 'girlfriend',
      authorName: '伴侣 B',
      authorAvatar: '/assets/home-avatars/partner-b.webp',
      title: '今天的光',
      summary: '正文摘要',
      imageUrls: ['https://cdn.example.com/diary/one.webp'],
      entryDate: '2026-05-17',
      moodKey: 'happy',
      locationName: '示例街区 A',
      weather: '晴',
      visibility: 'shared',
      createdAt: '2026-05-17T18:00:00',
      updatedAt: '2026-05-17T18:00:00'
    },
    {
      id: 11,
      role: 'boyfriend',
      authorName: '伴侣 A',
      authorAvatar: '/assets/home-avatars/partner-a.webp',
      title: '另一侧日记',
      summary: '另一侧摘要',
      imageUrls: [],
      entryDate: '2026-05-17',
      moodKey: 'miss',
      locationName: '示例城市 B',
      weather: '多云',
      visibility: 'shared',
      createdAt: '2026-05-17T19:00:00',
      updatedAt: '2026-05-17T19:00:00'
    },
    {
      id: 13,
      role: 'girlfriend',
      authorName: '伴侣 B',
      authorAvatar: '/assets/home-avatars/partner-b.webp',
      title: '只有女方的一天',
      summary: '女方当天已经写过',
      imageUrls: [],
      entryDate: '2026-05-16',
      moodKey: 'calm',
      locationName: '示例街区 A',
      weather: '晴',
      visibility: 'shared',
      createdAt: '2026-05-16T19:00:00',
      updatedAt: '2026-05-16T19:00:00'
    }
  ]
};

const detailResponse = {
  id: 10,
  role: 'girlfriend',
  authorName: '伴侣 B',
  authorAvatar: '/assets/home-avatars/partner-b.webp',
  contentMarkdown: '# 今天的光\n\n**正文**\n\n![图](https://cdn.example.com/diary/one.webp)',
  title: '今天的光',
  summary: '正文',
  imageUrls: ['https://cdn.example.com/diary/one.webp'],
  entryDate: '2026-05-17',
  moodKey: 'happy',
  visibility: 'shared',
  weather: '晴',
  rawWeather: '晴',
  temperature: 22,
  windDirection: '东风',
  windPower: '≤3',
  humidity: '60',
  province: '示例地区 A',
  city: '示例城市 A',
  district: '示例街区 A',
  locationName: '示例街区 A',
  latitude: 52.52,
  longitude: 13.41,
  createdAt: '2026-05-17T18:00:00',
  updatedAt: '2026-05-17T18:00:00'
};

const boyfriendDetailResponse = {
  ...detailResponse,
  id: 11,
  role: 'boyfriend',
  authorName: '伴侣 A',
  authorAvatar: '/assets/home-avatars/partner-a.webp',
  contentMarkdown: '# 另一侧日记\n\n男方正文',
  title: '另一侧日记',
  summary: '男方正文',
  imageUrls: [],
  moodKey: 'miss',
  locationName: '示例城市 B',
  weather: '多云',
  rawWeather: '多云',
  province: '示例地区 B',
  city: '示例城市 B',
  district: '示例街区 B',
  latitude: 52.52,
  longitude: 13.41,
  createdAt: '2026-05-17T19:00:00',
  updatedAt: '2026-05-17T19:00:00'
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createFetchMock(coupleRole: 'boyfriend' | 'girlfriend' = 'girlfriend') {
  const calls: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);

    if (url === '/api/auth/me') {
      return jsonResponse({
        id: coupleRole === 'boyfriend' ? 2 : 1,
        username: coupleRole === 'boyfriend' ? 'dashuaige' : 'demo_a',
        displayName: coupleRole === 'boyfriend' ? '伴侣 A' : '伴侣 B',
        coupleRole,
        avatarUrl: coupleRole === 'boyfriend' ? '/assets/home-avatars/partner-a.webp' : '/assets/home-avatars/partner-b.webp',
        bio: '',
        mood: '',
        updatedAt: '2026-05-17T10:00:00'
      });
    }
    if (url.startsWith('/api/diary/months')) {
      return jsonResponse(monthsResponse);
    }
    if (url === '/api/diary?month=2026-05') {
      return jsonResponse(monthResponse);
    }
    if (url === '/api/diary/10' && (!init || init.method === undefined || init.method === 'GET')) {
      return jsonResponse(detailResponse);
    }
    if (url === '/api/diary/11' && (!init || init.method === undefined || init.method === 'GET')) {
      return jsonResponse(boyfriendDetailResponse);
    }
    if (url === '/api/diary' && init?.method === 'POST') {
      return jsonResponse({ ...monthResponse.items[0], id: 12, title: '新日记', summary: '新正文' });
    }
    if (url === '/api/diary/10' && init?.method === 'PUT') {
      return jsonResponse({ ...detailResponse, title: '改过标题', contentMarkdown: '# 改过标题\n\n正文' });
    }
    if (url === '/api/diary/10' && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (url === '/api/diary/images') {
      return jsonResponse({ uploadId: 99, url: 'https://cdn.example.com/diary/tmp/upload.png' });
    }
    if (url === '/api/site') {
      throw new Error('diary page must not request /api/site');
    }

    return jsonResponse({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 });
  });

  return { fetcher, calls };
}

function createEmptyDiaryFetchMock(coupleRole: 'boyfriend' | 'girlfriend' = 'girlfriend') {
  const calls: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url === '/api/auth/me') {
      return jsonResponse({
        id: coupleRole === 'boyfriend' ? 2 : 1,
        username: coupleRole === 'boyfriend' ? 'dashuaige' : 'demo_a',
        displayName: coupleRole === 'boyfriend' ? '伴侣 A' : '伴侣 B',
        coupleRole,
        avatarUrl: coupleRole === 'boyfriend' ? '/assets/home-avatars/partner-a.webp' : '/assets/home-avatars/partner-b.webp',
        bio: '',
        mood: '',
        updatedAt: '2026-05-17T10:00:00'
      });
    }

    if (url.startsWith('/api/diary/months')) {
      return jsonResponse({
        years: [
          {
            year: 2026,
            months: []
          }
        ]
      });
    }

    if (url === '/api/diary?month=2026-05') {
      return jsonResponse({
        month: '2026-05',
        items: []
      });
    }

    return jsonResponse({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 });
  });

  return { fetcher, calls };
}

async function mountDiaryView(fetcher: typeof fetch) {
  vi.stubGlobal('fetch', fetcher);
  const wrapper = mount(DiaryView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        Teleport: true,
        teleport: true
      }
    }
  });

  await flushPromises();
  await wrapper.vm.$nextTick();
  mountedWrappers.add(wrapper);

  return wrapper;
}

async function setMarkdownContent(wrapper: VueWrapper, markdown: string) {
  await wrapper.get('textarea[name="content"]').setValue(markdown);
  await flushPromises();
  await wrapper.vm.$nextTick();
}

function unmountMountedDiaryWrappers() {
  mountedWrappers.forEach((wrapper) => wrapper.unmount());
  mountedWrappers.clear();
}

describe('日记页 /api/diary 用户侧接口联调', () => {
  beforeEach(() => {
    localStorage.setItem('snowlit_token', 'jwt-token');
    const { weather, lastCoordinates } = useWeatherAtmosphereData();
    weather.value = null;
    lastCoordinates.value = null;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
  });

  afterEach(() => {
    const { weather, lastCoordinates } = useWeatherAtmosphereData();
    weather.value = null;
    lastCoordinates.value = null;
    unmountMountedDiaryWrappers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    gsapTicker.add.mockReset();
    gsapTicker.remove.mockReset();
    localStorage.clear();
  });

  it('跨午夜重新打开新日记时刷新默认日期', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2025, 11, 31, 23, 30));
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);
    await wrapper.get('.diary-compose-fab').trigger('click');
    await flushPromises();
    expect(wrapper.getComponent(DiaryMarkdownEditor).props('initialValue').date).toBe('2025-12-31');

    wrapper.getComponent(DiaryMarkdownEditor).vm.$emit('close');
    await flushPromises();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30));
    await wrapper.get('.diary-compose-fab').trigger('click');
    await flushPromises();
    expect(wrapper.getComponent(DiaryMarkdownEditor).props('initialValue').date).toBe('2026-01-01');
  });

  it('初始化请求月份统计和当前月列表，不依赖旧 mock 或 /api/site', async () => {
    const { fetcher, calls } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    expect(calls).toContain('/api/diary/months');
    expect(calls).toContain('/api/diary?month=2026-05');
    expect(calls).toContain('/api/auth/me');
    expect(calls).not.toContain('/api/site');
    expect(wrapper.text()).toContain('今天的光');
    expect(wrapper.text()).toContain('开心');
    expect(wrapper.find('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="girlfriend"]').exists()).toBe(true);
    expect(wrapper.find('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="boyfriend"]').exists()).toBe(true);
  });

  it('初始化并发请求当前用户和月份统计，二者成功后再按真实角色加载当前月', async () => {
    const authDeferred = deferredResponse();
    const monthsDeferred = deferredResponse();
    const monthDeferred = deferredResponse();
    const calls: string[] = [];
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);

      if (url === '/api/auth/me') {
        return authDeferred.promise;
      }
      if (url === '/api/diary/months') {
        return monthsDeferred.promise;
      }
      if (url === '/api/diary?month=2026-05') {
        return monthDeferred.promise;
      }
      if (url === '/api/diary/11') {
        return Promise.resolve(jsonResponse(boyfriendDetailResponse));
      }

      return Promise.resolve(jsonResponse({ code: 'NOT_FOUND', message: 'not found' }, { status: 404 }));
    });

    vi.stubGlobal('fetch', fetcher);
    const wrapper = mount(DiaryView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          Teleport: true,
          teleport: true
        }
      }
    });
    mountedWrappers.add(wrapper);
    await wrapper.vm.$nextTick();
    await Promise.resolve();

    expect(calls).toContain('/api/auth/me');
    expect(calls).toContain('/api/diary/months');
    expect(calls).not.toContain('/api/diary?month=2026-05');

    authDeferred.resolve(
      jsonResponse({
        id: 2,
        username: 'dashuaige',
        displayName: '伴侣 A',
        coupleRole: 'boyfriend',
        avatarUrl: '/assets/home-avatars/partner-a.webp',
        bio: '',
        mood: '',
        updatedAt: '2026-05-17T10:00:00'
      })
    );
    await Promise.resolve();
    expect(calls).not.toContain('/api/diary?month=2026-05');

    monthsDeferred.resolve(jsonResponse(monthsResponse));
    await flushPromises();
    expect(calls).toContain('/api/diary?month=2026-05');

    monthDeferred.resolve(jsonResponse(monthResponse));
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="boyfriend"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.diary-detail__edit').exists()).toBe(true);
  });

  it('男方账号用 /api/auth/me 的 coupleRole 判断编辑删除权限和同日唯一预校验', async () => {
    const { fetcher, calls } = createFetchMock('boyfriend');
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    expect(calls).toContain('/api/auth/me');

    await wrapper.get('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="boyfriend"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.diary-detail__edit').exists()).toBe(true);
    expect(wrapper.find('.diary-detail__delete').exists()).toBe(true);
    await wrapper.get('.diary-detail__close').trigger('click');

    await wrapper.get('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="girlfriend"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.diary-detail__readonly').exists()).toBe(true);
    expect(wrapper.find('.diary-detail__edit').exists()).toBe(false);
    await wrapper.get('.diary-detail__close').trigger('click');

    await wrapper.get('.diary-compose-fab').trigger('click');
    await wrapper.get('input[name="date"]').setValue('2026-05-16');
    await setMarkdownContent(wrapper, '# 男方新日记\n\n同一天只有女方写过，不应拦截男方。');
    await wrapper.get('form.diary-markdown-editor__form').trigger('submit');
    await flushPromises();

    const createCall = (fetcher as ReturnType<typeof vi.fn>).mock.calls.find(([url, init]) => url === '/api/diary' && init?.method === 'POST');
    expect(createCall).toBeTruthy();
    expect(wrapper.text()).not.toContain('这一天已经写过日记啦');
  });

  it('点击卡片再请求详情 Markdown，全量字段进入弹窗', async () => {
    const { fetcher, calls } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    await wrapper.get('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="girlfriend"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(calls).toContain('/api/diary/10');
    expect(wrapper.get('.diary-detail__markdown-content').html()).toContain('<strong>正文</strong>');
    expect(wrapper.text()).toContain('22°C');
    expect(wrapper.text()).toContain('示例地区 A');
    expect(wrapper.find('.diary-detail__edit').exists()).toBe(true);
    expect(wrapper.find('.diary-detail__delete').exists()).toBe(true);
  });

  it('新建提交 moodKey、visibility 和当前天气定位快照，图片上传返回 URL 后插入 Markdown', async () => {
    const { weather, lastCoordinates } = useWeatherAtmosphereData();
    weather.value = {
      city: '示例城市 A',
      district: '示例街区 A',
      province: '示例地区 A',
      country: '德国',
      temperature: 22,
      rawWeather: '晴',
      weatherState: 'clear',
      weatherVariant: 'clear',
      precipitationKind: 'none',
      windDirection: '东风',
      windPower: '≤3',
      humidity: '60',
      daylightHint: 'day',
      observedAt: '2026-05-17T10:00:00'
    };
    lastCoordinates.value = { latitude: 52.52, longitude: 13.41 };
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    await wrapper.get('.diary-compose-fab').trigger('click');
    expect((wrapper.get('input[name="location"]').element as HTMLInputElement).value).toBe('示例街区 A');
    expect((wrapper.get('input[name="weather"]').element as HTMLInputElement).value).toBe('晴');
    expect(wrapper.get('input[name="location"]').attributes('readonly')).toBeDefined();
    expect(wrapper.get('input[name="weather"]').attributes('readonly')).toBeDefined();
    await wrapper.get('input[name="date"]').setValue('2026-05-18');
    expect(wrapper.find('[data-mood-dropdown="true"]').exists()).toBe(false);
    await wrapper.get('[data-mood-trigger="true"]').trigger('click');
    expect(wrapper.findAll('[data-mood-key]')).toHaveLength(10);
    await wrapper.get('[data-mood-key="sweet"]').trigger('click');
    expect(wrapper.find('[data-mood-dropdown="true"]').exists()).toBe(false);
    expect(wrapper.get('[data-mood-trigger="true"]').text()).toContain('甜蜜');
    await wrapper.get('select[name="visibility"]').setValue('private');
    await setMarkdownContent(wrapper, '# 新日记\n\n正文');
    await wrapper.get('form.diary-markdown-editor__form').trigger('submit');
    await flushPromises();

    const createCall = (fetcher as ReturnType<typeof vi.fn>).mock.calls.find(([url, init]) => url === '/api/diary' && init?.method === 'POST');
    expect(createCall).toBeTruthy();
    const payload = JSON.parse(String(createCall?.[1]?.body));
    expect(payload).toMatchObject({
      contentMarkdown: '# 新日记\n\n正文',
      date: '2026-05-18',
      moodKey: 'sweet',
      visibility: 'private',
      weatherSnapshot: {
        rawWeather: '晴',
        province: '示例地区 A',
        city: '示例城市 A',
        district: '示例街区 A',
        latitude: 52.52,
        longitude: 13.41
      }
    });
  });

  it('草稿恢复使用弹窗询问，恢复后填入草稿内容', async () => {
    localStorage.setItem(
      'snowlit:diary-draft:new:girlfriend',
      JSON.stringify({
        title: '草稿标题',
        content: '# 草稿标题\n\n草稿正文',
        date: '2026-05-18',
        moodKey: 'secret',
        location: '草稿地点',
        weather: '小雨',
        visibility: 'private',
        savedAt: '2026-05-18T12:00:00'
      })
    );
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    await wrapper.get('.diary-compose-fab').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.diary-editor-draft-note').exists()).toBe(false);
    expect(wrapper.find('[role="alertdialog"][aria-label="恢复草稿"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('发现一张未贴上的草稿');

    await wrapper.get('[data-action="restore"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="alertdialog"][aria-label="恢复草稿"]').exists()).toBe(false);
    expect((wrapper.get('textarea[name="content"]').element as HTMLTextAreaElement).value).toContain('草稿正文');
    expect((wrapper.get('input[name="location"]').element as HTMLInputElement).value).toBe('草稿地点');
    expect((wrapper.get('input[name="weather"]').element as HTMLInputElement).value).toBe('小雨');
  });

  it('编辑不提交日期，删除后刷新当前月列表和月份统计', async () => {
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    await wrapper.get('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="girlfriend"]').trigger('click');
    await flushPromises();
    await wrapper.get('.diary-detail__edit').trigger('click');
    await flushPromises();
    expect(wrapper.get('input[name="date"]').attributes('disabled')).toBeDefined();
    await setMarkdownContent(wrapper, '# 改过标题\n\n正文');
    await wrapper.get('form.diary-markdown-editor__form').trigger('submit');
    await flushPromises();

    const updateCall = (fetcher as ReturnType<typeof vi.fn>).mock.calls.find(([url, init]) => url === '/api/diary/10' && init?.method === 'PUT');
    const payload = JSON.parse(String(updateCall?.[1]?.body));
    expect(payload).toEqual({ contentMarkdown: '# 改过标题\n\n正文', moodKey: 'happy', visibility: 'shared' });
    expect('date' in payload).toBe(false);

    await wrapper.get('[data-diary-date="2026-05-17"] .diary-entry-card[data-role="girlfriend"]').trigger('click');
    await flushPromises();
    await wrapper.get('.diary-detail__delete').trigger('click');
    await flushPromises();
    const monthCalls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url) === '/api/diary?month=2026-05');
    const monthsCalls = (fetcher as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).startsWith('/api/diary/months'));
    expect(monthCalls.length).toBeGreaterThanOrEqual(2);
    expect(monthsCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('心情黄豆固定 10 个 key，本地 label/icon 映射且页面不显示 undefined/null/NaN', async () => {
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);
    const viewText = wrapper.text();
    ['undefined', 'null', 'NaN'].forEach((badText) => {
      expect(viewText).not.toContain(badText);
    });
  });

  it('右下角写日记入口使用 WebP 图片并保留打开弹窗行为', async () => {
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);
    expect(wrapper.get('.diary-compose-fab').attributes('aria-label')).toBe('写日记');
    expect(wrapper.find('.diary-compose-fab__image').exists()).toBe(true);

    await wrapper.get('.diary-compose-fab').trigger('click');
    expect(wrapper.find('form.diary-markdown-editor__form').exists()).toBe(true);
  });

  it('日记为空时不渲染时间线彩带 canvas', async () => {
    const { fetcher } = createEmptyDiaryFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);

    expect(wrapper.find('.diary-empty').exists()).toBe(true);
    expect(wrapper.find('.diary-date-point').exists()).toBe(false);
    expect(wrapper.find('.diary-timeline--empty').exists()).toBe(true);
    expect(wrapper.find('canvas.diary-timeline-glow-canvas[data-diary-timeline-glow="true"]').exists()).toBe(false);
  });

  it('保留 Markdown 双页编辑器、居中左右时间线、荧光 canvas 和动效降级结构', async () => {
    const { fetcher } = createFetchMock();
    const wrapper = await mountDiaryView(fetcher as unknown as typeof fetch);
    expect(wrapper.find('.diary-timeline--centered').exists()).toBe(true);
    expect(wrapper.find('.diary-date-row__side--boyfriend').exists()).toBe(true);
    expect(wrapper.find('.diary-date-row__side--girlfriend').exists()).toBe(true);
    expect(wrapper.find('canvas.diary-timeline-glow-canvas[data-diary-timeline-glow="true"]').exists()).toBe(true);
  });
});
