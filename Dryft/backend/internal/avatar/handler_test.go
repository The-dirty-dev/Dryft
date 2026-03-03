package avatar

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

func setUser(req *http.Request, uid uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), "user_id", uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// getUserIDFromContext
// ---------------------------------------------------------------------------

func TestGetUserIDFromContext_WithID(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUser(req, uid)

	got := getUserIDFromContext(req)
	if got != uid {
		t.Errorf("got %v, want %v", got, uid)
	}
}

func TestGetUserIDFromContext_NoID(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := getUserIDFromContext(req)
	if got != uuid.Nil {
		t.Errorf("expected uuid.Nil, got %v", got)
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
		{"GET", "/avatar/"},
		{"PUT", "/avatar/"},
		{"POST", "/avatar/equip"},
		{"POST", "/avatar/unequip"},
		{"PUT", "/avatar/colors"},
		{"PUT", "/avatar/name"},
		{"PUT", "/avatar/visibility"},
		{"GET", "/avatar/history"},
		{"POST", "/avatar/batch"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

// ---------------------------------------------------------------------------
// GetUserAvatarState – invalid UUID
// ---------------------------------------------------------------------------

func TestGetUserAvatarState_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/avatar/user/{userId}", h.GetUserAvatarState)

	req := httptest.NewRequest("GET", "/avatar/user/bad-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// UpdateAvatarState – validation
// ---------------------------------------------------------------------------

func TestUpdateAvatarState_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/avatar/", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UpdateAvatarState(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateAvatarState_NoUpdates(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/avatar/", strings.NewReader(`{}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UpdateAvatarState(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// EquipItem – validation
// ---------------------------------------------------------------------------

func TestEquipItem_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/avatar/equip", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.EquipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestEquipItem_MissingFields(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/avatar/equip", strings.NewReader(`{"item_id":"x"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.EquipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestEquipItem_MissingItemID(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/avatar/equip", strings.NewReader(`{"item_type":"avatar"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.EquipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// UnequipItem – validation
// ---------------------------------------------------------------------------

func TestUnequipItem_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/avatar/unequip", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UnequipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUnequipItem_MissingType(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/avatar/unequip", strings.NewReader(`{}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UnequipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SetColors – validation
// ---------------------------------------------------------------------------

func TestSetColors_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/avatar/colors", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.SetColors(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SetDisplayName – validation
// ---------------------------------------------------------------------------

func TestSetDisplayName_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/avatar/name", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.SetDisplayName(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSetDisplayName_Empty(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/avatar/name", strings.NewReader(`{"display_name":""}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.SetDisplayName(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SetVisibility – validation
// ---------------------------------------------------------------------------

func TestSetVisibility_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/avatar/visibility", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.SetVisibility(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// GetMultipleAvatarStates – validation
// ---------------------------------------------------------------------------

func TestGetMultipleAvatarStates_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/avatar/batch", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()

	h.GetMultipleAvatarStates(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetMultipleAvatarStates_EmptyUserIDs(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/avatar/batch", strings.NewReader(`{"user_ids":[]}`))
	rr := httptest.NewRecorder()

	h.GetMultipleAvatarStates(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetMultipleAvatarStates_TooMany(t *testing.T) {
	h := NewHandler(nil)
	// Create 51 UUIDs
	ids := make([]uuid.UUID, 51)
	for i := range ids {
		ids[i] = uuid.New()
	}
	body, _ := json.Marshal(BatchAvatarRequest{UserIDs: ids})
	req := httptest.NewRequest("POST", "/avatar/batch", strings.NewReader(string(body)))
	rr := httptest.NewRecorder()

	h.GetMultipleAvatarStates(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errs := map[error]string{
		ErrUserNotFound: "user not found",
		ErrItemNotOwned: "item not owned by user",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// Request struct JSON
// ---------------------------------------------------------------------------

func TestUpdateAvatarRequest_JSON(t *testing.T) {
	visible := true
	req := UpdateAvatarRequest{
		EquippedAvatar: "avatar-1",
		SkinTone:       "FFCC88",
		IsVisible:      &visible,
	}

	data, _ := json.Marshal(req)
	var decoded UpdateAvatarRequest
	json.Unmarshal(data, &decoded)

	if decoded.EquippedAvatar != "avatar-1" {
		t.Errorf("expected 'avatar-1', got %q", decoded.EquippedAvatar)
	}
	if decoded.IsVisible == nil || !*decoded.IsVisible {
		t.Error("expected is_visible=true")
	}
}

func TestEquipRequest_JSON(t *testing.T) {
	req := EquipRequest{
		ItemID:   "item-1",
		ItemType: "outfit",
	}

	data, _ := json.Marshal(req)
	var decoded EquipRequest
	json.Unmarshal(data, &decoded)

	if decoded.ItemID != "item-1" || decoded.ItemType != "outfit" {
		t.Error("fields not decoded correctly")
	}
}

// ---------------------------------------------------------------------------
// writeJSON / writeError helpers
// ---------------------------------------------------------------------------

func TestWriteJSON(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSON(rr, http.StatusOK, map[string]string{"key": "value"})

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("expected application/json, got %q", ct)
	}
}

func TestWriteError(t *testing.T) {
	rr := httptest.NewRecorder()
	writeError(rr, http.StatusBadRequest, "invalid_request", "Invalid request body")

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "Invalid request body" {
		t.Errorf("expected error 'Invalid request body', got %v", body["error"])
	}
}
