import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  MessageEntry,
  MessagePageDto
} from '../model';
import type { MessageGateway } from './ports';

export interface HttpMessageGatewayOptions {
  adapter?: HttpAdapter;
}

const MESSAGE_FAILURE = {
  message: '留言请求失败',
  responseMessage: 'prefer'
} as const;

export function createHttpMessageGateway({
  adapter
}: HttpMessageGatewayOptions = {}): MessageGateway {
  const request = adapter
    ? createSessionRequest({ adapter })
    : sessionRequest;

  return {
    fetchPage(query = {}) {
      const params = new URLSearchParams();
      params.set('page', String(query.page ?? 1));
      params.set('size', String(query.size ?? 20));
      return request.json<MessagePageDto>({
        path: `/api/messages?${params.toString()}`,
        failure: MESSAGE_FAILURE
      });
    },

    createMessage(input, image = null) {
      const form = new FormData();
      form.append(
        'payload',
        new Blob(
          [JSON.stringify(input)],
          { type: 'application/json' }
        )
      );
      if (image) {
        form.append('image', image);
      }

      return request.json<MessageEntry>({
        path: '/api/messages',
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: MESSAGE_FAILURE
      });
    },

    deleteMessage(id) {
      return request.noContent({
        path: `/api/messages/${id}`,
        method: 'DELETE',
        failure: MESSAGE_FAILURE
      });
    }
  };
}
