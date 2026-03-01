import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AdminVerificationsPage from '@/app/admin/verifications/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('AdminVerificationsPage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    (globalThis as any).__mockSearchParams = new URLSearchParams();
  });

  it('opens verification review modal when clicking Review', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        verifications: [
          {
            id: 'verification-1',
            user_id: 'user-1',
            user_email: 'user@dryft.site',
            user_name: 'User One',
            stripe_verified: true,
            jumio_status: 'pending',
            overall_status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
    });

    render(<AdminVerificationsPage />);

    await screen.findByText('User One');

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    await waitFor(() => {
      expect(screen.getByText('Verification Review')).toBeInTheDocument();
    });
  });
});
