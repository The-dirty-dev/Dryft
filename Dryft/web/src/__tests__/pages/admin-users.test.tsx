import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AdminUsersPage from '@/app/admin/users/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    (globalThis as any).__mockSearchParams = new URLSearchParams();
  });

  it('opens user detail modal when clicking View', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        users: [
          {
            id: 'user-1',
            email: 'user@dryft.site',
            display_name: 'User One',
            verified: false,
            is_banned: false,
            role: 'user',
            created_at: new Date().toISOString(),
            stats: {
              inventory_count: 0,
              total_spent: 0,
              total_purchases: 0,
            },
          },
        ],
        total: 1,
      },
    });

    render(<AdminUsersPage />);

    await screen.findByText('User One');

    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    await waitFor(() => {
      expect(screen.getAllByText('user@dryft.site').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('requires confirmation before resetting verification and calls reset endpoint on confirm', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        users: [
          {
            id: 'user-1',
            email: 'verified@dryft.site',
            display_name: 'Verified User',
            verified: true,
            verified_at: new Date().toISOString(),
            is_banned: false,
            role: 'user',
            created_at: new Date().toISOString(),
            stats: {
              inventory_count: 2,
              total_spent: 4999,
              total_purchases: 3,
            },
          },
        ],
        total: 1,
      },
    });
    mockApiClient.post.mockResolvedValue({ success: true });

    render(<AdminUsersPage />);

    await screen.findByText('Verified User');
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    await screen.findByRole('button', { name: 'Reset Verification' });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Verification' }));

    await screen.findByText('Reset Verification?');
    const resetButtons = screen.getAllByRole('button', { name: 'Reset Verification' });
    fireEvent.click(resetButtons[resetButtons.length - 1]);

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/v1/admin/users/user-1/reset-verification',
        {}
      );
    });
  });
});
