import React from 'react';
import { render, screen } from '@testing-library/react-native';
import DiscoverScreen from '../../screens/discover/DiscoverScreen';

jest.mock('../../store/matchingStore', () => ({
  useMatchingStore: () => ({
    discoverProfiles: [],
    currentProfileIndex: 0,
    isLoadingDiscover: true,
    loadDiscoverProfiles: jest.fn(),
    swipe: jest.fn(),
    nextProfile: jest.fn(),
  }),
}));

describe('DiscoverScreen', () => {
  it('renders loading state', () => {
    render(<DiscoverScreen />);
    expect(screen.getByText('Finding people near you...')).toBeTruthy();
  });
});
