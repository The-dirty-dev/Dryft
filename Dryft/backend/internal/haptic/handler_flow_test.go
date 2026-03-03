package haptic

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	authmw "github.com/dryft-app/backend/internal/middleware"
	"github.com/dryft-app/backend/internal/models"
)

type mockHapticHandlerService struct {
	registerDeviceFn         func(ctx context.Context, userID uuid.UUID, req *models.RegisterDeviceRequest) (*models.HapticDevice, error)
	getUserDevicesFn         func(ctx context.Context, userID uuid.UUID) ([]models.HapticDevice, error)
	getDeviceFn              func(ctx context.Context, userID, deviceID uuid.UUID) (*models.HapticDevice, error)
	updateDeviceFn           func(ctx context.Context, userID, deviceID uuid.UUID, req *models.UpdateDeviceRequest) (*models.HapticDevice, error)
	deleteDeviceFn           func(ctx context.Context, userID, deviceID uuid.UUID) error
	setPermissionFn          func(ctx context.Context, ownerID uuid.UUID, req *models.SetPermissionRequest) (*models.HapticPermission, error)
	getPermissionsForMatchFn func(ctx context.Context, userID, matchID uuid.UUID) ([]models.HapticPermission, error)
	revokePermissionFn       func(ctx context.Context, ownerID, controllerID, matchID uuid.UUID) error
	sendCommandFn            func(ctx context.Context, senderID uuid.UUID, cmd *models.HapticCommand) error
	getPublicPatternsFn      func(ctx context.Context, limit, offset int) ([]models.HapticPattern, error)
	getPatternFn             func(ctx context.Context, patternID uuid.UUID) (*models.HapticPattern, error)
	getMatchOtherUserFn      func(ctx context.Context, userID, matchID uuid.UUID) (uuid.UUID, error)
}

func (m *mockHapticHandlerService) RegisterDevice(ctx context.Context, userID uuid.UUID, req *models.RegisterDeviceRequest) (*models.HapticDevice, error) {
	if m.registerDeviceFn == nil {
		return &models.HapticDevice{ID: uuid.New(), UserID: userID}, nil
	}
	return m.registerDeviceFn(ctx, userID, req)
}
func (m *mockHapticHandlerService) GetUserDevices(ctx context.Context, userID uuid.UUID) ([]models.HapticDevice, error) {
	if m.getUserDevicesFn == nil {
		return []models.HapticDevice{}, nil
	}
	return m.getUserDevicesFn(ctx, userID)
}
func (m *mockHapticHandlerService) GetDevice(ctx context.Context, userID, deviceID uuid.UUID) (*models.HapticDevice, error) {
	if m.getDeviceFn == nil {
		return &models.HapticDevice{ID: deviceID, UserID: userID}, nil
	}
	return m.getDeviceFn(ctx, userID, deviceID)
}
func (m *mockHapticHandlerService) UpdateDevice(ctx context.Context, userID, deviceID uuid.UUID, req *models.UpdateDeviceRequest) (*models.HapticDevice, error) {
	if m.updateDeviceFn == nil {
		return &models.HapticDevice{ID: deviceID, UserID: userID}, nil
	}
	return m.updateDeviceFn(ctx, userID, deviceID, req)
}
func (m *mockHapticHandlerService) DeleteDevice(ctx context.Context, userID, deviceID uuid.UUID) error {
	if m.deleteDeviceFn == nil {
		return nil
	}
	return m.deleteDeviceFn(ctx, userID, deviceID)
}
func (m *mockHapticHandlerService) SetPermission(ctx context.Context, ownerID uuid.UUID, req *models.SetPermissionRequest) (*models.HapticPermission, error) {
	if m.setPermissionFn == nil {
		return &models.HapticPermission{}, nil
	}
	return m.setPermissionFn(ctx, ownerID, req)
}
func (m *mockHapticHandlerService) GetPermissionsForMatch(ctx context.Context, userID, matchID uuid.UUID) ([]models.HapticPermission, error) {
	if m.getPermissionsForMatchFn == nil {
		return []models.HapticPermission{}, nil
	}
	return m.getPermissionsForMatchFn(ctx, userID, matchID)
}
func (m *mockHapticHandlerService) RevokePermission(ctx context.Context, ownerID, controllerID, matchID uuid.UUID) error {
	if m.revokePermissionFn == nil {
		return nil
	}
	return m.revokePermissionFn(ctx, ownerID, controllerID, matchID)
}
func (m *mockHapticHandlerService) SendCommand(ctx context.Context, senderID uuid.UUID, cmd *models.HapticCommand) error {
	if m.sendCommandFn == nil {
		return nil
	}
	return m.sendCommandFn(ctx, senderID, cmd)
}
func (m *mockHapticHandlerService) GetPublicPatterns(ctx context.Context, limit, offset int) ([]models.HapticPattern, error) {
	if m.getPublicPatternsFn == nil {
		return []models.HapticPattern{}, nil
	}
	return m.getPublicPatternsFn(ctx, limit, offset)
}
func (m *mockHapticHandlerService) GetPattern(ctx context.Context, patternID uuid.UUID) (*models.HapticPattern, error) {
	if m.getPatternFn == nil {
		return &models.HapticPattern{ID: patternID}, nil
	}
	return m.getPatternFn(ctx, patternID)
}
func (m *mockHapticHandlerService) GetMatchOtherUser(ctx context.Context, userID, matchID uuid.UUID) (uuid.UUID, error) {
	if m.getMatchOtherUserFn == nil {
		return uuid.New(), nil
	}
	return m.getMatchOtherUserFn(ctx, userID, matchID)
}

