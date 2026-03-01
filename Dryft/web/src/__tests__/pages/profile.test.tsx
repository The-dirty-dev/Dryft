import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ProfilePage from '@/app/profile/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  clearTokens: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.put.mockReset();
    mockApiClient.getToken.mockReset();
  });

  it('enters edit mode when Edit Profile is clicked', async () => {
    mockApiClient.getToken.mockReturnValue('token');
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        user: {
          id: 'user-1',
          email: 'user@dryft.site',
          display_name: 'Alex',
          bio: 'Hello',
          avatar_url: null,
          verified: true,
          created_at: new Date().toISOString(),
          stats: {
            inventory_count: 0,
            total_spent: 0,
          },
        },
      },
    });

    render(<ProfilePage />);

    await screen.findByText('Alex');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));

    await waitFor(() => {
      expect(screen.getByText('Display Name')).toBeInTheDocument();
    });
  });
});
