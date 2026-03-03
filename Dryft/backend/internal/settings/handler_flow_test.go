package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type mockSettingsHandlerService struct {
	getSettingsFn    func(userID string) (*AllSettings, error)
	updateSettingsFn func(userID string, settings AllSettings) error
	updateCategoryFn func(userID string, category string, data interface{}) error
	syncFn           func(userID string, req SyncRequest) (*SyncResult, error)
	resetFn          func(userID string) (*AllSettings, error)
	getUpdatedAtFn   func(userID string) (*time.Time, error)
}

func (m *mockSettingsHandlerService) GetSettings(userID string) (*AllSettings, error) {
	if m.getSettingsFn == nil {
		return &AllSettings{}, nil
	}
	return m.getSettingsFn(userID)
}
func (m *mockSettingsHandlerService) UpdateSettings(userID string, settings AllSettings) error {
	if m.updateSettingsFn == nil {
		return nil
	}
	return m.updateSettingsFn(userID, settings)
}
func (m *mockSettingsHandlerService) UpdateCategory(userID string, category string, data interface{}) error {
	if m.updateCategoryFn == nil {
		return nil
	}
	return m.updateCategoryFn(userID, category, data)
}
func (m *mockSettingsHandlerService) SyncSettings(userID string, req SyncRequest) (*SyncResult, error) {
	if m.syncFn == nil {
		return &SyncResult{}, nil
	}
	return m.syncFn(userID, req)
}
func (m *mockSettingsHandlerService) ResetSettings(userID string) (*AllSettings, error) {
	if m.resetFn == nil {
		return &AllSettings{}, nil
	}
	return m.resetFn(userID)
}
func (m *mockSettingsHandlerService) GetUpdatedAt(userID string) (*time.Time, error) {
	if m.getUpdatedAtFn == nil {
		t := time.Now().UTC()
		return &t, nil
	}
	return m.getUpdatedAtFn(userID)
}

func withSettingsUser(req *http.Request, userID string) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), "userID", userID))
}

func TestGetSettings_Success(t *testing.T) {
	h := &Handler{service: &mockSettingsHandlerService{
		getSettingsFn: func(userID string) (*AllSettings, error) {
			if userID != "u1" {
				t.Fatalf("unexpected user: %s", userID)
			}
			return &AllSettings{}, nil
		},
	}}
	req := withSettingsUser(httptest.NewRequest(http.MethodGet, "/settings", nil), "u1")
	rec := httptest.NewRecorder()
	h.GetSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestUpdateSettings_Success(t *testing.T) {
	h := &Handler{service: &mockSettingsHandlerService{
		updateSettingsFn: func(userID string, settings AllSettings) error {
			if userID != "u1" {
				t.Fatalf("unexpected user: %s", userID)
			}
			return nil
		},
	}}
	req := withSettingsUser(httptest.NewRequest(http.MethodPut, "/settings", bytes.NewBufferString(`{}`)), "u1")
	rec := httptest.NewRecorder()
	h.UpdateSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestCategoryPatchEndpoints_Success(t *testing.T) {
	categories := []struct {
		name string
		fn   func(w http.ResponseWriter, r *http.Request)
		body string
	}{
		{"notifications", nil, `{"messages":true}`},
		{"privacy", nil, `{"show_age":true}`},
		{"appearance", nil, `{"theme":"light"}`},
		{"vr", nil, `{"vr_enabled":true}`},
		{"haptic", nil, `{"enabled":true}`},
		{"matching", nil, `{"distance":25}`},
		{"safety", nil, `{"panic_enabled":true}`},
	}

	seen := map[string]bool{}
	h := &Handler{service: &mockSettingsHandlerService{
		updateCategoryFn: func(userID string, category string, data interface{}) error {
			if userID != "u1" {
				t.Fatalf("unexpected user: %s", userID)
			}
			seen[category] = true
			return nil
		},
	}}
	categories[0].fn = h.UpdateNotifications
	categories[1].fn = h.UpdatePrivacy
	categories[2].fn = h.UpdateAppearance
	categories[3].fn = h.UpdateVR
	categories[4].fn = h.UpdateHaptic
	categories[5].fn = h.UpdateMatching
	categories[6].fn = h.UpdateSafety

	for _, tc := range categories {
		t.Run(tc.name, func(t *testing.T) {
			req := withSettingsUser(httptest.NewRequest(http.MethodPatch, "/settings/"+tc.name, bytes.NewBufferString(tc.body)), "u1")
			rec := httptest.NewRecorder()
			tc.fn(rec, req)
			if rec.Code != http.StatusNoContent {
				t.Fatalf("expected 204, got %d", rec.Code)
			}
		})
	}

	for _, tc := range categories {
		if !seen[tc.name] {
			t.Fatalf("expected category %s to be updated", tc.name)
		}
	}
}

func TestResetSettings_Success(t *testing.T) {
	h := &Handler{service: &mockSettingsHandlerService{
		resetFn: func(userID string) (*AllSettings, error) {
			if userID != "u1" {
				t.Fatalf("unexpected user: %s", userID)
			}
			return &AllSettings{}, nil
		},
	}}
	req := withSettingsUser(httptest.NewRequest(http.MethodPost, "/settings/reset", nil), "u1")
	rec := httptest.NewRecorder()
	h.ResetSettings(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body["settings"]; !ok {
		t.Fatalf("missing settings key")
	}
}