func withHapticUser(req *http.Request, userID uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), authmw.UserIDKey, userID)
	return req.WithContext(ctx)
}

func TestRegisterDevice_SuccessAndLimitExceeded(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		registerDeviceFn: func(_ context.Context, _ uuid.UUID, req *models.RegisterDeviceRequest) (*models.HapticDevice, error) {
			if req.DeviceName == "overflow" {
				return nil, ErrDeviceLimitExceeded
			}
			return &models.HapticDevice{ID: uuid.New()}, nil
		},
	}}

	req := withHapticUser(httptest.NewRequest(http.MethodPost, "/haptic/devices", bytes.NewBufferString(`{"device_name":"Lush","device_index":1}`)), userID)
	rec := httptest.NewRecorder()
	h.RegisterDevice(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}

	req2 := withHapticUser(httptest.NewRequest(http.MethodPost, "/haptic/devices", bytes.NewBufferString(`{"device_name":"overflow","device_index":2}`)), userID)
	rec2 := httptest.NewRecorder()
	h.RegisterDevice(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for limit exceeded, got %d", rec2.Code)
	}
}

func TestGetDevices_Success(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		getUserDevicesFn: func(_ context.Context, gotUserID uuid.UUID) ([]models.HapticDevice, error) {
			if gotUserID != userID {
				t.Fatalf("unexpected user id")
			}
			return []models.HapticDevice{{ID: uuid.New(), UserID: gotUserID}}, nil
		},
	}}

	req := withHapticUser(httptest.NewRequest(http.MethodGet, "/haptic/devices", nil), userID)
	rec := httptest.NewRecorder()
	h.GetDevices(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetDevice_NotFound(t *testing.T) {
	userID := uuid.New()
	deviceID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		getDeviceFn: func(context.Context, uuid.UUID, uuid.UUID) (*models.HapticDevice, error) {
			return nil, ErrDeviceNotFound
		},
	}}

	r := chi.NewRouter()
	r.Get("/haptic/devices/{deviceId}", func(w http.ResponseWriter, req *http.Request) {
		h.GetDevice(w, withHapticUser(req, userID))
	})

	req := httptest.NewRequest(http.MethodGet, "/haptic/devices/"+deviceID.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestGetDevice_UnexpectedError(t *testing.T) {
	userID := uuid.New()
	deviceID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		getDeviceFn: func(context.Context, uuid.UUID, uuid.UUID) (*models.HapticDevice, error) {
			return nil, errors.New("boom")
		},
	}}

	r := chi.NewRouter()
	r.Get("/haptic/devices/{deviceId}", func(w http.ResponseWriter, req *http.Request) {
		h.GetDevice(w, withHapticUser(req, userID))
	})

	req := httptest.NewRequest(http.MethodGet, "/haptic/devices/"+deviceID.String(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}

func TestUpdateDevice_SuccessAndInvalidIntensity(t *testing.T) {
	userID := uuid.New()
	deviceID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		updateDeviceFn: func(_ context.Context, _ uuid.UUID, _ uuid.UUID, req *models.UpdateDeviceRequest) (*models.HapticDevice, error) {
			if req.MaxIntensity != nil && *req.MaxIntensity > 1 {
				return nil, ErrInvalidIntensity
			}
			return &models.HapticDevice{ID: deviceID, UserID: userID}, nil
		},
	}}

	r := chi.NewRouter()
	r.Patch("/haptic/devices/{deviceId}", func(w http.ResponseWriter, req *http.Request) {
		h.UpdateDevice(w, withHapticUser(req, userID))
	})

	req := httptest.NewRequest(http.MethodPatch, "/haptic/devices/"+deviceID.String(), bytes.NewBufferString(`{"max_intensity":0.8}`))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	req2 := httptest.NewRequest(http.MethodPatch, "/haptic/devices/"+deviceID.String(), bytes.NewBufferString(`{"max_intensity":1.5}`))
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec2.Code)
	}
}

