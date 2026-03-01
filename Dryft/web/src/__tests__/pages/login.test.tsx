import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import LoginPage from '@/app/login/page';

const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
  saveTokens: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockApiClient.post.mockReset();
    mockApiClient.saveTokens.mockReset();
    const router = (globalThis as any).__mockRouter;
    router.push.mockReset();
  });

  it('submits login form and navigates on success', async () => {
    mockApiClient.post.mockResolvedValue({
      success: true,
      data: {
        tokens: {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        },
      },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@dryft.site' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      const router = (globalThis as any).__mockRouter;
      expect(router.push).toHaveBeenCalledWith('/');
    });
  });
});
