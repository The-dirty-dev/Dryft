package agegate

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for age verification.
// LEGAL NOTE: All endpoints require authentication except webhooks.
// Rate limiting should be applied to prevent abuse.
type Handler struct {
	service agegateHandlerService
}

type agegateHandlerService interface {
	InitiateCardVerification(ctx context.Context, userID uuid.UUID, email string) (*models.CardVerificationInitResponse, error)
	ConfirmCardVerification(ctx context.Context, userID uuid.UUID, setupIntentID string) error
	InitiateIDVerification(ctx context.Context, userID uuid.UUID, callbackURL string) (*models.IDVerificationInitResponse, error)
	HandleJumioWebhook(ctx context.Context, payload []byte, signature string) error
	GetVerificationStatus(ctx context.Context, userID uuid.UUID) (*models.VerificationStatusResponse, error)
	RetryVerification(ctx context.Context, userID uuid.UUID) error
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// InitiateCardVerification starts the Stripe card verification process.
// POST /v1/age-gate/card/initiate
// Response: { "client_secret": "..." }
func (h *Handler) InitiateCardVerification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from auth context (middleware should set this)
	userID, email, err := getUserFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	resp, err := h.service.InitiateCardVerification(ctx, userID, email)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// ConfirmCardVerification confirms the card was verified.
// POST /v1/age-gate/card/confirm
// Request: { "setup_intent_id": "..." }
func (h *Handler) ConfirmCardVerification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, _, err := getUserFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		SetupIntentID string `json:"setup_intent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SetupIntentID == "" {
		writeError(w, http.StatusBadRequest, "setup_intent_id required")
		return
	}

	if err := h.service.ConfirmCardVerification(ctx, userID, req.SetupIntentID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// InitiateIDVerification starts the Jumio ID verification process.
// POST /v1/age-gate/id/initiate
// Response: { "redirect_url": "..." } or { "sdk_token": "..." }
func (h *Handler) InitiateIDVerification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, _, err := getUserFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Build callback URL - in production this would come from config
	callbackURL := getCallbackURL(r)

	resp, err := h.service.InitiateIDVerification(ctx, userID, callbackURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// HandleJumioWebhook receives verification results from Jumio.
// POST /v1/age-gate/id/webhook
// LEGAL NOTE: This endpoint is called by Jumio's servers.
// Validate the signature to prevent spoofing.
func (h *Handler) HandleJumioWebhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	// Get signature from header
	signature := r.Header.Get("X-Jumio-Signature")

	if err := h.service.HandleJumioWebhook(ctx, body, signature); err != nil {
		// Log the error but return 200 to prevent Jumio retries
		// In production, use proper logging
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
}

// GetVerificationStatus returns the current verification status.
// GET /v1/age-gate/status
func (h *Handler) GetVerificationStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, _, err := getUserFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	status, err := h.service.GetVerificationStatus(ctx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, status)
}

// RetryVerification allows a user to retry after rejection.
// POST /v1/age-gate/retry
func (h *Handler) RetryVerification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, _, err := getUserFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if err := h.service.RetryVerification(ctx, userID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// Helper functions

type contextKey string

const (
	userIDKey    contextKey = "user_id"
	userEmailKey contextKey = "user_email"
)

func getUserFromContext(r *http.Request) (uuid.UUID, string, error) {
	// SECURITY: Only extract user info from context (set by auth middleware)
	// Never accept user ID from headers to prevent impersonation attacks
	if id, ok := r.Context().Value(userIDKey).(uuid.UUID); ok {
		if e, ok := r.Context().Value(userEmailKey).(string); ok {
			return id, e, nil
		}
		return id, "", nil
	}
	return uuid.Nil, "", http.ErrNoCookie // Using this as a generic "not found" error
}

func getCallbackURL(r *http.Request) string {
	// Build from request host in dev, use config in production
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}
	return scheme + "://" + r.Host + "/v1/age-gate/id/webhook"
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	httputil.RespondJSON(w, status, data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	httputil.RespondError(w, status, message)
}
