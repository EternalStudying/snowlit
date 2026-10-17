import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  DiaryArchiveDto,
  DiaryDetailDto,
  DiaryImageUploadDto,
  DiaryMonthDto,
  DiaryRole,
  DiarySummaryDto
} from '../model';
import type { DiaryGateway } from './ports';

export interface HttpDiaryGatewayOptions {
  adapter?: HttpAdapter;
}

interface CurrentDiaryUserDto {
  coupleRole: DiaryRole;
}

const DIARY_FAILURE = {
  message: '日记操作失败',
  networkMessage: '日记数据加载失败',
  responseMessage: 'prefer'
} as const;

const CURRENT_ROLE_FAILURE = {
  message: '用户资料加载失败',
  responseMessage: 'ignore'
} as const;

export function createHttpDiaryGateway({
  adapter
}: HttpDiaryGatewayOptions = {}): DiaryGateway {
  const request = adapter ? createSessionRequest({ adapter }) : sessionRequest;

  return {
    async fetchCurrentRole() {
      const user = await request.json<CurrentDiaryUserDto>({
        path: '/api/auth/me',
        failure: CURRENT_ROLE_FAILURE
      });
      return user.coupleRole;
    },

    fetchArchive(year) {
      const query =
        typeof year === 'number'
          ? `?year=${encodeURIComponent(String(year))}`
          : '';
      return request.json<DiaryArchiveDto>({
        path: `/api/diary/months${query}`,
        failure: DIARY_FAILURE
      });
    },

    fetchMonth(month) {
      return request.json<DiaryMonthDto>({
        path: `/api/diary?month=${encodeURIComponent(month)}`,
        failure: DIARY_FAILURE
      });
    },

    fetchDetail(id) {
      return request.json<DiaryDetailDto>({
        path: `/api/diary/${id}`,
        failure: DIARY_FAILURE
      });
    },

    createEntry(input) {
      return request.json<DiarySummaryDto>({
        path: '/api/diary',
        method: 'POST',
        body: { kind: 'json', value: input },
        failure: DIARY_FAILURE
      });
    },

    updateEntry(id, input) {
      return request.json<DiaryDetailDto>({
        path: `/api/diary/${id}`,
        method: 'PUT',
        body: { kind: 'json', value: input },
        failure: DIARY_FAILURE
      });
    },

    deleteEntry(id) {
      return request.noContent({
        path: `/api/diary/${id}`,
        method: 'DELETE',
        failure: DIARY_FAILURE
      });
    },

    uploadImage(file) {
      const form = new FormData();
      form.append('file', file);
      return request.json<DiaryImageUploadDto>({
        path: '/api/diary/images',
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: DIARY_FAILURE
      });
    }
  };
}
