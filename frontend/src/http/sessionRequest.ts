import { getAuthToken, invalidateSession as invalidateAuthSession } from '../auth';

export type HttpAdapter = (path: string, init?: RequestInit) => Promise<Response>;

export type RequestFailureKind = 'network' | 'http' | 'invalid-response';

export class RequestFailure extends Error {
  readonly kind: RequestFailureKind;
  readonly status: number;
  readonly code?: string;

  constructor(
    kind: RequestFailureKind,
    message: string,
    options: {
      status: number;
      code?: string;
      cause?: unknown;
    }
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'RequestFailure';
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
  }
}

export type RequestBody =
  | {
      kind: 'json';
      value: unknown;
    }
  | {
      kind: 'form';
      value: FormData;
    };

export interface RequestFailurePolicy {
  message: string;
  networkMessage?: string;
  responseMessage?: 'prefer' | 'ignore';
}

export interface RequestCall {
  path: `/api/${string}`;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: RequestBody;
  headers?: Readonly<Record<string, string>>;
  session?: 'attach' | 'omit';
  keepalive?: boolean;
  failure: RequestFailurePolicy;
}

export interface SessionRequest {
  json<T>(call: RequestCall): Promise<T>;
  noContent(call: RequestCall): Promise<void>;
}

interface SessionRequestDependencies {
  adapter?: HttpAdapter;
  readToken?: () => string;
  invalidateSession?: () => void;
}

interface ErrorPayload {
  code?: string;
  message?: string;
}

const dynamicFetchAdapter: HttpAdapter = (path, init) => globalThis.fetch(path, init);

export function createSessionRequest({
  adapter = dynamicFetchAdapter,
  readToken = getAuthToken,
  invalidateSession = invalidateAuthSession
}: SessionRequestDependencies = {}): SessionRequest {
  async function send(call: RequestCall): Promise<Response> {
    const init = createRequestInit(call, readToken);

    try {
      const response = await adapter(call.path, init);
      if (response.ok) {
        return response;
      }

      const payload = await readErrorPayload(response);
      const isSessionFailure =
        call.session !== 'omit' &&
        response.status === 401 &&
        (payload.code === undefined || payload.code === 'UNAUTHORIZED');

      if (isSessionFailure) {
        invalidateSession();
        throw new RequestFailure(
          'http',
          payload.message || '登录已过期，请重新登录',
          requestFailureDetails(response.status, payload.code)
        );
      }

      const message =
        call.failure.responseMessage === 'prefer'
          ? payload.message || call.failure.message
          : call.failure.message;
      throw new RequestFailure(
        'http',
        message,
        requestFailureDetails(response.status, payload.code)
      );
    } catch (error) {
      if (error instanceof RequestFailure) {
        throw error;
      }

      throw new RequestFailure(
        'network',
        call.failure.networkMessage ?? call.failure.message,
        { status: 0, cause: error }
      );
    }
  }

  return {
    async json<T>(call: RequestCall): Promise<T> {
      const response = await send(call);
      try {
        return (await response.json()) as T;
      } catch (error) {
        throw new RequestFailure('invalid-response', call.failure.message, {
          status: response.status,
          cause: error
        });
      }
    },

    async noContent(call: RequestCall): Promise<void> {
      await send(call);
    }
  };
}

export const sessionRequest = createSessionRequest();

function createRequestInit(call: RequestCall, readToken: () => string): RequestInit | undefined {
  const headers = createHeaders(call, readToken);
  const init: RequestInit = {};

  if (call.keepalive) init.keepalive = true;
  if (call.method) {
    init.method = call.method;
  }
  if (Object.keys(headers).length > 0) {
    init.headers = headers;
  }
  if (call.body?.kind === 'json') {
    init.body = JSON.stringify(call.body.value);
  } else if (call.body?.kind === 'form') {
    init.body = call.body.value;
  }

  return Object.keys(init).length > 0 ? init : undefined;
}

function createHeaders(call: RequestCall, readToken: () => string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [name, value] of Object.entries(call.headers ?? {})) {
    if (name.toLowerCase() !== 'authorization') {
      headers[name] = value;
    }
  }

  if (call.body?.kind === 'json') {
    removeHeader(headers, 'content-type');
    headers['Content-Type'] = 'application/json';
  } else if (call.body?.kind === 'form') {
    removeHeader(headers, 'content-type');
  }

  if (call.session !== 'omit') {
    const token = readToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function removeHeader(headers: Record<string, string>, normalizedName: string): void {
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === normalizedName) {
      delete headers[name];
    }
  }
}

async function readErrorPayload(response: Response): Promise<ErrorPayload> {
  try {
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== 'object') {
      return {};
    }

    const record = body as Record<string, unknown>;
    return {
      ...(typeof record.code === 'string' && record.code ? { code: record.code } : {}),
      ...(typeof record.message === 'string' && record.message ? { message: record.message } : {})
    };
  } catch {
    return {};
  }
}

function requestFailureDetails(status: number, code?: string): { status: number; code?: string } {
  return {
    status,
    ...(code ? { code } : {})
  };
}
