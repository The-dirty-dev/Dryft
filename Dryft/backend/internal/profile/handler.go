package profile

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// Handler handles HTTP requests for profile management
type Handler struct {
	service  profileHandlerService
	uploader Uploader
}

type profileHandlerService interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req *UpdateProfileRequest) (*ProfileResponse, error)
	UpdateLocation(ctx context.Context, userID uuid.UUID, req *UpdateLocationRequest) error
	GetPreferences(ctx context.Context, userID uuid.UUID) (*models.UserPreferences, error)
	UpdatePreferences(ctx context.Context, userID uuid.UUID, req *UpdatePreferencesRequest) (*models.UserPreferences, error)
	SetProfilePhoto(ctx context.Context, userID uuid.UUID, photoKey string) error
	AddPhoto(ctx context.Context, userID uuid.UUID, photoKey string) ([]string, error)
	RemovePhoto(ctx context.Context, userID uuid.UUID, photoIndex int) ([]string, error)
	ReorderPhotos(ctx context.Context, userID uuid.UUID, newOrder []int) ([]string, error)
}

// Uploader interface for S3 uploads
type Uploader interface {
	UploadPhoto(userID uuid.UUID, data []byte, contentType string) (string, error)
	UploadProfilePhoto(userID uuid.UUID, data []byte, contentType string) (string, error)
	GetSignedURL(key string) (string, error)
	GetSignedUploadURL(key, contentType string) (string, error)
	DeleteObject(key string) error
}

// NewHandler creates a new profile handler
func NewHandler(service *Service, uploader Uploader) *Handler {
	return &Handler{
		service:  service,
		uploader: uploader,
	}
}

// GetProfile handles GET /v1/profile
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	profile, err := h.service.GetProfile(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get profile")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, profile)
}

// UpdateProfile handles PATCH /v1/profile
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	profile, err := h.service.UpdateProfile(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		if errors.Is(err, ErrInvalidInterest) {
			httputil.WriteError(w, http.StatusBadRequest, "interest exceeds 50 characters")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, profile)
}

// UpdateLocation handles PUT /v1/profile/location
func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req UpdateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.UpdateLocation(r.Context(), userID, &req); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update location")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GetPreferences handles GET /v1/profile/preferences
func (h *Handler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	prefs, err := h.service.GetPreferences(r.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get preferences")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, prefs)
}

// UpdatePreferences handles PATCH /v1/profile/preferences
func (h *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	prefs, err := h.service.UpdatePreferences(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		if errors.Is(err, ErrInvalidAge) {
			httputil.WriteError(w, http.StatusBadRequest, "invalid age range (min 18, max must be >= min)")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update preferences")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, prefs)
}

// UploadPhoto handles POST /v1/profile/photos
func (h *Handler) UploadPhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "file too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "photo file required")
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/webp" {
		httputil.WriteError(w, http.StatusBadRequest, "only JPEG, PNG, and WebP images allowed")
		return
	}

	// Read file
	data, err := io.ReadAll(file)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	// Upload to S3
	key, err := h.uploader.UploadPhoto(userID, data, contentType)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to upload photo")
		return
	}

	// Check if this is the main profile photo or gallery photo
	isMain := r.FormValue("main") == "true"

	if isMain {
		if err := h.service.SetProfilePhoto(r.Context(), userID, key); err != nil {
			httputil.WriteError(w, http.StatusInternalServerError, "failed to set profile photo")
			return
		}
		httputil.WriteJSON(w, http.StatusOK, map[string]string{
			"photo_key": key,
			"type":      "main",
		})
	} else {
		photos, err := h.service.AddPhoto(r.Context(), userID, key)
		if err != nil {
			if errors.Is(err, ErrTooManyPhotos) {
				httputil.WriteError(w, http.StatusBadRequest, "maximum 6 photos allowed")
				return
			}
			httputil.WriteError(w, http.StatusInternalServerError, "failed to add photo")
			return
		}
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"photo_key": key,
			"photos":    photos,
			"type":      "gallery",
		})
	}
}

// DeletePhoto handles DELETE /v1/profile/photos/{index}
func (h *Handler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	indexStr := chi.URLParam(r, "index")
	index, err := strconv.Atoi(indexStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid photo index")
		return
	}

	photos, err := h.service.RemovePhoto(r.Context(), userID, index)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"photos": photos,
	})
}

// ReorderPhotos handles PUT /v1/profile/photos/reorder
func (h *Handler) ReorderPhotos(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		Order []int `json:"order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	photos, err := h.service.ReorderPhotos(r.Context(), userID, req.Order)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"photos": photos,
	})
}

// GetPhotoURL handles GET /v1/profile/photos/{key}/url
func (h *Handler) GetPhotoURL(w http.ResponseWriter, r *http.Request) {
	_, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	key := chi.URLParam(r, "*")
	if key == "" {
		httputil.WriteError(w, http.StatusBadRequest, "photo key required")
		return
	}

	url, err := h.uploader.GetSignedURL(key)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to generate URL")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"url": url,
	})
}

// GetUploadURL handles POST /v1/profile/photos/upload-url
func (h *Handler) GetUploadURL(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		ContentType string `json:"content_type"`
		IsMain      bool   `json:"is_main"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate content type
	if req.ContentType != "image/jpeg" && req.ContentType != "image/png" && req.ContentType != "image/webp" {
		httputil.WriteError(w, http.StatusBadRequest, "only JPEG, PNG, and WebP images allowed")
		return
	}

	// Generate key
	ext := ".jpg"
	switch req.ContentType {
	case "image/png":
		ext = ".png"
	case "image/webp":
		ext = ".webp"
	}

	var key string
	if req.IsMain {
		key = "profiles/" + userID.String() + "/main" + ext
	} else {
		key = "photos/" + userID.String() + "/" + uuid.New().String() + ext
	}

	url, err := h.uploader.GetSignedUploadURL(key, req.ContentType)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to generate upload URL")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"upload_url": url,
		"key":        key,
	})
}

// ConfirmUpload handles POST /v1/profile/photos/confirm
func (h *Handler) ConfirmUpload(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		Key    string `json:"key"`
		IsMain bool   `json:"is_main"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.IsMain {
		if err := h.service.SetProfilePhoto(r.Context(), userID, req.Key); err != nil {
			httputil.WriteError(w, http.StatusInternalServerError, "failed to set profile photo")
			return
		}
		httputil.WriteJSON(w, http.StatusOK, map[string]string{
			"photo_key": req.Key,
			"type":      "main",
		})
	} else {
		photos, err := h.service.AddPhoto(r.Context(), userID, req.Key)
		if err != nil {
			if errors.Is(err, ErrTooManyPhotos) {
				httputil.WriteError(w, http.StatusBadRequest, "maximum 6 photos allowed")
				return
			}
			httputil.WriteError(w, http.StatusInternalServerError, "failed to add photo")
			return
		}
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"photo_key": req.Key,
			"photos":    photos,
			"type":      "gallery",
		})
	}
}

// Helper functions

type contextKey string

const userIDContextKey contextKey = "user_id"

func getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	if id, ok := r.Context().Value(userIDContextKey).(uuid.UUID); ok {
		return id, nil
	}
	return uuid.Nil, http.ErrNoCookie
}