func TestSetPermission_ValidationAndNotMatched(t *testing.T) {
	userID := uuid.New()
	controllerID := uuid.New()
	matchID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		setPermissionFn: func(_ context.Context, _ uuid.UUID, req *models.SetPermissionRequest) (*models.HapticPermission, error) {
			if req.PermissionType == models.PermissionTypeNever {
				return nil, ErrNotMatched
			}
			return &models.HapticPermission{ControllerID: req.ControllerID, MatchID: req.MatchID}, nil
		},
	}}

	req := withHapticUser(httptest.NewRequest(http.MethodPost, "/haptic/permissions", bytes.NewBufferString(`{}`)), userID)
	rec := httptest.NewRecorder()
	h.SetPermission(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing IDs, got %d", rec.Code)
	}

	notMatchedBody := `{"controller_id":"` + controllerID.String() + `","match_id":"` + matchID.String() + `","permission_type":"never"}`
	req2 := withHapticUser(httptest.NewRequest(http.MethodPost, "/haptic/permissions", bytes.NewBufferString(notMatchedBody)), userID)
	rec2 := httptest.NewRecorder()
	h.SetPermission(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for not matched, got %d", rec2.Code)
	}

	okBody := `{"controller_id":"` + controllerID.String() + `","match_id":"` + matchID.String() + `","permission_type":"always"}`
	req3 := withHapticUser(httptest.NewRequest(http.MethodPost, "/haptic/permissions", bytes.NewBufferString(okBody)), userID)
	rec3 := httptest.NewRecorder()
	h.SetPermission(rec3, req3)
	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec3.Code)
	}
}

func TestGetMatchPermissions_SuccessAndInvalidID(t *testing.T) {
	userID := uuid.New()
	matchID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		getPermissionsForMatchFn: func(_ context.Context, _ uuid.UUID, gotMatchID uuid.UUID) ([]models.HapticPermission, error) {
			if gotMatchID != matchID {
				t.Fatalf("unexpected match ID")
			}
			return nil, nil
		},
	}}

	r := chi.NewRouter()
	r.Get("/haptic/permissions/match/{matchId}", func(w http.ResponseWriter, req *http.Request) {
		h.GetMatchPermissions(w, withHapticUser(req, userID))
	})

	req := httptest.NewRequest(http.MethodGet, "/haptic/permissions/match/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/haptic/permissions/match/"+matchID.String(), nil)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}
}

func TestRevokePermission_NotFoundAndSuccess(t *testing.T) {
	userID := uuid.New()
	controllerID := uuid.New()
	matchID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		revokePermissionFn: func(_ context.Context, _ uuid.UUID, gotControllerID, _ uuid.UUID) error {
			if gotControllerID == controllerID {
				return ErrPermissionNotFound
			}
			return nil
		},
	}}

	body := `{"controller_id":"` + controllerID.String() + `","match_id":"` + matchID.String() + `"}`
	req := withHapticUser(httptest.NewRequest(http.MethodDelete, "/haptic/permissions", bytes.NewBufferString(body)), userID)
	rec := httptest.NewRecorder()
	h.RevokePermission(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}

	okBody := `{"controller_id":"` + uuid.New().String() + `","match_id":"` + matchID.String() + `"}`
	req2 := withHapticUser(httptest.NewRequest(http.MethodDelete, "/haptic/permissions", bytes.NewBufferString(okBody)), userID)
	rec2 := httptest.NewRecorder()
	h.RevokePermission(rec2, req2)
	if rec2.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec2.Code)
	}
}

