export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  displayName: string;
}

export interface LoginSession {
  token: string;
  user: AuthenticatedUser;
}
