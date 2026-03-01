'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/profile" className="text-muted hover:text-white transition-colors">
              Profile
            </Link>
            <Link href="/messages" className="text-muted hover:text-white transition-colors">
              Messages
            </Link>
            <Link href="/settings" className="text-white font-medium">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

        <div className="space-y-4">
          {/* Haptic Devices */}
          <Card
            href="/settings/devices"
            className="flex items-center gap-4 p-6 hover:border-primary transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">📳</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Haptic Devices</h2>
              <p className="text-sm text-muted">
                Connect and manage your devices through Intiface Central
              </p>
            </div>
            <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Card>

          {/* Notifications */}
          <Card className="flex items-center gap-4 p-6 opacity-50 cursor-not-allowed">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
              <p className="text-sm text-muted">
                Manage push notification preferences
              </p>
            </div>
            <span className="text-xs text-muted">Coming soon</span>
          </Card>

          {/* Privacy */}
          <Card className="flex items-center gap-4 p-6 opacity-50 cursor-not-allowed">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Privacy</h2>
              <p className="text-sm text-muted">
                Control who can see your profile and activity
              </p>
            </div>
            <span className="text-xs text-muted">Coming soon</span>
          </Card>

          {/* Account */}
          <Card className="flex items-center gap-4 p-6 opacity-50 cursor-not-allowed">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Account</h2>
              <p className="text-sm text-muted">
                Manage your account settings and security
              </p>
            </div>
            <span className="text-xs text-muted">Coming soon</span>
          </Card>
        </div>
      </div>
    </div>
  );
}
