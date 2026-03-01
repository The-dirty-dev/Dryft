import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { classNames } from '@/utils';

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
}

export default function Dropdown({
  trigger,
  children,
  align = 'left',
  className,
  triggerClassName,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={classNames('relative inline-flex', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={classNames('inline-flex items-center', triggerClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={classNames(
            'absolute mt-2 min-w-[160px] rounded-xl border border-border bg-surface shadow-lg z-20',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
