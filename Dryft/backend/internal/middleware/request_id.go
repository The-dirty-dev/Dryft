package middleware

import (
	"net/http"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// RequestID attaches a unique request ID to each incoming request.
func RequestID(next http.Handler) http.Handler {
	return chimiddleware.RequestID(next)
}
