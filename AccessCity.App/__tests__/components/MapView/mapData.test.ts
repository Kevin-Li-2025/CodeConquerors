import { hazards, reportHazardOptions, reportHazardLabelMap } from '@/components/MapView/mapData';

describe('mapData', () => {
  it('exposes sample hazards and report options', () => {
    expect(hazards.length).toBeGreaterThan(0);
    expect(reportHazardOptions.some((o) => o.key === 'other')).toBe(true);
    expect(reportHazardLabelMap.unsafe_crossing).toBe('Unsafe crossing');
  });
});
