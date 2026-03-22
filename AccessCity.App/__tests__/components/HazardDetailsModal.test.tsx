import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HazardDetailsModal from '@/components/MapView/HazardDetailsModal';
import type { Hazard } from '@/components/MapView/MapTypes';

const hazard: Hazard = {
  id: '1',
  title: 'Dim corridor',
  type: 'lighting',
  latitude: 52.48,
  longitude: -1.89,
  description: 'Very dark.',
  status: 'Pending',
  locationText: 'City centre',
  reportedTime: '5m ago',
};

describe('HazardDetailsModal', () => {
  it('shows hazard fields and Close triggers onClose', () => {
    const onClose = jest.fn();

    const { getByText } = render(
      <HazardDetailsModal visible hazard={hazard} onClose={onClose} />,
    );

    expect(getByText('Dim corridor')).toBeTruthy();
    expect(getByText('Status: Pending')).toBeTruthy();
    expect(getByText('Very dark.')).toBeTruthy();

    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
