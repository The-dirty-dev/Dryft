'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Textarea from '@/components/ui/Textarea';
import apiClient from '@/lib/api';

interface ProfileData {
  id: string;
  email: string;
  display_name?: string;
  bio?: string;
  profile_photo_url?: string;
  photos?: string[];
  birth_date?: string;
  age?: number;
  gender?: string;
  looking_for?: string[];
  interests?: string[];
  job_title?: string;
  company?: string;
  school?: string;
  height?: number;
  city?: string;
  verified: boolean;
}

const GENDER_OPTIONS = [
  { label: 'Man', value: 'male' },
  { label: 'Woman', value: 'female' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Other', value: 'other' },
];

const INTEREST_SUGGESTIONS = [
  'Travel', 'Music', 'Movies', 'Gaming', 'Fitness', 'Cooking',
  'Reading', 'Art', 'Photography', 'Dancing', 'Hiking', 'Yoga',
  'Coffee', 'Wine', 'Dogs', 'Cats', 'Beach', 'Mountains',
];

export default function EditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [newInterest, setNewInterest] = useState('');
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [deletePhotoIndex, setDeletePhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const response = await apiClient.get<ProfileData>('/v1/profile');
    if (response.success && response.data) {
      setProfile(response.data);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);

    const response = await apiClient.patch('/v1/profile', {
      display_name: profile.display_name,
      bio: profile.bio,
      birth_date: profile.birth_date,
      gender: profile.gender,
      looking_for: profile.looking_for,
      interests: profile.interests,
      job_title: profile.job_title,
      company: profile.company,
      school: profile.school,
      height: profile.height,
    });

    setIsSaving(false);

    if (response.success) {
      router.push('/profile');
    }
  };

  const handlePhotoUpload = async (file: File, isMain: boolean) => {
    if (isMain) setUploadingMain(true);
    else setUploadingGallery(true);

    const formData = new FormData();
    formData.append('photo', file);
    if (isMain) formData.append('main', 'true');

    const response = await apiClient.upload<{ photo_key: string; photos?: string[] }>(
      '/v1/profile/photos',
      formData
    );

    if (response.success && response.data) {
      if (isMain) {
        setProfile((prev) =>
          prev ? { ...prev, profile_photo_url: response.data!.photo_key } : null
        );
      } else {
        setProfile((prev) =>
          prev ? { ...prev, photos: response.data!.photos } : null
        );
      }
    }

    if (isMain) setUploadingMain(false);
    else setUploadingGallery(false);
  };

  const handleDeletePhoto = async (index: number) => {
    const response = await apiClient.delete<{ photos: string[] }>(
      `/v1/profile/photos/${index}`
    );
    if (response.success && response.data) {
      setProfile((prev) =>
        prev ? { ...prev, photos: response.data!.photos } : null
      );
    }
  };

  const toggleLookingFor = (gender: string) => {
    if (!profile) return;
    const current = profile.looking_for || [];
    if (current.includes(gender)) {
      setProfile({ ...profile, looking_for: current.filter((g) => g !== gender) });
    } else {
      setProfile({ ...profile, looking_for: [...current, gender] });
    }
  };

  const addInterest = (interest: string) => {
    if (!profile) return;
    const trimmed = interest.trim();
    if (!trimmed || (profile.interests?.length || 0) >= 10) return;
    if (profile.interests?.includes(trimmed)) return;

    setProfile({
      ...profile,
      interests: [...(profile.interests || []), trimmed],
    });
    setNewInterest('');
  };

  const removeInterest = (interest: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      interests: profile.interests?.filter((i) => i !== interest) || [],
    });
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
        <p className="text-muted">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-muted hover:text-white">
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-white">Edit Profile</h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Photos Section */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-2">Photos</h2>
          <p className="text-sm text-muted mb-6">Add up to 6 photos</p>

          <div className="grid grid-cols-4 gap-4">
            {/* Main Photo */}
            <div
              className="col-span-2 row-span-2 aspect-square relative rounded-xl overflow-hidden border-2 border-primary bg-surface cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {profile.profile_photo_url ? (
                <Image
                  src={profile.profile_photo_url}
                  alt="Profile"
                  fill
                  className="object-cover group-hover:opacity-80 transition-opacity"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <span className="text-4xl text-primary">+</span>
                  <span className="text-sm text-muted mt-2">Main Photo</span>
                </div>
              )}
              {uploadingMain && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <LoadingSpinner className="h-8 w-8 border-white" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file, true);
                }}
              />
            </div>

            {/* Gallery Photos */}
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const photo = profile.photos?.[index];
              return (
                <div
                  key={index}
                  className="aspect-square relative rounded-xl overflow-hidden border border-border bg-surface cursor-pointer group"
                  onClick={() => {
                    if (photo) {
                      setDeletePhotoIndex(index);
                    } else {
                      galleryInputRef.current?.click();
                    }
                  }}
                >
                  {photo ? (
                    <>
                      <Image
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity"
                      />
                      <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-xs">✕</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-2xl text-muted">+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoUpload(file, false);
            }}
          />
        </section>

        {/* Basic Info */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-6">About You</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-muted mb-2">Display Name</label>
              <Input
                type="text"
                value={profile.display_name || ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                className="w-full"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Bio</label>
              <Textarea
                value={profile.bio || ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                className="w-full h-32 resize-none min-h-0"
                maxLength={500}
                placeholder="Write something about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Birthday</label>
              <Input
                type="date"
                value={profile.birth_date || ''}
                onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
        </section>

        {/* Gender */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-6">I am a</h2>
          <div className="flex flex-wrap gap-3">
            {GENDER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                onClick={() => setProfile({ ...profile, gender: option.value })}
                variant="ghost"
                className={`px-6 py-3 rounded-full text-sm font-medium transition-colors ${
                  profile.gender === option.value
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-muted hover:text-white'
                }`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>

        {/* Looking For */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-6">Interested In</h2>
          <div className="flex flex-wrap gap-3">
            {GENDER_OPTIONS.slice(0, 3).map((option) => (
              <Button
                key={option.value}
                onClick={() => toggleLookingFor(option.value)}
                variant="ghost"
                className={`px-6 py-3 rounded-full text-sm font-medium transition-colors ${
                  profile.looking_for?.includes(option.value)
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-muted hover:text-white'
                }`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>

        {/* Interests */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-2">Interests</h2>
          <p className="text-sm text-muted mb-6">Add up to 10 interests</p>

          {/* Current interests */}
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.interests?.map((interest) => (
              <Button
                key={interest}
                onClick={() => removeInterest(interest)}
                variant="ghost"
                className="px-4 py-2 bg-primary text-white rounded-full text-sm flex items-center gap-2 hover:bg-primary/80"
              >
                {interest}
                <span>✕</span>
              </Button>
            ))}
          </div>

          {/* Add interest */}
          <div className="flex gap-3 mb-4">
            <Input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addInterest(newInterest)}
              className="flex-1"
              placeholder="Add interest..."
              maxLength={50}
            />
            <Button
              onClick={() => addInterest(newInterest)}
              className="px-6"
            >
              Add
            </Button>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {INTEREST_SUGGESTIONS.filter(
              (s) => !profile.interests?.includes(s)
            ).slice(0, 8).map((suggestion) => (
              <Button
                key={suggestion}
                onClick={() => addInterest(suggestion)}
                variant="ghost"
                className="px-3 py-1.5 text-sm text-primary border border-primary/30 rounded-full hover:bg-primary/10"
              >
                + {suggestion}
              </Button>
            ))}
          </div>
        </section>

        {/* Work & Education */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-6">Work & Education</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm text-muted mb-2">Job Title</label>
              <Input
                type="text"
                value={profile.job_title || ''}
                onChange={(e) => setProfile({ ...profile, job_title: e.target.value })}
                className="w-full"
                placeholder="What do you do?"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">Company</label>
              <Input
                type="text"
                value={profile.company || ''}
                onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                className="w-full"
                placeholder="Where do you work?"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">School</label>
              <Input
                type="text"
                value={profile.school || ''}
                onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                className="w-full"
                placeholder="Where did you study?"
                maxLength={100}
              />
            </div>
          </div>
        </section>

        {/* Height */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-6">Height</h2>
          <Input
            type="number"
            value={profile.height || ''}
            onChange={(e) =>
              setProfile({ ...profile, height: parseInt(e.target.value) || undefined })
            }
            className="w-48"
            placeholder="Height in cm"
            min={100}
            max={250}
          />
          <p className="text-sm text-muted mt-2">Height in centimeters (e.g., 175)</p>
        </section>
      </div>

      <ConfirmDialog
        open={deletePhotoIndex !== null}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deletePhotoIndex !== null) handleDeletePhoto(deletePhotoIndex);
          setDeletePhotoIndex(null);
        }}
        onCancel={() => setDeletePhotoIndex(null)}
      />
    </div>
  );
}
