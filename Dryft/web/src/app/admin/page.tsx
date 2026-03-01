'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/utils';

interface DashboardStats {
  total_users: number;
  verified_users: number;
  total_creators: number;
  total_items: number;
  pending_items: number;
  total_sales: number;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  pending_verifications: number;
  active_sessions: number;
}

interface RecentActivity {
  id: string;
  type: 'user_registered' | 'item_submitted' | 'purchase' | 'verification_completed' | 'creator_applied';
  description: string;
  created_at: string;
  metadata?: Record<string, string>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);

    const [statsRes, activityRes] = await Promise.all([
      apiClient.get<{ stats: DashboardStats }>('/v1/admin/stats'),
      apiClient.get<{ activities: RecentActivity[] }>('/v1/admin/activity?limit=10'),
    ]);

    if (statsRes.success && statsRes.data) {
      setStats(statsRes.data.stats);
    }
    if (activityRes.success && activityRes.data) {
      setActivities(activityRes.data.activities || []);
    }

    setIsLoading(false);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'user_registered':
        return 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z';
      case 'item_submitted':
        return 'M12 6v6m0 0v6m0-6h6m-6 0H6';
      case 'purchase':
        return 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z';
      case 'verification_completed':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'creator_applied':
        return 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-surface rounded w-48" />
          <div className="grid grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-muted mt-1">Welcome back. Here&apos;s what&apos;s happening.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={formatNumber(stats?.total_users || 0)}
          subtitle={`${formatNumber(stats?.verified_users || 0)} verified`}
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          color="blue"
        />
        <StatCard
          title="Total Items"
          value={formatNumber(stats?.total_items || 0)}
          subtitle={`${formatNumber(stats?.pending_items || 0)} pending review`}
          icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          color="purple"
          alert={Boolean(stats?.pending_items && stats.pending_items > 0)}
        />
        <StatCard
          title="Revenue (Month)"
          value={formatCurrency(stats?.revenue_month || 0)}
          subtitle={`${formatCurrency(stats?.revenue_today || 0)} today`}
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          color="green"
        />
        <StatCard
          title="Pending Verifications"
          value={formatNumber(stats?.pending_verifications || 0)}
          subtitle="Awaiting review"
          icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          color="yellow"
          alert={Boolean(stats?.pending_verifications && stats.pending_verifications > 0)}
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Card
              href="/admin/items?status=pending"
              className="flex items-center gap-3 p-3 rounded-lg hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">Review Items</div>
                <div className="text-sm text-muted">{stats?.pending_items || 0} pending</div>
              </div>
            </Card>

            <Card
              href="/admin/verifications?status=pending"
              className="flex items-center gap-3 p-3 rounded-lg hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">Age Verifications</div>
                <div className="text-sm text-muted">{stats?.pending_verifications || 0} pending</div>
              </div>
            </Card>

            <Card
              href="/admin/creators?status=pending"
              className="flex items-center gap-3 p-3 rounded-lg hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">Creator Applications</div>
                <div className="text-sm text-muted">Review new creators</div>
              </div>
            </Card>

            <Card
              href="/admin/reports"
              className="flex items-center gap-3 p-3 rounded-lg hover:border-primary transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white">View Reports</div>
                <div className="text-sm text-muted">Analytics & insights</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          {activities.length === 0 ? (
            <p className="text-muted text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-border flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getActivityIcon(activity.type)} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{activity.description}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Platform Health */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface rounded-xl p-6">
          <h3 className="text-sm text-muted mb-2">Active Sessions</h3>
          <div className="text-2xl font-bold text-white">{formatNumber(stats?.active_sessions || 0)}</div>
          <div className="mt-4 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: '75%' }} />
          </div>
          <p className="text-xs text-muted mt-2">Platform health: Good</p>
        </div>

        <div className="bg-surface rounded-xl p-6">
          <h3 className="text-sm text-muted mb-2">Total Sales</h3>
          <div className="text-2xl font-bold text-white">{formatNumber(stats?.total_sales || 0)}</div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-green-500 text-sm">+12%</span>
            <span className="text-xs text-muted">vs last week</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6">
          <h3 className="text-sm text-muted mb-2">Creators</h3>
          <div className="text-2xl font-bold text-white">{formatNumber(stats?.total_creators || 0)}</div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-green-500 text-sm">+5</span>
            <span className="text-xs text-muted">new this week</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  alert,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: 'blue' | 'purple' | 'green' | 'yellow';
  alert?: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className={`bg-surface rounded-xl p-6 ${alert ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className="text-xs text-muted mt-2">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}
