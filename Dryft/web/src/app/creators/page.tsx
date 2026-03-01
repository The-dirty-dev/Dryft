'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { Creator } from '@/types';

export default function CreatorsPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const CREATORS_PER_PAGE = 24;

  useEffect(() => {
    loadCreators();
  }, [currentPage]);

  const loadCreators = async () => {
    setIsLoading(true);

    // Backend exposes a public featured-creators endpoint; no pagination for now
    const response = await apiClient.get<{ creators: Creator[] | null }>(
      `/v1/creators/featured`
    );

    if (response.success && response.data) {
      const list = response.data.creators || [];
      setCreators(list);
      // For featured, treat the whole list as a single page
      setTotalCreators(list.length);
    }

    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      loadCreators();
      return;
    }

    setIsLoading(true);
    const response = await apiClient.get<{ creators: Creator[]; total: number }>(
      `/v1/creators/search?q=${encodeURIComponent(search)}&limit=${CREATORS_PER_PAGE}`
    );

    if (response.success && response.data) {
      setCreators(response.data.creators || []);
      setTotalCreators(response.data.total);
    }
    setIsLoading(false);
  };

  const totalPages = Math.ceil(totalCreators / CREATORS_PER_PAGE);

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
            <Link href="/creators" className="text-white font-medium">
              Creators
            </Link>
            <Link href="/login" className="btn-secondary text-sm px-4 py-2">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Creators</h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Discover talented creators making avatars, outfits, toys, and more for Dryft.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-4 mb-8 max-w-xl mx-auto">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creators..."
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        {/* Creators Grid */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner className="h-12 w-12" />
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-muted">No creators found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
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

        {/* Become a Creator CTA */}
        <section className="mt-20 bg-surface rounded-2xl p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Become a Creator</h2>
          <p className="text-muted mb-8 max-w-xl mx-auto">
            Have skills in 3D modeling, animation, or design? Join our creator program
            and start selling your creations to the Dryft community.
          </p>
          <Link href="/creators/apply" className="btn-primary">
            Apply Now
          </Link>
        </section>
      </div>
    </div>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <Card href={`/creators/${creator.id}`} className="group text-center">
      <div className="p-4">
        <div className="relative w-20 h-20 mx-auto mb-4">
          {creator.avatar_url ? (
            <Image
              src={creator.avatar_url}
              alt={creator.display_name}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {creator.display_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {creator.is_verified && (
            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        <h3 className="font-medium text-white truncate">{creator.display_name}</h3>
        <p className="text-sm text-muted mt-1">{creator.item_count} items</p>
        <p className="text-xs text-muted mt-2">{creator.total_sales} sales</p>
      </div>
    </Card>
  );
}
