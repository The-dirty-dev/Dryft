import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutPage from '@/app/checkout/page';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({ submit: vi.fn(async () => ({})) }),
  PaymentElement: () => <div data-testid="payment-element" />,
}));

describe('CheckoutPage', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    (globalThis as any).__mockSearchParams = new URLSearchParams();
  });

  it('shows invalid session message when required params are missing', async () => {
    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Invalid checkout session')).toBeInTheDocument();
    });
  });

  it('loads order summary and mounts payment form', async () => {
    (globalThis as any).__mockSearchParams = new URLSearchParams('secret=sec_123&purchase=p_1');

    mockApiClient.get.mockResolvedValue({
      success: true,
      data: {
        purchase: {
          purchase_id: 'p_1',
          item_name: 'Premium Outfit',
          creator_name: 'Creator A',
          amount: 1299,
          currency: 'usd',
        },
      },
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Order Summary')).toBeInTheDocument();
      expect(screen.getByText('Premium Outfit')).toBeInTheDocument();
      expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    });
  });
});
