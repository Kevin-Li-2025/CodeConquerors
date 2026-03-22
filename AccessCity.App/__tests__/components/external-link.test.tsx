import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { Text, Pressable } = require('react-native');
  return {
    Link: ({ children, href, onPress, ...rest }: any) => (
      <Pressable
        accessibilityLabel={`ext-${href}`}
        onPress={() =>
          onPress?.({
            preventDefault: jest.fn(),
          })
        }
        {...rest}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

import * as WebBrowser from 'expo-web-browser';
import { ExternalLink } from '@/components/external-link';

describe('ExternalLink', () => {
  const originalOs = process.env.EXPO_OS;

  beforeEach(() => {
    process.env.EXPO_OS = 'ios';
    jest.mocked(WebBrowser.openBrowserAsync).mockClear();
  });

  afterEach(() => {
    process.env.EXPO_OS = originalOs;
  });

  it('opens in-app browser on native', async () => {
    const { getByLabelText } = render(
      <ExternalLink href="https://example.com/path">Open</ExternalLink>,
    );

    fireEvent.press(getByLabelText('ext-https://example.com/path'));

    await waitFor(() => {
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        'https://example.com/path',
        expect.objectContaining({ presentationStyle: 'automatic' }),
      );
    });
  });
});
