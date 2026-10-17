import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  StoryImageUploadDto,
  StoryMoment,
  StoryMomentListDto
} from '../model';
import type { StoryGateway } from './ports';

export interface HttpStoryGatewayOptions {
  adapter?: HttpAdapter;
}

const STORY_FAILURE = {
  message: '点滴地图请求失败',
  networkMessage: '点滴地图加载失败',
  responseMessage: 'prefer'
} as const;

export function createHttpStoryGateway({
  adapter
}: HttpStoryGatewayOptions = {}): StoryGateway {
  const request = adapter
    ? createSessionRequest({ adapter })
    : sessionRequest;

  return {
    fetchMoments(filters = {}) {
      const query = new URLSearchParams();
      if (filters.category) {
        query.set('category', filters.category);
      }
      if (typeof filters.year === 'number') {
        query.set('year', String(filters.year));
      }

      const suffix = query.size ? `?${query.toString()}` : '';
      return request.json<StoryMomentListDto>({
        path: `/api/story/moments${suffix}`,
        failure: STORY_FAILURE
      });
    },

    fetchMoment(id) {
      return request.json<StoryMoment>({
        path: `/api/story/moments/${id}`,
        failure: STORY_FAILURE
      });
    },

    createMoment(input) {
      return request.json<StoryMoment>({
        path: '/api/story/moments',
        method: 'POST',
        body: { kind: 'json', value: input },
        failure: STORY_FAILURE
      });
    },

    updateMoment(id, input) {
      return request.json<StoryMoment>({
        path: `/api/story/moments/${id}`,
        method: 'PUT',
        body: { kind: 'json', value: input },
        failure: STORY_FAILURE
      });
    },

    deleteMoment(id) {
      return request.noContent({
        path: `/api/story/moments/${id}`,
        method: 'DELETE',
        failure: STORY_FAILURE
      });
    },

    uploadImage(file) {
      const form = new FormData();
      form.append('file', file);
      return request.json<StoryImageUploadDto>({
        path: '/api/story/moments/images',
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: STORY_FAILURE
      });
    }
  };
}
