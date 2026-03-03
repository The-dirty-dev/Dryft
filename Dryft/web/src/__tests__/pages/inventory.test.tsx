import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryPage from '@/app/inventory/page';

const mockApiClient = vi.hoisted(() => ({
  getToken: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('InventoryPage', () => {
  beforeEach(() => {
    mockApiClient.getToken.mockReset();
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();

    const router = (globalThis as any).__mockRouter;
    router.push.mockReset();
  });

  it('redirects to login when user is not authenticated', async () => {
    mockApiClient.getToken.mockReturnValue(null);

    render(<InventoryPage />);

    await waitFor(() => {
      const router = (globalThis as any).__mockRouter;
      expect(router.push).toHaveBeenCalledWith('/login');
    });
  });

  it('renders inventory and equips an item', async () => {
    mockApiClient.getToken.mockReturnValue('token');
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'inv-1',
            item_id: 'item-1',
            item_type: 'avatar',
            name: 'Neon Avatar',
            thumbnail_url: 'https://cdn.example/avatar.png',
            is_equipped: false,
          },
        ],
      },
    });
    mockApiClient.post.mockResolvedValue({ success: true });

    render(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Neon Avatar')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Equip' }));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/inventory/inv-1/equip', {});
    });
  });

  it('requests filtered inventory when type filter changes', async () => {
    mockApiClient.getToken.mockReturnValue('token');
    mockApiClient.get.mockResolvedValue({ success: true, data: { items: [] } });

    render(<InventoryPage />);

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/v1/inventory');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Avatars' }));

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/v1/inventory?type=avatar');
    });
  });
});
