'use client';

import Link from 'next/link';
import { Vibrate, Bell, Shield, User, ChevronRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Logo from '@/components/ui/Logo';

interface SettingsItemProps {
  href?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
}

function SettingsItem({ href, icon, title, description, disabled }: SettingsItemProps) {
  return (
    <Card
      href={disabled ? undefined : href}
      className={`flex items-center gap-4 p-6 transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-primary cursor-pointer'
      }`}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {disabled ? (
        <span className="text-xs text-muted bg-border px-3 py-1 rounded-full">Coming soon</span>
      ) : (
        <ChevronRight className="w-5 h-5 text-muted" />
      )}
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
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
          <SettingsItem
            href="/settings/devices"
            icon={<Vibrate className="w-6 h-6" />}
            title="Haptic Devices"
            description="Connect and manage your devices through Intiface Central"
          />

          <SettingsItem
            icon={<Bell className="w-6 h-6" />}
            title="Notifications"
            description="Manage push notification preferences"
            disabled
          />

          <SettingsItem
            icon={<Shield className="w-6 h-6" />}
            title="Privacy"
            description="Control who can see your profile and activity"
            disabled
          />

          <SettingsItem
            icon={<User className="w-6 h-6" />}
            title="Account"
            description="Manage your account settings and security"
            disabled
          />
        </div>
      </div>
    </div>
  );
}
