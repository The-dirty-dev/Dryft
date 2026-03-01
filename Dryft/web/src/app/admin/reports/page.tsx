'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/utils';

interface RevenueData {
  date: string;
  revenue: number;
  sales: number;
}

interface TopItem {
  id: string;
  name: string;
  creator_name: string;
  thumbnail_url?: string;
  revenue: number;
  sales: number;
}

interface TopCreator {
  id: string;
  display_name: string;
  avatar_url?: string;
  revenue: number;
  sales: number;
  items: number;
}

interface AnalyticsData {
  revenue: {
    today: number;
    yesterday: number;
    this_week: number;
    last_week: number;
    this_month: number;
    last_month: number;
    all_time: number;
  };
  users: {
    total: number;
    new_today: number;
    new_this_week: number;
    new_this_month: number;
    verified: number;
    verification_rate: number;
  };
  items: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  creators: {
    total: number;
    active: number;
    new_this_month: number;
  };
  daily_revenue: RevenueData[];
  top_items: TopItem[];
  top_creators: TopCreator[];
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function AdminReportsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setIsLoading(true);

    const response = await apiClient.get<{ analytics: AnalyticsData }>(
      `/v1/admin/analytics?range=${timeRange}`
    );

    if (response.success && response.data) {
      setAnalytics(response.data.analytics);
    }

    setIsLoading(false);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
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

  if (!analytics) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <p className="text-xl text-muted">Failed to load analytics</p>
        </div>
      </div>
    );
  }

  const revenueChange = calculateChange(analytics.revenue.this_week, analytics.revenue.last_week);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-muted mt-1">Platform performance and insights</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              onClick={() => setTimeRange(range)}
              variant={timeRange === range ? 'primary' : 'secondary'}
              className="px-4 py-2 rounded-lg text-sm font-medium"
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface rounded-xl p-6">
          <p className="text-sm text-muted">Today&apos;s Revenue</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(analytics.revenue.today)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-sm ${analytics.revenue.today >= analytics.revenue.yesterday ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(calculateChange(analytics.revenue.today, analytics.revenue.yesterday))}
            </span>
            <span className="text-xs text-muted">vs yesterday</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6">
          <p className="text-sm text-muted">This Week</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(analytics.revenue.this_week)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-sm ${revenueChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(revenueChange)}
            </span>
            <span className="text-xs text-muted">vs last week</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6">
          <p className="text-sm text-muted">This Month</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(analytics.revenue.this_month)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-sm ${analytics.revenue.this_month >= analytics.revenue.last_month ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(calculateChange(analytics.revenue.this_month, analytics.revenue.last_month))}
            </span>
            <span className="text-xs text-muted">vs last month</span>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6">
          <p className="text-sm text-muted">All Time Revenue</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(analytics.revenue.all_time)}</p>
          <p className="text-xs text-muted mt-2">Total platform revenue</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-surface rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-6">Revenue Trend</h2>
        <div className="h-64 flex items-end gap-1">
          {analytics.daily_revenue.map((day, i) => {
            const maxRevenue = Math.max(...analytics.daily_revenue.map((d) => d.revenue), 1);
            const height = (day.revenue / maxRevenue) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <div className="w-full relative">
                  <div
                    className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-border rounded-lg px-3 py-2 text-xs whitespace-nowrap">
                      <p className="text-white font-medium">{formatCurrency(day.revenue)}</p>
                      <p className="text-muted">{day.sales} sales</p>
                      <p className="text-muted">{new Date(day.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-4 text-xs text-muted">
          <span>{analytics.daily_revenue[0]?.date ? new Date(analytics.daily_revenue[0].date).toLocaleDateString() : ''}</span>
          <span>{analytics.daily_revenue[analytics.daily_revenue.length - 1]?.date ? new Date(analytics.daily_revenue[analytics.daily_revenue.length - 1].date).toLocaleDateString() : ''}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Users */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted">Total Users</span>
              <span className="text-white font-medium">{formatNumber(analytics.users.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">New Today</span>
              <span className="text-white font-medium">{formatNumber(analytics.users.new_today)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">New This Week</span>
              <span className="text-white font-medium">{formatNumber(analytics.users.new_this_week)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">New This Month</span>
              <span className="text-white font-medium">{formatNumber(analytics.users.new_this_month)}</span>
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between">
                <span className="text-muted">Verified Users</span>
                <span className="text-green-400 font-medium">{formatNumber(analytics.users.verified)}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-muted">Verification Rate</span>
                <span className="text-white font-medium">{analytics.users.verification_rate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Items</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted">Total Items</span>
              <span className="text-white font-medium">{formatNumber(analytics.items.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Approved</span>
              <span className="text-green-400 font-medium">{formatNumber(analytics.items.approved)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Pending Review</span>
              <span className="text-yellow-400 font-medium">{formatNumber(analytics.items.pending)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Rejected</span>
              <span className="text-red-400 font-medium">{formatNumber(analytics.items.rejected)}</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="h-2 bg-border rounded-full overflow-hidden flex">
              <div
                className="bg-green-500"
                style={{ width: `${(analytics.items.approved / analytics.items.total) * 100}%` }}
              />
              <div
                className="bg-yellow-500"
                style={{ width: `${(analytics.items.pending / analytics.items.total) * 100}%` }}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(analytics.items.rejected / analytics.items.total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Creators */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Creators</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted">Total Creators</span>
              <span className="text-white font-medium">{formatNumber(analytics.creators.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Active Creators</span>
              <span className="text-green-400 font-medium">{formatNumber(analytics.creators.active)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">New This Month</span>
              <span className="text-white font-medium">{formatNumber(analytics.creators.new_this_month)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Items & Creators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Items */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Top Selling Items</h2>
          {analytics.top_items.length === 0 ? (
            <p className="text-muted text-center py-8">No data available</p>
          ) : (
            <div className="space-y-4">
              {analytics.top_items.map((item, i) => (
                <div key={item.id} className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted w-8">{i + 1}</span>
                  <div className="w-12 h-12 rounded-lg bg-border overflow-hidden flex-shrink-0">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                        No img
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-muted truncate">by {item.creator_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{formatCurrency(item.revenue)}</p>
                    <p className="text-xs text-muted">{item.sales} sales</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Creators */}
        <div className="bg-surface rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Top Creators</h2>
          {analytics.top_creators.length === 0 ? (
            <p className="text-muted text-center py-8">No data available</p>
          ) : (
            <div className="space-y-4">
              {analytics.top_creators.map((creator, i) => (
                <div key={creator.id} className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted w-8">{i + 1}</span>
                  <div className="w-12 h-12 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                    {creator.avatar_url ? (
                      <img src={creator.avatar_url} alt={creator.display_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {creator.display_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{creator.display_name}</p>
                    <p className="text-xs text-muted">{creator.items} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{formatCurrency(creator.revenue)}</p>
                    <p className="text-xs text-muted">{creator.sales} sales</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
