'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/utils';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface PurchaseDetails {
  purchase_id: string;
  item_name: string;
  item_thumbnail?: string;
  creator_name: string;
  amount: number;
  currency: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clientSecret = searchParams.get('secret');
  const purchaseId = searchParams.get('purchase');

  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientSecret || !purchaseId) {
      setError('Invalid checkout session');
      setIsLoading(false);
      return;
    }

    loadPurchaseDetails();
  }, [purchaseId]);

  const loadPurchaseDetails = async () => {
    const response = await apiClient.get<{ purchase: PurchaseDetails }>(
      `/v1/store/purchases/${purchaseId}`
    );

    if (response.success && response.data) {
      setPurchaseDetails(response.data.purchase);
    } else {
      setError('Failed to load purchase details');
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted mb-4">{error || 'Invalid checkout session'}</p>
          <Link href="/store" className="btn-primary">
            Return to Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Order Summary */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-6">Checkout</h1>

            {purchaseDetails && (
              <div className="bg-surface rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>

                <div className="flex gap-4 mb-6">
                  {purchaseDetails.item_thumbnail && (
                    <div className="w-20 h-20 rounded-lg bg-border overflow-hidden">
                      <img
                        src={purchaseDetails.item_thumbnail}
                        alt={purchaseDetails.item_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-white">{purchaseDetails.item_name}</h3>
                    <p className="text-sm text-muted">by {purchaseDetails.creator_name}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted">Subtotal</span>
                    <span className="text-white">
                      {formatCurrency(purchaseDetails.amount, purchaseDetails.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-white">Total</span>
                    <span className="text-primary">
                      {formatCurrency(purchaseDetails.amount, purchaseDetails.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 text-sm text-muted">
              <p>Your payment is processed securely by Stripe.</p>
              <p className="mt-2">
                By completing this purchase, you agree to our{' '}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Payment Form */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Payment Details</h2>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#ff4757',
                    colorBackground: '#1a1a2e',
                    colorText: '#ffffff',
                    colorTextSecondary: '#888888',
                    colorDanger: '#ff4757',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <PaymentForm
                purchaseId={purchaseId || ''}
                amount={purchaseDetails?.amount || 0}
                currency={purchaseDetails?.currency || 'usd'}
              />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  purchaseId,
  amount,
  currency,
}: {
  purchaseId: string;
  amount: number;
  currency: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setIsProcessing(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?purchase=${purchaseId}`,
      },
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed');
      setIsProcessing(false);
    }
    // If successful, Stripe redirects to return_url
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-surface rounded-xl p-6">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <div className="bg-primary/10 border border-primary rounded-lg p-4">
          <p className="text-primary text-sm">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 text-lg"
      >
        {isProcessing ? (
          <span className="inline-flex items-center justify-center">
            <LoadingSpinner variant="inline" />
            Processing...
          </span>
        ) : (
          `Pay ${formatCurrency(amount, currency)}`
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-sm text-muted">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
