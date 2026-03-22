import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/components/MapView/AdminHazardReport', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'admin-hazard-report' }, 'AdminHazardReport');
});

import AdminHazardReportPage from '@/app/(tabs)/report/adminHazard-report';

describe('AdminHazardReportPage', () => {
  it('renders AdminHazardReport', () => {
    const { getByTestId } = render(<AdminHazardReportPage />);
    expect(getByTestId('admin-hazard-report')).toBeTruthy();
  });
});
