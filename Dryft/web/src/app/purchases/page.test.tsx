import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchasesPage from '@/app/purchases/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('purchases page', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
  });

  it('renders purchase history list', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchases: [
          {
            id: 'p-1',
            item_id: 'item-1',
            item_name: 'Neon Wings',
            item_type: 'outfit',
            creator_name: 'Creator A',
            amount: 1299,
            currency: 'usd',
            status: 'completed',
            created_at: new Date().toISOString(),
          },
        ],
      },
    });

    render(<PurchasesPage />);

    await waitFor(() => {
      expect(screen.getByText('Purchase History')).toBeInTheDocument();
      expect(screen.getByText('Neon Wings')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no purchases', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: { purchases: [] } });

    render(<PurchasesPage />);

    await waitFor(() => {
      expect(screen.getByText('No purchases found')).toBeInTheDocument();
      expect(screen.getByText("You haven't made any purchases yet.")).toBeInTheDocument();
    });
  });

  it('filters purchase list by status', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchases: [
          {
            id: 'p-1',
            item_id: 'item-1',
            item_name: 'Completed Item',
            item_type: 'outfit',
            creator_name: 'Creator A',
            amount: 500,
            currency: 'usd',
            status: 'completed',
            created_at: new Date().toISOString(),
          },
          {
            id: 'p-2',
            item_id: 'item-2',
            item_name: 'Pending Item',
            item_type: 'effect',
            creator_name: 'Creator B',
            amount: 900,
            currency: 'usd',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ],
      },
    });

    render(<PurchasesPage />);

    await screen.findByText('Completed Item');
    fireEvent.click(screen.getByRole('button', { name: 'pending' }));

    await waitFor(() => {
      expect(screen.queryByText('Completed Item')).toBeNull();
      expect(screen.getByText('Pending Item')).toBeInTheDocument();
    });
  });
});
