package subscription

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

type mockSubscriptionHandlerService struct {
	getSubscriptionFn             func(ctx context.Context, userID string) (*Subscription, error)
	getUserCreditsFn              func(ctx context.Context, userID string) (*UserCredits, error)
	getEntitlementsFn             func(ctx context.Context, userID string) (Entitlements, error)
	getUserTierFn                 func(ctx context.Context, userID string) (Tier, error)
	verifyAndCreateSubscriptionFn func(ctx context.Context, userID, productID, receipt string, platform Platform) (*Subscription, error)
	cancelSubscriptionFn          func(ctx context.Context, userID string) error
	useBoostFn                    func(ctx context.Context, userID string) (int, error)
	useSuperLikeFn                func(ctx context.Context, userID string) (int, error)
	useLikeFn                     func(ctx context.Context, userID string) (int, error)
	hasEntitlementFn              func(ctx context.Context, userID string, entitlement string) (bool, error)
}

func (m *mockSubscriptionHandlerService) GetSubscription(ctx context.Context, userID string) (*Subscription, error) {
	if m.getSubscriptionFn == nil {
		return nil, nil
	}
	return m.getSubscriptionFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) GetUserCredits(ctx context.Context, userID string) (*UserCredits, error) {
	if m.getUserCreditsFn == nil {
		return nil, nil
	}
	return m.getUserCreditsFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) GetEntitlements(ctx context.Context, userID string) (Entitlements, error) {
	if m.getEntitlementsFn == nil {
		return TierEntitlements[TierFree], nil
	}
	return m.getEntitlementsFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) GetUserTier(ctx context.Context, userID string) (Tier, error) {
	if m.getUserTierFn == nil {
		return TierFree, nil
	}
	return m.getUserTierFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) VerifyAndCreateSubscription(ctx context.Context, userID, productID, receipt string, platform Platform) (*Subscription, error) {
	if m.verifyAndCreateSubscriptionFn == nil {
		return nil, nil
	}
	return m.verifyAndCreateSubscriptionFn(ctx, userID, productID, receipt, platform)
}

func (m *mockSubscriptionHandlerService) CancelSubscription(ctx context.Context, userID string) error {
	if m.cancelSubscriptionFn == nil {
		return nil
	}
	return m.cancelSubscriptionFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) UseBoost(ctx context.Context, userID string) (int, error) {
	if m.useBoostFn == nil {
		return 0, nil
	}
	return m.useBoostFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) UseSuperLike(ctx context.Context, userID string) (int, error) {
	if m.useSuperLikeFn == nil {
		return 0, nil
	}
	return m.useSuperLikeFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) UseLike(ctx context.Context, userID string) (int, error) {
	if m.useLikeFn == nil {
		return 0, nil
	}
	return m.useLikeFn(ctx, userID)
}

func (m *mockSubscriptionHandlerService) HasEntitlement(ctx context.Context, userID string, entitlement string) (bool, error) {
	if m.hasEntitlementFn == nil {
		return false, nil
	}
	return m.hasEntitlementFn(ctx, userID, entitlement)
}

func setSubscriptionUser(req *http.Request, userID string) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), "user_id", userID))
}

