'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Logo from '@/components/ui/Logo';
import { useChatSocket } from '@/hooks/useChatSocket';
import apiClient from '@/lib/api';

interface DiscoverProfile {
  id: string;
  display_name: string;
  bio?: string;
  profile_photo?: string;
  age?: number;
}

interface Match {
  id: string;
  user: DiscoverProfile;
  matched_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // WebSocket handlers for real-time updates
  const handleNewMessage = useCallback(
    (payload: { conversation_id: string; sender_id: string; content: string; created_at: number }) => {
      setMatches((prev) =>
        prev.map((match) => {
          // Find the match with this conversation (we'll need to track conversation IDs)
          // For now, we update based on sender_id matching the match user
          if (match.user.id === payload.sender_id) {
            return {
              ...match,
              last_message: payload.content,
              last_message_at: new Date(payload.created_at).toISOString(),
              unread_count: match.unread_count + 1,
            };
          }
          return match;
        }).sort((a, b) => {
          // Sort by most recent message
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        })
      );
    },
    []
  );

  const handleNewMatch = useCallback(
    (payload: { match_id: string; conversation_id: string; user: { id: string; display_name: string; photo_url?: string }; matched_at: number }) => {
      const newMatch: Match = {
        id: payload.match_id,
        user: {
          id: payload.user.id,
          display_name: payload.user.display_name,
          profile_photo: payload.user.photo_url,
        },
        matched_at: new Date(payload.matched_at).toISOString(),
        unread_count: 0,
      };
      setMatches((prev) => [newMatch, ...prev]);
    },
    []
  );

  const handleUnmatched = useCallback(
    (payload: { match_id: string }) => {
      setMatches((prev) => prev.filter((match) => match.id !== payload.match_id));
    },
    []
  );

  const { isConnected } = useChatSocket({
    onNewMessage: handleNewMessage,
    onNewMatch: handleNewMatch,
    onUnmatched: handleUnmatched,
  });

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setIsLoading(true);
    const response = await apiClient.get<{ matches: Match[] }>('/v1/matches');
    if (response.success && response.data) {
      setMatches(response.data.matches || []);
    }
    setIsLoading(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const newMatches = matches.filter((m) => !m.last_message);
  const conversations = matches
    .filter((m) => m.last_message)
    .filter((m) =>
      m.user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="text-muted">/</span>
            <h1 className="text-xl font-semibold text-white">Messages</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/discover" className="text-muted hover:text-white transition-colors">
              Discover
            </Link>
            <Link href="/profile" className="text-muted hover:text-white transition-colors">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        {/* Search */}
        <div className="px-6 py-4 border-b border-border">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner className="h-12 w-12" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">No matches yet</h2>
            <p className="text-muted mb-6">Start swiping to find your connections</p>
            <Link href="/discover" className="btn-primary">
              Start Discovering
            </Link>
          </div>
        ) : (
          <>
            {/* New Matches Section */}
            {newMatches.length > 0 && (
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-sm font-medium text-muted mb-4">New Matches</h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {newMatches.map((match) => (
                    <Link
                      key={match.id}
                      href={`/messages/${match.id}`}
                      className="flex-shrink-0 text-center group"
                    >
                      <div className="relative w-16 h-16 mb-2">
                        <Image
                          src={match.user.profile_photo || '/placeholder-avatar.png'}
                          alt={match.user.display_name}
                          fill
                          className="rounded-full object-cover border-2 border-primary group-hover:border-white transition-colors"
                        />
                      </div>
                      <span className="text-xs text-white truncate block max-w-[64px]">
                        {match.user.display_name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Conversations */}
            <div className="divide-y divide-border">
              {conversations.length === 0 && searchQuery ? (
                <div className="px-6 py-12 text-center text-muted">
                  No conversations match your search
                </div>
              ) : (
                conversations.map((match) => (
                  <Link
                    key={match.id}
                    href={`/messages/${match.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-surface transition-colors"
                  >
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <Image
                        src={match.user.profile_photo || '/placeholder-avatar.png'}
                        alt={match.user.display_name}
                        fill
                        className="rounded-full object-cover"
                      />
                      {match.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-white">
                          {match.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-white truncate">
                          {match.user.display_name}
                        </h3>
                        <span className="text-xs text-muted flex-shrink-0 ml-2">
                          {match.last_message_at && formatTime(match.last_message_at)}
                        </span>
                      </div>
                      <p
                        className={`text-sm truncate ${
                          match.unread_count > 0 ? 'text-white font-medium' : 'text-muted'
                        }`}
                      >
                        {match.last_message || 'Start a conversation'}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
