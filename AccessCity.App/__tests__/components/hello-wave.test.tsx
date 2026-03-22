import React from 'react';
import { render } from '@testing-library/react-native';
import { HelloWave } from '@/components/hello-wave';

describe('HelloWave', () => {
  it('renders wave emoji', () => {
    const { getByText } = render(<HelloWave />);
    expect(getByText('👋')).toBeTruthy();
  });
});
