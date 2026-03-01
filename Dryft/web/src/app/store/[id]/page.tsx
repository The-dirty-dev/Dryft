'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';
import { StoreItem, ItemReview } from '@/types';

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<StoreItem | null>(null);
  const [reviews, setReviews] = useState<ItemReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    setIsLoading(true);
    setError(null);

    const [itemRes, reviewsRes] = await Promise.all([
      apiClient.get<{ item: StoreItem }>(`/v1/store/items/${itemId}`),
      apiClient.get<{ reviews: ItemReview[] }>(`/v1/store/items/${itemId}/reviews?limit=10`),
    ]);

    if (itemRes.success && itemRes.data) {
      setItem(itemRes.data.item);
    } else {
      setError('Item not found');
    }

    if (reviewsRes.success && reviewsRes.data) {
      setReviews(reviewsRes.data.reviews || []);
    }

    setIsLoading(false);
  };

  const handlePurchase = async () => {
    if (!item) return;

    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setIsPurchasing(true);
    setError(null);

    const response = await apiClient.post<{ client_secret: string; purchase_id: string }>(
      '/v1/store/purchase',
      { item_id: item.id }
    );

    if (response.success && response.data) {
      // In production, use Stripe.js to handle payment
      // For now, redirect to a payment page or show payment modal
      window.location.href = `/checkout?secret=${response.data.client_secret}&purchase=${response.data.purchase_id}`;
    } else {
      setError(response.error || 'Failed to initiate purchase');
    }

    setIsPurchasing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted mb-4">{error || 'Item not found'}</p>
          <Link href="/store" className="btn-primary">
            Back to Store
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-6">
            <Link href="/store" className="text-muted hover:text-white transition-colors">
              Store
            </Link>
            <Link href="/creators" className="text-muted hover:text-white transition-colors">
              Creators
            </Link>
            <Link href="/login" className="btn-secondary text-sm px-4 py-2">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted mb-6">
          <Link href="/store" className="hover:text-white">Store</Link>
          <span className="mx-2">/</span>
          <span className="text-white">{item.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-square bg-surface rounded-xl overflow-hidden">
              {item.thumbnail_url ? (
                <Image
                  src={item.thumbnail_url}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  No image
                </div>
              )}
              {item.is_featured && (
                <span className="absolute top-4 left-4 bg-primary text-white text-sm px-3 py-1 rounded-full">
                  Featured
                </span>
              )}
            </div>

            {/* Preview images would go here */}
            {item.preview_urls && item.preview_urls.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {item.preview_urls.slice(0, 4).map((url, i) => (
                  <div key={i} className="relative aspect-square bg-surface rounded-lg overflow-hidden">
                    <Image src={url} alt={`Preview ${i + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-xs text-primary uppercase tracking-wide">
                  {item.item_type}
                </span>
                <h1 className="text-3xl font-bold text-white mt-1">{item.name}</h1>
              </div>
              {item.rating_count > 0 && (
                <div className="text-right">
                  <div className="text-xl font-semibold text-white">{item.rating.toFixed(1)}</div>
                  <div className="text-xs text-muted">{item.rating_count} reviews</div>
                </div>
              )}
            </div>

            <Link
              href={`/creators/${item.creator_id}`}
              className="inline-flex items-center gap-2 text-muted hover:text-white transition-colors mb-6"
            >
              by <span className="text-primary">{item.creator_name}</span>
            </Link>

            <p className="text-muted mb-8 leading-relaxed">
              {item.description || 'No description available.'}
            </p>

            {/* Price and Purchase */}
            <div className="bg-surface rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted">Price</span>
                <span className={`text-2xl font-bold ${item.price === 0 ? 'text-green-500' : 'text-white'}`}>
                  {formatPrice(item.price, item.currency)}
                </span>
              </div>

              {item.is_owned ? (
                <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 text-center">
                  <span className="text-green-500 font-medium">You own this item</span>
                </div>
              ) : (
                <Button
                  onClick={handlePurchase}
                  disabled={isPurchasing}
                  className="w-full"
                >
                  {isPurchasing ? (
                    <span className="inline-flex items-center justify-center">
                      <LoadingSpinner variant="inline" />
                      Processing...
                    </span>
                  ) : item.price === 0 ? (
                    'Get for Free'
                  ) : (
                    `Buy for ${formatPrice(item.price, item.currency)}`
                  )}
                </Button>
              )}

              {error && (
                <p className="text-primary text-sm mt-4 text-center">{error}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-surface rounded-lg p-4">
                <div className="text-xl font-semibold text-white">{item.purchase_count}</div>
                <div className="text-xs text-muted">Sales</div>
              </div>
              <div className="bg-surface rounded-lg p-4">
                <div className="text-xl font-semibold text-white">{item.rating_count}</div>
                <div className="text-xs text-muted">Reviews</div>
              </div>
              <div className="bg-surface rounded-lg p-4">
                <div className="text-xl font-semibold text-white">
                  {item.rating_count > 0 ? item.rating.toFixed(1) : '-'}
                </div>
                <div className="text-xs text-muted">Rating</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-8">Reviews</h2>

          {reviews.length === 0 ? (
            <div className="bg-surface rounded-xl p-8 text-center">
              <p className="text-muted">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ItemReview }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < review.rating);

  return (
    <div className="bg-surface rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-medium text-white">{review.user_name}</div>
          <div className="flex gap-1 mt-1">
            {stars.map((filled, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-border'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
        <div className="text-sm text-muted">
          {new Date(review.created_at).toLocaleDateString()}
        </div>
      </div>
      {review.comment && (
        <p className="text-muted">{review.comment}</p>
      )}
    </div>
  );
}
