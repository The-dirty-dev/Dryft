'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatCurrency, formatDate } from '@/utils';

interface PurchaseDetails {
  purchase_id: string;
  item_id: string;
  item_name: string;
  item_thumbnail?: string;
  item_type: string;
  creator_id: string;
  creator_name: string;
  amount: number;
  currency: string;
  status: string;
  completed_at?: string;
  created_at: string;
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params.id as string;

  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPurchase();
  }, [purchaseId]);

  const loadPurchase = async () => {
    const response = await apiClient.get<{ purchase: PurchaseDetails }>(
      `/v1/store/purchases/${purchaseId}`
    );

    if (response.success && response.data) {
      setPurchase(response.data.purchase);
    } else {
      setError('Purchase not found');
    }

    setIsLoading(false);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          color: 'text-green-400',
          bg: 'bg-green-500/20',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          label: 'Completed',
        };
      case 'pending':
        return {
          color: 'text-yellow-400',
          bg: 'bg-yellow-500/20',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          label: 'Pending',
        };
      case 'failed':
        return {
          color: 'text-red-400',
          bg: 'bg-red-500/20',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          label: 'Failed',
        };
      case 'refunded':
        return {
          color: 'text-blue-400',
          bg: 'bg-blue-500/20',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          ),
          label: 'Refunded',
        };
      default:
        return {
          color: 'text-muted',
          bg: 'bg-surface',
          icon: null,
          label: status,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Purchase Not Found</h1>
          <p className="text-muted mb-6">{error || 'This purchase does not exist.'}</p>
          <Link href="/purchases" className="btn-primary">
            View All Purchases
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(purchase.status);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Logo />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/purchases"
          className="inline-flex items-center gap-2 text-muted hover:text-white mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Purchases
        </Link>

        {/* Receipt Card */}
        <div className="bg-surface rounded-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/20 to-transparent p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Receipt</h1>
                <p className="text-sm text-muted font-mono">
                  Order #{purchase.purchase_id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="font-medium">{statusInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Item Details */}
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-medium text-muted uppercase mb-4">Item Purchased</h2>
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg bg-border overflow-hidden flex-shrink-0">
                {purchase.item_thumbnail ? (
                  <img
                    src={purchase.item_thumbnail}
                    alt={purchase.item_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Link
                  href={`/store/${purchase.item_id}`}
                  className="text-lg font-medium text-white hover:text-primary"
                >
                  {purchase.item_name}
                </Link>
                <p className="text-sm text-muted mt-1">
                  by{' '}
                  <Link
                    href={`/creators/${purchase.creator_id}`}
                    className="hover:text-primary"
                  >
                    {purchase.creator_name}
                  </Link>
                </p>
                <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary/20 text-primary rounded capitalize">
                  {purchase.item_type}
                </span>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-medium text-muted uppercase mb-4">Order Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted">Order Date</span>
                <span className="text-white">
                  {formatDate(purchase.created_at, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {purchase.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted">Completed</span>
                  <span className="text-white">
                    {formatDate(purchase.completed_at, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Order ID</span>
                <span className="text-white font-mono text-sm">{purchase.purchase_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Payment Method</span>
                <span className="text-white">Credit Card (via Stripe)</span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="p-6">
            <h2 className="text-sm font-medium text-muted uppercase mb-4">Payment Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="text-white">
                  {purchase.amount === 0
                    ? 'Free'
                    : formatCurrency(purchase.amount, purchase.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tax</span>
                <span className="text-white">$0.00</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-lg">
                <span className="font-semibold text-white">Total</span>
                <span className="font-bold text-primary">
                  {purchase.amount === 0
                    ? 'Free'
                    : formatCurrency(purchase.amount, purchase.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-4">
          {purchase.status === 'completed' && (
            <Link
              href={`/inventory?highlight=${purchase.item_id}`}
              className="btn-primary"
            >
              View in Inventory
            </Link>
          )}
          <Link href={`/store/${purchase.item_id}`} className="btn-secondary">
            View Item Page
          </Link>
          <Button
            variant="secondary"
            onClick={() => window.print()}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print Receipt
          </Button>
        </div>

        {/* Help */}
        <div className="mt-8 p-4 bg-surface rounded-lg">
          <p className="text-sm text-muted">
            Need help with this order?{' '}
            <Link href="/support" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
