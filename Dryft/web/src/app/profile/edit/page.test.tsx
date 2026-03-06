import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EditProfilePage from '@/app/profile/edit/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  upload: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('profile/edit page', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.patch.mockReset();

    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        id: 'user-1',
        email: 'profile@dryft.site',
        display_name: 'Profile User',
        bio: 'Original bio',
        verified: true,
        looking_for: [],
        interests: ['Music'],
      },
    });

    mockApiClient.patch.mockResolvedValue({ success: true });
  });

  it('renders edit form with current profile values', async () => {
    render(<EditProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Profile User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Original bio')).toBeInTheDocument();
    });
  });

  it('saves updated profile values', async () => {
    render(<EditProfilePage />);

    await screen.findByText('Edit Profile');

    fireEvent.change(screen.getByDisplayValue('Profile User'), { target: { value: 'Updated User' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockApiClient.patch).toHaveBeenCalled();
      expect((globalThis as any).__mockRouter.push).toHaveBeenCalledWith('/profile');
    });
  });

  it('shows loading state while fetching profile', () => {
    mockApiClient.get.mockImplementation(() => new Promise(() => {}));

    render(<EditProfilePage />);

    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });
});
