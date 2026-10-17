import {
  reactive,
  ref,
  type Ref
} from 'vue';
import type {
  LoginCredentials,
  LoginSession
} from '../model';
import { createHttpLoginGateway } from './httpLoginGateway';
import type { LoginGateway } from './ports';

export interface LoginLifecycleState {
  credentials: LoginCredentials;
  submitting: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
}

export interface LoginLifecycle {
  state: LoginLifecycleState;
  submit(): Promise<boolean>;
}

export interface LoginLifecycleOptions {
  gateway?: LoginGateway;
  onAuthenticated(
    session: LoginSession
  ): Promise<void> | void;
}

export function createLoginLifecycle({
  gateway = createHttpLoginGateway(),
  onAuthenticated
}: LoginLifecycleOptions): LoginLifecycle {
  const credentials = reactive<LoginCredentials>({
    username: '',
    password: ''
  });
  const submitting = ref(false);
  const error = ref('');

  async function submit(): Promise<boolean> {
    if (submitting.value) {
      return false;
    }

    const input: LoginCredentials = {
      username: credentials.username.trim(),
      password: credentials.password
    };
    if (!input.username || !input.password) {
      error.value = '请输入账号和密码';
      return false;
    }

    submitting.value = true;
    error.value = '';
    try {
      const session = await gateway.authenticate(input);
      await onAuthenticated(session);
      return true;
    } catch (cause) {
      error.value =
        cause instanceof Error
          ? cause.message
          : '登录失败，请稍后再试';
      return false;
    } finally {
      submitting.value = false;
    }
  }

  return {
    state: {
      credentials,
      submitting,
      error
    },
    submit
  };
}

export function useLoginLifecycle(
  options: LoginLifecycleOptions
): LoginLifecycle {
  return createLoginLifecycle(options);
}
