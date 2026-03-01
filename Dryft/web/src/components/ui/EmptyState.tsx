import type { ReactNode } from 'react';
import { classNames } from '@/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={classNames('text-center py-12 px-6', className)}>
      {icon && <div className="mx-auto mb-4 flex items-center justify-center">{icon}</div>}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && <p className="text-sm text-muted mb-6">{description}</p>}
      {action}
    </div>
  );
}
