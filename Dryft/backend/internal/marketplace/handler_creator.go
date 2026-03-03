package marketplace

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// BecomeCreator handles POST /v1/creators
func (h *Handler) BecomeCreator(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req CreateCreatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.StoreName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "store_name is required")
		return
	}

	creator, err := h.creator.CreateCreator(r.Context(), *userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlreadyCreator):
			httputil.WriteError(w, http.StatusConflict, "you already have a creator account")
		case errors.Is(err, ErrStoreNameTaken):
			httputil.WriteError(w, http.StatusConflict, "store name is already taken")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to create creator account")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, creator)
}

// GetMyCreatorAccount handles GET /v1/creators/me
func (h *Handler) GetMyCreatorAccount(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	creator, err := h.creator.GetCreator(r.Context(), *userID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get creator account")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, creator)
}

// OnboardingLinkRequest represents a request for onboarding link
type OnboardingLinkRequest struct {
	ReturnURL  string `json:"return_url"`
	RefreshURL string `json:"refresh_url"`
}

// GetOnboardingLink handles POST /v1/creators/onboarding-link
func (h *Handler) GetOnboardingLink(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req OnboardingLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ReturnURL == "" || req.RefreshURL == "" {
		httputil.WriteError(w, http.StatusBadRequest, "return_url and refresh_url are required")
		return
	}

	link, err := h.creator.GetOnboardingLink(r.Context(), *userID, req.ReturnURL, req.RefreshURL)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to create onboarding link")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"url": link,
	})
}

// UpdateCreatorProfileRequest represents a profile update request
type UpdateCreatorProfileRequest struct {
	StoreName   *string `json:"store_name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// UpdateCreatorProfile handles PATCH /v1/creators/me
func (h *Handler) UpdateCreatorProfile(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req UpdateCreatorProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	creator, err := h.creator.UpdateCreatorProfile(r.Context(), *userID, req.StoreName, req.Description)
	if err != nil {
		switch {
		case errors.Is(err, ErrCreatorNotFound):
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
		case errors.Is(err, ErrStoreNameTaken):
			httputil.WriteError(w, http.StatusConflict, "store name is already taken")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to update profile")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, creator)
}

// GetMyEarnings handles GET /v1/creators/earnings
func (h *Handler) GetMyEarnings(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	earnings, err := h.creator.GetCreatorEarnings(r.Context(), *userID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get earnings")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, earnings)
}

// GetMyItems handles GET /v1/creators/items
func (h *Handler) GetMyItems(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	// Get creator ID
	creator, err := h.creator.GetCreator(r.Context(), *userID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get creator account")
		return
	}

	// Parse status filter
	var status *models.ItemStatus
	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		s := models.ItemStatus(statusStr)
		status = &s
	}

	pg := httputil.ParseLimitOffset(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	items, err := h.creator.GetCreatorItems(r.Context(), creator.ID, status, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"limit":  limit,
		"offset": offset,
	})
}

// GetFeaturedCreators handles GET /v1/creators/featured
func (h *Handler) GetFeaturedCreators(w http.ResponseWriter, r *http.Request) {
	limit := httputil.ParseLimitOffset(r, 10, 50).Limit

	creators, err := h.creator.GetFeaturedCreators(r.Context(), limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get featured creators")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"creators": creators,
	})
}

// GetCreator handles GET /v1/creators/{creatorID}
func (h *Handler) GetCreator(w http.ResponseWriter, r *http.Request) {
	creatorIDStr := chi.URLParam(r, "creatorID")
	creatorID, err := uuid.Parse(creatorIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid creator ID")
		return
	}

	creator, err := h.creator.GetCreatorByID(r.Context(), creatorID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "creator not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get creator")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, creator)
}

// GetCreatorItems handles GET /v1/creators/{creatorID}/items
func (h *Handler) GetCreatorItems(w http.ResponseWriter, r *http.Request) {
	creatorIDStr := chi.URLParam(r, "creatorID")
	creatorID, err := uuid.Parse(creatorIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid creator ID")
		return
	}

	pg := httputil.ParseLimitOffset(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	// Only show approved items for public view
	approved := models.ItemStatusApproved
	items, err := h.creator.GetCreatorItems(r.Context(), creatorID, &approved, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"limit":  limit,
		"offset": offset,
	})
}
