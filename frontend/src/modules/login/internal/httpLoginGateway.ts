import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  LoginCredentials,
  LoginSession
} from '../model';
import type { LoginGateway } from './ports';

export interface HttpLoginGatewayOptions {
  adapter?: HttpAdapter;
}

export function createHttpLoginGateway({
  adapter
}: HttpLoginGatewayOptions = {}): LoginGateway {
  const request = adapter
    ? createSessionRequest({ adapter })
    : sessionRequest;

  return {
    authenticate(credentials: LoginCredentials) {
      return request.json<LoginSession>({
        path: '/api/auth/login',
        method: 'POST',
        body: {
          kind: 'json',
          value: credentials
        },
        session: 'omit',
        failure: {
          message: '账号或密码错误',
          networkMessage: '登录请求失败',
          responseMessage: 'ignore'
        }
      });
    }
  };
}
