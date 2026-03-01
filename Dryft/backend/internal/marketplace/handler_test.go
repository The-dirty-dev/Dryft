package marketplace

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func setUser(req *http.Request, uid uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), userIDContextKey, uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// getUserIDFromContext / getRequiredUserID
// ---------------------------------------------------------------------------

func TestGetUserIDFromContext_WithID(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUser(req, uid)

	got := getUserIDFromContext(req)
	if got == nil {
		t.Fatal("expected non-nil user ID")
	}
	if *got != uid {
		t.Errorf("got %v, want %v", *got, uid)
	}
}

func TestGetUserIDFromContext_NoID(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := getUserIDFromContext(req)
	if got != nil {
		t.Errorf("expected nil, got %v", *got)
	}
}

func TestGetRequiredUserID_NoAuth(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()

	got := getRequiredUserID(req, rr)
	if got != nil {
		t.Errorf("expected nil, got %v", *got)
	}
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetRequiredUserID_WithAuth(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	got := getRequiredUserID(req, rr)
	if got == nil {
		t.Fatal("expected non-nil user ID")
	}
	if *got != uid {
		t.Errorf("got %v, want %v", *got, uid)
	}
}

// ---------------------------------------------------------------------------
// Auth checks (no user ID -> 401)
// ---------------------------------------------------------------------------

func TestInitiatePurchase_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("POST", "/v1/store/purchase", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.InitiatePurchase(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetPurchaseHistory_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("GET", "/v1/store/purchases", nil)
	rr := httptest.NewRecorder()

	h.GetPurchaseHistory(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetInventory_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("GET", "/v1/inventory", nil)
	rr := httptest.NewRecorder()

	h.GetInventory(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetEquippedItems_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("GET", "/v1/inventory/equipped", nil)
	rr := httptest.NewRecorder()

	h.GetEquippedItems(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestEquipItem_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("POST", "/v1/inventory/equip", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.EquipItem(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUnequipItem_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("POST", "/v1/inventory/unequip", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UnequipItem(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestBecomeCreator_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("POST", "/v1/creators", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.BecomeCreator(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetMyCreatorAccount_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("GET", "/v1/creators/me", nil)
	rr := httptest.NewRecorder()

	h.GetMyCreatorAccount(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetMyEarnings_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("GET", "/v1/creators/earnings", nil)
	rr := httptest.NewRecorder()

	h.GetMyEarnings(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetMyItems_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("GET", "/v1/creators/items", nil)
	rr := httptest.NewRecorder()

	h.GetMyItems(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Invalid JSON body -> 400
// ---------------------------------------------------------------------------

func TestInitiatePurchase_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/store/purchase", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.InitiatePurchase(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestInitiatePurchase_InvalidItemID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/store/purchase",
		strings.NewReader(`{"item_id":"not-a-uuid"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.InitiatePurchase(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestEquipItem_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/inventory/equip", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.EquipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestEquipItem_InvalidItemID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/inventory/equip",
		strings.NewReader(`{"item_id":"bad"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.EquipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUnequipItem_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/inventory/unequip", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UnequipItem(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestBecomeCreator_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/creators", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.BecomeCreator(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestBecomeCreator_EmptyStoreName(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/creators",
		strings.NewReader(`{"store_name":""}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.BecomeCreator(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetOnboardingLink_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("POST", "/v1/creators/onboarding-link",
		strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.GetOnboardingLink(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetOnboardingLink_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/creators/onboarding-link",
		strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.GetOnboardingLink(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetOnboardingLink_MissingURLs(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/v1/creators/onboarding-link",
		strings.NewReader(`{"return_url":"https://example.com"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.GetOnboardingLink(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestUpdateCreatorProfile_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	req := httptest.NewRequest("PATCH", "/v1/creators/me", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.UpdateCreatorProfile(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestUpdateCreatorProfile_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	uid := uuid.New()
	req := httptest.NewRequest("PATCH", "/v1/creators/me", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()

	h.UpdateCreatorProfile(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Invalid UUID in URL params
// ---------------------------------------------------------------------------

func TestGetItem_InvalidUUID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/items/{itemID}", h.GetItem)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/items/bad-uuid", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetPurchase_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/purchases/{purchaseID}", h.GetPurchase)

	pid := uuid.New().String()
	req := httptest.NewRequest("GET", "/purchases/"+pid, nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetPurchase_InvalidUUID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/purchases/{purchaseID}", h.GetPurchase)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/purchases/bad-uuid", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetAssetBundle_NoAuth(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/inventory/{itemID}/asset", h.GetAssetBundle)

	iid := uuid.New().String()
	req := httptest.NewRequest("GET", "/inventory/"+iid+"/asset", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetAssetBundle_InvalidUUID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/inventory/{itemID}/asset", h.GetAssetBundle)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/inventory/bad-uuid/asset", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetCreator_InvalidUUID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/creators/{creatorID}", h.GetCreator)

	req := httptest.NewRequest("GET", "/creators/bad-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetCreatorItems_InvalidUUID(t *testing.T) {
	h := NewHandler(nil, nil, nil, nil, nil)
	r := chi.NewRouter()
	r.Get("/creators/{creatorID}/items", h.GetCreatorItems)

	req := httptest.NewRequest("GET", "/creators/bad-uuid/items", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// parseItemFilter
// ---------------------------------------------------------------------------

func TestParseItemFilter_Empty(t *testing.T) {
	req := httptest.NewRequest("GET", "/items", nil)
	filter := parseItemFilter(req)

	if filter.Type != nil {
		t.Error("expected nil Type")
	}
	if filter.Search != "" {
		t.Error("expected empty Search")
	}
	if filter.Tags != nil {
		t.Error("expected nil Tags")
	}
}

func TestParseItemFilter_WithParams(t *testing.T) {
	req := httptest.NewRequest("GET", "/items?type=avatar&search=cool&tags=new,hot&min_price=100&max_price=1000&featured=true&sort_by=price&sort_order=asc", nil)
	filter := parseItemFilter(req)

	if filter.Type == nil || string(*filter.Type) != "avatar" {
		t.Error("expected type 'avatar'")
	}
	if filter.Search != "cool" {
		t.Errorf("expected search 'cool', got %q", filter.Search)
	}
	if len(filter.Tags) != 2 || filter.Tags[0] != "new" || filter.Tags[1] != "hot" {
		t.Errorf("expected tags [new, hot], got %v", filter.Tags)
	}
	if filter.MinPrice == nil || *filter.MinPrice != 100 {
		t.Error("expected min_price 100")
	}
	if filter.MaxPrice == nil || *filter.MaxPrice != 1000 {
		t.Error("expected max_price 1000")
	}
	if filter.Featured == nil || !*filter.Featured {
		t.Error("expected featured true")
	}
	if filter.SortBy != "price" {
		t.Errorf("expected sort_by 'price', got %q", filter.SortBy)
	}
	if filter.SortOrder != "asc" {
		t.Errorf("expected sort_order 'asc', got %q", filter.SortOrder)
	}
}

func TestParseItemFilter_WithCreatorAndCategory(t *testing.T) {
	cid := uuid.New()
	catid := uuid.New()
	req := httptest.NewRequest("GET", "/items?creator_id="+cid.String()+"&category_id="+catid.String(), nil)
	filter := parseItemFilter(req)

	if filter.CreatorID == nil || *filter.CreatorID != cid {
		t.Error("expected creator_id to match")
	}
	if filter.CategoryID == nil || *filter.CategoryID != catid {
		t.Error("expected category_id to match")
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errs := map[error]string{
		ErrItemNotFound:         "item not found",
		ErrCategoryNotFound:     "category not found",
		ErrNotItemOwner:         "you don't own this item",
		ErrAlreadyOwned:         "you already own this item",
		ErrItemUnavailable:      "item is not available for purchase",
		ErrPaymentFailed:        "payment failed",
		ErrInvalidPayment:       "invalid payment",
		ErrPurchaseNotFound:     "purchase not found",
		ErrInventoryItemNotFound: "inventory item not found",
		ErrCreatorNotFound:      "creator account not found",
		ErrAlreadyCreator:       "user already has a creator account",
		ErrCreatorNotOnboarded:  "creator has not completed Stripe onboarding",
		ErrStoreNameTaken:       "store name is already taken",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// Request struct JSON
// ---------------------------------------------------------------------------

func TestPurchaseItemRequest_JSON(t *testing.T) {
	req := PurchaseItemRequest{ItemID: uuid.New().String()}
	data, _ := json.Marshal(req)
	var decoded PurchaseItemRequest
	json.Unmarshal(data, &decoded)
	if decoded.ItemID == "" {
		t.Error("expected non-empty item_id")
	}
}

func TestEquipItemRequest_JSON(t *testing.T) {
	req := EquipItemRequest{ItemID: uuid.New().String()}
	data, _ := json.Marshal(req)
	var decoded EquipItemRequest
	json.Unmarshal(data, &decoded)
	if decoded.ItemID == "" {
		t.Error("expected non-empty item_id")
	}
}

func TestCreateCreatorRequest_JSON(t *testing.T) {
	desc := "My awesome store"
	req := CreateCreatorRequest{StoreName: "TestStore", Description: &desc}
	data, _ := json.Marshal(req)
	var decoded CreateCreatorRequest
	json.Unmarshal(data, &decoded)
	if decoded.StoreName != "TestStore" {
		t.Errorf("expected 'TestStore', got %q", decoded.StoreName)
	}
}

func TestOnboardingLinkRequest_JSON(t *testing.T) {
	req := OnboardingLinkRequest{
		ReturnURL:  "https://example.com/return",
		RefreshURL: "https://example.com/refresh",
	}
	data, _ := json.Marshal(req)
	var decoded OnboardingLinkRequest
	json.Unmarshal(data, &decoded)
	if decoded.ReturnURL != "https://example.com/return" {
		t.Errorf("unexpected return_url: %q", decoded.ReturnURL)
	}
}
