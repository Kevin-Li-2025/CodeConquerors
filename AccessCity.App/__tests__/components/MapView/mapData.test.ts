import { reportHazardOptions, reportHazardLabelMap } from '@/components/MapView/mapData';

describe('mapData', () => {
  it('exposes report options used by the live report flow', () => {
    expect(reportHazardOptions.some((o) => o.key === 'other')).toBe(true);
    expect(reportHazardLabelMap.unsafe_crossing).toBe('Unsafe crossing');
  });
});
