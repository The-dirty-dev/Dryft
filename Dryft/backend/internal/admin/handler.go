package admin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	authmw "github.com/dryft-app/backend/internal/middleware"
)

// Handler handles admin HTTP requests
type Handler struct {
	service *Service
}

// NewHandler creates a new admin handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// AdminMiddleware ensures the user is an admin
func (h *Handler) AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := getUserIDFromContext(r)
		if userID == nil {
			httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		isAdmin, err := h.service.IsAdmin(r.Context(), *userID)
		if err != nil || !isAdmin {
			httputil.WriteError(w, http.StatusForbidden, "admin access required")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// GetDashboard handles GET /admin/dashboard
func (h *Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := h.service.GetDashboardStats(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get dashboard stats")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, stats)
}

// =============================================================================
// Verification Review Endpoints
// =============================================================================

// GetVerifications handles GET /admin/verifications with optional status filter
func (h *Handler) GetVerifications(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset
	status := r.URL.Query().Get("status")

	reviews, total, err := h.service.GetVerifications(r.Context(), status, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get verifications")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"verifications": reviews,
		"total":         total,
		"limit":         limit,
		"offset":        offset,
	})
}

// GetPendingVerifications handles GET /admin/verifications/pending
func (h *Handler) GetPendingVerifications(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	reviews, total, err := h.service.GetVerifications(r.Context(), "pending", limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get verifications")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"verifications": reviews,
		"total":         total,
		"limit":         limit,
		"offset":        offset,
	})
}

// GetVerification handles GET /admin/verifications/{id}
func (h *Handler) GetVerification(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid verification ID")
		return
	}

	review, err := h.service.GetVerification(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrVerificationNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "verification not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get verification")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, review)
}

// ApproveVerification handles POST /admin/verifications/{id}/approve
func (h *Handler) ApproveVerification(w http.ResponseWriter, r *http.Request) {
	adminID := getUserIDFromContext(r)
	if adminID == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid verification ID")
		return
	}

	var req struct {
		Notes string `json:"notes,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req) // Optional body

	err = h.service.ApproveVerification(r.Context(), *adminID, id, req.Notes)
	if err != nil {
		if errors.Is(err, ErrVerificationNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "verification not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to approve verification")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "approved",
	})
}

// RejectVerification handles POST /admin/verifications/{id}/reject
func (h *Handler) RejectVerification(w http.ResponseWriter, r *http.Request) {
	adminID := getUserIDFromContext(r)
	if adminID == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid verification ID")
		return
	}

	var req struct {
		Reason string `json:"reason"`
		Notes  string `json:"notes,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Reason == "" {
		httputil.WriteError(w, http.StatusBadRequest, "reason is required")
		return
	}

	err = h.service.RejectVerification(r.Context(), *adminID, id, req.Reason, req.Notes)
	if err != nil {
		if errors.Is(err, ErrVerificationNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "verification not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to reject verification")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "rejected",
	})
}

// =============================================================================
// Report Review Endpoints
// =============================================================================

// GetPendingReports handles GET /admin/reports/pending
func (h *Handler) GetPendingReports(w http.ResponseWriter, r *http.Request) {
	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	reports, total, err := h.service.GetPendingReports(r.Context(), limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get reports")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"reports": reports,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// ReportDecision represents a report review decision
type ReportDecision struct {
	Action string `json:"action"` // "dismiss", "warn", "ban"
	Notes  string `json:"notes,omitempty"`
}

// ReviewReport handles POST /admin/reports/{id}/review
func (h *Handler) ReviewReport(w http.ResponseWriter, r *http.Request) {
	adminID := getUserIDFromContext(r)
	if adminID == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid report ID")
		return
	}

	var decision ReportDecision
	if err := json.NewDecoder(r.Body).Decode(&decision); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if decision.Action != "dismiss" && decision.Action != "warn" && decision.Action != "ban" {
		httputil.WriteError(w, http.StatusBadRequest, "action must be 'dismiss', 'warn', or 'ban'")
		return
	}

	err = h.service.ReviewReport(r.Context(), *adminID, id, decision.Action, decision.Notes)
	if err != nil {
		if errors.Is(err, ErrReportNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "report not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to review report")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "reviewed",
		"action": decision.Action,
	})
}

// =============================================================================
// User Management Endpoints
// =============================================================================

// GetUser handles GET /admin/users/{id}
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	user, err := h.service.GetUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get user")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, user)
}

// BanRequest represents a ban request
type BanRequest struct {
	Reason string `json:"reason"`
	Notes  string `json:"notes,omitempty"`
}

// BanUser handles POST /admin/users/{id}/ban
func (h *Handler) BanUser(w http.ResponseWriter, r *http.Request) {
	adminID := getUserIDFromContext(r)
	if adminID == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	var req BanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Reason == "" {
		httputil.WriteError(w, http.StatusBadRequest, "reason is required")
		return
	}

	err = h.service.BanUser(r.Context(), *adminID, id, req.Reason, req.Notes)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found or already banned")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to ban user")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "banned",
	})
}

// UnbanRequest represents an unban request
type UnbanRequest struct {
	Notes string `json:"notes,omitempty"`
}

// UnbanUser handles POST /admin/users/{id}/unban
func (h *Handler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	adminID := getUserIDFromContext(r)
	if adminID == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	var req UnbanRequest
	json.NewDecoder(r.Body).Decode(&req) // Optional body

	err = h.service.UnbanUser(r.Context(), *adminID, id, req.Notes)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "user not found or not banned")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to unban user")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "unbanned",
	})
}

// RegisterRoutes registers all admin routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Use(h.AdminMiddleware)

	r.Get("/dashboard", h.GetDashboard)

	// Verification review
	r.Get("/verifications", h.GetVerifications)
	r.Get("/verifications/pending", h.GetPendingVerifications)
	r.Get("/verifications/{id}", h.GetVerification)
	r.Post("/verifications/{id}/approve", h.ApproveVerification)
	r.Post("/verifications/{id}/reject", h.RejectVerification)

	// Report review
	r.Get("/reports/pending", h.GetPendingReports)
	r.Post("/reports/{id}/review", h.ReviewReport)

	// User management
	r.Get("/users/{id}", h.GetUser)
	r.Post("/users/{id}/ban", h.BanUser)
	r.Post("/users/{id}/unban", h.UnbanUser)
}

// =============================================================================
// Helper Functions
// =============================================================================

func getUserIDFromContext(r *http.Request) *uuid.UUID {
	if id, ok := authmw.GetUserID(r); ok {
		return &id
	}
	return nil
}

