package profile

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

type mockProfileHandlerService struct {
	getProfileFn        func(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error)
	updateProfileFn     func(ctx context.Context, userID uuid.UUID, req *UpdateProfileRequest) (*ProfileResponse, error)
	updateLocationFn    func(ctx context.Context, userID uuid.UUID, req *UpdateLocationRequest) error
	getPreferencesFn    func(ctx context.Context, userID uuid.UUID) (*models.UserPreferences, error)
	updatePreferencesFn func(ctx context.Context, userID uuid.UUID, req *UpdatePreferencesRequest) (*models.UserPreferences, error)
	setProfilePhotoFn   func(ctx context.Context, userID uuid.UUID, photoKey string) error
	addPhotoFn          func(ctx context.Context, userID uuid.UUID, photoKey string) ([]string, error)
	removePhotoFn       func(ctx context.Context, userID uuid.UUID, photoIndex int) ([]string, error)
	reorderPhotosFn     func(ctx context.Context, userID uuid.UUID, newOrder []int) ([]string, error)
}

func (m *mockProfileHandlerService) GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error) {
	return m.getProfileFn(ctx, userID)
}
func (m *mockProfileHandlerService) UpdateProfile(ctx context.Context, userID uuid.UUID, req *UpdateProfileRequest) (*ProfileResponse, error) {
	return m.updateProfileFn(ctx, userID, req)
}
func (m *mockProfileHandlerService) UpdateLocation(ctx context.Context, userID uuid.UUID, req *UpdateLocationRequest) error {
	if m.updateLocationFn == nil {
		return nil
	}
	return m.updateLocationFn(ctx, userID, req)
}
func (m *mockProfileHandlerService) GetPreferences(ctx context.Context, userID uuid.UUID) (*models.UserPreferences, error) {
	if m.getPreferencesFn == nil {
		return &models.UserPreferences{}, nil
	}
	return m.getPreferencesFn(ctx, userID)
}
func (m *mockProfileHandlerService) UpdatePreferences(ctx context.Context, userID uuid.UUID, req *UpdatePreferencesRequest) (*models.UserPreferences, error) {
	if m.updatePreferencesFn == nil {
		return &models.UserPreferences{}, nil
	}
	return m.updatePreferencesFn(ctx, userID, req)
}
func (m *mockProfileHandlerService) SetProfilePhoto(ctx context.Context, userID uuid.UUID, photoKey string) error {
	if m.setProfilePhotoFn == nil {
		return nil
	}
	return m.setProfilePhotoFn(ctx, userID, photoKey)
}
func (m *mockProfileHandlerService) AddPhoto(ctx context.Context, userID uuid.UUID, photoKey string) ([]string, error) {
	if m.addPhotoFn == nil {
		return []string{photoKey}, nil
	}
	return m.addPhotoFn(ctx, userID, photoKey)
}
func (m *mockProfileHandlerService) RemovePhoto(ctx context.Context, userID uuid.UUID, photoIndex int) ([]string, error) {
	if m.removePhotoFn == nil {
		return []string{}, nil
	}
	return m.removePhotoFn(ctx, userID, photoIndex)
}
func (m *mockProfileHandlerService) ReorderPhotos(ctx context.Context, userID uuid.UUID, newOrder []int) ([]string, error) {
	if m.reorderPhotosFn == nil {
		return []string{}, nil
	}
	return m.reorderPhotosFn(ctx, userID, newOrder)
}

type mockProfileUploader struct {
	uploadPhotoFn        func(userID uuid.UUID, data []byte, contentType string) (string, error)
	uploadProfilePhotoFn func(userID uuid.UUID, data []byte, contentType string) (string, error)
	getSignedURLFn       func(key string) (string, error)
	getSignedUploadURLFn func(key, contentType string) (string, error)
	deleteObjectFn       func(key string) error
}

func (m *mockProfileUploader) UploadPhoto(userID uuid.UUID, data []byte, contentType string) (string, error) {
	return m.uploadPhotoFn(userID, data, contentType)
}
func (m *mockProfileUploader) UploadProfilePhoto(userID uuid.UUID, data []byte, contentType string) (string, error) {
	if m.uploadProfilePhotoFn == nil {
		return "", nil
	}
	return m.uploadProfilePhotoFn(userID, data, contentType)
}
func (m *mockProfileUploader) GetSignedURL(key string) (string, error) {
	if m.getSignedURLFn == nil {
		return "", nil
	}
	return m.getSignedURLFn(key)
}
func (m *mockProfileUploader) GetSignedUploadURL(key, contentType string) (string, error) {
	if m.getSignedUploadURLFn == nil {
		return "", nil
	}
	return m.getSignedUploadURLFn(key, contentType)
}
func (m *mockProfileUploader) DeleteObject(key string) error {
	if m.deleteObjectFn == nil {
		return nil
	}
	return m.deleteObjectFn(key)
}

func TestGetProfile_NotFoundFromService(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockProfileHandlerService{
			getProfileFn: func(_ context.Context, _ uuid.UUID) (*ProfileResponse, error) {
				return nil, ErrUserNotFound
			},
			updateProfileFn: func(context.Context, uuid.UUID, *UpdateProfileRequest) (*ProfileResponse, error) {
				return nil, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/profile", nil)
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.GetProfile(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestUpdateProfile_Success(t *testing.T) {
	uid := uuid.New()
	displayName := "Dryft"
	h := &Handler{
		service: &mockProfileHandlerService{
			getProfileFn: func(context.Context, uuid.UUID) (*ProfileResponse, error) { return nil, nil },
			updateProfileFn: func(_ context.Context, gotUserID uuid.UUID, req *UpdateProfileRequest) (*ProfileResponse, error) {
				if gotUserID != uid {
					t.Fatalf("unexpected user id: %s", gotUserID)
				}
				if req.DisplayName == nil || *req.DisplayName != displayName {
					t.Fatalf("unexpected display_name: %+v", req.DisplayName)
				}
				return &ProfileResponse{ID: uid.String(), DisplayName: req.DisplayName}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPatch, "/v1/profile", bytes.NewBufferString(`{"display_name":"Dryft"}`))
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.UpdateProfile(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp ProfileResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.ID != uid.String() {
		t.Fatalf("unexpected id: %s", resp.ID)
	}
}

func TestUploadPhoto_UploaderFailure(t *testing.T) {
	uid := uuid.New()
	h := &Handler{
		service: &mockProfileHandlerService{
			getProfileFn:    func(context.Context, uuid.UUID) (*ProfileResponse, error) { return nil, nil },
			updateProfileFn: func(context.Context, uuid.UUID, *UpdateProfileRequest) (*ProfileResponse, error) { return nil, nil },
		},
		uploader: &mockProfileUploader{
			uploadPhotoFn: func(_ uuid.UUID, _ []byte, _ string) (string, error) {
				return "", errors.New("upload failed")
			},
		},
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	partHeader := textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="photo"; filename="avatar.jpg"`},
		"Content-Type":        {"image/jpeg"},
	}
	part, err := writer.CreatePart(partHeader)
	if err != nil {
		t.Fatalf("create multipart part: %v", err)
	}
	if _, err := part.Write([]byte("fake-image-data")); err != nil {
		t.Fatalf("write multipart payload: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/profile/photos", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = setUser(req, uid)
	rec := httptest.NewRecorder()
	h.UploadPhoto(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}
