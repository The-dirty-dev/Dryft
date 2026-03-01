'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import apiClient from '@/lib/api';
import { formatCurrency } from '@/utils';

interface AdminCreator {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  store_name: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  stripe_account_id?: string;
  stripe_onboarded: boolean;
  payouts_enabled: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason?: string;
  total_items: number;
  total_sales: number;
  total_earnings: number;
  available_balance: number;
  average_rating: number;
  rating_count: number;
  applied_at: string;
  approved_at?: string;
}

type CreatorFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';

export default function AdminCreatorsPage() {
  const searchParams = useSearchParams();

  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [totalCreators, setTotalCreators] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<CreatorFilter>(
    (searchParams.get('status') as CreatorFilter) || 'all'
  );
  const [selectedCreator, setSelectedCreator] = useState<AdminCreator | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<AdminCreator | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const CREATORS_PER_PAGE = 20;

  useEffect(() => {
    loadCreators();
  }, [filter, currentPage]);

  const loadCreators = async () => {
    setIsLoading(true);

    let endpoint = `/v1/admin/creators?limit=${CREATORS_PER_PAGE}&offset=${currentPage * CREATORS_PER_PAGE}`;
    if (filter !== 'all') endpoint += `&status=${filter}`;

    const response = await apiClient.get<{ creators: AdminCreator[]; total: number }>(endpoint);

    if (response.success && response.data) {
      setCreators(response.data.creators || []);
      setTotalCreators(response.data.total);
    }

    setIsLoading(false);
  };

  const handleApprove = async (creator: AdminCreator) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/creators/${creator.id}/approve`, {});

    if (response.success) {
      setCreators((prev) =>
        prev.map((c) => (c.id === creator.id ? { ...c, status: 'approved' as const } : c))
      );
      setShowModal(false);
      setSelectedCreator(null);
    }
    setActionLoading(false);
  };

  const handleReject = async (creator: AdminCreator) => {
    if (!rejectionReason.trim()) return;

    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/creators/${creator.id}/reject`, {
      reason: rejectionReason,
    });

    if (response.success) {
      setCreators((prev) =>
        prev.map((c) =>
          c.id === creator.id ? { ...c, status: 'rejected' as const, rejection_reason: rejectionReason } : c
        )
      );
      setShowModal(false);
      setSelectedCreator(null);
      setRejectionReason('');
    }
    setActionLoading(false);
  };

  const handleSuspend = async (creator: AdminCreator) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/creators/${creator.id}/suspend`, {});

    if (response.success) {
      setCreators((prev) =>
        prev.map((c) => (c.id === creator.id ? { ...c, status: 'suspended' as const } : c))
      );
    }
    setActionLoading(false);
  };

  const handleReactivate = async (creator: AdminCreator) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/creators/${creator.id}/reactivate`, {});

    if (response.success) {
      setCreators((prev) =>
        prev.map((c) => (c.id === creator.id ? { ...c, status: 'approved' as const } : c))
      );
    }
    setActionLoading(false);
  };

  const openCreatorModal = (creator: AdminCreator) => {
    setSelectedCreator(creator);
    setShowModal(true);
    setRejectionReason('');
  };

  const totalPages = Math.ceil(totalCreators / CREATORS_PER_PAGE);

  const getStatusBadge = (status: AdminCreator['status']) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      suspended: 'bg-gray-500/20 text-gray-400',
    };
    return styles[status];
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Creator Management</h1>
        <p className="text-muted mt-1">Review applications and manage creators</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'approved', 'rejected', 'suspended'] as CreatorFilter[]).map((f) => (
          <Button
            key={f}
            onClick={() => {
              setFilter(f);
              setCurrentPage(0);
            }}
            variant="ghost"
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

      {/* Creators Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      ) : creators.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl">
          <p className="text-xl text-muted">No creators found</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Creator</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Items</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Sales</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Earnings</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Rating</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Applied</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {creators.map((creator) => (
                <tr key={creator.id} className="hover:bg-border/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                        {creator.avatar_url ? (
                          <Image
                            src={creator.avatar_url}
                            alt={creator.display_name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {creator.display_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{creator.store_name || creator.display_name}</p>
                        <p className="text-xs text-muted truncate">{creator.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusBadge(creator.status)}`}>
                      {creator.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{creator.total_items}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{creator.total_sales}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{formatCurrency(creator.total_earnings)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">
                      {creator.rating_count > 0 ? creator.average_rating.toFixed(1) : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">
                      {new Date(creator.applied_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => openCreatorModal(creator)}
                        className="px-3 py-1 text-sm"
                      >
                        {creator.status === 'pending' ? 'Review' : 'View'}
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
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            variant="secondary"
          >
            Previous
          </Button>
          <span className="text-muted">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            variant="secondary"
          >
            Next
          </Button>
        </div>
      )}

      {/* Creator Detail Modal */}
      <Modal
        open={showModal && !!selectedCreator}
        onClose={() => setShowModal(false)}
        containerClassName="max-w-2xl w-full"
      >
        {selectedCreator && (
          <>
            {/* Banner */}
            <div className="h-32 bg-border relative">
              {selectedCreator.banner_url && (
                <Image
                  src={selectedCreator.banner_url}
                  alt="Banner"
                  fill
                  className="object-cover"
                />
              )}
              <Button
                onClick={() => setShowModal(false)}
                variant="ghost"
                className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {/* Profile Header */}
            <div className="px-6 -mt-12 relative">
              <div className="flex items-end gap-4">
                <div className="w-24 h-24 rounded-xl bg-surface border-4 border-surface overflow-hidden">
                  {selectedCreator.avatar_url ? (
                    <Image
                      src={selectedCreator.avatar_url}
                      alt={selectedCreator.display_name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <span className="text-3xl font-bold text-primary">
                        {selectedCreator.display_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="pb-2">
                  <h2 className="text-xl font-bold text-white">{selectedCreator.store_name || selectedCreator.display_name}</h2>
                  <p className="text-muted">{selectedCreator.email}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadge(selectedCreator.status)}`}>
                  {selectedCreator.status}
                </span>
                {selectedCreator.stripe_onboarded && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400">
                    Stripe Connected
                  </span>
                )}
                {selectedCreator.payouts_enabled && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                    Payouts Enabled
                  </span>
                )}
              </div>

              {/* Bio */}
              {selectedCreator.bio && (
                <div>
                  <p className="text-sm text-muted mb-2">Bio</p>
                  <p className="text-white">{selectedCreator.bio}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{selectedCreator.total_items}</div>
                  <div className="text-xs text-muted">Items</div>
                </div>
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{selectedCreator.total_sales}</div>
                  <div className="text-xs text-muted">Sales</div>
                </div>
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{formatCurrency(selectedCreator.total_earnings)}</div>
                  <div className="text-xs text-muted">Earnings</div>
                </div>
                <div className="bg-border rounded-lg p-4 text-center">
                  <div className="text-xl font-bold text-white">{formatCurrency(selectedCreator.available_balance)}</div>
                  <div className="text-xs text-muted">Balance</div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted">Applied</span>
                  <span className="text-white">{new Date(selectedCreator.applied_at).toLocaleDateString()}</span>
                </div>
                {selectedCreator.approved_at && (
                  <div className="flex justify-between">
                    <span className="text-muted">Approved</span>
                    <span className="text-white">{new Date(selectedCreator.approved_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Rejection Reason Display */}
              {selectedCreator.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-400 font-medium">Rejection Reason</p>
                  <p className="text-muted mt-1">{selectedCreator.rejection_reason}</p>
                </div>
              )}

              {/* Rejection Input */}
              {selectedCreator.status === 'pending' && (
                <div>
                  <label className="text-sm text-muted mb-2 block">Rejection Reason (if rejecting)</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this application is being rejected..."
                    rows={2}
                    className="w-full resize-none min-h-[80px]"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-border flex justify-end gap-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Close
              </Button>

              {selectedCreator.status === 'pending' && (
                <>
                  <Button
                    onClick={() => handleReject(selectedCreator)}
                    disabled={actionLoading || !rejectionReason.trim()}
                    variant="ghost"
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    {actionLoading ? 'Processing...' : 'Reject'}
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedCreator)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </Button>
                </>
              )}

              {selectedCreator.status === 'approved' && (
                <Button
                  onClick={() => setSuspendTarget(selectedCreator)}
                  disabled={actionLoading}
                  variant="ghost"
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  {actionLoading ? 'Processing...' : 'Suspend'}
                </Button>
              )}

              {selectedCreator.status === 'suspended' && (
                <Button
                  onClick={() => handleReactivate(selectedCreator)}
                  disabled={actionLoading}
                  variant="ghost"
                  className="bg-green-500 text-white hover:bg-green-600"
                >
                  {actionLoading ? 'Processing...' : 'Reactivate'}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={suspendTarget !== null}
        title="Suspend Creator"
        message={`Are you sure you want to suspend ${suspendTarget?.display_name ?? 'this creator'}? Their items will be hidden from the store.`}
        confirmLabel="Suspend"
        variant="danger"
        loading={actionLoading}
        onConfirm={() => {
          if (suspendTarget) handleSuspend(suspendTarget);
          setSuspendTarget(null);
        }}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  );
}
