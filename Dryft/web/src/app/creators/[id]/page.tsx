'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';
import { Creator, StoreItem } from '@/types';

export default function CreatorProfilePage() {
  const params = useParams();
  const creatorId = params.id as string;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    loadCreator();
  }, [creatorId]);

  useEffect(() => {
    if (creator) {
      loadItems();
    }
  }, [creator, currentPage]);

  const loadCreator = async () => {
    setIsLoading(true);
    setError(null);

    const response = await apiClient.get<{ creator: Creator }>(`/v1/creators/${creatorId}`);

    if (response.success && response.data) {
      setCreator(response.data.creator);
    } else {
      setError('Creator not found');
    }

    setIsLoading(false);
  };

  const loadItems = async () => {
    const response = await apiClient.get<{ items: StoreItem[]; total: number }>(
      `/v1/creators/${creatorId}/items?limit=${ITEMS_PER_PAGE}&offset=${currentPage * ITEMS_PER_PAGE}`
    );

    if (response.success && response.data) {
      setItems(response.data.items || []);
      setTotalItems(response.data.total);
    }
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted mb-4">{error || 'Creator not found'}</p>
          <Link href="/creators" className="btn-primary">
            Back to Creators
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
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
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

      {/* Creator Profile Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="relative w-32 h-32 flex-shrink-0">
              {creator.avatar_url ? (
                <Image
                  src={creator.avatar_url}
                  alt={creator.display_name}
                  fill
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-4xl font-bold text-primary">
                    {creator.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {creator.is_verified && (
                <div className="absolute bottom-0 right-0 bg-primary rounded-full p-2">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{creator.display_name}</h1>
                {creator.is_verified && (
                  <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Verified</span>
                )}
              </div>

              {creator.bio && (
                <p className="text-muted mb-6 max-w-2xl">{creator.bio}</p>
              )}

              {/* Stats */}
              <div className="flex flex-wrap justify-center md:justify-start gap-8">
                <div>
                  <div className="text-2xl font-bold text-white">{creator.item_count}</div>
                  <div className="text-sm text-muted">Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{creator.total_sales}</div>
                  <div className="text-sm text-muted">Sales</div>
                </div>
                {creator.average_rating > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-white">{creator.average_rating.toFixed(1)}</div>
                    <div className="text-sm text-muted">Rating</div>
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-white">
                    {new Date(creator.created_at).getFullYear()}
                  </div>
                  <div className="text-sm text-muted">Joined</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-white mb-8">Items by {creator.display_name}</h2>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted">No items yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-12">
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  variant="secondary"
                >
                  Previous
                </Button>
                <span className="text-muted">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: StoreItem }) {
  return (
    <Card href={`/store/${item.id}`} className="group">
      <div className="relative aspect-square bg-border">
        {item.thumbnail_url && (
          <Image
            src={item.thumbnail_url}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
          />
        )}
        {item.is_featured && (
          <span className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
            Featured
          </span>
        )}
        {item.is_owned && (
          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
            Owned
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-white truncate">{item.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className={`font-semibold ${item.price === 0 ? 'text-green-500' : 'text-primary'}`}>
            {formatPrice(item.price, item.currency)}
          </span>
          {item.rating_count > 0 && (
            <span className="text-xs text-muted">
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
