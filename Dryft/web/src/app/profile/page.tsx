'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Textarea from '@/components/ui/Textarea';
import apiClient from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  verified: boolean;
  created_at: string;
  stats: {
    inventory_count: number;
    total_spent: number;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const token = apiClient.getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);

    const response = await apiClient.get<{ user: UserProfile }>('/v1/users/me');

    if (response.success && response.data) {
      setProfile(response.data.user);
      setDisplayName(response.data.user.display_name);
      setBio(response.data.user.bio || '');
    }

    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const response = await apiClient.put('/v1/users/me', {
      display_name: displayName,
      bio,
    });

    if (response.success) {
      setProfile((prev) => prev ? { ...prev, display_name: displayName, bio } : null);
      setIsEditing(false);
    } else {
      setError(response.error || 'Failed to update profile');
    }

    setIsSaving(false);
  };

  const handleLogout = () => {
    apiClient.clearTokens();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner className="h-12 w-12" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-muted mb-4">Unable to load profile</p>
          <Link href="/" className="btn-primary">
            Go Home
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
            <Link href="/inventory" className="text-muted hover:text-white transition-colors">
              Inventory
            </Link>
            <Link href="/profile" className="text-white font-medium">
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Profile Header */}
        <div className="bg-surface rounded-2xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="relative w-32 h-32 flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  fill
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-4xl font-bold text-primary">
                    {profile.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-muted mb-2">Display Name</label>
                    <Input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-2">Bio</label>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full resize-none min-h-[100px]"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                  {error && <p className="text-primary text-sm">{error}</p>}
                  <div className="flex gap-4">
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsEditing(false);
                        setDisplayName(profile.display_name);
                        setBio(profile.bio || '');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-white">{profile.display_name}</h1>
                    {profile.verified && (
                      <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-muted mb-4">{profile.email}</p>
                  {profile.bio && <p className="text-muted mb-6">{profile.bio}</p>}
                  <Button variant="secondary" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface rounded-xl p-6 text-center">
            <div className="text-2xl font-bold text-white">{profile.stats.inventory_count}</div>
            <div className="text-sm text-muted">Items Owned</div>
          </div>
          <div className="bg-surface rounded-xl p-6 text-center">
            <div className="text-2xl font-bold text-white">
              ${(profile.stats.total_spent / 100).toFixed(0)}
            </div>
            <div className="text-sm text-muted">Total Spent</div>
          </div>
          <div className="bg-surface rounded-xl p-6 text-center">
            <div className="text-2xl font-bold text-white">
              {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
            <div className="text-sm text-muted">Member Since</div>
          </div>
          <div className="bg-surface rounded-xl p-6 text-center">
            <div className="text-2xl font-bold text-white">
              {profile.verified ? 'Yes' : 'No'}
            </div>
            <div className="text-sm text-muted">Age Verified</div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-surface rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/inventory"
              className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">My Inventory</div>
                <div className="text-sm text-muted">View and equip your items</div>
              </div>
            </Link>
            <Link
              href="/store"
              className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">Browse Store</div>
                <div className="text-sm text-muted">Find new items</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Age Verification */}
        {!profile.verified && (
          <div className="bg-primary/10 border border-primary rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-2">Age Verification Required</h2>
            <p className="text-muted mb-4">
              Complete age verification to access all features of Dryft.
            </p>
            <Link href="/verify" className="btn-primary">
              Start Verification
            </Link>
          </div>
        )}

        {/* Logout */}
        <div className="text-center">
          <Button
            onClick={() => setShowLogoutConfirm(true)}
            variant="ghost"
            className="p-0 text-muted hover:text-primary"
          >
            Sign Out
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        variant="warning"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
