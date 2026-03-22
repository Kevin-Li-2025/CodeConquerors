import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HazardPreviewCard from '@/components/MapView/HazardPreviewCard';
import type { Hazard } from '@/components/MapView/MapTypes';

const sampleHazard: Hazard = {
  id: '1',
  title: 'Broken light',
  type: 'broken_light',
  latitude: 52.48,
  longitude: -1.89,
  description: 'Dim',
  status: 'Pending',
  locationText: 'Near centre',
  reportedTime: '1h ago',
};

describe('HazardPreviewCard', () => {
  it('returns null when not visible', () => {
    const { toJSON } = render(
      <HazardPreviewCard
        visible={false}
        hazard={sampleHazard}
        onClose={jest.fn()}
        onOpenDetails={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders hazard and triggers actions', () => {
    const onClose = jest.fn();
    const onOpenDetails = jest.fn();

    const { getByText } = render(
      <HazardPreviewCard
        visible
        hazard={sampleHazard}
        onClose={onClose}
        onOpenDetails={onOpenDetails}
      />,
    );

    expect(getByText('Broken light')).toBeTruthy();
    expect(getByText('BROKEN LIGHT')).toBeTruthy();

    fireEvent.press(getByText('Details'));
    expect(onOpenDetails).toHaveBeenCalled();
  });
});
