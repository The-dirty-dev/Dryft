import type { ReactNode } from 'react';
import { classNames } from '@/utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const positionClasses: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export default function Tooltip({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) {
  return (
    <div className={classNames('relative inline-flex group', className)}>
      {children}
      <div
        className={classNames(
          'pointer-events-none absolute z-20 whitespace-nowrap rounded-lg bg-black/80 px-3 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100',
          positionClasses[position]
        )}
      >
        {content}
      </div>
    </div>
  );
}
