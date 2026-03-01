'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Logo from '@/components/ui/Logo';
import apiClient from '@/lib/api';
import { AuthResponse } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    const response = await apiClient.post<AuthResponse>('/v1/auth/register', {
      email,
      password,
      display_name: displayName || undefined,
    });

    if (response.success && response.data) {
      apiClient.saveTokens(response.data.tokens);
      router.push('/');
    } else {
      setError(response.error || 'Registration failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Logo size={64} className="justify-center gap-3 text-4xl" />
          <p className="text-muted mt-3">Create your account</p>
        </div>

        {error && (
          <div className="bg-primary/10 border border-primary rounded-xl p-4 mb-6 flex items-center justify-between">
            <span className="text-primary">{error}</span>
            <Button
              onClick={() => setError(null)}
              variant="ghost"
              className="p-0 text-primary hover:underline"
            >
              Dismiss
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm text-muted mb-2">
              Display Name (optional)
            </label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-muted mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-muted mb-2">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm text-muted mb-2">
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full"
              placeholder="Confirm your password"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <span className="inline-flex items-center">
                <LoadingSpinner variant="inline" />
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted text-center">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
          You must be 18+ to use this service.
        </p>

        <div className="mt-8 text-center text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
