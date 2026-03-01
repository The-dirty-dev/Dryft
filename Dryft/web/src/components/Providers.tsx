'use client';

import { ReactNode, useEffect } from 'react';
import { ToastProvider } from './Toast';
import { GlobalNotifications } from './GlobalNotifications';
import ErrorBoundary from './ErrorBoundary';
import { initErrorHandling } from '@/utils/errorHandler';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    initErrorHandling();
  }, []);

  return (
    <ToastProvider>
      <GlobalNotifications />
      <ErrorBoundary>{children}</ErrorBoundary>
    </ToastProvider>
  );
}

export default Providers;
