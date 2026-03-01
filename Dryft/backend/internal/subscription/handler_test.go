package subscription

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// userIDMiddleware injects a user_id into request context for testing.
func userIDMiddleware(uid string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

func TestRegisterRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/subscriptions/status"},
		{"GET", "/subscriptions/entitlements"},
		{"POST", "/subscriptions/verify"},
		{"POST", "/subscriptions/restore"},
		{"POST", "/subscriptions/cancel"},
		{"POST", "/subscriptions/use-boost"},
		{"POST", "/subscriptions/use-super-like"},
		{"POST", "/subscriptions/use-like"},
		{"GET", "/subscriptions/has/rewind"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errs := map[error]string{
		ErrSubscriptionNotFound: "subscription not found",
		ErrInvalidReceipt:       "invalid receipt",
		ErrAlreadySubscribed:    "already subscribed",
		ErrInsufficientCredits:  "insufficient credits",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// Tier / Platform constants
// ---------------------------------------------------------------------------

func TestTier_Values(t *testing.T) {
	tiers := map[Tier]string{
		TierFree:    "free",
		TierPlus:    "plus",
		TierPremium: "premium",
		TierVIP:     "vip",
	}
	for tier, expected := range tiers {
		if string(tier) != expected {
			t.Errorf("expected %q, got %q", expected, string(tier))
		}
	}
}

func TestPlatform_Values(t *testing.T) {
	if string(PlatformIOS) != "ios" {
		t.Errorf("expected 'ios', got %q", string(PlatformIOS))
	}
	if string(PlatformAndroid) != "android" {
		t.Errorf("expected 'android', got %q", string(PlatformAndroid))
	}
}

// ---------------------------------------------------------------------------
// TierEntitlements
// ---------------------------------------------------------------------------

func TestTierEntitlements_Free(t *testing.T) {
	e := TierEntitlements[TierFree]
	if e.DailyLikes != 50 {
		t.Errorf("expected 50 daily likes, got %d", e.DailyLikes)
	}
	if e.DailySuperLikes != 1 {
		t.Errorf("expected 1 daily super like, got %d", e.DailySuperLikes)
	}
	if !e.VRAccess {
		t.Error("expected VR access for free tier")
	}
	if e.Rewind {
		t.Error("expected no rewind for free tier")
	}
}

func TestTierEntitlements_Plus(t *testing.T) {
	e := TierEntitlements[TierPlus]
	if e.DailyLikes != -1 {
		t.Errorf("expected unlimited daily likes (-1), got %d", e.DailyLikes)
	}
	if !e.Rewind {
		t.Error("expected rewind for plus tier")
	}
	if !e.SeeWhoLikesYou {
		t.Error("expected see_who_likes_you for plus tier")
	}
	if e.PrivateVRRooms {
		t.Error("expected no private VR rooms for plus tier")
	}
}

func TestTierEntitlements_Premium(t *testing.T) {
	e := TierEntitlements[TierPremium]
	if e.DailySuperLikes != -1 {
		t.Errorf("expected unlimited super likes (-1), got %d", e.DailySuperLikes)
	}
	if !e.PrivateVRRooms {
		t.Error("expected private VR rooms for premium tier")
	}
	if !e.CustomAvatars {
		t.Error("expected custom avatars for premium tier")
	}
	if !e.IncognitoMode {
		t.Error("expected incognito mode for premium tier")
	}
	if e.PrioritySupport {
		t.Error("expected no priority support for premium tier")
	}
}

func TestTierEntitlements_VIP(t *testing.T) {
	e := TierEntitlements[TierVIP]
	if e.MonthlyBoosts != 5 {
		t.Errorf("expected 5 monthly boosts, got %d", e.MonthlyBoosts)
	}
	if !e.PrioritySupport {
		t.Error("expected priority support for VIP tier")
	}
	if !e.IncognitoMode {
		t.Error("expected incognito mode for VIP tier")
	}
}

// ---------------------------------------------------------------------------
// VerifyPurchase – validation (with auth middleware)
// ---------------------------------------------------------------------------

func TestVerifyPurchase_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/subscriptions/verify", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestVerifyPurchase_InvalidPlatform(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/subscriptions/verify",
		strings.NewReader(`{"product_id":"com.dryft.plus","receipt":"abc","platform":"windows"}`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestRestorePurchases_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/subscriptions/restore", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// getTierFromProductID
// ---------------------------------------------------------------------------

func TestGetTierFromProductID(t *testing.T) {
	tests := []struct {
		productID string
		expected  Tier
	}{
		{"com.dryft.vip.monthly", TierVIP},
		{"com.dryft.premium.yearly", TierPremium},
		{"com.dryft.plus.monthly", TierPlus},
		{"com.dryft.unknown", TierFree},
		{"", TierFree},
	}
	for _, tt := range tests {
		got := getTierFromProductID(tt.productID)
		if got != tt.expected {
			t.Errorf("getTierFromProductID(%q) = %q, want %q", tt.productID, got, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// Request/Response struct JSON
// ---------------------------------------------------------------------------

func TestVerifyRequest_JSON(t *testing.T) {
	req := VerifyRequest{
		ProductID: "com.dryft.plus",
		Receipt:   "abc123",
		Platform:  "ios",
	}
	data, _ := json.Marshal(req)
	var decoded VerifyRequest
	json.Unmarshal(data, &decoded)

	if decoded.ProductID != "com.dryft.plus" {
		t.Errorf("expected 'com.dryft.plus', got %q", decoded.ProductID)
	}
	if decoded.Platform != "ios" {
		t.Errorf("expected 'ios', got %q", decoded.Platform)
	}
}

func TestStatusResponse_JSON(t *testing.T) {
	resp := StatusResponse{
		Tier:                "plus",
		BoostsRemaining:     3,
		SuperLikesRemaining: 5,
		DailyLikesRemaining: -1,
		Entitlements:        TierEntitlements[TierPlus],
	}

	data, _ := json.Marshal(resp)
	var decoded StatusResponse
	json.Unmarshal(data, &decoded)

	if decoded.Tier != "plus" {
		t.Errorf("expected 'plus', got %q", decoded.Tier)
	}
	if decoded.BoostsRemaining != 3 {
		t.Errorf("expected 3, got %d", decoded.BoostsRemaining)
	}
	if decoded.DailyLikesRemaining != -1 {
		t.Errorf("expected -1, got %d", decoded.DailyLikesRemaining)
	}
}

func TestSubscriptionInfo_JSON(t *testing.T) {
	info := SubscriptionInfo{
		Tier:         "premium",
		ProductID:    "com.dryft.premium.yearly",
		ExpiresAt:    "2025-12-31T23:59:59Z",
		WillRenew:    true,
		PurchaseDate: "2025-01-01T00:00:00Z",
		Platform:     "ios",
	}

	data, _ := json.Marshal(info)
	var decoded SubscriptionInfo
	json.Unmarshal(data, &decoded)

	if decoded.Tier != "premium" {
		t.Errorf("expected 'premium', got %q", decoded.Tier)
	}
	if !decoded.WillRenew {
		t.Error("expected will_renew=true")
	}
}

func TestEntitlements_JSON(t *testing.T) {
	e := Entitlements{
		DailyLikes:      -1,
		DailySuperLikes: 5,
		Rewind:          true,
		VRAccess:        true,
	}

	data, _ := json.Marshal(e)
	var decoded Entitlements
	json.Unmarshal(data, &decoded)

	if decoded.DailyLikes != -1 {
		t.Errorf("expected -1, got %d", decoded.DailyLikes)
	}
	if !decoded.Rewind {
		t.Error("expected rewind=true")
	}
}

// ---------------------------------------------------------------------------
// generateUUID
// ---------------------------------------------------------------------------

func TestGenerateUUID_Unique(t *testing.T) {
	ids := make(map[string]bool)
	for i := 0; i < 50; i++ {
		id := generateUUID()
		if ids[id] {
			t.Errorf("duplicate UUID: %s", id)
		}
		ids[id] = true
	}
}

// ---------------------------------------------------------------------------
// contains helper
// ---------------------------------------------------------------------------

func TestContains(t *testing.T) {
	tests := []struct {
		s, substr string
		expected  bool
	}{
		{"com.dryft.plus.monthly", "plus", true},
		{"com.dryft.premium.yearly", "premium", true},
		{"com.dryft.free", "vip", false},
		{"", "plus", false},
		{"plus", "plus", true},
	}
	for _, tt := range tests {
		got := contains(tt.s, tt.substr)
		if got != tt.expected {
			t.Errorf("contains(%q, %q) = %v, want %v", tt.s, tt.substr, got, tt.expected)
		}
	}
}
