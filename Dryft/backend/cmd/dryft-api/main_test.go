package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSkipForWebSocketBypassesWrappedMiddleware(t *testing.T) {
	baseHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	wrappedMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Middleware", "applied")
			next.ServeHTTP(w, r)
		})
	}

	handler := skipForWebSocket(wrappedMiddleware)(baseHandler)
	req := httptest.NewRequest(http.MethodGet, "/v1/ws", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
	}
	if got := rec.Header().Get("X-Middleware"); got != "" {
		t.Fatalf("expected middleware to be skipped, got header X-Middleware=%q", got)
	}
}

func TestSkipForWebSocketAppliesWrappedMiddlewareForNonWebSocketRequests(t *testing.T) {
	baseHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrappedMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Middleware", "applied")
			next.ServeHTTP(w, r)
		})
	}

	handler := skipForWebSocket(wrappedMiddleware)(baseHandler)
	req := httptest.NewRequest(http.MethodGet, "/v1/profile", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
	if got := rec.Header().Get("X-Middleware"); got != "applied" {
		t.Fatalf("expected middleware header to be set, got %q", got)
	}
}
