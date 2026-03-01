'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import apiClient from '@/lib/api';
import { formatPrice } from '@/utils';
import { ItemType, ItemStatus } from '@/types';

interface AdminItem {
  id: string;
  creator_id: string;
  creator_name: string;
  item_type: ItemType;
  name: string;
  description: string;
  price: number;
  currency: string;
  thumbnail_url?: string;
  preview_urls?: string[];
  asset_bundle_url?: string;
  status: ItemStatus;
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  purchase_count: number;
  rating: number;
  rating_count: number;
}

const STATUS_OPTIONS: { label: string; value: ItemStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Disabled', value: 'disabled' },
];

const TYPE_OPTIONS: { label: string; value: ItemType | 'all' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Avatar', value: 'avatar' },
  { label: 'Outfit', value: 'outfit' },
  { label: 'Toy', value: 'toy' },
  { label: 'Effect', value: 'effect' },
  { label: 'Gesture', value: 'gesture' },
];

export default function AdminItemsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<AdminItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | 'all'>(
    (searchParams.get('status') as ItemStatus) || 'all'
  );
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all');
  const [selectedItem, setSelectedItem] = useState<AdminItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disableTarget, setDisableTarget] = useState<AdminItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadItems();
  }, [selectedStatus, selectedType, currentPage]);

  const loadItems = async () => {
    setIsLoading(true);

    let endpoint = `/v1/admin/items?limit=${ITEMS_PER_PAGE}&offset=${currentPage * ITEMS_PER_PAGE}`;
    if (selectedStatus !== 'all') endpoint += `&status=${selectedStatus}`;
    if (selectedType !== 'all') endpoint += `&type=${selectedType}`;

    const response = await apiClient.get<{ items: AdminItem[]; total: number }>(endpoint);

    if (response.success && response.data) {
      setItems(response.data.items || []);
      setTotalItems(response.data.total);
    }

    setIsLoading(false);
  };

  const handleApprove = async (item: AdminItem) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/items/${item.id}/approve`, {});

    if (response.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'approved' as ItemStatus } : i))
      );
      setShowModal(false);
      setSelectedItem(null);
    }
    setActionLoading(false);
  };

  const handleReject = async (item: AdminItem) => {
    if (!rejectionReason.trim()) return;

    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/items/${item.id}/reject`, {
      reason: rejectionReason,
    });

    if (response.success) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'rejected' as ItemStatus, rejection_reason: rejectionReason } : i
        )
      );
      setShowModal(false);
      setSelectedItem(null);
      setRejectionReason('');
    }
    setActionLoading(false);
  };

  const handleDisable = async (item: AdminItem) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/items/${item.id}/disable`, {});

    if (response.success) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'disabled' as ItemStatus } : i))
      );
    }
    setActionLoading(false);
  };

  const openReviewModal = (item: AdminItem) => {
    setSelectedItem(item);
    setShowModal(true);
    setRejectionReason('');
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const getStatusBadge = (status: ItemStatus) => {
    const styles = {
      draft: 'bg-gray-500/20 text-gray-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      disabled: 'bg-gray-500/20 text-gray-400',
    };
    return styles[status] || styles.draft;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Item Moderation</h1>
        <p className="text-muted mt-1">Review and manage marketplace items</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              onClick={() => {
                setSelectedStatus(option.value);
                setCurrentPage(0);
              }}
              variant="ghost"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === option.value
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-white'
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value as ItemType | 'all');
            setCurrentPage(0);
          }}
          className="input"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Items Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl">
          <p className="text-xl text-muted">No items found</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Item</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Creator</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Type</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Price</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Submitted</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-border/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-border overflow-hidden flex-shrink-0">
                        {item.thumbnail_url ? (
                          <Image
                            src={item.thumbnail_url}
                            alt={item.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{item.name}</p>
                        <p className="text-xs text-muted truncate max-w-[200px]">{item.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{item.creator_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted capitalize">{item.item_type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{formatPrice(item.price, item.currency)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">
                      {new Date(item.submitted_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => openReviewModal(item)}
                        className="px-3 py-1 text-sm"
                      >
                        Review
                      </Button>
                      {item.status === 'approved' && (
                        <Button
                          onClick={() => setDisableTarget(item)}
                          variant="secondary"
                          className="px-3 py-1 text-sm text-muted hover:text-white"
                        >
                          Disable
                        </Button>
                      )}
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

      {/* Review Modal */}
      <Modal
        open={showModal && !!selectedItem}
        onClose={() => setShowModal(false)}
        containerClassName="max-w-2xl w-full"
      >
        {selectedItem && (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Review Item</h2>
                  <p className="text-muted mt-1">{selectedItem.name}</p>
                </div>
                <Button
                  onClick={() => setShowModal(false)}
                  variant="ghost"
                  className="text-muted hover:text-white"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Preview */}
              <div className="aspect-video bg-border rounded-xl overflow-hidden">
                {selectedItem.thumbnail_url ? (
                  <Image
                    src={selectedItem.thumbnail_url}
                    alt={selectedItem.name}
                    width={800}
                    height={450}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    No preview available
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted">Creator</p>
                  <p className="text-white">{selectedItem.creator_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Type</p>
                  <p className="text-white capitalize">{selectedItem.item_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Price</p>
                  <p className="text-white">{formatPrice(selectedItem.price, selectedItem.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusBadge(selectedItem.status)}`}>
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-muted mb-2">Description</p>
                <p className="text-white">{selectedItem.description || 'No description'}</p>
              </div>

              {/* Rejection Reason Input */}
              {selectedItem.status === 'pending' && (
                <div>
                  <label className="text-sm text-muted mb-2 block">Rejection Reason (if rejecting)</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this item is being rejected..."
                    rows={3}
                    className="w-full resize-none min-h-[100px]"
                  />
                </div>
              )}

              {/* Previous Rejection */}
              {selectedItem.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-400 font-medium">Previous Rejection Reason</p>
                  <p className="text-muted mt-1">{selectedItem.rejection_reason}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-border flex justify-end gap-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              {selectedItem.status === 'pending' && (
                <>
                  <Button
                    onClick={() => handleReject(selectedItem)}
                    disabled={actionLoading || !rejectionReason.trim()}
                    variant="ghost"
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    {actionLoading ? 'Processing...' : 'Reject'}
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedItem)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={disableTarget !== null}
        title="Disable Item"
        message={`Are you sure you want to disable "${disableTarget?.title ?? 'this item'}"? It will be removed from the store.`}
        confirmLabel="Disable"
        variant="danger"
        loading={actionLoading}
        onConfirm={() => {
          if (disableTarget) handleDisable(disableTarget);
          setDisableTarget(null);
        }}
        onCancel={() => setDisableTarget(null)}
      />
    </div>
  );
}
