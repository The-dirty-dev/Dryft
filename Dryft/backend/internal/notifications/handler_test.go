package notifications

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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

func TestRegisterDevice_NilService(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/v1/notifications/devices", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", rr.Code)
	}
}

func TestRegisterDevice_InvalidJSON(t *testing.T) {
	// Need a non-nil service for this to pass the nil check
	svc := &Service{}
	h := NewHandler(svc)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/notifications/devices", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestRegisterDevice_MissingFields(t *testing.T) {
	svc := &Service{}
	h := NewHandler(svc)
	uid := uuid.New()
	// Missing token, platform, device_id
	req := httptest.NewRequest("POST", "/v1/notifications/devices", strings.NewReader(`{"token":"tok"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestRegisterDevice_NoAuth(t *testing.T) {
	svc := &Service{}
	h := NewHandler(svc)
	req := httptest.NewRequest("POST", "/v1/notifications/devices", strings.NewReader(`{"token":"t","platform":"ios","device_id":"d"}`))
	rr := httptest.NewRecorder()

	h.RegisterDevice(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// RegisterDeviceRequest struct
// ---------------------------------------------------------------------------

func TestRegisterDeviceRequest_Fields(t *testing.T) {
	r := RegisterDeviceRequest{
		Token:      "abc",
		Platform:   "ios",
		DeviceID:   "dev-1",
		AppVersion: "1.0.0",
	}
	if r.Token != "abc" || r.Platform != "ios" || r.DeviceID != "dev-1" {
		t.Error("fields not set correctly")
	}
}

// ---------------------------------------------------------------------------
// DevicePlatform
// ---------------------------------------------------------------------------

func TestDevicePlatform_Values(t *testing.T) {
	if PlatformIOS != "ios" {
		t.Errorf("expected 'ios', got %q", PlatformIOS)
	}
	if PlatformAndroid != "android" {
		t.Errorf("expected 'android', got %q", PlatformAndroid)
	}
	if PlatformWeb != "web" {
		t.Errorf("expected 'web', got %q", PlatformWeb)
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	if ErrDeviceNotFound.Error() != "device not found" {
		t.Errorf("unexpected: %s", ErrDeviceNotFound)
	}
	if ErrInvalidToken.Error() != "invalid device token" {
		t.Errorf("unexpected: %s", ErrInvalidToken)
	}
}
