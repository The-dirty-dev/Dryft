import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import StorePage from '@/app/store/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('StorePage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
  });

  it('searches items and renders results', async () => {
    mockApiClient.get.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/v1/store/categories')) {
        return Promise.resolve({ success: true, data: { categories: [] } });
      }
      if (endpoint.startsWith('/v1/store/items')) {
        return Promise.resolve({ success: true, data: { items: [], total: 0 } });
      }
      if (endpoint.startsWith('/v1/store/search')) {
        return Promise.resolve({
          success: true,
          data: {
            items: [
              {
                id: 'item-1',
                name: 'Test Toy',
                description: 'A toy',
                price: 499,
                currency: 'usd',
                type: 'toy',
                creator_id: 'creator-1',
                creator_name: 'Creator',
                tags: [],
                purchase_count: 0,
                rating: 0,
                rating_count: 0,
                is_featured: false,
                is_owned: false,
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    render(<StorePage />);

    fireEvent.change(screen.getByPlaceholderText('Search items...'), {
      target: { value: 'toy' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Test Toy')).toBeInTheDocument();
    });
  });
});
