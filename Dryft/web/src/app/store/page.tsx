'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';
import { StoreItem, ItemCategory, ItemType } from '@/types';

const ITEM_TYPES: { label: string; value: ItemType | null }[] = [
  { label: 'All', value: null },
  { label: 'Avatars', value: 'avatar' },
  { label: 'Outfits', value: 'outfit' },
  { label: 'Toys', value: 'toy' },
  { label: 'Effects', value: 'effect' },
  { label: 'Gestures', value: 'gesture' },
];

export default function StorePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner className="h-12 w-12" /></div>}>
      <StoreContent />
    </Suspense>
  );
}

function StoreContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedType, setSelectedType] = useState<ItemType | null>(
    (searchParams.get('type') as ItemType) || null
  );

  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadItems();
  }, [selectedType, currentPage]);

  const loadCategories = async () => {
    const response = await apiClient.get<{ categories: ItemCategory[] }>('/v1/store/categories');
    if (response.success && response.data) {
      setCategories(response.data.categories || []);
    }
  };

  const loadItems = async () => {
    setIsLoading(true);

    let endpoint = `/v1/store/items?limit=${ITEMS_PER_PAGE}&offset=${currentPage * ITEMS_PER_PAGE}`;
    if (selectedType) {
      endpoint += `&type=${selectedType}`;
    }

    const response = await apiClient.get<{
      items: StoreItem[];
      total: number;
    }>(endpoint);

    if (response.success && response.data) {
      setItems(response.data.items || []);
      setTotalItems(response.data.total);
    }

    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      loadItems();
      return;
    }

    setIsLoading(true);
    const response = await apiClient.get<{
      items: StoreItem[];
      total: number;
    }>(`/v1/store/search?q=${encodeURIComponent(search)}&limit=${ITEMS_PER_PAGE}`);

    if (response.success && response.data) {
      setItems(response.data.items || []);
      setTotalItems(response.data.total);
    }
    setIsLoading(false);
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/store" className="text-white font-medium">
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
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-4 mb-8">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {ITEM_TYPES.map((type) => (
            <Button
              key={type.label}
              onClick={() => {
                setSelectedType(type.value);
                setCurrentPage(0);
              }}
              variant="ghost"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedType === type.value
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-white'
              }`}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner className="h-12 w-12" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted">No items found</p>
            <p className="text-muted mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-12">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="text-muted">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
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
        <p className="text-sm text-muted truncate">by {item.creator_name}</p>
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
