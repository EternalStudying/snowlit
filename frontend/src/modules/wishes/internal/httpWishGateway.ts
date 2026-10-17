import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  WishDetailDto,
  WishPageDto,
  WishSummaryDto
} from '../model';
import type { WishGateway } from './ports';

export interface HttpWishGatewayOptions {
  adapter?: HttpAdapter;
}

const WISH_FAILURE = {
  message: '清单请求失败',
  networkMessage: '清单数据加载失败',
  responseMessage: 'prefer'
} as const;

export function createHttpWishGateway({
  adapter
}: HttpWishGatewayOptions = {}): WishGateway {
  const request = adapter ? createSessionRequest({ adapter }) : sessionRequest;

  return {
    fetchPage(query) {
      const params = new URLSearchParams();
      if (query.category) {
        params.set('category', query.category);
      }
      params.set('completed', String(query.completed));
      params.set('page', String(query.page));
      params.set('size', String(query.size));

      return request.json<WishPageDto>({
        path: `/api/wishes?${params.toString()}`,
        failure: WISH_FAILURE
      });
    },

    fetchDetail(id) {
      return request.json<WishDetailDto>({
        path: `/api/wishes/${id}`,
        failure: WISH_FAILURE
      });
    },

    completeWish(id, image) {
      const form = new FormData();
      form.append('image', image);

      return request.json<WishSummaryDto>({
        path: `/api/wishes/${id}/complete`,
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: WISH_FAILURE
      });
    },

    reopenWish(id) {
      return request.json<WishSummaryDto>({
        path: `/api/wishes/${id}/reopen`,
        method: 'POST',
        failure: WISH_FAILURE
      });
    },

    createWish(input, image) {
      const form = new FormData();
      form.append(
        'payload',
        new Blob([JSON.stringify(input)], { type: 'application/json' })
      );
      if (image) {
        form.append('image', image);
      }

      return request.json<WishSummaryDto>({
        path: '/api/wishes',
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: WISH_FAILURE
      });
    }
  };
}
