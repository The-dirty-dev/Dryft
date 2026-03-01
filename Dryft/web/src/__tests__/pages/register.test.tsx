import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import RegisterPage from '@/app/register/page';

const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
  saveTokens: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    mockApiClient.post.mockReset();
    mockApiClient.saveTokens.mockReset();
  });

  it('shows an error when passwords do not match', async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@dryft.site' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password124' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });
});