func TestGetStatus_Success(t *testing.T) {
	userID := "user-1"
	expiresAt := time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
	purchaseDate := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)

	h := &Handler{
		service: &mockSubscriptionHandlerService{
			getSubscriptionFn: func(_ context.Context, gotUserID string) (*Subscription, error) {
				if gotUserID != userID {
					t.Fatalf("unexpected user id: %s", gotUserID)
				}
				return &Subscription{
					Tier:         TierPlus,
					ProductID:    "com.dryft.plus.monthly",
					Platform:     PlatformIOS,
					ExpiresAt:    expiresAt,
					PurchaseDate: purchaseDate,
					WillRenew:    true,
				}, nil
			},
			getUserCreditsFn: func(context.Context, string) (*UserCredits, error) {
				return &UserCredits{
					Boosts:              2,
					SuperLikes:          1,
					DailyLikesUsed:      10,
					DailySuperLikesUsed: 1,
				}, nil
			},
			getEntitlementsFn: func(context.Context, string) (Entitlements, error) {
				return TierEntitlements[TierPlus], nil
			},
			getUserTierFn: func(context.Context, string) (Tier, error) {
				return TierPlus, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/subscriptions/status", nil)
	req = setSubscriptionUser(req, userID)
	rec := httptest.NewRecorder()
	h.GetStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body StatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Tier != string(TierPlus) {
		t.Fatalf("expected tier=%s, got %s", TierPlus, body.Tier)
	}
	if body.Subscription == nil || body.Subscription.ProductID != "com.dryft.plus.monthly" {
		t.Fatalf("unexpected subscription payload: %+v", body.Subscription)
	}
}

func TestVerifyPurchase_Success(t *testing.T) {
	userID := "user-2"
	expiresAt := time.Date(2026, 12, 1, 10, 0, 0, 0, time.UTC)

	h := &Handler{
		service: &mockSubscriptionHandlerService{
			verifyAndCreateSubscriptionFn: func(_ context.Context, gotUserID, productID, receipt string, platform Platform) (*Subscription, error) {
				if gotUserID != userID || productID != "com.dryft.vip.monthly" || receipt != "r-123" || platform != PlatformIOS {
					t.Fatalf("unexpected verify args")
				}
				return &Subscription{
					Tier:      TierVIP,
					ExpiresAt: expiresAt,
				}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions/verify", strings.NewReader(`{"product_id":"com.dryft.vip.monthly","receipt":"r-123","platform":"ios"}`))
	req = setSubscriptionUser(req, userID)
	rec := httptest.NewRecorder()
	h.VerifyPurchase(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if ok, _ := body["success"].(bool); !ok {
		t.Fatalf("expected success=true, got %+v", body)
	}
}

func TestCancelSubscription_Success(t *testing.T) {
	userID := "user-3"
	h := &Handler{
		service: &mockSubscriptionHandlerService{
			cancelSubscriptionFn: func(_ context.Context, gotUserID string) error {
				if gotUserID != userID {
					t.Fatalf("unexpected user id: %s", gotUserID)
				}
				return nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions/cancel", nil)
	req = setSubscriptionUser(req, userID)
	rec := httptest.NewRecorder()
	h.CancelSubscription(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestUseBoost_InsufficientCredits(t *testing.T) {
	h := &Handler{
		service: &mockSubscriptionHandlerService{
			useBoostFn: func(context.Context, string) (int, error) {
				return 0, ErrInsufficientCredits
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/subscriptions/use-boost", nil)
	req = setSubscriptionUser(req, "user-4")
	rec := httptest.NewRecorder()
	h.UseBoost(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Fatalf("expected 402, got %d", rec.Code)
	}
}

func TestGetEntitlements_Success(t *testing.T) {
	userID := "user-5"
	h := &Handler{
		service: &mockSubscriptionHandlerService{
			getEntitlementsFn: func(_ context.Context, gotUserID string) (Entitlements, error) {
				if gotUserID != userID {
					t.Fatalf("unexpected user id: %s", gotUserID)
				}
				return TierEntitlements[TierPremium], nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/subscriptions/entitlements", nil)
	req = setSubscriptionUser(req, userID)
	rec := httptest.NewRecorder()
	h.GetEntitlements(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestHasEntitlement_Success(t *testing.T) {
	userID := "user-6"
	h := &Handler{
		service: &mockSubscriptionHandlerService{
			hasEntitlementFn: func(_ context.Context, gotUserID string, entitlement string) (bool, error) {
				if gotUserID != userID || entitlement != "rewind" {
					t.Fatalf("unexpected entitlement request")
				}
				return true, nil
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/v1/subscriptions/has/{entitlement}", h.HasEntitlement)

	req := httptest.NewRequest(http.MethodGet, "/v1/subscriptions/has/rewind", nil)
	req = setSubscriptionUser(req, userID)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
