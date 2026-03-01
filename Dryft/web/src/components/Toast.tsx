'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Image from 'next/image';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'match';
  title: string;
  message?: string;
  imageUrl?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ShowToastOptions {
  type?: 'success' | 'error' | 'info';
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showToast: (options: ShowToastOptions) => void;
  showMatchNotification: (userName: string, userPhoto?: string, onView?: () => void) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (options: ShowToastOptions) => {
      addToast({
        type: options.type || 'info',
        title: options.title || (options.type === 'error' ? 'Error' : options.type === 'success' ? 'Success' : 'Notice'),
        message: options.message,
        duration: options.duration,
        action: options.action,
      });
    },
    [addToast]
  );

  const showMatchNotification = useCallback(
    (userName: string, userPhoto?: string, onView?: () => void) => {
      addToast({
        type: 'match',
        title: "It's a Match!",
        message: `You and ${userName} liked each other`,
        imageUrl: userPhoto,
        duration: 8000,
        action: onView
          ? {
              label: 'Say Hi',
              onClick: onView,
            }
          : undefined,
      });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, showToast, showMatchNotification }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const bgColor =
    toast.type === 'match'
      ? 'bg-gradient-to-r from-pink-500 to-primary'
      : toast.type === 'success'
      ? 'bg-green-600'
      : toast.type === 'error'
      ? 'bg-red-600'
      : 'bg-surface';

  return (
    <div
      className={`${bgColor} rounded-xl shadow-2xl p-4 animate-slide-in-right border border-white/10`}
      onClick={() => onRemove(toast.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRemove(toast.id);
        }
      }}
    >
      <div className="flex items-start gap-3">
        {toast.imageUrl && (
          <div className="relative w-12 h-12 flex-shrink-0">
            <Image
              src={toast.imageUrl}
              alt=""
              fill
              className="rounded-full object-cover border-2 border-white"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-white text-lg">{toast.title}</h4>
          {toast.message && <p className="text-white/90 text-sm mt-0.5">{toast.message}</p>}
          {toast.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.action?.onClick();
                onRemove(toast.id);
              }}
              className="mt-2 px-4 py-1.5 bg-white text-primary font-semibold rounded-full text-sm hover:bg-white/90 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(toast.id);
          }}
          className="text-white/70 hover:text-white text-xl leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

export default ToastProvider;
