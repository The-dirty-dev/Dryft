package verification

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dryft-app/backend/internal/httputil"
)

type Handler struct {
	service         verificationHandlerService
	socialValidator SocialTokenValidator
}

type verificationHandlerService interface {
	GetUserVerifications(ctx context.Context, userID string) ([]Verification, error)
	CalculateTrustScore(ctx context.Context, userID string) (int, error)
	IsUserVerified(ctx context.Context, userID string) (bool, error)
	SubmitPhotoVerification(ctx context.Context, userID string, photoData io.Reader, filename, poseType string) (*Verification, error)
	SendPhoneVerification(ctx context.Context, userID, phoneNumber string) (*VerificationCode, error)
	VerifyPhoneCode(ctx context.Context, userID, verificationID, code string) (*Verification, error)
	SendEmailVerification(ctx context.Context, userID, email string) (*VerificationCode, error)
	VerifyEmailCode(ctx context.Context, userID, token string) (*Verification, error)
	SubmitIDVerification(ctx context.Context, userID string, frontData io.Reader, backData io.Reader) (*Verification, error)
	ConnectSocialAccount(ctx context.Context, userID, provider, socialID, socialEmail string) (*Verification, error)
	GetPendingVerifications(ctx context.Context, vType VerificationType, limit, offset int) ([]Verification, int64, error)
	ReviewVerification(ctx context.Context, verificationID, reviewerID string, approved bool, reason string) error
}

func NewHandler(service *Service, socialValidator SocialTokenValidator) *Handler {
	return &Handler{service: service, socialValidator: socialValidator}
}

// RegisterRoutes registers verification routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/verification", func(r chi.Router) {
		// User verification status
		r.Get("/status", h.GetVerificationStatus)
		r.Get("/score", h.GetTrustScore)

		// Photo verification
		r.Post("/photo", h.SubmitPhotoVerification)

		// Phone verification
		r.Post("/phone/send", h.SendPhoneVerification)
		r.Post("/phone/verify", h.VerifyPhoneCode)

		// Email verification
		r.Post("/email/send", h.SendEmailVerification)
		r.Post("/email/verify", h.VerifyEmailCode)

		// ID verification
		r.Post("/id", h.SubmitIDVerification)

		// Social verification
		r.Post("/social", h.ConnectSocialAccount)

		// Admin routes
		r.Route("/admin", func(r chi.Router) {
			r.Get("/pending", h.GetPendingVerifications)
			r.Post("/{verificationId}/review", h.ReviewVerification)
		})
	})
}

// Response types
type VerificationStatusResponse struct {
	Verifications []VerificationResponse `json:"verifications"`
	TrustScore    int                    `json:"trust_score"`
	IsVerified    bool                   `json:"is_verified"`
}

type VerificationResponse struct {
	Type            string  `json:"type"`
	Status          string  `json:"status"`
	SubmittedAt     *string `json:"submitted_at,omitempty"`
	ReviewedAt      *string `json:"reviewed_at,omitempty"`
	ExpiresAt       *string `json:"expires_at,omitempty"`
	RejectionReason string  `json:"rejection_reason,omitempty"`
}

// GetVerificationStatus returns all verification statuses for the user
func (h *Handler) GetVerificationStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	verifications, err := h.service.GetUserVerifications(r.Context(), userID)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	score, _ := h.service.CalculateTrustScore(r.Context(), userID)
	isVerified, _ := h.service.IsUserVerified(r.Context(), userID)

	response := VerificationStatusResponse{
		Verifications: make([]VerificationResponse, 0),
		TrustScore:    score,
		IsVerified:    isVerified,
	}

	for _, v := range verifications {
		vr := VerificationResponse{
			Type:            string(v.Type),
			Status:          string(v.Status),
			RejectionReason: v.RejectionReason,
		}
		if !v.SubmittedAt.IsZero() {
			t := v.SubmittedAt.Format("2006-01-02T15:04:05Z")
			vr.SubmittedAt = &t
		}
		if v.ReviewedAt != nil {
			t := v.ReviewedAt.Format("2006-01-02T15:04:05Z")
			vr.ReviewedAt = &t
		}
		if v.ExpiresAt != nil {
			t := v.ExpiresAt.Format("2006-01-02T15:04:05Z")
			vr.ExpiresAt = &t
		}
		response.Verifications = append(response.Verifications, vr)
	}

	httputil.RespondJSON(w, http.StatusOK, response)
}

// GetTrustScore returns the user's trust score
func (h *Handler) GetTrustScore(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	score, err := h.service.CalculateTrustScore(r.Context(), userID)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]int{"trust_score": score})
}

