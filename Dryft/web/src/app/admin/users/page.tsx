'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/utils';

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  verified: boolean;
  verified_at?: string;
  is_banned: boolean;
  ban_reason?: string;
  role: 'user' | 'creator' | 'moderator' | 'admin';
  created_at: string;
  last_login_at?: string;
  stats: {
    inventory_count: number;
    total_spent: number;
    total_purchases: number;
  };
}

type UserFilter = 'all' | 'verified' | 'unverified' | 'banned' | 'creators';

export default function AdminUsersPage() {
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>(
    (searchParams.get('filter') as UserFilter) || 'all'
  );
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [resetVerificationUser, setResetVerificationUser] = useState<AdminUser | null>(null);

  const USERS_PER_PAGE = 20;

  useEffect(() => {
    loadUsers();
  }, [filter, currentPage]);

  const loadUsers = async () => {
    setIsLoading(true);

    let endpoint = `/v1/admin/users?limit=${USERS_PER_PAGE}&offset=${currentPage * USERS_PER_PAGE}`;
    if (filter !== 'all') endpoint += `&filter=${filter}`;

    const response = await apiClient.get<{ users: AdminUser[]; total: number }>(endpoint);

    if (response.success && response.data) {
      setUsers(response.data.users || []);
      setTotalUsers(response.data.total);
    }

    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) {
      loadUsers();
      return;
    }

    setIsLoading(true);
    const response = await apiClient.get<{ users: AdminUser[]; total: number }>(
      `/v1/admin/users/search?q=${encodeURIComponent(search)}&limit=${USERS_PER_PAGE}`
    );

    if (response.success && response.data) {
      setUsers(response.data.users || []);
      setTotalUsers(response.data.total);
    }
    setIsLoading(false);
  };

  const handleBan = async (user: AdminUser) => {
    if (!banReason.trim()) return;

    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/users/${user.id}/ban`, {
      reason: banReason,
    });

    if (response.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_banned: true, ban_reason: banReason } : u))
      );
      setShowModal(false);
      setSelectedUser(null);
      setBanReason('');
    }
    setActionLoading(false);
  };

  const handleUnban = async (user: AdminUser) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/users/${user.id}/unban`, {});

    if (response.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_banned: false, ban_reason: undefined } : u))
      );
    }
    setActionLoading(false);
  };

  const requestResetVerification = (user: AdminUser) => {
    setResetVerificationUser(user);
    setShowResetConfirm(true);
  };

  const handleResetVerification = async () => {
    if (!resetVerificationUser) return;

    setActionLoading(true);
    const response = await apiClient.post(
      `/v1/admin/users/${resetVerificationUser.id}/reset-verification`,
      {}
    );

    if (response.success) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === resetVerificationUser.id ? { ...u, verified: false, verified_at: undefined } : u
        )
      );
      setSelectedUser((prev) =>
        prev && prev.id === resetVerificationUser.id
          ? { ...prev, verified: false, verified_at: undefined }
          : prev
      );
    }

    setShowResetConfirm(false);
    setResetVerificationUser(null);
    setActionLoading(false);
  };

  const openUserModal = (user: AdminUser) => {
    setSelectedUser(user);
    setShowModal(true);
    setBanReason('');
  };

  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-muted mt-1">View and manage user accounts</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-64"
          />
          <Button type="submit">
            Search
          </Button>
        </form>

        <div className="flex gap-2">
          {(['all', 'verified', 'unverified', 'banned', 'creators'] as UserFilter[]).map((f) => (
            <Button
              key={f}
              variant="ghost"
              onClick={() => {
                setFilter(f);
                setCurrentPage(0);
                setSearch('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-white'
              }`}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl">
          <p className="text-xl text-muted">No users found</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">User</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Role</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Items</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Spent</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Joined</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-border/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.display_name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {user.display_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{user.display_name || 'No name'}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {user.is_banned ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 inline-block w-fit">
                          Banned
                        </span>
                      ) : user.verified ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 inline-block w-fit">
                          Verified
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 inline-block w-fit">
                          Unverified
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted capitalize">{user.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{user.stats.inventory_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{formatCurrency(user.stats.total_spent)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => openUserModal(user)}
                        className="px-3 py-1 text-sm"
                      >
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <Button
            variant="secondary"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-muted">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}

      {/* User Detail Modal */}
      <Modal
        open={showModal && !!selectedUser}
        onClose={() => setShowModal(false)}
        containerClassName="max-w-xl w-full"
      >
        {selectedUser && (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/20 overflow-hidden">
                    {selectedUser.avatar_url ? (
                      <Image
                        src={selectedUser.avatar_url}
                        alt={selectedUser.display_name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">
                          {selectedUser.display_name?.charAt(0).toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedUser.display_name || 'No name'}</h2>
                    <p className="text-muted">{selectedUser.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowModal(false)}
                  className="text-muted hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Badges */}
              <div className="flex gap-2">
                {selectedUser.is_banned && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400">
                    Banned
                  </span>
                )}
                {selectedUser.verified && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                    Age Verified
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 capitalize">
                  {selectedUser.role}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{selectedUser.stats.inventory_count}</div>
                  <div className="text-xs text-muted">Items Owned</div>
                </div>
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{selectedUser.stats.total_purchases}</div>
                  <div className="text-xs text-muted">Purchases</div>
                </div>
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{formatCurrency(selectedUser.stats.total_spent)}</div>
                  <div className="text-xs text-muted">Total Spent</div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted">User ID</span>
                  <span className="text-white font-mono text-sm">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Joined</span>
                  <span className="text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                </div>
                {selectedUser.last_login_at && (
                  <div className="flex justify-between">
                    <span className="text-muted">Last Login</span>
                    <span className="text-white">{new Date(selectedUser.last_login_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedUser.verified_at && (
                  <div className="flex justify-between">
                    <span className="text-muted">Verified At</span>
                    <span className="text-white">{new Date(selectedUser.verified_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Ban Reason Display */}
              {selectedUser.is_banned && selectedUser.ban_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-400 font-medium">Ban Reason</p>
                  <p className="text-muted mt-1">{selectedUser.ban_reason}</p>
                </div>
              )}

              {/* Ban Input */}
              {!selectedUser.is_banned && (
                <div>
                  <label className="text-sm text-muted mb-2 block">Ban Reason (if banning)</label>
                  <Textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Explain why this user is being banned..."
                    rows={2}
                    className="w-full resize-none"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-border flex justify-between">
              <div className="flex gap-2">
                {selectedUser.verified && (
                  <Button
                    variant="ghost"
                    onClick={() => requestResetVerification(selectedUser)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 disabled:opacity-50 transition-colors"
                  >
                    Reset Verification
                  </Button>
                )}
              </div>
              <div className="flex gap-4">
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Close
                </Button>
                {selectedUser.is_banned ? (
                  <Button
                    onClick={() => handleUnban(selectedUser)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Processing...' : 'Unban User'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleBan(selectedUser)}
                    disabled={actionLoading || !banReason.trim()}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Processing...' : 'Ban User'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset Verification?"
        message={
          resetVerificationUser
            ? `This will clear age verification for ${resetVerificationUser.display_name || resetVerificationUser.email}. They will need to verify again.`
            : 'This will clear age verification. They will need to verify again.'
        }
        confirmLabel="Reset Verification"
        cancelLabel="Cancel"
        variant="warning"
        loading={actionLoading}
        onConfirm={handleResetVerification}
        onCancel={() => {
          if (actionLoading) return;
          setShowResetConfirm(false);
          setResetVerificationUser(null);
        }}
      />
    </div>
  );
}
