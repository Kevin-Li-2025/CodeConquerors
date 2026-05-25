import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import ReportPage from '@/app/(tabs)/report/reportpage';
import { geocodingService } from '@/services/geocoding.service';
jest.mock('@/components/MapView/ReportHazardModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: function MockReportModal({
      visible,
      onClose,
      reportStep,
      onNext,
      onSubmit,
      locationLabel,
      locationHint,
    }: {
      visible: boolean;
      onClose: () => void;
      reportStep: number;
      onNext: () => void;
      onSubmit: () => void;
      locationLabel?: string;
      locationHint?: string;
    }) {
      if (!visible) {
        return null;
      }
      return (
        <View testID="report-modal">
          <Text>step-{reportStep}</Text>
          <Text>{locationLabel}</Text>
          <Text>{locationHint}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close modal">
            <Text>Close</Text>
          </Pressable>
          <Pressable onPress={onNext} accessibilityLabel="Next step">
            <Text>Next</Text>
          </Pressable>
          <Pressable onPress={onSubmit} accessibilityLabel="Submit report">
            <Text>Submit</Text>
          </Pressable>
        </View>
      );
    },
  };
});

jest.mock('@/services/geocoding.service', () => ({
  geocodingService: {
    reverse: jest.fn(),
  },
}));

describe('ReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(geocodingService.reverse).mockResolvedValue(null);
  });

  it('shows report modal on mount', async () => {
    const { findByTestId } = render(<ReportPage />);
    expect(await findByTestId('report-modal')).toBeTruthy();
  });

  it('closes modal and goes back', async () => {
    const { findByLabelText } = render(<ReportPage />);
    fireEvent.press(await findByLabelText('Close modal'));
    expect(router.back).toHaveBeenCalled();
  });

  it('uses reverse geocoding for the report location label', async () => {
    jest.mocked(geocodingService.reverse).mockResolvedValue({
      display_name: 'New Street, Birmingham',
    });

    const { findByText } = render(<ReportPage />);

    expect(await findByText('New Street, Birmingham')).toBeTruthy();
    expect(await findByText('Location matched automatically')).toBeTruthy();
  });
});
