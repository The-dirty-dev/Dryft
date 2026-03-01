package settings

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Handler handles HTTP requests for settings
type Handler struct {
	service *Service
}

// NewHandler creates a new settings handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers settings routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/settings", func(r chi.Router) {
		r.Get("/", h.GetSettings)
		r.Put("/", h.UpdateSettings)
		r.Post("/sync", h.SyncSettings)
		r.Post("/reset", h.ResetSettings)

		// Category-specific updates
		r.Patch("/notifications", h.UpdateNotifications)
		r.Patch("/privacy", h.UpdatePrivacy)
		r.Patch("/appearance", h.UpdateAppearance)
		r.Patch("/vr", h.UpdateVR)
		r.Patch("/haptic", h.UpdateHaptic)
		r.Patch("/matching", h.UpdateMatching)
		r.Patch("/safety", h.UpdateSafety)
	})
}

// getUserID extracts user ID from context (set by auth middleware)
func getUserID(r *http.Request) string {
	userID := r.Context().Value("userID")
	if userID == nil {
		return ""
	}
	return userID.(string)
}

// GetSettings returns user settings
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	settings, err := h.service.GetSettings(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	updatedAt, _ := h.service.GetUpdatedAt(userID)

	response := struct {
		Settings  *AllSettings `json:"settings"`
		UpdatedAt *string      `json:"updatedAt,omitempty"`
	}{
		Settings: settings,
	}

	if updatedAt != nil {
		t := updatedAt.Format("2006-01-02T15:04:05Z07:00")
		response.UpdatedAt = &t
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateSettings updates all user settings
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings AllSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateSettings(userID, settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return updated settings
	h.GetSettings(w, r)
}

// SyncSettings handles bidirectional sync
func (h *Handler) SyncSettings(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.service.SyncSettings(userID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ResetSettings resets user settings to defaults
func (h *Handler) ResetSettings(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	settings, err := h.service.ResetSettings(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := struct {
		Settings *AllSettings `json:"settings"`
	}{
		Settings: settings,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateNotifications updates notification settings
func (h *Handler) UpdateNotifications(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings NotificationSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "notifications", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdatePrivacy updates privacy settings
func (h *Handler) UpdatePrivacy(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings PrivacySettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "privacy", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateAppearance updates appearance settings
func (h *Handler) UpdateAppearance(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings AppearanceSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "appearance", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateVR updates VR settings
func (h *Handler) UpdateVR(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings VRSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "vr", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateHaptic updates haptic settings
func (h *Handler) UpdateHaptic(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings HapticSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "haptic", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateMatching updates matching preferences
func (h *Handler) UpdateMatching(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings MatchingPreferences
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "matching", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// UpdateSafety updates safety settings
func (h *Handler) UpdateSafety(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var settings SafetySettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateCategory(userID, "safety", settings); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
