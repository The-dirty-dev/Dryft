import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import CreatorScreen from '../../screens/detail/CreatorScreen';
import marketplaceApi from '../../api/marketplace';

jest.mock('../../api/marketplace', () => ({
  __esModule: true,
  default: {
    getCreator: jest.fn(),
    getCreatorItems: jest.fn(),
  },
  marketplaceApi: {
    getCreator: jest.fn(),
    getCreatorItems: jest.fn(),
  },
}));

const mockNavigation = {
  setOptions: jest.fn(),
  navigate: jest.fn(),
};

describe('CreatorScreen', () => {
  it('renders creator details and items', async () => {
    (marketplaceApi.getCreator as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'creator-1',
        store_name: 'Neon Creator',
        display_name: 'Neon Creator',
        bio: 'Creating neon vibes',
        item_count: 2,
        total_sales: 10,
        average_rating: 4.8,
        is_verified: true,
      },
    });

    (marketplaceApi.getCreatorItems as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'item-1', name: 'Neon Avatar', item_type: 'avatar', price: 0, currency: 'usd' },
        ],
      },
    });

    render(
      <CreatorScreen
        route={{ params: { creatorId: 'creator-1' } } as any}
        navigation={mockNavigation as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Neon Creator')).toBeTruthy();
    });

    expect(screen.getAllByText('Items').length).toBeGreaterThanOrEqual(1);
  }, 15000);
});
