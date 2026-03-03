package matching

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// Handler handles HTTP requests for matching
type Handler struct {
	service matchingHandlerService
}

type matchingHandlerService interface {
	Swipe(ctx context.Context, swiperID, swipedID uuid.UUID, direction models.SwipeDirection) (*SwipeResult, error)
	GetDiscoverProfiles(ctx context.Context, userID uuid.UUID, limit int) ([]models.DiscoverProfile, error)
	GetMatches(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.MatchWithUser, error)
	GetMatch(ctx context.Context, userID, matchID uuid.UUID) (*models.MatchWithUser, error)
	Unmatch(ctx context.Context, userID, matchID uuid.UUID) error
}

// NewHandler creates a new matching handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// SwipeRequest represents a swipe action request
type SwipeRequest struct {
	UserID    string `json:"user_id"`
	Direction string `json:"direction"` // "like" or "pass"
}

// Swipe handles POST /v1/discover/swipe
func (h *Handler) Swipe(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req SwipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate direction
	var direction models.SwipeDirection
	switch req.Direction {
	case "like":
		direction = models.SwipeLike
	case "pass":
		direction = models.SwipePass
	default:
		httputil.WriteError(w, http.StatusBadRequest, "direction must be 'like' or 'pass'")
		return
	}

	// Parse target user ID
	targetID, err := uuid.Parse(req.UserID)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid user_id")
		return
	}

	result, err := h.service.Swipe(r.Context(), userID, targetID, direction)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlreadySwiped):
			httputil.WriteError(w, http.StatusConflict, "already swiped on this user")
		case errors.Is(err, ErrCannotSwipeSelf):
			httputil.WriteError(w, http.StatusBadRequest, "cannot swipe on yourself")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to record swipe")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

// GetDiscoverProfiles handles GET /v1/discover
func (h *Handler) GetDiscoverProfiles(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	pg := httputil.ParsePagination(r, 10, 50)

	profiles, err := h.service.GetDiscoverProfiles(r.Context(), userID, pg.Limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get profiles")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"profiles": profiles,
	})
}

// GetMatches handles GET /v1/matches
func (h *Handler) GetMatches(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)

	matches, err := h.service.GetMatches(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get matches")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"matches": matches,
	})
}

// GetMatch handles GET /v1/matches/{matchID}
func (h *Handler) GetMatch(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	matchIDStr := chi.URLParam(r, "matchID")
	matchID, err := uuid.Parse(matchIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid match ID")
		return
	}

	match, err := h.service.GetMatch(r.Context(), userID, matchID)
	if err != nil {
		if errors.Is(err, ErrMatchNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "match not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get match")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, match)
}

// Unmatch handles DELETE /v1/matches/{matchID}
func (h *Handler) Unmatch(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	matchIDStr := chi.URLParam(r, "matchID")
	matchID, err := uuid.Parse(matchIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid match ID")
		return
	}

	err = h.service.Unmatch(r.Context(), userID, matchID)
	if err != nil {
		switch {
		case errors.Is(err, ErrMatchNotFound):
			httputil.WriteError(w, http.StatusNotFound, "match not found")
		case errors.Is(err, ErrNotInMatch):
			httputil.WriteError(w, http.StatusForbidden, "you are not part of this match")
		case errors.Is(err, ErrAlreadyUnmatched):
			httputil.WriteError(w, http.StatusConflict, "already unmatched")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to unmatch")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
