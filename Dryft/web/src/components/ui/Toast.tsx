import type { ReactNode } from 'react';
import { classNames } from '@/utils';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  title?: string;
  children?: ReactNode;
  variant?: ToastVariant;
  className?: string;
}

const variantClasses: Record<ToastVariant, string> = {
  info: 'bg-surface text-white border-border',
  success: 'bg-green-500/10 text-green-100 border-green-500/30',
  warning: 'bg-yellow-500/10 text-yellow-100 border-yellow-500/30',
  error: 'bg-red-500/10 text-red-100 border-red-500/30',
};

export default function Toast({ title, children, variant = 'info', className }: ToastProps) {
  return (
    <div
      className={classNames(
        'rounded-xl border px-4 py-3 shadow-lg',
        variantClasses[variant],
        className
      )}
    >
      {title && <div className="font-semibold mb-1">{title}</div>}
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}
