import type {
  LoginCredentials,
  LoginSession
} from '../model';

export interface LoginGateway {
  authenticate(
    credentials: LoginCredentials
  ): Promise<LoginSession>;
}
