import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageErrorFallback from '@/components/PageErrorFallback';

function Exploder() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders a custom fallback and reports errors', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary fallback={<div>Fallback UI</div>} onError={onError}>
        <Exploder />
      </ErrorBoundary>
    );

    expect(screen.getByText('Fallback UI')).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it('renders the default page fallback with error message', () => {
    render(
      <ErrorBoundary>
        <Exploder />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});

describe('PageErrorFallback', () => {
  it('shows retry button when onRetry is provided', () => {
    render(<PageErrorFallback onRetry={() => {}} />);

    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
