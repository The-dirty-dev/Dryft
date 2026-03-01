package links

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers the link routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/links", func(r chi.Router) {
		// General link operations
		r.Post("/", h.CreateLink)
		r.Get("/{code}", h.GetLink)
		r.Post("/{code}/validate", h.ValidateLink)
		r.Post("/{code}/use", h.UseLink)

		// Profile links
		r.Post("/profile", h.CreateProfileLink)

		// VR invite links
		r.Route("/vr-invite", func(r chi.Router) {
			r.Post("/", h.CreateVRInvite)
			r.Get("/{code}", h.GetVRInvite)
			r.Get("/{code}/validate", h.ValidateVRInvite)
			r.Post("/{code}/accept", h.AcceptVRInvite)
			r.Post("/{code}/decline", h.DeclineVRInvite)
			r.Post("/{code}/cancel", h.CancelVRInvite)
		})

		// User's invites
		r.Get("/user/{userId}/vr-invites", h.GetUserVRInvites)
	})
}

// Request/Response types

type CreateLinkRequest struct {
	Type      string            `json:"type"`
	TargetID  string            `json:"target_id,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	ExpiresIn int               `json:"expires_in_seconds,omitempty"` // seconds
	MaxUses   int               `json:"max_uses,omitempty"`
}

type CreateLinkResponse struct {
	Link *Link  `json:"link"`
	URL  string `json:"url"`
}

type LinkResponse struct {
	Valid     bool   `json:"valid"`
	Link      *Link  `json:"link,omitempty"`
	URL       string `json:"url,omitempty"`
	Error     string `json:"error,omitempty"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

type CreateVRInviteRequest struct {
	GuestID   string `json:"guest_id,omitempty"`
	RoomType  string `json:"room_type,omitempty"`
	ExpiresIn int    `json:"expires_in_seconds,omitempty"`
}

type VRInviteResponse struct {
	Valid      bool   `json:"valid"`
	InviteCode string `json:"invite_code,omitempty"`
	HostID     string `json:"host_id,omitempty"`
	HostName   string `json:"host_name,omitempty"`
	GuestID    string `json:"guest_id,omitempty"`
	RoomID     string `json:"room_id,omitempty"`
	RoomType   string `json:"room_type,omitempty"`
	Status     string `json:"status,omitempty"`
	ExpiresAt  int64  `json:"expires_at,omitempty"`
	URL        string `json:"url,omitempty"`
	Error      string `json:"error,omitempty"`
}

// Handlers

func (h *Handler) CreateLink(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req CreateLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	expiresIn := time.Duration(req.ExpiresIn) * time.Second
	if expiresIn == 0 {
		expiresIn = 7 * 24 * time.Hour // Default 7 days
	}

	maxUses := req.MaxUses
	if maxUses == 0 {
		maxUses = 1
	}

	link, err := h.service.CreateLink(
		r.Context(),
		LinkType(req.Type),
		userID,
		req.TargetID,
		req.Metadata,
		expiresIn,
		maxUses,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := CreateLinkResponse{
		Link: link,
		URL:  h.service.BuildLinkURL(link.Type, link.Code),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) GetLink(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	link, err := h.service.GetLink(r.Context(), code)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrLinkNotFound {
			status = http.StatusNotFound
		}
		respondWithError(w, status, err.Error())
		return
	}

	resp := LinkResponse{
		Valid: true,
		Link:  link,
		URL:   h.service.BuildLinkURL(link.Type, link.Code),
	}

	if link.ExpiresAt != nil {
		resp.ExpiresAt = link.ExpiresAt.Format(time.RFC3339)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) ValidateLink(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	link, err := h.service.ValidateLink(r.Context(), code)
	if err != nil {
		resp := LinkResponse{
			Valid: false,
			Error: err.Error(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	resp := LinkResponse{
		Valid: true,
		Link:  link,
		URL:   h.service.BuildLinkURL(link.Type, link.Code),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) UseLink(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	link, err := h.service.UseLink(r.Context(), code)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrLinkNotFound {
			status = http.StatusNotFound
		}
		respondWithError(w, status, err.Error())
		return
	}

	resp := LinkResponse{
		Valid: true,
		Link:  link,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) CreateProfileLink(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	// Profile links don't expire and can be used unlimited times
	link, err := h.service.CreateLink(
		r.Context(),
		LinkTypeProfile,
		userID,
		userID,
		nil,
		0, // No expiration
		0, // Unlimited uses
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := CreateLinkResponse{
		Link: link,
		URL:  h.service.BuildLinkURL(link.Type, link.Code),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// VR Invite handlers

func (h *Handler) CreateVRInvite(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req CreateVRInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	expiresIn := time.Duration(req.ExpiresIn) * time.Second
	if expiresIn == 0 {
		expiresIn = 24 * time.Hour // Default 24 hours
	}

	roomType := req.RoomType
	if roomType == "" {
		roomType = "private"
	}

	invite, err := h.service.CreateVRInvite(r.Context(), userID, req.GuestID, roomType, expiresIn)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp := VRInviteResponse{
		Valid:      true,
		InviteCode: invite.Code,
		HostID:     invite.HostID,
		GuestID:    invite.GuestID,
		RoomType:   invite.RoomType,
		Status:     invite.Status,
		ExpiresAt:  invite.ExpiresAt.Unix(),
		URL:        h.service.BuildLinkURL(LinkTypeVRInvite, invite.Code),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) GetVRInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	invite, err := h.service.GetVRInvite(r.Context(), code)
	if err != nil {
		status := http.StatusInternalServerError
		if err == ErrLinkNotFound {
			status = http.StatusNotFound
		}
		respondWithError(w, status, err.Error())
		return
	}

	resp := VRInviteResponse{
		Valid:      true,
		InviteCode: invite.Code,
		HostID:     invite.HostID,
		GuestID:    invite.GuestID,
		RoomID:     invite.RoomID,
		RoomType:   invite.RoomType,
		Status:     invite.Status,
		ExpiresAt:  invite.ExpiresAt.Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) ValidateVRInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	invite, err := h.service.ValidateVRInvite(r.Context(), code)
	if err != nil {
		resp := VRInviteResponse{
			Valid: false,
			Error: err.Error(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	// Get host name from user service (simplified here)
	hostName := "User" // Would fetch from user service

	resp := VRInviteResponse{
		Valid:      true,
		InviteCode: invite.Code,
		HostID:     invite.HostID,
		HostName:   hostName,
		RoomType:   invite.RoomType,
		ExpiresAt:  invite.ExpiresAt.Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) AcceptVRInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	userID := r.Context().Value("user_id").(string)

	invite, err := h.service.AcceptVRInvite(r.Context(), code, userID)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrLinkNotFound {
			status = http.StatusNotFound
		}
		respondWithError(w, status, err.Error())
		return
	}

	resp := VRInviteResponse{
		Valid:      true,
		InviteCode: invite.Code,
		HostID:     invite.HostID,
		GuestID:    invite.GuestID,
		RoomID:     invite.RoomID,
		RoomType:   invite.RoomType,
		Status:     invite.Status,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) DeclineVRInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	if err := h.service.DeclineVRInvite(r.Context(), code); err != nil {
		status := http.StatusBadRequest
		if err == ErrLinkNotFound {
			status = http.StatusNotFound
		}
		respondWithError(w, status, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *Handler) CancelVRInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	userID := r.Context().Value("user_id").(string)

	if err := h.service.CancelVRInvite(r.Context(), code, userID); err != nil {
		status := http.StatusBadRequest
		if err == ErrLinkNotFound {
			status = http.StatusNotFound
		}
		respondWithError(w, status, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (h *Handler) GetUserVRInvites(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	status := r.URL.Query().Get("status")

	invites, err := h.service.GetUserVRInvites(r.Context(), userID, status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"invites": invites,
		"count":   len(invites),
	})
}

func respondWithError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
