package logger

import (
	"context"
	"log/slog"
	"os"
)

type contextKey string

const requestLoggerContextKey contextKey = "request_logger"

// Init configures the global slog logger.
// In development, it uses a human-readable text handler.
// In production, it uses JSON for structured log aggregation.
func Init(environment string) {
	var handler slog.Handler

	if environment == "production" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
	} else {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})
	}

	slog.SetDefault(slog.New(handler))
}

// WithContext stores a logger on the context for request-scoped logging.
func WithContext(ctx context.Context, l *slog.Logger) context.Context {
	if l == nil {
		return ctx
	}
	return context.WithValue(ctx, requestLoggerContextKey, l)
}

// FromContext returns a request-scoped logger when available, otherwise slog.Default().
func FromContext(ctx context.Context) *slog.Logger {
	if ctx == nil {
		return slog.Default()
	}
	if l, ok := ctx.Value(requestLoggerContextKey).(*slog.Logger); ok && l != nil {
		return l
	}
	return slog.Default()
}
