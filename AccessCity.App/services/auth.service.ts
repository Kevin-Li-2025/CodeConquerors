import { api } from './api';
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  deleteItemAsync,
  getItemAsync,
  setItemAsync,
} from './sessionStorage';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ResetPasswordRequest,
} from '../models/auth';

type StoredUser = {
  email?: string;
  fullName?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const authService = {
  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', request, {
      skipAuth: true,
    });

    await this.saveSession(response);
    return response;
  },

  async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', request, {
      skipAuth: true,
    });

    await this.saveSession(response);
    return response;
  },

  async saveSession(data: AuthResponse) {
    if (!isNonEmptyString(data?.token)) {
      throw new Error('Missing access token in auth response');
    }

    if (!isNonEmptyString(data?.refreshToken)) {
      throw new Error('Missing refresh token in auth response');
    }

    await setItemAsync(TOKEN_KEY, data.token);
    await setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);

    const userData: StoredUser = {
      email: data.email,
      fullName: data.fullName,
    };

    await setItemAsync(USER_KEY, JSON.stringify(userData));
  },

  async getSession() {
    const token = await getItemAsync(TOKEN_KEY);
    const refreshToken = await getItemAsync(REFRESH_TOKEN_KEY);
    const userJson = await getItemAsync(USER_KEY);

    if (!isNonEmptyString(token)) {
      return null;
    }

    if (!userJson) {
      return null;
    }

    try {
      const user = JSON.parse(userJson);

      return {
        token,
        refreshToken: isNonEmptyString(refreshToken) ? refreshToken : null,
        user,
      };
    } catch (error) {
      console.warn('FAILED TO PARSE USER SESSION:', error);
      return null;
    }
  },

  async clearSession() {
    await deleteItemAsync(TOKEN_KEY);
    await deleteItemAsync(REFRESH_TOKEN_KEY);
    await deleteItemAsync(USER_KEY);
  },

  async logout() {
    const refreshToken = await getItemAsync(REFRESH_TOKEN_KEY);

    if (isNonEmptyString(refreshToken)) {
      try {
        await api.request(`/auth/revoke-token?token=${encodeURIComponent(refreshToken)}`, {
          method: 'POST',
          skipAuth: true,
        });
      } catch (e) {
        console.warn('BACKEND LOGOUT FAILED:', e);
      }
    }

    await this.clearSession();
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return api.post<{ message: string }>(
      '/auth/forgot-password',
      { email },
      { skipAuth: true }
    );
  },

  async resetPassword(
    request: ResetPasswordRequest
  ): Promise<{ message: string }> {
    return api.post<{ message: string }>(
      '/auth/reset-password',
      request,
      { skipAuth: true }
    );
  },
};
