import * as Haptics from 'expo-haptics';
import { renderHook, act } from '@testing-library/react-native';
import { useFormAnimation } from '@/hooks/use-form-animation';

describe('useFormAnimation', () => {
  it('shake triggers haptic feedback', () => {
    const { result } = renderHook(() => useFormAnimation());

    act(() => {
      result.current.shake();
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });
});
