'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import apiClient from '@/lib/api';

interface VerificationAttempt {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_avatar?: string;

  // Stripe
  stripe_verified: boolean;
  stripe_verified_at?: string;

  // Jumio
  jumio_scan_ref?: string;
  jumio_status: 'pending' | 'approved' | 'rejected' | 'expired';
  jumio_verified_at?: string;
  jumio_dob?: string;
  jumio_document_type?: string;
  jumio_country?: string;

  // Face match
  face_match_score?: number;
  face_match_passed?: boolean;
  profile_photo_url?: string;
  id_selfie_url?: string;

  // Overall
  overall_status: 'pending' | 'verified' | 'rejected' | 'manual_review';
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;

  created_at: string;
  updated_at: string;
}

type VerificationFilter = 'all' | 'pending' | 'manual_review' | 'verified' | 'rejected';

export default function AdminVerificationsPage() {
  const searchParams = useSearchParams();

  const [verifications, setVerifications] = useState<VerificationAttempt[]>([]);
  const [totalVerifications, setTotalVerifications] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<VerificationFilter>(
    (searchParams.get('status') as VerificationFilter) || 'all'
  );
  const [selectedVerification, setSelectedVerification] = useState<VerificationAttempt | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadVerifications();
  }, [filter, currentPage]);

  const loadVerifications = async () => {
    setIsLoading(true);

    let endpoint = `/v1/admin/verifications?limit=${ITEMS_PER_PAGE}&offset=${currentPage * ITEMS_PER_PAGE}`;
    if (filter !== 'all') endpoint += `&status=${filter}`;

    const response = await apiClient.get<{ verifications: VerificationAttempt[]; total: number }>(endpoint);

    if (response.success && response.data) {
      setVerifications(response.data.verifications || []);
      setTotalVerifications(response.data.total);
    }

    setIsLoading(false);
  };

  const handleApprove = async (verification: VerificationAttempt) => {
    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/verifications/${verification.id}/approve`, {});

    if (response.success) {
      setVerifications((prev) =>
        prev.map((v) => (v.id === verification.id ? { ...v, overall_status: 'verified' as const } : v))
      );
      setShowModal(false);
      setSelectedVerification(null);
    }
    setActionLoading(false);
  };

  const handleReject = async (verification: VerificationAttempt) => {
    if (!rejectionReason.trim()) return;

    setActionLoading(true);
    const response = await apiClient.post(`/v1/admin/verifications/${verification.id}/reject`, {
      reason: rejectionReason,
    });

    if (response.success) {
      setVerifications((prev) =>
        prev.map((v) =>
          v.id === verification.id
            ? { ...v, overall_status: 'rejected' as const, rejection_reason: rejectionReason }
            : v
        )
      );
      setShowModal(false);
      setSelectedVerification(null);
      setRejectionReason('');
    }
    setActionLoading(false);
  };

  const openVerificationModal = (verification: VerificationAttempt) => {
    setSelectedVerification(verification);
    setShowModal(true);
    setRejectionReason('');
  };

  const totalPages = Math.ceil(totalVerifications / ITEMS_PER_PAGE);

  const getStatusBadge = (status: VerificationAttempt['overall_status']) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      manual_review: 'bg-orange-500/20 text-orange-400',
      verified: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
    };
    return styles[status];
  };

  const getFaceMatchColor = (score?: number) => {
    if (!score) return 'text-muted';
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Age Verifications</h1>
        <p className="text-muted mt-1">Review and manage user verification attempts</p>
      </div>

      {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'manual_review', 'verified', 'rejected'] as VerificationFilter[]).map((f) => (
            <Button
              key={f}
              variant="ghost"
              onClick={() => {
                setFilter(f);
                setCurrentPage(0);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-muted hover:text-white'
            } ${f === 'manual_review' ? 'capitalize' : 'capitalize'}`}
          >
            {f === 'manual_review' ? 'Manual Review' : f}
            </Button>
          ))}
        </div>

      {/* Verifications Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner className="h-12 w-12" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-xl">
          <p className="text-xl text-muted">No verifications found</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">User</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Card</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">ID Check</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Face Match</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted">Submitted</th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {verifications.map((verification) => (
                <tr key={verification.id} className="hover:bg-border/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                        {verification.user_avatar ? (
                          <Image
                            src={verification.user_avatar}
                            alt={verification.user_name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {verification.user_name?.charAt(0).toUpperCase() || verification.user_email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{verification.user_name || 'No name'}</p>
                        <p className="text-xs text-muted truncate">{verification.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusBadge(verification.overall_status)}`}>
                      {verification.overall_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {verification.stripe_verified ? (
                      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-muted" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm ${verification.jumio_status === 'approved' ? 'text-green-400' : verification.jumio_status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {verification.jumio_status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${getFaceMatchColor(verification.face_match_score)}`}>
                      {verification.face_match_score ? `${verification.face_match_score.toFixed(0)}%` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-muted">
                      {new Date(verification.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <Button
                        onClick={() => openVerificationModal(verification)}
                        className="px-3 py-1 text-sm"
                      >
                        Review
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

      {/* Verification Detail Modal */}
      <Modal
        open={showModal && !!selectedVerification}
        onClose={() => setShowModal(false)}
        containerClassName="max-w-3xl w-full"
      >
        {selectedVerification && (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Verification Review</h2>
                  <p className="text-muted mt-1">{selectedVerification.user_email}</p>
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
              {/* Face Comparison */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Face Comparison</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted mb-2">Profile Photo</p>
                    <div className="aspect-square bg-border rounded-xl overflow-hidden">
                      {selectedVerification.profile_photo_url ? (
                        <Image
                          src={selectedVerification.profile_photo_url}
                          alt="Profile"
                          width={300}
                          height={300}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          No photo
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted mb-2">ID Selfie</p>
                    <div className="aspect-square bg-border rounded-xl overflow-hidden">
                      {selectedVerification.id_selfie_url ? (
                        <Image
                          src={selectedVerification.id_selfie_url}
                          alt="ID Selfie"
                          width={300}
                          height={300}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted">
                          No selfie
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Face Match Score</span>
                    <span className={`text-2xl font-bold ${getFaceMatchColor(selectedVerification.face_match_score)}`}>
                      {selectedVerification.face_match_score ? `${selectedVerification.face_match_score.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  {selectedVerification.face_match_score && selectedVerification.face_match_score >= 80 && selectedVerification.face_match_score < 90 && (
                    <p className="text-sm text-orange-400 mt-2">
                      Score is between 80-90%. Manual review recommended.
                    </p>
                  )}
                </div>
              </div>

              {/* Verification Steps */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Verification Steps</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-border rounded-lg">
                    <div className="flex items-center gap-3">
                      {selectedVerification.stripe_verified ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <span className="text-white">Card Verification (Stripe)</span>
                    </div>
                    <span className={`text-sm ${selectedVerification.stripe_verified ? 'text-green-400' : 'text-yellow-400'}`}>
                      {selectedVerification.stripe_verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-border rounded-lg">
                    <div className="flex items-center gap-3">
                      {selectedVerification.jumio_status === 'approved' ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : selectedVerification.jumio_status === 'rejected' ? (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <span className="text-white">ID Verification (Jumio)</span>
                    </div>
                    <span className={`text-sm capitalize ${selectedVerification.jumio_status === 'approved' ? 'text-green-400' : selectedVerification.jumio_status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {selectedVerification.jumio_status || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-border rounded-lg">
                    <div className="flex items-center gap-3">
                      {selectedVerification.face_match_passed ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : selectedVerification.face_match_score && selectedVerification.face_match_score < 80 ? (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <span className="text-white">Face Match</span>
                    </div>
                    <span className={`text-sm ${getFaceMatchColor(selectedVerification.face_match_score)}`}>
                      {selectedVerification.face_match_score ? `${selectedVerification.face_match_score.toFixed(0)}%` : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ID Details */}
              {selectedVerification.jumio_status === 'approved' && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">ID Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-border rounded-lg p-4">
                      <p className="text-sm text-muted">Date of Birth</p>
                      <p className="text-white">{selectedVerification.jumio_dob || 'N/A'}</p>
                    </div>
                    <div className="bg-border rounded-lg p-4">
                      <p className="text-sm text-muted">Document Type</p>
                      <p className="text-white capitalize">{selectedVerification.jumio_document_type || 'N/A'}</p>
                    </div>
                    <div className="bg-border rounded-lg p-4">
                      <p className="text-sm text-muted">Country</p>
                      <p className="text-white">{selectedVerification.jumio_country || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection Reason Display */}
              {selectedVerification.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-400 font-medium">Rejection Reason</p>
                  <p className="text-muted mt-1">{selectedVerification.rejection_reason}</p>
                </div>
              )}

              {/* Rejection Input */}
              {(selectedVerification.overall_status === 'pending' || selectedVerification.overall_status === 'manual_review') && (
                <div>
                  <label className="text-sm text-muted mb-2 block">Rejection Reason (if rejecting)</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this verification is being rejected..."
                    rows={2}
                    className="w-full resize-none"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-border flex justify-end gap-4">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Close
              </Button>

              {(selectedVerification.overall_status === 'pending' || selectedVerification.overall_status === 'manual_review') && (
                <>
                  <Button
                    onClick={() => handleReject(selectedVerification)}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Processing...' : 'Reject'}
                  </Button>
                  <Button
                    onClick={() => handleApprove(selectedVerification)}
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
    </div>
  );
}
