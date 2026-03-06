package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	dryftlogger "github.com/dryft-app/backend/internal/logger"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

func TestRequestID_InjectsContextLoggerWithRequestID(t *testing.T) {
	var logs bytes.Buffer
	original := slog.Default()
	t.Cleanup(func() {
		slog.SetDefault(original)
	})

	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelInfo})))

	var capturedID string
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedID = chimiddleware.GetReqID(r.Context())
		dryftlogger.FromContext(r.Context()).Info("request log")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/v1/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if capturedID == "" {
		t.Fatal("expected request ID in context")
	}
	logOutput := logs.String()
	if !strings.Contains(logOutput, `"request_id":"`+capturedID+`"`) {
		t.Fatalf("expected log output to include request_id %q, got %s", capturedID, logOutput)
	}
}
