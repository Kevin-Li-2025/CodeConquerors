import * as SecureStore from 'expo-secure-store';
import { authService } from '@/services/auth.service';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    post: jest.fn(),
    request: jest.fn(),
  },
}));

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('login posts credentials and saves session', async () => {
    jest.mocked(api.post).mockResolvedValue({
      token: 'access',
      refreshToken: 'refresh',
      email: 'u@test.com',
      fullName: 'User',
    });

    const result = await authService.login({ email: 'u@test.com', password: 'secret12' });

    expect(api.post).toHaveBeenCalledWith(
      '/auth/login',
      { email: 'u@test.com', password: 'secret12' },
      { skipAuth: true },
    );
    expect(result.token).toBe('access');
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
  });

  it('saveSession throws when token missing', async () => {
    await expect(
      authService.saveSession({
        token: '',
        refreshToken: 'r',
        email: 'a@b.com',
        fullName: 'A',
      } as never),
    ).rejects.toThrow('Missing access token');
  });

  it('getSession returns null without token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await expect(authService.getSession()).resolves.toBeNull();
  });

  it('forgotPassword posts email with skipAuth', async () => {
    jest.mocked(api.post).mockResolvedValue({ message: 'sent' });

    const res = await authService.forgotPassword('a@b.com');

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.com' }, { skipAuth: true });
    expect(res.message).toBe('sent');
  });

  it('resetPassword posts payload with skipAuth', async () => {
    jest.mocked(api.post).mockResolvedValue({ message: 'ok' });

    await authService.resetPassword({
      email: 'a@b.com',
      token: 'tok',
      newPassword: 'Password12',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/auth/reset-password',
      { email: 'a@b.com', token: 'tok', newPassword: 'Password12' },
      { skipAuth: true },
    );
  });

  it('logout revokes refresh token when present', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'ac_refresh_token') return 'refresh-val';
      return null;
    });
    jest.mocked(api.request).mockResolvedValue(undefined as never);

    await authService.logout();

    expect(api.request).toHaveBeenCalledWith(
      expect.stringContaining('/auth/revoke-token?token='),
      expect.objectContaining({ method: 'POST', skipAuth: true }),
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
