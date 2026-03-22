import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FilterModal from '@/components/MapView/FilterModal';
import type { RouteFilters } from '@/components/MapView/MapTypes';

const baseFilters: RouteFilters = {
  avoidSteepHills: false,
  wheelchairAccessible: false,
  avoidReportedHazards: false,
  preferWellLitStreets: false,
  minSafetyScore: 10,
  maxSafetyScore: 90,
};

describe('FilterModal', () => {
  it('calls toggle, apply, reset, and safety steppers', () => {
    const onClose = jest.fn();
    const onToggleFilter = jest.fn();
    const onAdjustMinSafety = jest.fn();
    const onAdjustMaxSafety = jest.fn();
    const onApply = jest.fn();
    const onReset = jest.fn();

    const { getByText, getAllByText } = render(
      <FilterModal
        visible
        routeFilters={baseFilters}
        onClose={onClose}
        onToggleFilter={onToggleFilter}
        onAdjustMinSafety={onAdjustMinSafety}
        onAdjustMaxSafety={onAdjustMaxSafety}
        onApply={onApply}
        onReset={onReset}
      />,
    );

    fireEvent.press(getByText('Avoid steep hills'));
    expect(onToggleFilter).toHaveBeenCalledWith('avoidSteepHills');

    fireEvent.press(getByText('Apply'));
    expect(onApply).toHaveBeenCalled();

    fireEvent.press(getByText('Reset'));
    expect(onReset).toHaveBeenCalled();

    const plus = getAllByText('+');
    fireEvent.press(plus[0]);
    expect(onAdjustMinSafety).toHaveBeenCalledWith(10);

    const minus = getAllByText('-');
    fireEvent.press(minus[1]);
    expect(onAdjustMaxSafety).toHaveBeenCalledWith(-10);
  });
});
