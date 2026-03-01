import Button from '@/components/ui/Button';

export interface PageErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function PageErrorFallback({
  title = 'Something went wrong',
  message = 'Please try again or refresh the page.',
  onRetry,
}: PageErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-muted mb-6">{message}</p>
        <div className="flex items-center justify-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} className="px-6">
              Try Again
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="px-6"
          >
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
