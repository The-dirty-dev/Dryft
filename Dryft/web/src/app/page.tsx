'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import Logo from '@/components/ui/Logo';
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

      {/* Hero */}
      <section className="py-24 px-6 relative overflow-hidden">
        {/* Subtle gradient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <Image
            src="/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto mb-8 rounded-2xl"
            priority
          />
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Express yourself in VR
          </h1>
          <p className="text-xl text-muted mb-10 max-w-2xl mx-auto">
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
            <Link href="/store?featured=true" className="text-primary hover:underline text-sm font-medium">
              View all &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : featuredItems.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        </div>
      </section>

      {/* Popular Items */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Popular</h2>
            <Link href="/store?sort_by=popular" className="text-primary hover:underline text-sm font-medium">
              View all &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : popularItems.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-6 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 text-muted text-sm">
            <Logo size={20} iconOnly linked={false} />
            <span>&copy; {new Date().getFullYear()} Dryft. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-muted">
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/support" className="hover:text-white transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Skeleton placeholder while items are loading */
function SkeletonCard() {
  return (
    <div className="card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-2" />
      </div>
    </div>
  );
}

function ItemCard({ item }: { item: StoreItem }) {
  return (
    <Card href={`/store/${item.id}`} className="group">
      <div className="relative aspect-square bg-border overflow-hidden">
        {item.thumbnail_url && (
          <Image
            src={item.thumbnail_url}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {item.is_featured && (
          <span className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded-md font-medium">
            Featured
          </span>
        )}
        {item.is_owned && (
          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-md font-medium">
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
            <span className="text-xs text-muted inline-flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-current text-yellow-500" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
