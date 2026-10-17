import type { LoginGateway } from '../../internal/ports';
import type {
  LoginCredentials,
  LoginSession
} from '../../model';

export interface MemoryLoginGatewayOptions {
  session?: LoginSession;
  authenticate?: (
    credentials: LoginCredentials
  ) => Promise<LoginSession>;
}

export function createMemoryLoginGateway({
  session = {
    token: 'memory-token',
    user: {
      id: 1,
      username: 'lover',
      displayName: '小夏'
    }
  },
  authenticate
}: MemoryLoginGatewayOptions = {}): LoginGateway {
  return {
    authenticate(credentials) {
      return authenticate
        ? authenticate(credentials)
        : Promise.resolve(structuredClone(session));
    }
  };
}
