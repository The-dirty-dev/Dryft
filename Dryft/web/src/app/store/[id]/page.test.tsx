import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetailPage from '@/app/store/[id]/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('store/[id] page', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApiClient.getToken.mockReset();
    (globalThis as any).__mockParams = { id: 'item-1' };

    mockApiClient.get.mockImplementation((url: string) => {
      if (url === '/v1/store/items/item-1') {
        return Promise.resolve({
          success: true,
          data: {
            item: {
              id: 'item-1',
              name: 'Neon Crown',
              description: 'Premium wearable',
              thumbnail_url: '',
              item_type: 'avatar',
              creator_id: 'creator-1',
              creator_name: 'Creator Prime',
              rating: 4.9,
              rating_count: 12,
              purchase_count: 40,
              price: 999,
              currency: 'usd',
              is_featured: true,
              is_owned: false,
              preview_urls: [],
            },
          },
        });
      }
      if (url === '/v1/store/items/item-1/reviews?limit=10') {
        return Promise.resolve({ success: true, data: { reviews: [] } });
      }
      return Promise.resolve({ success: true, data: {} });
    });
  });

  it('renders item details and purchase action', async () => {
    render(<ItemDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Neon Crown' })).toBeInTheDocument();
      expect(screen.getByText('Buy for $9.99')).toBeInTheDocument();
    });
  });

  it('redirects to login when user is not authenticated', async () => {
    mockApiClient.getToken.mockReturnValue(null);

    render(<ItemDetailPage />);
    await screen.findByRole('heading', { name: 'Neon Crown' });

    fireEvent.click(screen.getByRole('button', { name: 'Buy for $9.99' }));

    expect((globalThis as any).__mockRouter.push).toHaveBeenCalledWith('/login');
  });

  it('initiates checkout when user is authenticated', async () => {
    mockApiClient.getToken.mockReturnValue('token');
    mockApiClient.post.mockResolvedValue({
      success: true,
      data: { client_secret: 'cs_1', purchase_id: 'purchase_1' },
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });

    render(<ItemDetailPage />);
    await screen.findByRole('heading', { name: 'Neon Crown' });

    fireEvent.click(screen.getByRole('button', { name: 'Buy for $9.99' }));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/store/purchase', { item_id: 'item-1' });
      expect(window.location.href).toContain('/checkout?secret=cs_1&purchase=purchase_1');
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
