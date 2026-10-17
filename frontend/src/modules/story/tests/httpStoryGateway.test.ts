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
import { createHttpStoryGateway } from '../internal/httpStoryGateway';
import type {
  StoryMoment,
  StoryMomentInput
} from '../model';

const moment: StoryMoment & {longitude: number; latitude: number} = {
  id: 2,
  title: '第一次去海边散步',
  content: '傍晚的风很温柔。',
  eventTime: '2026-04-05T18:30:00',
  endTime: '2026-04-06T00:00:00',
  locationName: '尼斯海边',
  address: '法国尼斯',
  longitude: 7.26,
  latitude: 43.70,
  category: 'travel',
  images: ['https://example.com/sea.jpg'],
  createdByUserId: 1,
  createdAt: '2026-04-05T18:30:00',
  updatedAt: '2026-04-05T18:30:00'
};

const input: StoryMomentInput = {
  title: moment.title,
  content: moment.content,
  eventTime: moment.eventTime,
  endTime: moment.endTime,
  locationName: moment.locationName,
  address: moment.address,
  longitude: moment.longitude,
  latitude: moment.latitude,
  category: moment.category,
  images: moment.images
};

describe('HttpStoryGateway', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuthToken();
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('公开列表与详情保留筛选 query，并在无会话时不附认证头', async () => {
    const list = {
      items: [moment],
      years: [2026],
      canManage: false
    };
    const adapter = viAdapter([
      jsonResponse(list),
      jsonResponse(moment)
    ]);
    const gateway = createHttpStoryGateway({ adapter });

    await expect(
      gateway.fetchMoments({
        category: 'travel',
        year: 2026
      })
    ).resolves.toEqual(list);
    await expect(gateway.fetchMoment(2)).resolves.toEqual(moment);

    expect(adapter).toHaveBeenNthCalledWith(
      1,
      '/api/story/moments?category=travel&year=2026',
      undefined
    );
    expect(adapter).toHaveBeenNthCalledWith(
      2,
      '/api/story/moments/2',
      undefined
    );
  });

  it('创建、更新、删除和图片上传保留 JSON、204 与 multipart 契约', async () => {
    setAuthToken('story-token');
    const adapter = viAdapter([
      jsonResponse(moment),
      jsonResponse({ ...moment, title: '更新后' }),
      new Response(null, { status: 204 }),
      jsonResponse({ url: 'https://example.com/upload.jpg' })
    ]);
    const gateway = createHttpStoryGateway({ adapter });
    const image = new File(['image'], 'story.jpg', {
      type: 'image/jpeg'
    });

    await gateway.createMoment(input);
    await gateway.updateMoment(2, {
      ...input,
      title: '更新后'
    });
    await gateway.deleteMoment(2);
    await gateway.uploadImage(image);

    expect(adapter).toHaveBeenNthCalledWith(
      1,
      '/api/story/moments',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer story-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      }
    );
    expect(adapter).toHaveBeenNthCalledWith(
      2,
      '/api/story/moments/2',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer story-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...input,
          title: '更新后'
        })
      }
    );
    expect(adapter).toHaveBeenNthCalledWith(
      3,
      '/api/story/moments/2',
      {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer story-token'
        }
      }
    );
    const upload = adapter.mock.calls[3];
    expect(upload[0]).toBe('/api/story/moments/images');
    expect(upload[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer story-token'
      }
    });
    expect((upload[1]?.body as FormData).get('file')).toBe(image);
  });
});

function viAdapter(responses: Response[]) {
  return vi.fn(async (_path: string, _init?: RequestInit) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected Story request');
    }
    return response;
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
