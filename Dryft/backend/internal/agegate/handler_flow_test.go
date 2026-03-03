package agegate

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dryft-app/backend/internal/models"
	"github.com/google/uuid"
)

type mockAgegateHandlerService struct {
	initiateCardFn func(ctx context.Context, userID uuid.UUID, email string) (*models.CardVerificationInitResponse, error)
	confirmCardFn  func(ctx context.Context, userID uuid.UUID, setupIntentID string) error
	initiateIDFn   func(ctx context.Context, userID uuid.UUID, callbackURL string) (*models.IDVerificationInitResponse, error)
	webhookFn      func(ctx context.Context, payload []byte, signature string) error
	statusFn       func(ctx context.Context, userID uuid.UUID) (*models.VerificationStatusResponse, error)
	retryFn        func(ctx context.Context, userID uuid.UUID) error
}

func (m *mockAgegateHandlerService) InitiateCardVerification(ctx context.Context, userID uuid.UUID, email string) (*models.CardVerificationInitResponse, error) {
	if m.initiateCardFn == nil {
		return &models.CardVerificationInitResponse{ClientSecret: "secret"}, nil
	}
	return m.initiateCardFn(ctx, userID, email)
}
func (m *mockAgegateHandlerService) ConfirmCardVerification(ctx context.Context, userID uuid.UUID, setupIntentID string) error {
	if m.confirmCardFn == nil {
		return nil
	}
	return m.confirmCardFn(ctx, userID, setupIntentID)
}
func (m *mockAgegateHandlerService) InitiateIDVerification(ctx context.Context, userID uuid.UUID, callbackURL string) (*models.IDVerificationInitResponse, error) {
	if m.initiateIDFn == nil {
		return &models.IDVerificationInitResponse{RedirectURL: "https://jumio.example/redirect"}, nil
	}
	return m.initiateIDFn(ctx, userID, callbackURL)
}
func (m *mockAgegateHandlerService) HandleJumioWebhook(ctx context.Context, payload []byte, signature string) error {
	if m.webhookFn == nil {
		return nil
	}
	return m.webhookFn(ctx, payload, signature)
}
func (m *mockAgegateHandlerService) GetVerificationStatus(ctx context.Context, userID uuid.UUID) (*models.VerificationStatusResponse, error) {
	if m.statusFn == nil {
		return &models.VerificationStatusResponse{Status: models.VerificationStatusVerified, CardVerified: true}, nil
	}
	return m.statusFn(ctx, userID)
}
func (m *mockAgegateHandlerService) RetryVerification(ctx context.Context, userID uuid.UUID) error {
	if m.retryFn == nil {
		return nil
	}
	return m.retryFn(ctx, userID)
}

func withAgegateUser(req *http.Request, userID uuid.UUID, email string) *http.Request {
	ctx := context.WithValue(req.Context(), userIDKey, userID)
	ctx = context.WithValue(ctx, userEmailKey, email)
	return req.WithContext(ctx)
}

func TestInitiateCardVerification_Success(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockAgegateHandlerService{
		initiateCardFn: func(_ context.Context, gotUserID uuid.UUID, email string) (*models.CardVerificationInitResponse, error) {
			if gotUserID != userID || email != "u@dryft.site" {
				t.Fatalf("unexpected initiate args")
			}
			return &models.CardVerificationInitResponse{ClientSecret: "secret"}, nil
		},
	}}

	req := withAgegateUser(httptest.NewRequest(http.MethodPost, "/age-gate/card/initiate", nil), userID, "u@dryft.site")
	rec := httptest.NewRecorder()
	h.InitiateCardVerification(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestInitiateIDVerification_Success(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockAgegateHandlerService{
		initiateIDFn: func(_ context.Context, gotUserID uuid.UUID, callbackURL string) (*models.IDVerificationInitResponse, error) {
			if gotUserID != userID || callbackURL == "" {
				t.Fatalf("unexpected id verification args")
			}
			return &models.IDVerificationInitResponse{RedirectURL: "https://jumio.example/r"}, nil
		},
	}}

	req := withAgegateUser(httptest.NewRequest(http.MethodPost, "http://api.dryft.site/v1/age-gate/id/initiate", nil), userID, "u@dryft.site")
	rec := httptest.NewRecorder()
	h.InitiateIDVerification(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestConfirmCardVerification_Success(t *testing.T) {
	userID := uuid.New()
	h := &Handler{service: &mockAgegateHandlerService{
		confirmCardFn: func(_ context.Context, gotUserID uuid.UUID, setupIntentID string) error {
			if gotUserID != userID || setupIntentID != "seti_123" {
				t.Fatalf("unexpected confirm args")
			}
			return nil
		},
	}}

	req := withAgegateUser(httptest.NewRequest(http.MethodPost, "/age-gate/card/confirm", bytes.NewBufferString(`{"setup_intent_id":"seti_123"}`)), userID, "u@dryft.site")
	rec := httptest.NewRecorder()
	h.ConfirmCardVerification(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
