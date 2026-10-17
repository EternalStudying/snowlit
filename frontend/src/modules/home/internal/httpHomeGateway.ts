import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  HomeLocationSnapshot,
  HomeOverview
} from '../model';
import type { HomeGateway } from './ports';

export interface HttpHomeGatewayOptions {
  adapter?: HttpAdapter;
}

export function createHttpHomeGateway({
  adapter
}: HttpHomeGatewayOptions = {}): HomeGateway {
  const request = adapter
    ? createSessionRequest({ adapter })
    : sessionRequest;

  return {
    fetchOverview() {
      return request.json<HomeOverview>({
        path: '/api/home',
        failure: {
          message: '首页数据加载失败',
          responseMessage: 'ignore'
        }
      });
    },

    reportLocation(snapshot: HomeLocationSnapshot) {
      return request.noContent({
        path: '/api/home/location',
        method: 'POST',
        body: { kind: 'json', value: snapshot },
        failure: {
          message: '位置上报失败',
          responseMessage: 'ignore'
        }
      });
    }
  };
}
