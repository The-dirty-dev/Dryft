import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SubscriptionScreen from '../../screens/subscription/SubscriptionScreen';

const mockInitialize = jest.fn();
const mockPurchaseProduct = jest.fn();
const mockRestorePurchases = jest.fn();
const mockClearError = jest.fn();

let mockStoreState: any = {};

jest.mock('../../store/subscriptionStore', () => {
  const actual = jest.requireActual('../../store/subscriptionStore');
  return {
    ...actual,
    useSubscriptionStore: () => mockStoreState,
  };
});

describe('SubscriptionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__mockRoute = { params: {} };
    mockStoreState = {
      products: [
        { productId: 'dryft_plus_monthly', price: '$14.99' },
        { productId: 'dryft_plus_yearly', price: '$119.99' },
        { productId: 'dryft_premium_monthly', price: '$29.99' },
        { productId: 'dryft_premium_yearly', price: '$239.99' },
        { productId: 'dryft_vip_monthly', price: '$39.99' },
        { productId: 'dryft_vip_yearly', price: '$299.99' },
      ],
      subscription: null,
      isLoading: false,
      error: null,
      initialize: mockInitialize,
      purchaseProduct: mockPurchaseProduct,
      restorePurchases: mockRestorePurchases,
      clearError: mockClearError,
    };
  });

  it('renders plan options', () => {
    render(<SubscriptionScreen navigation={(global as any).__mockNavigation} route={(global as any).__mockRoute} />);

    expect(screen.getByText('Dryft+')).toBeTruthy();
    expect(screen.getByText('Premium')).toBeTruthy();
    expect(screen.getByText('VIP')).toBeTruthy();
  });

  it('switches to monthly billing when Monthly is pressed', () => {
    render(<SubscriptionScreen navigation={(global as any).__mockNavigation} route={(global as any).__mockRoute} />);

    fireEvent.press(screen.getByText('Monthly'));

    expect(screen.getByText('Get Dryft+')).toBeTruthy();
  });

  it('starts purchase flow when selecting a plan', () => {
    render(<SubscriptionScreen navigation={(global as any).__mockNavigation} route={(global as any).__mockRoute} />);

    fireEvent.press(screen.getByText('Get Premium - $239.99/year'));

    expect(mockPurchaseProduct).toHaveBeenCalled();
  });
});
