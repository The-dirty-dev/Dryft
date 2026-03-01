'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import apiClient from '@/lib/api';
import { formatDistance } from '@/utils';

interface DiscoverProfile {
  id: string;
  display_name: string;
  bio?: string;
  profile_photo?: string;
  age?: number;
  distance?: number;
  photos: string[];
  interests: string[];
}

interface SwipeResult {
  matched: boolean;
  match_id?: string;
  matched_user?: DiscoverProfile;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState<DiscoverProfile | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'like' | 'pass' | null>(null);

  const loadProfiles = useCallback(async () => {
    const response = await apiClient.get<{ profiles: DiscoverProfile[] }>(
      '/v1/discover?limit=20'
    );
    if (response.success && response.data) {
      setProfiles(response.data.profiles || []);
      setCurrentIndex(0);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const currentProfile = profiles[currentIndex];
  const nextProfile = profiles[currentIndex + 1];

  const handleSwipe = async (direction: 'like' | 'pass') => {
    if (!currentProfile || isSwiping) return;

    setIsSwiping(true);
    setSwipeDirection(direction);

    const response = await apiClient.post<SwipeResult>('/v1/discover/swipe', {
      user_id: currentProfile.id,
      direction,
    });

    // Wait for animation
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (response.success && response.data?.matched && response.data.matched_user) {
      setMatchedUser(response.data.matched_user);
      setShowMatch(true);
    }

    setSwipeDirection(null);
    setCurrentIndex((prev) => prev + 1);
    setIsSwiping(false);

    // Load more profiles when running low
    if (currentIndex >= profiles.length - 5) {
      loadProfiles();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showMatch) return;
      if (e.key === 'ArrowLeft') handleSwipe('pass');
      if (e.key === 'ArrowRight') handleSwipe('like');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProfile, isSwiping, showMatch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-muted">Finding people near you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/discover" className="text-white font-medium">
              Discover
            </Link>
            <Link href="/messages" className="text-muted hover:text-white transition-colors relative">
              Messages
            </Link>
            <Link href="/profile" className="text-muted hover:text-white transition-colors">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-8">
        {!currentProfile ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">👋</div>
            <h2 className="text-2xl font-semibold text-white mb-2">No more profiles</h2>
            <p className="text-muted mb-6">Check back later for new people to meet</p>
            <Button onClick={loadProfiles}>Refresh</Button>
          </div>
        ) : (
          <>
            {/* Card Stack */}
            <div className="relative h-[600px] mb-8">
              {/* Background card */}
              {nextProfile && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden bg-surface transform scale-95 opacity-50">
                  <Image
                    src={nextProfile.profile_photo || '/placeholder-avatar.png'}
                    alt={nextProfile.display_name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {/* Main card */}
              <div
                className={`absolute inset-0 rounded-2xl overflow-hidden bg-surface shadow-2xl transition-transform duration-300 ${
                  swipeDirection === 'like'
                    ? 'translate-x-full rotate-12 opacity-0'
                    : swipeDirection === 'pass'
                    ? '-translate-x-full -rotate-12 opacity-0'
                    : ''
                }`}
              >
                <Image
                  src={currentProfile.profile_photo || '/placeholder-avatar.png'}
                  alt={currentProfile.display_name}
                  fill
                  className="object-cover"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Like/Pass indicators */}
                {swipeDirection === 'like' && (
                  <div className="absolute top-8 left-8 border-4 border-green-500 rounded-lg px-6 py-2 rotate-[-15deg]">
                    <span className="text-3xl font-bold text-green-500">LIKE</span>
                  </div>
                )}
                {swipeDirection === 'pass' && (
                  <div className="absolute top-8 right-8 border-4 border-red-500 rounded-lg px-6 py-2 rotate-[15deg]">
                    <span className="text-3xl font-bold text-red-500">PASS</span>
                  </div>
                )}

                {/* Profile info */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-3xl font-bold text-white">
                    {currentProfile.display_name}
                    {currentProfile.age && <span className="font-normal">, {currentProfile.age}</span>}
                  </h2>
                  {currentProfile.distance !== undefined && currentProfile.distance !== null && (
                    <p className="text-muted mt-1">{formatDistance(currentProfile.distance)}</p>
                  )}
                  {currentProfile.bio && (
                    <p className="text-white/90 mt-3 line-clamp-2">{currentProfile.bio}</p>
                  )}
                  {currentProfile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {currentProfile.interests.slice(0, 5).map((interest, i) => (
                        <span
                          key={i}
                          className="bg-primary/30 text-primary px-3 py-1 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-8">
              <Button
                variant="ghost"
                onClick={() => handleSwipe('pass')}
                disabled={isSwiping}
                className="w-16 h-16 rounded-full border-2 border-red-500 text-red-500 flex items-center justify-center text-2xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 shadow-lg"
                title="Pass (←)"
              >
                ✕
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleSwipe('like')}
                disabled={isSwiping}
                className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl hover:scale-110 transition-all disabled:opacity-50 shadow-lg"
                title="Like (→)"
              >
                ♥
              </Button>
            </div>

            <p className="text-center text-muted text-sm mt-4">
              Use arrow keys ← → to swipe
            </p>
          </>
        )}
      </div>

      {/* Match Modal */}
      <Modal
        open={showMatch && !!matchedUser}
        overlayClassName="bg-black/90"
        containerClassName="bg-transparent border-0 rounded-none max-w-lg w-full"
      >
        {matchedUser && (
          <div className="text-center">
            <h2 className="text-4xl font-bold text-primary mb-4">It's a Match!</h2>
            <p className="text-xl text-white mb-8">
              You and {matchedUser.display_name} liked each other
            </p>
            <div className="relative w-32 h-32 mx-auto mb-8">
              <Image
                src={matchedUser.profile_photo || '/placeholder-avatar.png'}
                alt={matchedUser.display_name}
                fill
                className="rounded-full object-cover border-4 border-primary"
              />
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button
                onClick={() => {
                  setShowMatch(false);
                  router.push('/messages');
                }}
                className="w-full"
              >
                Send Message
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowMatch(false)}
                className="text-muted hover:text-white transition-colors"
              >
                Keep Swiping
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
