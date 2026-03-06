package middleware

import (
	"log/slog"
	"net/http"

	"github.com/dryft-app/backend/internal/logger"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// RequestID attaches a unique request ID to each incoming request.
func RequestID(next http.Handler) http.Handler {
	return chimiddleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := chimiddleware.GetReqID(r.Context())
		reqLogger := slog.Default().With("request_id", requestID)
		ctx := logger.WithContext(r.Context(), reqLogger)
		next.ServeHTTP(w, r.WithContext(ctx))
	}))
}
