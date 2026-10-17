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
  setAuthToken
} from '../../../auth';
import { createHttpDiaryGateway } from '../internal/httpDiaryGateway';
import type {
  DiaryArchiveDto,
  DiaryDetailDto,
  DiaryMonthDto,
  DiarySummaryDto
} from '../model';

const summary: DiarySummaryDto = {
  id: 10,
  role: 'girlfriend',
  authorName: '伴侣 B',
  authorAvatar: '',
  title: '今天的光',
  summary: '正文摘要',
  imageUrls: [],
  entryDate: '2026-05-17',
  moodKey: 'happy',
  locationName: '示例街区 A',
  weather: '晴',
  visibility: 'shared',
  createdAt: '2026-05-17T18:00:00',
  updatedAt: '2026-05-17T18:00:00'
};

const detail: DiaryDetailDto = {
  ...summary,
  contentMarkdown: '# 今天的光\n\n正文',
  rawWeather: '晴',
  temperature: 22,
  windDirection: '东风',
  windPower: '≤3',
  humidity: '60',
  province: '示例地区 A',
  city: '示例城市 A',
  district: '示例街区 A',
  latitude: 52.52,
  longitude: 13.41
};

describe('HttpDiaryGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuthToken();
    setAuthToken('diary-token');
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('初始化、归档、月份和详情保留路径、query 与 Bearer 契约', async () => {
    const archive: DiaryArchiveDto = {
      years: [
        {
          year: 2026,
          months: [
            {
              month: '2026-05',
              count: 1,
              hasEntries: true
            }
          ]
        }
      ]
    };
    const month: DiaryMonthDto = {
      month: '2026-05',
      items: [summary]
    };
    const adapter = viAdapter([
      jsonResponse({ coupleRole: 'girlfriend' }),
      jsonResponse(archive),
      jsonResponse(month),
      jsonResponse(detail)
    ]);
    const gateway = createHttpDiaryGateway({ adapter });

    await expect(gateway.fetchCurrentRole()).resolves.toBe(
      'girlfriend'
    );
    await expect(gateway.fetchArchive(2026)).resolves.toEqual(
      archive
    );
    await expect(
      gateway.fetchMonth('2026-05')
    ).resolves.toEqual(month);
    await expect(gateway.fetchDetail(10)).resolves.toEqual(
      detail
    );

    expect(adapter).toHaveBeenNthCalledWith(1, '/api/auth/me', {
      headers: { Authorization: 'Bearer diary-token' }
    });
    expect(adapter).toHaveBeenNthCalledWith(
      2,
      '/api/diary/months?year=2026',
      { headers: { Authorization: 'Bearer diary-token' } }
    );
    expect(adapter).toHaveBeenNthCalledWith(
      3,
      '/api/diary?month=2026-05',
      { headers: { Authorization: 'Bearer diary-token' } }
    );
    expect(adapter).toHaveBeenNthCalledWith(4, '/api/diary/10', {
      headers: { Authorization: 'Bearer diary-token' }
    });
  });

  it('创建、更新、删除和图片上传保留 JSON、无响应体与 multipart 契约', async () => {
    const adapter = viAdapter([
      jsonResponse(summary),
      jsonResponse(detail),
      new Response(null, { status: 204 }),
      jsonResponse({
        uploadId: 99,
        url: 'https://cdn.example.com/diary/image.webp'
      })
    ]);
    const gateway = createHttpDiaryGateway({ adapter });
    const createInput = {
      contentMarkdown: '# 今天的光\n\n正文',
      date: '2026-05-17',
      moodKey: 'happy' as const,
      visibility: 'shared' as const
    };
    const updateInput = {
      contentMarkdown: '# 改过标题\n\n正文',
      moodKey: 'sweet' as const,
      visibility: 'private' as const
    };
    const image = new File(['image'], 'diary.webp', {
      type: 'image/webp'
    });

    await gateway.createEntry(createInput);
    await gateway.updateEntry(10, updateInput);
    await gateway.deleteEntry(10);
    await gateway.uploadImage(image);

    expect(adapter).toHaveBeenNthCalledWith(1, '/api/diary', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer diary-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createInput)
    });
    expect(adapter).toHaveBeenNthCalledWith(
      2,
      '/api/diary/10',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer diary-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateInput)
      }
    );
    expect(adapter).toHaveBeenNthCalledWith(
      3,
      '/api/diary/10',
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer diary-token' }
      }
    );
    const [uploadPath, uploadInit] = adapter.mock.calls[3] as [
      string,
      RequestInit
    ];
    expect(uploadPath).toBe('/api/diary/images');
    expect(uploadInit).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer diary-token' }
    });
    expect(uploadInit.body).toBeInstanceOf(FormData);
    expect((uploadInit.body as FormData).get('file')).toBe(image);
  });

  it('优先保留后端中文错误消息', async () => {
    const adapter = viAdapter([
      jsonResponse(
        {
          code: 'DIARY_MOOD_INVALID',
          message: '心情不正确'
        },
        400
      )
    ]);
    const gateway = createHttpDiaryGateway({ adapter });

    await expect(
      gateway.fetchMonth('bad')
    ).rejects.toThrow('心情不正确');
  });
});

function viAdapter(responses: Response[]) {
  let index = 0;
  return vi.fn(
    async (_input: string, _init?: RequestInit) =>
      responses[index++]
  );
}

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
