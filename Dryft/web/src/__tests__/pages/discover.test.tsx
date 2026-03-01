import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import DiscoverPage from '@/app/discover/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('DiscoverPage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
  });

  it('shows match modal after liking a profile', async () => {

    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        profiles: [
          {
            id: 'profile-1',
            display_name: 'Alex',
            photos: [],
            interests: ['Music'],
          },
        ],
      },
    });

    mockApiClient.post.mockResolvedValue({
      success: true,
      data: {
        matched: true,
        match_id: 'match-1',
        matched_user: {
          id: 'profile-2',
          display_name: 'Jamie',
          photos: [],
          interests: [],
        },
      },
    });

    render(<DiscoverPage />);

    await screen.findByText('Alex');

    fireEvent.click(screen.getByTitle('Like (→)'));

    await waitFor(
      () => {
        expect(screen.getByText("It's a Match!")).toBeInTheDocument();
        expect(screen.getByText('You and Jamie liked each other')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
