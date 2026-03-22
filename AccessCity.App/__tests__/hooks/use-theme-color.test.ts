import { useThemeColor } from '@/hooks/use-theme-color';
import { renderHook } from '@testing-library/react-native';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

describe('useThemeColor', () => {
  it('uses prop override in light mode', () => {
    jest.mocked(useColorScheme).mockReturnValue('light');

    const { result } = renderHook(() =>
      useThemeColor({ light: '#abcdef', dark: '#fedcba' }, 'background'),
    );

    expect(result.current).toBe('#abcdef');
  });

  it('falls back to theme palette when prop missing', () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');

    const { result } = renderHook(() => useThemeColor({}, 'tint'));

    expect(result.current).toBe(Colors.dark.tint);
  });
});
