import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutSuccessPage from '@/app/checkout/success/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('checkout/success page', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    (globalThis as any).__mockSearchParams = new URLSearchParams();
  });

  it('renders invalid purchase state when purchase query param is missing', async () => {
    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid purchase')).toBeInTheDocument();
    });
  });

  it('renders success confirmation and order details for completed purchase', async () => {
    (globalThis as any).__mockSearchParams = new URLSearchParams('purchase=purchase_1&payment_intent=pi_123');

    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchase: {
          purchase_id: 'purchase_1',
          item_id: 'item_1',
          item_name: 'Skyline Outfit',
          item_type: 'outfit',
          creator_name: 'Creator VR',
          amount: 1999,
          currency: 'usd',
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
      },
    });

    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Purchase Complete!')).toBeInTheDocument();
      expect(screen.getByText('Order Details')).toBeInTheDocument();
      expect(screen.getByText('Skyline Outfit')).toBeInTheDocument();
    });
  });

  it('renders payment failed state when purchase is failed', async () => {
    (globalThis as any).__mockSearchParams = new URLSearchParams('purchase=purchase_2');

    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchase: {
          purchase_id: 'purchase_2',
          item_id: 'item_2',
          item_name: 'Avatar Frame',
          item_type: 'effect',
          creator_name: 'Creator B',
          amount: 499,
          currency: 'usd',
          status: 'failed',
          completed_at: new Date().toISOString(),
        },
      },
    });

    render(<CheckoutSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      expect(screen.getByText('Payment failed. Please try again.')).toBeInTheDocument();
    });
  });
});
