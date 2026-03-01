'use client';

import Modal from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
  default: 'bg-primary hover:bg-primary/90 focus:ring-primary',
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} closeOnOverlayClick={!loading}>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 ${variantStyles[variant]}`}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
