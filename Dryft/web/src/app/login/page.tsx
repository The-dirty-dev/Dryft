'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import apiClient from '@/lib/api';
import { AuthResponse } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const response = await apiClient.post<AuthResponse>('/v1/auth/login', {
      email,
      password,
    });

    if (response.success && response.data) {
      apiClient.saveTokens(response.data.tokens);
      router.push('/');
    } else {
      setError(response.error || 'Login failed');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="text-4xl font-bold text-primary">
            Dryft
          </Link>
          <p className="text-muted mt-2">Sign in to your account</p>
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
              placeholder="Enter your password"
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
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-8 text-center text-muted">
          Don't have an account?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
