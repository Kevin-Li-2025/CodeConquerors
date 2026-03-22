jest.mock('expo-speech', () => ({
  stop: jest.fn(),
  speak: jest.fn(),
}));

import * as Speech from 'expo-speech';
import {
  stepsFromApi,
  stopVoiceGuidance,
  runVoiceGuidance,
  stepsFromCoordinates,
} from '@/components/MapView/voiceGuidance';

describe('voiceGuidance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stepsFromApi maps OSRM-style steps', () => {
    const steps = stepsFromApi([
      { instruction: 'Turn left', to: { coordinates: [-1.9, 52.5] } },
    ]);
    expect(steps).toEqual([{ toLng: -1.9, toLat: 52.5, instruction: 'Turn left' }]);
  });

  it('stepsFromApi returns empty for non-array', () => {
    expect(stepsFromApi(null)).toEqual([]);
  });

  it('stopVoiceGuidance stops speech', () => {
    stopVoiceGuidance();
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('runVoiceGuidance speaks first step when lastSpoken is -1', () => {
    const ref = { current: -1 };
    runVoiceGuidance(0, 0, [{ toLat: 1, toLng: 1, instruction: '  Go  ' }], ref);
    expect(Speech.speak).toHaveBeenCalledWith('Go', expect.any(Object));
    expect(ref.current).toBe(0);
  });

  it('stepsFromCoordinates returns arrive instruction for straight line', () => {
    const coords = [
      { latitude: 52.48, longitude: -1.89 },
      { latitude: 52.481, longitude: -1.891 },
    ];
    const steps = stepsFromCoordinates(coords);
    expect(steps.some((s) => s.instruction.includes('Arrive'))).toBe(true);
  });

  it('stepsFromCoordinates returns empty for short path', () => {
    expect(stepsFromCoordinates([{ latitude: 0, longitude: 0 }])).toEqual([]);
  });
});
