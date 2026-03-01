package avatar

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles avatar HTTP requests
type Handler struct {
	service *Service
}

// NewHandler creates a new avatar handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers avatar routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/avatar", func(r chi.Router) {
		r.Get("/", h.GetMyAvatarState)
		r.Put("/", h.UpdateAvatarState)
		r.Post("/equip", h.EquipItem)
		r.Post("/unequip", h.UnequipItem)
		r.Put("/colors", h.SetColors)
		r.Put("/name", h.SetDisplayName)
		r.Put("/visibility", h.SetVisibility)
		r.Get("/history", h.GetEquipHistory)

		// Get another user's avatar (for VR rendering)
		r.Get("/user/{userId}", h.GetUserAvatarState)

		// Batch get avatars for multiple users
		r.Post("/batch", h.GetMultipleAvatarStates)
	})
}

// GetMyAvatarState returns the current user's avatar state
func (h *Handler) GetMyAvatarState(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	state, err := h.service.GetAvatarState(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch avatar state")
		return
	}

	writeJSON(w, http.StatusOK, state)
}

// GetUserAvatarState returns another user's avatar state
func (h *Handler) GetUserAvatarState(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	state, err := h.service.GetAvatarState(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user_not_found", "User not found")
		return
	}

	writeJSON(w, http.StatusOK, state)
}

type UpdateAvatarRequest struct {
	EquippedAvatar string `json:"equipped_avatar,omitempty"`
	EquippedOutfit string `json:"equipped_outfit,omitempty"`
	EquippedEffect string `json:"equipped_effect,omitempty"`
	SkinTone       string `json:"skin_tone,omitempty"`
	HairColor      string `json:"hair_color,omitempty"`
	EyeColor       string `json:"eye_color,omitempty"`
	DisplayName    string `json:"display_name,omitempty"`
	IsVisible      *bool  `json:"is_visible,omitempty"`
}

func (h *Handler) UpdateAvatarState(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req UpdateAvatarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	updates := make(map[string]interface{})
	if req.EquippedAvatar != "" {
		updates["equipped_avatar"] = req.EquippedAvatar
	}
	if req.EquippedOutfit != "" {
		updates["equipped_outfit"] = req.EquippedOutfit
	}
	if req.EquippedEffect != "" {
		updates["equipped_effect"] = req.EquippedEffect
	}
	if req.SkinTone != "" {
		updates["skin_tone"] = req.SkinTone
	}
	if req.HairColor != "" {
		updates["hair_color"] = req.HairColor
	}
	if req.EyeColor != "" {
		updates["eye_color"] = req.EyeColor
	}
	if req.DisplayName != "" {
		updates["display_name"] = req.DisplayName
	}
	if req.IsVisible != nil {
		updates["is_visible"] = *req.IsVisible
	}

	if len(updates) == 0 {
		writeError(w, http.StatusBadRequest, "no_updates", "No fields to update")
		return
	}

	err := h.service.UpdateAvatarState(r.Context(), userID, updates)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update avatar state")
		return
	}

	// Return updated state
	state, _ := h.service.GetAvatarState(r.Context(), userID)
	writeJSON(w, http.StatusOK, state)
}

type EquipRequest struct {
	ItemID   string `json:"item_id"`
	ItemType string `json:"item_type"` // avatar, outfit, effect
}

func (h *Handler) EquipItem(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req EquipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.ItemID == "" || req.ItemType == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "item_id and item_type are required")
		return
	}

	err := h.service.EquipItem(r.Context(), userID, req.ItemID, req.ItemType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "equip_failed", "Failed to equip item")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Item equipped successfully",
	})
}

type UnequipRequest struct {
	ItemType string `json:"item_type"`
}

func (h *Handler) UnequipItem(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req UnequipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.ItemType == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "item_type is required")
		return
	}

	err := h.service.UnequipItem(r.Context(), userID, req.ItemType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "unequip_failed", "Failed to unequip item")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Item unequipped successfully",
	})
}

type ColorsRequest struct {
	SkinTone  string `json:"skin_tone,omitempty"`
	HairColor string `json:"hair_color,omitempty"`
	EyeColor  string `json:"eye_color,omitempty"`
}

func (h *Handler) SetColors(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req ColorsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	err := h.service.SetColors(r.Context(), userID, req.SkinTone, req.HairColor, req.EyeColor)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update colors")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Colors updated successfully",
	})
}

type DisplayNameRequest struct {
	DisplayName string `json:"display_name"`
}

func (h *Handler) SetDisplayName(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req DisplayNameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "display_name is required")
		return
	}

	err := h.service.SetDisplayName(r.Context(), userID, req.DisplayName)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update display name")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Display name updated successfully",
	})
}

type VisibilityRequest struct {
	IsVisible bool `json:"is_visible"`
}

func (h *Handler) SetVisibility(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req VisibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	err := h.service.SetVisibility(r.Context(), userID, req.IsVisible)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update visibility")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Visibility updated successfully",
	})
}

func (h *Handler) GetEquipHistory(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	history, err := h.service.GetEquipHistory(r.Context(), userID, 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch equip history")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"history": history,
		"count":   len(history),
	})
}

type BatchAvatarRequest struct {
	UserIDs []uuid.UUID `json:"user_ids"`
}

func (h *Handler) GetMultipleAvatarStates(w http.ResponseWriter, r *http.Request) {
	var req BatchAvatarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if len(req.UserIDs) == 0 {
		writeError(w, http.StatusBadRequest, "missing_fields", "user_ids is required")
		return
	}

	if len(req.UserIDs) > 50 {
		writeError(w, http.StatusBadRequest, "too_many_users", "Maximum 50 users per request")
		return
	}

	states, err := h.service.GetMultipleAvatarStates(r.Context(), req.UserIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch avatar states")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"avatars": states,
		"count":   len(states),
	})
}

// --- Helpers ---

func getUserIDFromContext(r *http.Request) uuid.UUID {
	if id, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]interface{}{
		"error":   code,
		"message": message,
	})
}
