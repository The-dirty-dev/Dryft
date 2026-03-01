import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StoreScreen from '../../screens/main/StoreScreen';

jest.mock('../../store/marketplaceStore', () => ({
  useMarketplaceStore: () => ({
    items: [],
    totalItems: 0,
    currentPage: 0,
    isLoadingStore: false,
    loadItems: jest.fn(),
    searchItems: jest.fn(),
    setFilter: jest.fn(),
  }),
}));

describe('StoreScreen', () => {
  it('renders empty state when no items', () => {
    render(<StoreScreen />);
    expect(screen.getByText('No items found')).toBeTruthy();
  });
});
