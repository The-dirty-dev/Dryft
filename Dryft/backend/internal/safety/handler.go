package safety

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for safety features
type Handler struct {
	service *Service
}

// NewHandler creates a new safety handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers safety routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/safety", func(r chi.Router) {
		// Block management
		r.Post("/block", h.BlockUser)
		r.Delete("/block/{userId}", h.UnblockUser)
		r.Get("/blocked", h.GetBlockedUsers)
		r.Get("/blocked/{userId}/check", h.CheckBlocked)

		// Reports
		r.Post("/report", h.SubmitReport)
		r.Get("/reports", h.GetMyReports)

		// Panic button
		r.Post("/panic", h.RecordPanic)

		// Warnings (read-only for users)
		r.Get("/warnings", h.GetMyWarnings)
	})
}

// RegisterAdminRoutes registers admin-only safety routes
func (h *Handler) RegisterAdminRoutes(r chi.Router) {
	r.Route("/admin/safety", func(r chi.Router) {
		// Report management
		r.Get("/reports", h.GetPendingReports)
		r.Get("/reports/user/{userId}", h.GetReportsAgainstUser)
		r.Put("/reports/{reportId}", h.UpdateReport)

		// Warning management
		r.Post("/warnings", h.IssueWarning)
		r.Get("/warnings/user/{userId}", h.GetUserWarnings)

		// Panic events
		r.Get("/panic/user/{userId}", h.GetUserPanicEvents)
	})
}

// --- Block Endpoints ---

type BlockRequest struct {
	UserID uuid.UUID `json:"user_id"`
	Reason string    `json:"reason,omitempty"`
}

func (h *Handler) BlockUser(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req BlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.UserID == uuid.Nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "User ID is required")
		return
	}

	err := h.service.BlockUser(r.Context(), userID, req.UserID, req.Reason)
	if err != nil {
		switch {
		case errors.Is(err, ErrCannotBlockSelf):
			writeError(w, http.StatusBadRequest, "cannot_block_self", "Cannot block yourself")
		case errors.Is(err, ErrAlreadyBlocked):
			writeError(w, http.StatusConflict, "already_blocked", "User already blocked")
		default:
			writeError(w, http.StatusInternalServerError, "block_failed", "Failed to block user")
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "User blocked successfully",
	})
}

func (h *Handler) UnblockUser(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	blockedUserID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	err = h.service.UnblockUser(r.Context(), userID, blockedUserID)
	if err != nil {
		if errors.Is(err, ErrNotBlocked) {
			writeError(w, http.StatusNotFound, "not_blocked", "User is not blocked")
			return
		}
		writeError(w, http.StatusInternalServerError, "unblock_failed", "Failed to unblock user")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "User unblocked successfully",
	})
}

func (h *Handler) GetBlockedUsers(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	blocks, err := h.service.GetBlockedUsers(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch blocked users")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"blocked_users": blocks,
		"count":         len(blocks),
	})
}

func (h *Handler) CheckBlocked(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	checkUserID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	blocked, err := h.service.IsBlocked(r.Context(), userID, checkUserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "check_failed", "Failed to check block status")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"is_blocked": blocked,
	})
}

// --- Report Endpoints ---

type ReportRequest struct {
	ReportedUserID uuid.UUID `json:"reported_user_id"`
	Category       string    `json:"category"`
	Reason         string    `json:"reason"`
	Description    string    `json:"description,omitempty"`
	EvidenceURLs   []string  `json:"evidence_urls,omitempty"`
	SessionID      uuid.UUID `json:"session_id,omitempty"`
}

