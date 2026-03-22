import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RouteInfoCard from '@/components/MapView/RouteInfoCard';

describe('RouteInfoCard', () => {
  it('compact state shows Route action', () => {
    const onPressRoute = jest.fn();
    const onStartNavigation = jest.fn();

    const { getByText } = render(
      <RouteInfoCard
        visible={false}
        travelTime=""
        distance=""
        safetyScore=""
        onPressRoute={onPressRoute}
        onStartNavigation={onStartNavigation}
      />,
    );

    fireEvent.press(getByText('Route'));
    expect(onPressRoute).toHaveBeenCalled();
  });

  it('expanded state shows safety labels and start navigation', () => {
    const onPressRoute = jest.fn();
    const onStartNavigation = jest.fn();

    const { getByText } = render(
      <RouteInfoCard
        visible
        travelTime="12 min"
        distance="2.1 km"
        safetyScore="85%"
        onPressRoute={onPressRoute}
        onStartNavigation={onStartNavigation}
      />,
    );

    expect(getByText('Good')).toBeTruthy();
    expect(getByText('Low')).toBeTruthy();

    fireEvent.press(getByText('Start Navigation'));
    expect(onStartNavigation).toHaveBeenCalled();
  });
});
