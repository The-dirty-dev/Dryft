package marketplace

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/config"
)

func TestInitiatePurchase_ValidationErrors(t *testing.T) {
	h := &Handler{
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	userID := uuid.New()
	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/store/purchase", bytes.NewBufferString(`{"item_id":`)), userID)
	rec := httptest.NewRecorder()
	h.InitiatePurchase(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 invalid json, got %d", rec.Code)
	}

	req2 := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/store/purchase", bytes.NewBufferString(`{"item_id":"not-a-uuid"}`)), userID)
	rec2 := httptest.NewRecorder()
	h.InitiatePurchase(rec2, req2)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 invalid uuid, got %d", rec2.Code)
	}
}

func TestInitiatePurchase_SuccessAndInsufficientBalancePath(t *testing.T) {
	buyerID := uuid.New()
	itemID := uuid.New()
	h := &Handler{
		store: &mockMarketplaceStoreService{},
		purchase: &mockMarketplacePurchaseService{
			initiatePurchaseFn: func(_ context.Context, _ uuid.UUID, _ uuid.UUID) (*PurchaseResult, error) {
				return &PurchaseResult{PurchaseID: uuid.New(), Amount: 1200, Currency: "usd", ClientSecret: "pi_secret"}, nil
			},
		},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/store/purchase", bytes.NewBufferString(`{"item_id":"`+itemID.String()+`"}`)), buyerID)
	rec := httptest.NewRecorder()
	h.InitiatePurchase(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on success, got %d", rec.Code)
	}

	h.purchase = &mockMarketplacePurchaseService{
		initiatePurchaseFn: func(_ context.Context, _ uuid.UUID, _ uuid.UUID) (*PurchaseResult, error) {
			// Closest current path to insufficient funds in this handler.
			return nil, ErrItemUnavailable
		},
	}
	rec2 := httptest.NewRecorder()
	h.InitiatePurchase(rec2, req)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unavailable/insufficient path, got %d", rec2.Code)
	}
}

func TestStripeWebhook_InvalidSignature(t *testing.T) {
	h := &Handler{
		cfg:       &config.Config{StripeWebhookSecret: "whsec_test"},
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/webhooks/stripe/marketplace", bytes.NewBufferString(`{"id":"evt_1"}`))
	req.Header.Set("Stripe-Signature", "invalid")
	rec := httptest.NewRecorder()
	h.HandleStripeWebhook(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 invalid signature, got %d", rec.Code)
	}
}
