package notifications

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type mockNotificationsHandlerService struct {
	registerDeviceFn         func(ctx context.Context, userID uuid.UUID, token string, platform DevicePlatform, deviceID, appVersion string) (*Device, error)
	unregisterDeviceFn       func(ctx context.Context, userID uuid.UUID, deviceID string) error
	getNotificationHistoryFn func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]map[string]interface{}, error)
	getUnreadCountFn         func(ctx context.Context, userID uuid.UUID) (int, error)
	markNotificationReadFn   func(ctx context.Context, userID, notificationID uuid.UUID) error
	markAllReadFn            func(ctx context.Context, userID uuid.UUID) error
	registerVoIPDeviceFn     func(ctx context.Context, userID uuid.UUID, token, bundleID string) (*VoIPDevice, error)
	unregisterVoIPDeviceFn   func(ctx context.Context, userID uuid.UUID, token string) error
}

func (m *mockNotificationsHandlerService) RegisterDevice(ctx context.Context, userID uuid.UUID, token string, platform DevicePlatform, deviceID, appVersion string) (*Device, error) {
	if m.registerDeviceFn == nil {
		return &Device{ID: uuid.New()}, nil
	}
	return m.registerDeviceFn(ctx, userID, token, platform, deviceID, appVersion)
}
func (m *mockNotificationsHandlerService) UnregisterDevice(ctx context.Context, userID uuid.UUID, deviceID string) error {
	if m.unregisterDeviceFn == nil {
		return nil
	}
	return m.unregisterDeviceFn(ctx, userID, deviceID)
}
func (m *mockNotificationsHandlerService) GetNotificationHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]map[string]interface{}, error) {
	if m.getNotificationHistoryFn == nil {
		return []map[string]interface{}{}, nil
	}
	return m.getNotificationHistoryFn(ctx, userID, limit, offset)
}
func (m *mockNotificationsHandlerService) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error) {
	if m.getUnreadCountFn == nil {
		return 0, nil
	}
	return m.getUnreadCountFn(ctx, userID)
}
func (m *mockNotificationsHandlerService) MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	if m.markNotificationReadFn == nil {
		return nil
	}
	return m.markNotificationReadFn(ctx, userID, notificationID)
}
func (m *mockNotificationsHandlerService) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error {
	if m.markAllReadFn == nil {
		return nil
	}
	return m.markAllReadFn(ctx, userID)
}
func (m *mockNotificationsHandlerService) RegisterVoIPDevice(ctx context.Context, userID uuid.UUID, token, bundleID string) (*VoIPDevice, error) {
	if m.registerVoIPDeviceFn == nil {
		return &VoIPDevice{ID: uuid.New()}, nil
	}
	return m.registerVoIPDeviceFn(ctx, userID, token, bundleID)
}
func (m *mockNotificationsHandlerService) UnregisterVoIPDevice(ctx context.Context, userID uuid.UUID, token string) error {
	if m.unregisterVoIPDeviceFn == nil {
		return nil
	}
	return m.unregisterVoIPDeviceFn(ctx, userID, token)
}

func TestRegisterDevice_Success(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			registerDeviceFn: func(_ context.Context, userID uuid.UUID, token string, platform DevicePlatform, deviceID, appVersion string) (*Device, error) {
				if userID != uid || platform != PlatformIOS || token == "" || deviceID == "" {
					t.Fatalf("unexpected register args")
				}
				return &Device{ID: uuid.New()}, nil
			},
			getNotificationHistoryFn: func(context.Context, uuid.UUID, int, int) ([]map[string]interface{}, error) { return nil, nil },
			getUnreadCountFn:         func(context.Context, uuid.UUID) (int, error) { return 0, nil },
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/notifications/devices", strings.NewReader(`{"token":"tok","platform":"ios","device_id":"dev-1"}`))
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.RegisterDevice(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetNotifications_Success(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			registerDeviceFn: func(context.Context, uuid.UUID, string, DevicePlatform, string, string) (*Device, error) {
				return nil, nil
			},
			getNotificationHistoryFn: func(_ context.Context, _ uuid.UUID, limit, offset int) ([]map[string]interface{}, error) {
				if limit != 20 || offset != 0 {
					t.Fatalf("unexpected pagination: limit=%d offset=%d", limit, offset)
				}
				return []map[string]interface{}{{"id": "n1"}}, nil
			},
			getUnreadCountFn: func(context.Context, uuid.UUID) (int, error) { return 3, nil },
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/notifications", nil)
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.GetNotifications(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["unread_count"].(float64) != 3 {
		t.Fatalf("unexpected unread_count: %+v", body)
	}
}

func TestMarkRead_SuccessNoContent(t *testing.T) {
	uid := uuid.New()
	notifID := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			registerDeviceFn: func(context.Context, uuid.UUID, string, DevicePlatform, string, string) (*Device, error) {
				return nil, nil
			},
			getNotificationHistoryFn: func(context.Context, uuid.UUID, int, int) ([]map[string]interface{}, error) { return nil, nil },
			getUnreadCountFn:         func(context.Context, uuid.UUID) (int, error) { return 0, nil },
			markNotificationReadFn: func(_ context.Context, userID, notificationID uuid.UUID) error {
				if userID != uid || notificationID != notifID {
					t.Fatalf("unexpected ids")
				}
				return nil
			},
		},
	}

	r := chi.NewRouter()
	r.Post("/v1/notifications/{id}/read", h.MarkRead)
	req := httptest.NewRequest(http.MethodPost, "/v1/notifications/"+notifID.String()+"/read", nil)
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestRegisterVoIPDevice_Success(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			registerDeviceFn: func(context.Context, uuid.UUID, string, DevicePlatform, string, string) (*Device, error) {
				return nil, nil
			},
			getNotificationHistoryFn: func(context.Context, uuid.UUID, int, int) ([]map[string]interface{}, error) { return nil, nil },
			getUnreadCountFn:         func(context.Context, uuid.UUID) (int, error) { return 0, nil },
			registerVoIPDeviceFn: func(_ context.Context, userID uuid.UUID, token, bundleID string) (*VoIPDevice, error) {
				if userID != uid || token != "voip-token" || bundleID != "com.dryft.app" {
					t.Fatalf("unexpected voip args")
				}
				return &VoIPDevice{ID: uuid.New()}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/notifications/voip-devices", strings.NewReader(`{"token":"voip-token","bundle_id":"com.dryft.app"}`))
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.RegisterVoIPDevice(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestUnregisterDevice_NoContent(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			unregisterDeviceFn: func(_ context.Context, userID uuid.UUID, deviceID string) error {
				if userID != uid || deviceID != "dev-1" {
					t.Fatalf("unexpected unregister args")
				}
				return nil
			},
		},
	}

	r := chi.NewRouter()
	r.Delete("/v1/notifications/devices/{deviceId}", h.UnregisterDevice)

	req := httptest.NewRequest(http.MethodDelete, "/v1/notifications/devices/dev-1", nil)
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestMarkAllRead_NoContent(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			markAllReadFn: func(_ context.Context, userID uuid.UUID) error {
				if userID != uid {
					t.Fatalf("unexpected user: %s", userID)
				}
				return nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/notifications/read-all", nil)
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.MarkAllRead(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestGetUnreadCount_Success(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockNotificationsHandlerService{
			getUnreadCountFn: func(_ context.Context, userID uuid.UUID) (int, error) {
				if userID != uid {
					t.Fatalf("unexpected user: %s", userID)
				}
				return 7, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/notifications/unread-count", nil)
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.GetUnreadCount(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]int
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["count"] != 7 {
		t.Fatalf("expected count=7, got %+v", body)
	}
}
