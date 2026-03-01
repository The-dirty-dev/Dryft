package profile

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
	ctx := context.WithValue(req.Context(), userIDContextKey, uid)
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
// Auth checks (no user ID -> 401)
// ---------------------------------------------------------------------------

func TestGetProfile_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("GET", "/v1/profile", nil)
	rr := httptest.NewRecorder()

	h.GetProfile(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateProfile_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("PATCH", "/v1/profile", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateProfile(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateLocation_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("PUT", "/v1/profile/location", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateLocation(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetPreferences_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("GET", "/v1/profile/preferences", nil)
	rr := httptest.NewRecorder()

	h.GetPreferences(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdatePreferences_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("PATCH", "/v1/profile/preferences", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdatePreferences(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUploadPhoto_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("POST", "/v1/profile/photos", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UploadPhoto(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestDeletePhoto_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Delete("/photos/{index}", h.DeletePhoto)

	req := httptest.NewRequest("DELETE", "/photos/0", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestReorderPhotos_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("PUT", "/v1/profile/photos/reorder", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.ReorderPhotos(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetPhotoURL_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("GET", "/v1/profile/photos/key/url", nil)
	rr := httptest.NewRecorder()

	h.GetPhotoURL(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetUploadURL_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("POST", "/v1/profile/photos/upload-url", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.GetUploadURL(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestConfirmUpload_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil)
	req := httptest.NewRequest("POST", "/v1/profile/photos/confirm", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.ConfirmUpload(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Invalid JSON body -> 400
// ---------------------------------------------------------------------------

func TestUpdateProfile_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("PATCH", "/v1/profile", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UpdateProfile(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateLocation_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/v1/profile/location", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UpdateLocation(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdatePreferences_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("PATCH", "/v1/profile/preferences", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UpdatePreferences(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestReorderPhotos_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("PUT", "/v1/profile/photos/reorder", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.ReorderPhotos(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetUploadURL_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/profile/photos/upload-url", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.GetUploadURL(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetUploadURL_InvalidContentType(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/profile/photos/upload-url",
		strings.NewReader(`{"content_type":"text/plain"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.GetUploadURL(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestConfirmUpload_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/profile/photos/confirm", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.ConfirmUpload(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// DeletePhoto – invalid index
// ---------------------------------------------------------------------------

func TestDeletePhoto_InvalidIndex(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Delete("/photos/{index}", h.DeletePhoto)

	uid := uuid.New()
	req := httptest.NewRequest("DELETE", "/photos/abc", nil)
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
		ErrUserNotFound:    "user not found",
		ErrInvalidAge:      "invalid age range",
		ErrTooManyPhotos:   "maximum 6 photos allowed",
		ErrInvalidInterest: "interest too long",
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

func TestUpdateProfileRequest_JSON(t *testing.T) {
	name := "Alice"
	bio := "Hello world"
	req := UpdateProfileRequest{
		DisplayName: &name,
		Bio:         &bio,
		Interests:   []string{"hiking", "reading"},
	}

	data, _ := json.Marshal(req)
	var decoded UpdateProfileRequest
	json.Unmarshal(data, &decoded)

	if decoded.DisplayName == nil || *decoded.DisplayName != "Alice" {
		t.Error("expected display_name 'Alice'")
	}
	if len(decoded.Interests) != 2 {
		t.Errorf("expected 2 interests, got %d", len(decoded.Interests))
	}
}

func TestUpdateLocationRequest_JSON(t *testing.T) {
	req := UpdateLocationRequest{
		Latitude:  37.7749,
		Longitude: -122.4194,
		City:      "San Francisco",
		Country:   "US",
	}

	data, _ := json.Marshal(req)
	var decoded UpdateLocationRequest
	json.Unmarshal(data, &decoded)

	if decoded.City != "San Francisco" {
		t.Errorf("expected 'San Francisco', got %q", decoded.City)
	}
	if decoded.Latitude != 37.7749 {
		t.Errorf("expected 37.7749, got %f", decoded.Latitude)
	}
}

func TestProfileResponse_JSON(t *testing.T) {
	resp := ProfileResponse{
		ID:       "test-id",
		Email:    "test@example.com",
		Verified: true,
	}

	data, _ := json.Marshal(resp)
	var decoded ProfileResponse
	json.Unmarshal(data, &decoded)

	if decoded.Email != "test@example.com" {
		t.Errorf("expected 'test@example.com', got %q", decoded.Email)
	}
	if !decoded.Verified {
		t.Error("expected verified=true")
	}
}
