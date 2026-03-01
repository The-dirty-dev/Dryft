'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';
import { StoreItem } from '@/types';

export default function HomePage() {
  const [featuredItems, setFeaturedItems] = useState<StoreItem[]>([]);
  const [popularItems, setPopularItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);

    const [featuredRes, popularRes] = await Promise.all([
      apiClient.get<{ items: StoreItem[] }>('/v1/store/featured?limit=6'),
      apiClient.get<{ items: StoreItem[] }>('/v1/store/popular?limit=6'),
    ]);

    if (featuredRes.success && featuredRes.data) {
      setFeaturedItems(featuredRes.data.items || []);
    }
    if (popularRes.success && popularRes.data) {
      setPopularItems(popularRes.data.items || []);
    }

    setIsLoading(false);
  };

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

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Express yourself in VR
          </h1>
          <p className="text-xl text-muted mb-10">
            Shop avatars, outfits, toys, effects, and gestures from talented creators.
            Stand out in Dryft.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/store" className="btn-primary">
              Browse Store
            </Link>
            <Link href="/register" className="btn-secondary">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Items */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Featured</h2>
            <Link href="/store?featured=true" className="text-primary hover:underline">
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner className="h-12 w-12" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredItems.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular Items */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Popular</h2>
            <Link href="/store?sort_by=popular" className="text-primary hover:underline">
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner className="h-12 w-12" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {popularItems.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-6 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-muted text-sm">
            &copy; 2024 Dryft. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/support" className="hover:text-white">Support</Link>
          </div>
        </div>
      </footer>
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
              {item.rating.toFixed(1)} ({item.rating_count})
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