func TestGetPatternsAndGetPattern(t *testing.T) {
	userID := uuid.New()
	patternID := uuid.New()
	h := &Handler{service: &mockHapticHandlerService{
		getPublicPatternsFn: func(_ context.Context, limit, offset int) ([]models.HapticPattern, error) {
			if limit != 50 || offset != 0 {
				t.Fatalf("unexpected pagination")
			}
			return []models.HapticPattern{{ID: patternID, Name: "pulse"}}, nil
		},
		getPatternFn: func(_ context.Context, gotPatternID uuid.UUID) (*models.HapticPattern, error) {
			if gotPatternID == patternID {
				return &models.HapticPattern{ID: patternID, Name: "pulse"}, nil
			}
			return nil, errors.New("missing")
		},
	}}

	req := withHapticUser(httptest.NewRequest(http.MethodGet, "/haptic/patterns", nil), userID)
	rec := httptest.NewRecorder()
	h.GetPatterns(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	r := chi.NewRouter()
	r.Get("/haptic/patterns/{patternId}", func(w http.ResponseWriter, req *http.Request) {
		h.GetPattern(w, withHapticUser(req, userID))
	})

	req2 := httptest.NewRequest(http.MethodGet, "/haptic/patterns/not-a-uuid", nil)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec2.Code)
	}

	req3 := httptest.NewRequest(http.MethodGet, "/haptic/patterns/"+uuid.New().String(), nil)
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, req3)
	if rec3.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec3.Code)
	}

	req4 := httptest.NewRequest(http.MethodGet, "/haptic/patterns/"+patternID.String(), nil)
	rec4 := httptest.NewRecorder()
	r.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec4.Code)
	}
}

func TestGetMatchDevices_SuccessAndNotFound(t *testing.T) {
	userID := uuid.New()
	matchID := uuid.New()
	otherUserID := uuid.New()

	hNotFound := &Handler{service: &mockHapticHandlerService{
		getMatchOtherUserFn: func(context.Context, uuid.UUID, uuid.UUID) (uuid.UUID, error) {
			return uuid.Nil, errors.New("missing")
		},
	}}

	r1 := chi.NewRouter()
	r1.Get("/haptic/match/{matchId}/devices", func(w http.ResponseWriter, req *http.Request) {
		hNotFound.GetMatchDevices(w, withHapticUser(req, userID))
	})

	req1 := httptest.NewRequest(http.MethodGet, "/haptic/match/"+matchID.String()+"/devices", nil)
	rec1 := httptest.NewRecorder()
	r1.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec1.Code)
	}

	hSuccess := &Handler{service: &mockHapticHandlerService{
		getMatchOtherUserFn: func(_ context.Context, gotUserID, gotMatchID uuid.UUID) (uuid.UUID, error) {
			if gotUserID != userID || gotMatchID != matchID {
				t.Fatalf("unexpected ids")
			}
			return otherUserID, nil
		},
		getUserDevicesFn: func(_ context.Context, gotUserID uuid.UUID) ([]models.HapticDevice, error) {
			if gotUserID != otherUserID {
				t.Fatalf("expected other user ID")
			}
			return []models.HapticDevice{{ID: uuid.New(), DeviceName: "Toy", CanVibrate: true}}, nil
		},
	}}

	r2 := chi.NewRouter()
	r2.Get("/haptic/match/{matchId}/devices", func(w http.ResponseWriter, req *http.Request) {
		hSuccess.GetMatchDevices(w, withHapticUser(req, userID))
	})

	req2 := httptest.NewRequest(http.MethodGet, "/haptic/match/"+matchID.String()+"/devices", nil)
	rec2 := httptest.NewRecorder()
	r2.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}
}
