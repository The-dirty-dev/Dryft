package logger

import (
	"log/slog"
	"os"
)

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
