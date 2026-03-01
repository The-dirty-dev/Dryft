'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatCurrency, formatDate } from '@/utils';

interface Purchase {
  id: string;
  item_id: string;
  item_name: string;
  item_thumbnail?: string;
  item_type: string;
  creator_name: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  created_at: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    const response = await apiClient.get<{ purchases: Purchase[] }>('/v1/store/purchases');

    if (response.success && response.data) {
      setPurchases(response.data.purchases || []);
    }

    setIsLoading(false);
  };

  const getStatusBadge = (status: Purchase['status']) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
      refunded: 'bg-blue-500/20 text-blue-400',
    };

    const labels = {
      pending: 'Pending',
      completed: 'Completed',
      failed: 'Failed',
      refunded: 'Refunded',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredPurchases = purchases.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const totalSpent = purchases
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-6">
            <Link href="/store" className="text-muted hover:text-white">
              Store
            </Link>
            <Link href="/inventory" className="text-muted hover:text-white">
              Inventory
            </Link>
            <Link href="/profile" className="text-muted hover:text-white">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Purchase History</h1>
            <p className="text-muted">
              {purchases.length} purchase{purchases.length !== 1 ? 's' : ''} total
            </p>
          </div>

          {/* Stats Card */}
          <div className="bg-surface rounded-xl p-6">
            <p className="text-sm text-muted mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(totalSpent, 'usd')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'completed', 'pending', 'refunded'].map((status) => (
            <Button
              key={status}
              variant="ghost"
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted hover:text-white'
              }`}
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Purchases List */}
        {filteredPurchases.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No purchases found</h3>
            <p className="text-muted mb-6">
              {filter === 'all'
                ? "You haven't made any purchases yet."
                : `No ${filter} purchases.`}
            </p>
            <Link href="/store" className="btn-primary">
              Browse Store
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPurchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/purchases/${purchase.id}`}
                className="block bg-surface rounded-xl p-6 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-border overflow-hidden flex-shrink-0">
                    {purchase.item_thumbnail ? (
                      <img
                        src={purchase.item_thumbnail}
                        alt={purchase.item_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-muted"
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

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white truncate">
                        {purchase.item_name}
                      </h3>
                      {getStatusBadge(purchase.status)}
                    </div>
                    <p className="text-sm text-muted">
                      by {purchase.creator_name}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted">
                      <span className="capitalize">{purchase.item_type}</span>
                      <span>
                        {formatDate(purchase.created_at, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">
                      {purchase.amount === 0
                        ? 'Free'
                        : formatCurrency(purchase.amount, purchase.currency)}
                    </p>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination placeholder */}
        {filteredPurchases.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted">
              Showing {filteredPurchases.length} of {purchases.length} purchases
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
