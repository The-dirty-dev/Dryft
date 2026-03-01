import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  children: ReactNode;
  overlayClassName?: string;
  containerClassName?: string;
  closeOnOverlayClick?: boolean;
  onClose?: () => void;
}

const classes = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

export default function Modal({
  open,
  children,
  overlayClassName,
  containerClassName,
  closeOnOverlayClick = false,
  onClose,
}: ModalProps) {
  if (!open) return null;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose?.();
    }
  };

  return (
    <div
      className={classes(
        'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4',
        overlayClassName
      )}
      onClick={handleOverlayClick}
    >
      <div
        className={classes(
          'bg-surface border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
          containerClassName
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
