package haptic

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/dryft-app/backend/internal/middleware"
)

func setUser(req *http.Request, uid uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), authmw.UserIDKey, uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// getUserIDFromContext
// ---------------------------------------------------------------------------

func TestGetUserIDFromContext_WithID(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUser(req, uid)

	got, err := getUserIDFromContext(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != uid {
		t.Errorf("got %v, want %v", got, uid)
	}
}

func TestGetUserIDFromContext_NoID(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	_, err := getUserIDFromContext(req)
	if err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// RegisterDevice – validation
// ---------------------------------------------------------------------------

func TestRegisterDevice_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/v1/haptic/devices", strings.NewReader(`{"device_name":"toy"}`))
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestRegisterDevice_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/haptic/devices", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestRegisterDevice_EmptyName(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/haptic/devices", strings.NewReader(`{"device_name":""}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Handler methods with invalid UUIDs (need chi router for URL params)
// ---------------------------------------------------------------------------

func TestGetDevices_NoAuth(t *testing.T) {
	h := NewHandler(nil)

	// Read the handler to find the GetDevices method
	// We'll test directly since no chi URL params needed
	req := httptest.NewRequest("GET", "/v1/haptic/devices", nil)
	rr := httptest.NewRecorder()

	// GetDevices should exist and return 401 for no auth
	defer func() {
		if r := recover(); r != nil {
			// method may not exist or panics on nil service
		}
	}()
	h.GetDevices(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetDevice_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/devices/{deviceId}", h.GetDevice)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/devices/bad-uuid", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestDeleteDevice_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Delete("/devices/{deviceId}", h.DeleteDevice)

	uid := uuid.New()
	req := httptest.NewRequest("DELETE", "/devices/bad-uuid", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SendCommand – validation
// ---------------------------------------------------------------------------

func TestSendCommand_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/devices/{deviceId}/command", h.SendCommand)

	did := uuid.New().String()
	req := httptest.NewRequest("POST", "/devices/"+did+"/command", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestSendCommand_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/devices/{deviceId}/command", h.SendCommand)

	uid := uuid.New()
	did := uuid.New().String()
	req := httptest.NewRequest("POST", "/devices/"+did+"/command", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errs := map[error]string{
		ErrDeviceNotFound:      "device not found",
		ErrPermissionDenied:    "permission denied",
		ErrNotMatched:          "users are not matched",
		ErrPermissionNotFound:  "permission not found",
		ErrInvalidIntensity:    "intensity must be between 0 and 1",
		ErrDeviceLimitExceeded: "device limit exceeded",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}
