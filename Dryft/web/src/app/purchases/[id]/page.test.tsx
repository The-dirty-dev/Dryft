import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseDetailPage from '@/app/purchases/[id]/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('purchases/[id] page', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    (globalThis as any).__mockParams = { id: 'purchase-1' };
  });

  it('renders purchase details receipt', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchase: {
          purchase_id: 'purchase-1',
          item_id: 'item-1',
          item_name: 'Premium Halo',
          item_type: 'effect',
          creator_id: 'creator-1',
          creator_name: 'Creator X',
          amount: 799,
          currency: 'usd',
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      },
    });

    render(<PurchaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Receipt')).toBeInTheDocument();
      expect(screen.getByText('Premium Halo')).toBeInTheDocument();
      expect(screen.getByText('Print Receipt')).toBeInTheDocument();
    });
  });

  it('renders not-found state when purchase is missing', async () => {
    mockApiClient.get.mockResolvedValue({ success: false, error: 'missing' });

    render(<PurchaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Purchase Not Found')).toBeInTheDocument();
      expect(screen.getByText('Purchase not found')).toBeInTheDocument();
    });
  });

  it('shows receipt print action', async () => {
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchase: {
          purchase_id: 'purchase-9',
          item_id: 'item-9',
          item_name: 'VR Mood Pack',
          item_type: 'effect',
          creator_id: 'creator-2',
          creator_name: 'Creator Y',
          amount: 1599,
          currency: 'usd',
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
      },
    });

    render(<PurchaseDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Print Receipt')).toBeInTheDocument();
    });
  });
});
