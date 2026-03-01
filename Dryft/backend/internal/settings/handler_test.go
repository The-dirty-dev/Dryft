package settings

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func setUserID(req *http.Request, uid string) *http.Request {
	ctx := context.WithValue(req.Context(), "userID", uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// getUserID
// ---------------------------------------------------------------------------

func TestGetUserID_Present(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req = setUserID(req, "user-123")

	got := getUserID(req)
	if got != "user-123" {
		t.Errorf("got %q, want %q", got, "user-123")
	}
}

func TestGetUserID_Absent(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := getUserID(req)
	if got != "" {
		t.Errorf("expected empty, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

func TestRegisterRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/settings/"},
		{"PUT", "/settings/"},
		{"POST", "/settings/sync"},
		{"POST", "/settings/reset"},
		{"PATCH", "/settings/notifications"},
		{"PATCH", "/settings/privacy"},
		{"PATCH", "/settings/appearance"},
		{"PATCH", "/settings/vr"},
		{"PATCH", "/settings/haptic"},
		{"PATCH", "/settings/matching"},
		{"PATCH", "/settings/safety"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

// ---------------------------------------------------------------------------
// Auth check (no userID in context -> 401)
// ---------------------------------------------------------------------------

func TestGetSettings_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("GET", "/settings/", nil)
	rr := httptest.NewRecorder()

	h.GetSettings(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateSettings_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PUT", "/settings/", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateSettings(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestSyncSettings_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/settings/sync", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.SyncSettings(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestResetSettings_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/settings/reset", nil)
	rr := httptest.NewRecorder()

	h.ResetSettings(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Invalid JSON body -> 400
// ---------------------------------------------------------------------------

func TestUpdateSettings_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PUT", "/settings/", strings.NewReader(`bad`))
	req = setUserID(req, "user-1")
	rr := httptest.NewRecorder()

	h.UpdateSettings(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSyncSettings_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/settings/sync", strings.NewReader(`bad`))
	req = setUserID(req, "user-1")
	rr := httptest.NewRecorder()

	h.SyncSettings(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateNotifications_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/notifications", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateNotifications(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateNotifications_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/notifications", strings.NewReader(`bad`))
	req = setUserID(req, "user-1")
	rr := httptest.NewRecorder()

	h.UpdateNotifications(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdatePrivacy_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/privacy", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdatePrivacy(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateAppearance_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/appearance", strings.NewReader(`bad`))
	req = setUserID(req, "user-1")
	rr := httptest.NewRecorder()

	h.UpdateAppearance(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateVR_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/vr", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateVR(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateHaptic_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/haptic", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateHaptic(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateMatching_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/matching", strings.NewReader(`bad`))
	req = setUserID(req, "user-1")
	rr := httptest.NewRecorder()

	h.UpdateMatching(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateSafety_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("PATCH", "/settings/safety", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateSafety(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Settings struct JSON round-trip
// ---------------------------------------------------------------------------

func TestNotificationSettings_JSON(t *testing.T) {
	ns := NotificationSettings{
		Enabled:           true,
		Matches:           true,
		Messages:          true,
		QuietHoursEnabled: true,
		QuietHoursStart:   "22:00",
		QuietHoursEnd:     "07:00",
	}

	data, _ := json.Marshal(ns)
	var decoded NotificationSettings
	json.Unmarshal(data, &decoded)

	if !decoded.Enabled || !decoded.QuietHoursEnabled {
		t.Error("expected enabled flags to be true")
	}
	if decoded.QuietHoursStart != "22:00" {
		t.Errorf("expected 22:00, got %q", decoded.QuietHoursStart)
	}
}

func TestPrivacySettings_JSON(t *testing.T) {
	ps := PrivacySettings{
		ShowOnlineStatus: true,
		ReadReceipts:     false,
	}

	data, _ := json.Marshal(ps)
	var decoded PrivacySettings
	json.Unmarshal(data, &decoded)

	if !decoded.ShowOnlineStatus {
		t.Error("expected ShowOnlineStatus true")
	}
	if decoded.ReadReceipts {
		t.Error("expected ReadReceipts false")
	}
}