// SubmitPhotoVerification handles photo verification submission
func (h *Handler) SubmitPhotoVerification(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB max
		httputil.RespondError(w, http.StatusBadRequest, "File too large")
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Photo required")
		return
	}
	defer file.Close()

	poseType := r.FormValue("pose_type")
	if poseType == "" {
		poseType = "selfie"
	}

	verification, err := h.service.SubmitPhotoVerification(r.Context(), userID, file, header.Filename, poseType)
	if err != nil {
		if err == ErrAlreadyVerified {
			httputil.RespondError(w, http.StatusConflict, "Already verified")
			return
		}
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"verification_id": verification.ID,
		"status":          verification.Status,
	})
}

type SendPhoneRequest struct {
	PhoneNumber string `json:"phone_number"`
}

// SendPhoneVerification sends a verification code via SMS
func (h *Handler) SendPhoneVerification(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req SendPhoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	vc, err := h.service.SendPhoneVerification(r.Context(), userID, req.PhoneNumber)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"verification_id": vc.ID,
		"expires_at":      vc.ExpiresAt.Unix(),
	})
}

type VerifyCodeRequest struct {
	VerificationID string `json:"verification_id"`
	Code           string `json:"code"`
}

// VerifyPhoneCode verifies the SMS code
func (h *Handler) VerifyPhoneCode(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req VerifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	verification, err := h.service.VerifyPhoneCode(r.Context(), userID, req.VerificationID, req.Code)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrVerificationNotFound {
			status = http.StatusNotFound
		}
		httputil.RespondError(w, status, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"status":  verification.Status,
	})
}

// SendEmailVerification sends a verification email
func (h *Handler) SendEmailVerification(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	// Get email from user profile (simplified - would fetch from user service)
	email := r.URL.Query().Get("email")
	if email == "" {
		httputil.RespondError(w, http.StatusBadRequest, "Email required")
		return
	}

	vc, err := h.service.SendEmailVerification(r.Context(), userID, email)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"expires_at": vc.ExpiresAt.Unix(),
	})
}

type VerifyEmailRequest struct {
	Token string `json:"token"`
}

// VerifyEmailCode verifies the email token
func (h *Handler) VerifyEmailCode(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	verification, err := h.service.VerifyEmailCode(r.Context(), userID, req.Token)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"status":  verification.Status,
	})
}

// SubmitIDVerification handles ID document submission
func (h *Handler) SubmitIDVerification(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	if err := r.ParseMultipartForm(20 << 20); err != nil { // 20MB max
		httputil.RespondError(w, http.StatusBadRequest, "File too large")
		return
	}

	frontFile, _, err := r.FormFile("front")
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Front image required")
		return
	}
	defer frontFile.Close()

	var backFile = func() interface{ Read([]byte) (int, error) } { return nil }()
	if bf, _, err := r.FormFile("back"); err == nil {
		backFile = bf
		defer bf.Close()
	}

	verification, err := h.service.SubmitIDVerification(r.Context(), userID, frontFile, backFile)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"verification_id": verification.ID,
		"status":          verification.Status,
	})
}

type SocialConnectRequest struct {
	Provider string `json:"provider"`
	Token    string `json:"token"`
}

// ConnectSocialAccount verifies via social login
func (h *Handler) ConnectSocialAccount(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req SocialConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if req.Provider == "" || req.Token == "" {
		httputil.RespondError(w, http.StatusBadRequest, "provider and token are required")
		return
	}

	profile, err := h.socialValidator.Validate(r.Context(), req.Provider, req.Token)
	if err != nil {
		status := http.StatusUnauthorized
		if errors.Is(err, ErrUnsupportedProvider) {
			status = http.StatusBadRequest
		}
		httputil.RespondError(w, status, err.Error())
		return
	}

	verification, err := h.service.ConnectSocialAccount(r.Context(), userID, req.Provider, profile.ID, profile.Email)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"status":  verification.Status,
	})
}

// Admin handlers

// GetPendingVerifications returns verifications awaiting review
func (h *Handler) GetPendingVerifications(w http.ResponseWriter, r *http.Request) {
	vType := VerificationType(r.URL.Query().Get("type"))
	limit := 50
	offset := 0

	verifications, count, err := h.service.GetPendingVerifications(r.Context(), vType, limit, offset)
	if err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]any{
		"verifications": verifications,
		"total":         count,
	})
}

type ReviewRequest struct {
	Approved bool   `json:"approved"`
	Reason   string `json:"reason,omitempty"`
}

// ReviewVerification allows admin to approve/reject
func (h *Handler) ReviewVerification(w http.ResponseWriter, r *http.Request) {
	verificationID := chi.URLParam(r, "verificationId")
	reviewerID := r.Context().Value("user_id").(string)

	var req ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.service.ReviewVerification(r.Context(), verificationID, reviewerID, req.Approved, req.Reason); err != nil {
		httputil.RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
}