func (h *Handler) SubmitReport(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req ReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.ReportedUserID == uuid.Nil || req.Category == "" || req.Reason == "" {
		writeError(w, http.StatusBadRequest, "missing_fields", "reported_user_id, category, and reason are required")
		return
	}

	report := &Report{
		ReporterID:     userID,
		ReportedUserID: req.ReportedUserID,
		Category:       req.Category,
		Reason:         req.Reason,
		Description:    req.Description,
		EvidenceURLs:   req.EvidenceURLs,
	}

	if req.SessionID != uuid.Nil {
		report.SessionID = &req.SessionID
	}

	err := h.service.SubmitReport(r.Context(), report)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCategory):
			writeError(w, http.StatusBadRequest, "invalid_category", "Invalid report category")
		case errors.Is(err, ErrDuplicateReport):
			writeError(w, http.StatusConflict, "duplicate_report", "You have already reported this user recently")
		default:
			writeError(w, http.StatusInternalServerError, "report_failed", "Failed to submit report")
		}
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success":   true,
		"report_id": report.ID,
		"message":   "Report submitted successfully. Our team will review it shortly.",
	})
}

func (h *Handler) GetMyReports(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	reports, err := h.service.GetUserReports(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch reports")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"reports": reports,
		"count":   len(reports),
	})
}

// --- Panic Endpoints ---

type PanicRequest struct {
	SessionID uuid.UUID `json:"session_id,omitempty"`
	Location  string    `json:"location,omitempty"`
}

func (h *Handler) RecordPanic(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	var req PanicRequest
	json.NewDecoder(r.Body).Decode(&req) // Optional body

	event := &PanicEvent{
		UserID:   userID,
		Location: req.Location,
	}

	if req.SessionID != uuid.Nil {
		event.SessionID = &req.SessionID
	}

	err := h.service.RecordPanicEvent(r.Context(), event)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "panic_failed", "Failed to record panic event")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Panic recorded. You have been safely removed from the session.",
	})
}

// --- Warning Endpoints ---

func (h *Handler) GetMyWarnings(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	warnings, err := h.service.GetActiveWarnings(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch warnings")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"warnings": warnings,
		"count":    len(warnings),
	})
}

// --- Admin Endpoints ---

func (h *Handler) GetPendingReports(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit == 0 {
		limit = 20
	}

	reports, total, err := h.service.GetPendingReports(r.Context(), limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch reports")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"reports": reports,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

func (h *Handler) GetReportsAgainstUser(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	reports, err := h.service.GetReportsAgainstUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch reports")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"reports": reports,
		"count":   len(reports),
	})
}

type UpdateReportRequest struct {
	Status     string `json:"status"`
	Resolution string `json:"resolution,omitempty"`
}

func (h *Handler) UpdateReport(w http.ResponseWriter, r *http.Request) {
	reviewerID := getUserIDFromContext(r)
	reportID, err := uuid.Parse(chi.URLParam(r, "reportId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_report_id", "Invalid report ID")
		return
	}

	var req UpdateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	err = h.service.UpdateReportStatus(r.Context(), reportID, reviewerID, req.Status, req.Resolution)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update_failed", "Failed to update report")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Report updated successfully",
	})
}

type IssueWarningRequest struct {
	UserID    uuid.UUID  `json:"user_id"`
	Type      string     `json:"type"` // warning, strike, suspension, ban
	Reason    string     `json:"reason"`
	Message   string     `json:"message,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

func (h *Handler) IssueWarning(w http.ResponseWriter, r *http.Request) {
	issuerID := getUserIDFromContext(r)

	var req IssueWarningRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	warning := &Warning{
		UserID:    req.UserID,
		Type:      req.Type,
		Reason:    req.Reason,
		Message:   req.Message,
		IssuedBy:  issuerID,
		ExpiresAt: req.ExpiresAt,
	}

	err := h.service.IssueWarning(r.Context(), warning)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "warning_failed", "Failed to issue warning")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"success":    true,
		"warning_id": warning.ID,
	})
}

func (h *Handler) GetUserWarnings(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	warnings, err := h.service.GetUserWarnings(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch warnings")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"warnings": warnings,
		"count":    len(warnings),
	})
}

func (h *Handler) GetUserPanicEvents(w http.ResponseWriter, r *http.Request) {
	userID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_user_id", "Invalid user ID")
		return
	}

	events, err := h.service.GetPanicEvents(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "fetch_failed", "Failed to fetch panic events")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"events": events,
		"count":  len(events),
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
