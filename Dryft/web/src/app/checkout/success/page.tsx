'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';

interface PurchaseDetails {
  purchase_id: string;
  item_id: string;
  item_name: string;
  item_thumbnail?: string;
  item_type: string;
  creator_name: string;
  amount: number;
  currency: string;
  status: string;
  completed_at: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const purchaseId = searchParams.get('purchase');
  const paymentIntent = searchParams.get('payment_intent');

  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) {
      setError('Invalid purchase');
      setIsLoading(false);
      return;
    }

    checkPurchaseStatus();
  }, [purchaseId]);

  const checkPurchaseStatus = async () => {
    // Poll for purchase completion (webhook may take a moment)
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      const response = await apiClient.get<{ purchase: PurchaseDetails }>(
        `/v1/store/purchases/${purchaseId}`
      );

      if (response.success && response.data) {
        const purchaseData = response.data.purchase;

        if (purchaseData.status === 'completed') {
          setPurchase(purchaseData);
          setIsLoading(false);
          return;
        }

        if (purchaseData.status === 'failed') {
          setError('Payment failed. Please try again.');
          setIsLoading(false);
          return;
        }

        // Still pending, poll again
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          // Assume success if we hit max attempts (webhook might be delayed)
          setPurchase(purchaseData);
          setIsLoading(false);
        }
      } else {
        setError('Failed to load purchase details');
        setIsLoading(false);
      }
    };

    poll();
  };

  const getItemAction = () => {
    if (!purchase) return null;

    switch (purchase.item_type) {
      case 'avatar':
        return {
          label: 'Equip Avatar',
          href: '/inventory?tab=avatars',
        };
      case 'outfit':
        return {
          label: 'Equip Outfit',
          href: '/inventory?tab=outfits',
        };
      case 'effect':
        return {
          label: 'View Effects',
          href: '/inventory?tab=effects',
        };
      case 'emote':
        return {
          label: 'View Emotes',
          href: '/inventory?tab=emotes',
        };
      default:
        return {
          label: 'View Inventory',
          href: '/inventory',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted">Confirming your purchase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Failed</h1>
          <p className="text-muted mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <Link href="/store" className="btn-secondary">
              Back to Store
            </Link>
            <Button onClick={() => router.back()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const itemAction = getItemAction();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Logo />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Purchase Complete!
          </h1>
          <p className="text-muted">
            Thank you for your purchase. Your item is now in your inventory.
          </p>
        </div>

        {/* Purchase Details */}
        {purchase && (
          <div className="bg-surface rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Order Details
            </h2>

            <div className="flex gap-4 mb-6">
              {purchase.item_thumbnail && (
                <div className="w-24 h-24 rounded-lg bg-border overflow-hidden flex-shrink-0">
                  <img
                    src={purchase.item_thumbnail}
                    alt={purchase.item_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium text-white text-lg">
                  {purchase.item_name}
                </h3>
                <p className="text-sm text-muted mb-1">
                  by {purchase.creator_name}
                </p>
                <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary rounded">
                  {purchase.item_type}
                </span>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Order ID</span>
                <span className="text-white font-mono text-xs">
                  {purchase.purchase_id.slice(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Date</span>
                <span className="text-white">
                  {new Date(purchase.completed_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
                <span className="text-white">Total Paid</span>
                <span className="text-primary">
                  {formatPrice(purchase.amount, purchase.currency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          {itemAction && (
            <Link href={itemAction.href} className="btn-primary flex-1 text-center py-3">
              {itemAction.label}
            </Link>
          )}
          <Link href="/store" className="btn-secondary flex-1 text-center py-3">
            Continue Shopping
          </Link>
        </div>

        {/* Receipt Link */}
        <div className="text-center mt-8">
          <Link
            href={`/purchases/${purchaseId}`}
            className="text-sm text-muted hover:text-primary"
          >
            View Receipt →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
