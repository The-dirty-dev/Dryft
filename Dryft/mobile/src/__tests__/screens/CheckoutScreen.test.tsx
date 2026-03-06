import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CheckoutScreen from '../../screens/checkout/CheckoutScreen';

const mockGet = jest.fn();
const mockConfirmPayment = jest.fn();

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
  },
}));

jest.mock('@stripe/stripe-react-native', () => ({
  useConfirmPayment: () => ({
    confirmPayment: (...args: any[]) => mockConfirmPayment(...args),
  }),
  CardField: ({ onCardChange }: { onCardChange?: (details: { complete: boolean }) => void }) => {
    onCardChange?.({ complete: true });
    return null;
  },
}));

describe('CheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__mockRoute = {
      params: {
        itemId: 'item-1',
        purchaseId: 'purchase-1',
        clientSecret: 'cs_test',
      },
    };

    mockGet.mockResolvedValue({
      success: true,
      data: {
        purchase: {
          purchase_id: 'purchase-1',
          item_name: 'Premium Wings',
          creator_name: 'Creator VR',
          amount: 1299,
          currency: 'usd',
        },
      },
    });
  });

  it('renders order summary from API response', async () => {
    render(<CheckoutScreen />);

    await waitFor(() => {
      expect(screen.getByText('Order Summary')).toBeTruthy();
      expect(screen.getByText('Premium Wings')).toBeTruthy();
    });
  }, 15000);

  it('shows payment details section', async () => {
    render(<CheckoutScreen />);

    await waitFor(() => {
      expect(screen.getByText('Payment Details')).toBeTruthy();
      expect(screen.getByText('Your payment is secure and encrypted by Stripe')).toBeTruthy();
    });
  });

  it('navigates to success when payment succeeds', async () => {
    mockConfirmPayment.mockResolvedValue({
      paymentIntent: { status: 'Succeeded' },
      error: null,
    });

    render(<CheckoutScreen />);

    await waitFor(() => screen.getByText('Pay $12.99'));

    fireEvent.press(screen.getByText('Pay $12.99'));

    await waitFor(() => {
      expect((global as any).__mockNavigation.replace).toHaveBeenCalledWith('CheckoutSuccess', {
        purchaseId: 'purchase-1',
      });
    });
  });
});
