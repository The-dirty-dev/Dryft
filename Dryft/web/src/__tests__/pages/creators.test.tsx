import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CreatorsPage from '@/app/creators/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('CreatorsPage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
  });

  it('searches creators and updates results', async () => {
    mockApiClient.get.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/v1/creators/search')) {
        return Promise.resolve({ success: true, data: { creators: [], total: 0 } });
      }
      return Promise.resolve({
        success: true,
        data: {
          creators: [
            {
              id: 'creator-1',
              user_id: 'user-1',
              store_name: 'Creator One',
            display_name: 'Creator One',
              stripe_onboarded: true,
              payouts_enabled: true,
              total_sales: 0,
              total_earnings: 0,
              item_count: 0,
              rating: 0,
              rating_count: 0,
              is_verified: false,
              is_featured: false,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
        },
      });
    });

    render(<CreatorsPage />);

    await screen.findByText('Creator One');

    fireEvent.change(screen.getByPlaceholderText('Search creators...'), {
      target: { value: 'Nope' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('No creators found')).toBeInTheDocument();
    });
  });
});
