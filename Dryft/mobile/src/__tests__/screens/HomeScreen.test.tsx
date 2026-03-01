import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../../screens/main/HomeScreen';

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { display_name: 'Taylor' },
  }),
}));

jest.mock('../../store/marketplaceStore', () => ({
  useMarketplaceStore: () => ({
    featuredItems: [],
    popularItems: [],
    loadFeaturedItems: jest.fn().mockResolvedValue(undefined),
    loadPopularItems: jest.fn().mockResolvedValue(undefined),
    isLoadingStore: false,
  }),
}));

jest.mock('../../components/ItemCard', () => ({
  __esModule: true,
  default: () => null,
}));

describe('HomeScreen', () => {
  it('renders greeting and VR companion card', () => {
    render(<HomeScreen />);

    expect(screen.getByText('Hey, Taylor!')).toBeTruthy();
    expect(screen.getByText('Join VR Session')).toBeTruthy();
    expect(screen.getByText('Browse Store')).toBeTruthy();
  });
});
