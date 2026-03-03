package marketplace

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

type mockMarketplaceStoreService struct {
	getItemsFn           func(ctx context.Context, userID *uuid.UUID, filter ItemFilter, limit, offset int) ([]models.StoreItemPublic, int, error)
	getItemFn            func(ctx context.Context, userID *uuid.UUID, itemID uuid.UUID) (*models.StoreItemPublic, error)
	getFeaturedItemsFn   func(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error)
	getPopularItemsFn    func(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error)
	getCategoriesFn      func(ctx context.Context) ([]models.ItemCategory, error)
	getItemsByCategoryFn func(ctx context.Context, userID *uuid.UUID, slug string, limit, offset int) ([]models.StoreItemPublic, int, error)
	searchItemsFn        func(ctx context.Context, userID *uuid.UUID, query string, limit, offset int) ([]models.StoreItemPublic, int, error)
}

func (m *mockMarketplaceStoreService) GetItems(ctx context.Context, userID *uuid.UUID, filter ItemFilter, limit, offset int) ([]models.StoreItemPublic, int, error) {
	if m.getItemsFn == nil {
		return []models.StoreItemPublic{}, 0, nil
	}
	return m.getItemsFn(ctx, userID, filter, limit, offset)
}
func (m *mockMarketplaceStoreService) GetItem(ctx context.Context, userID *uuid.UUID, itemID uuid.UUID) (*models.StoreItemPublic, error) {
	if m.getItemFn == nil {
		return &models.StoreItemPublic{ID: itemID}, nil
	}
	return m.getItemFn(ctx, userID, itemID)
}
func (m *mockMarketplaceStoreService) GetFeaturedItems(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error) {
	if m.getFeaturedItemsFn == nil {
		return []models.StoreItemPublic{}, nil
	}
	return m.getFeaturedItemsFn(ctx, userID, limit)
}
func (m *mockMarketplaceStoreService) GetPopularItems(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error) {
	if m.getPopularItemsFn == nil {
		return []models.StoreItemPublic{}, nil
	}
	return m.getPopularItemsFn(ctx, userID, limit)
}
func (m *mockMarketplaceStoreService) GetCategories(ctx context.Context) ([]models.ItemCategory, error) {
	if m.getCategoriesFn == nil {
		return []models.ItemCategory{}, nil
	}
	return m.getCategoriesFn(ctx)
}
func (m *mockMarketplaceStoreService) GetItemsByCategory(ctx context.Context, userID *uuid.UUID, slug string, limit, offset int) ([]models.StoreItemPublic, int, error) {
	if m.getItemsByCategoryFn == nil {
		return []models.StoreItemPublic{}, 0, nil
	}
	return m.getItemsByCategoryFn(ctx, userID, slug, limit, offset)
}
func (m *mockMarketplaceStoreService) SearchItems(ctx context.Context, userID *uuid.UUID, query string, limit, offset int) ([]models.StoreItemPublic, int, error) {
	if m.searchItemsFn == nil {
		return []models.StoreItemPublic{}, 0, nil
	}
	return m.searchItemsFn(ctx, userID, query, limit, offset)
}

type mockMarketplacePurchaseService struct {
	initiatePurchaseFn   func(ctx context.Context, buyerID, itemID uuid.UUID) (*PurchaseResult, error)
	getPurchaseHistoryFn func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.Purchase, error)
	getPurchaseFn        func(ctx context.Context, userID, purchaseID uuid.UUID) (*PurchaseDetails, error)
	completeFn           func(ctx context.Context, stripePaymentID string) error
	failFn               func(ctx context.Context, stripePaymentID string) error
}

func (m *mockMarketplacePurchaseService) InitiatePurchase(ctx context.Context, buyerID, itemID uuid.UUID) (*PurchaseResult, error) {
	if m.initiatePurchaseFn == nil {
		return &PurchaseResult{PurchaseID: uuid.New(), Amount: 100, Currency: "usd"}, nil
	}
	return m.initiatePurchaseFn(ctx, buyerID, itemID)
}
func (m *mockMarketplacePurchaseService) GetPurchaseHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.Purchase, error) {
	if m.getPurchaseHistoryFn == nil {
		return []models.Purchase{}, nil
	}
	return m.getPurchaseHistoryFn(ctx, userID, limit, offset)
}
func (m *mockMarketplacePurchaseService) GetPurchase(ctx context.Context, userID, purchaseID uuid.UUID) (*PurchaseDetails, error) {
	if m.getPurchaseFn == nil {
		return &PurchaseDetails{}, nil
	}
	return m.getPurchaseFn(ctx, userID, purchaseID)
}
func (m *mockMarketplacePurchaseService) CompletePurchase(ctx context.Context, stripePaymentID string) error {
	if m.completeFn == nil {
		return nil
	}
	return m.completeFn(ctx, stripePaymentID)
}
func (m *mockMarketplacePurchaseService) FailPurchase(ctx context.Context, stripePaymentID string) error {
	if m.failFn == nil {
		return nil
	}
	return m.failFn(ctx, stripePaymentID)
}

type mockMarketplaceInventoryService struct{}

func (m *mockMarketplaceInventoryService) GetInventory(context.Context, uuid.UUID, *models.ItemType, int, int) ([]models.InventoryItemWithDetails, error) {
	return []models.InventoryItemWithDetails{}, nil
}
func (m *mockMarketplaceInventoryService) GetEquippedItems(context.Context, uuid.UUID) ([]models.InventoryItemWithDetails, error) {
	return []models.InventoryItemWithDetails{}, nil
}
func (m *mockMarketplaceInventoryService) EquipItem(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}
func (m *mockMarketplaceInventoryService) UnequipItem(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}
func (m *mockMarketplaceInventoryService) GetAssetBundle(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "bundle", nil
}

type mockMarketplaceCreatorService struct{}

func (m *mockMarketplaceCreatorService) CreateCreator(context.Context, uuid.UUID, *CreateCreatorRequest) (*models.Creator, error) {
	return &models.Creator{}, nil
}
func (m *mockMarketplaceCreatorService) GetCreator(context.Context, uuid.UUID) (*models.Creator, error) {
	return &models.Creator{}, nil
}
func (m *mockMarketplaceCreatorService) GetOnboardingLink(context.Context, uuid.UUID, string, string) (string, error) {
	return "https://connect.stripe.com/onboarding", nil
}
func (m *mockMarketplaceCreatorService) UpdateCreatorProfile(context.Context, uuid.UUID, *string, *string) (*models.Creator, error) {
	return &models.Creator{}, nil
}
func (m *mockMarketplaceCreatorService) GetCreatorEarnings(context.Context, uuid.UUID) (*EarningsSummary, error) {
	return &EarningsSummary{}, nil
}
func (m *mockMarketplaceCreatorService) GetCreatorItems(context.Context, uuid.UUID, *models.ItemStatus, int, int) ([]models.StoreItem, error) {
	return []models.StoreItem{}, nil
}
func (m *mockMarketplaceCreatorService) GetFeaturedCreators(context.Context, int) ([]models.Creator, error) {
	return []models.Creator{}, nil
}
func (m *mockMarketplaceCreatorService) GetCreatorByID(context.Context, uuid.UUID) (*models.Creator, error) {
	return &models.Creator{}, nil
}
func (m *mockMarketplaceCreatorService) UpdateOnboardingStatus(context.Context, string, bool) error {
	return nil
}
func (m *mockMarketplaceCreatorService) DisconnectStripeAccount(context.Context, string) error {
	return nil
}

func withMarketplaceUser(req *http.Request, userID uuid.UUID) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), userIDContextKey, userID))
}

func TestGetItems_PaginationAndFiltering(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		store: &mockMarketplaceStoreService{
			getItemsFn: func(_ context.Context, gotUserID *uuid.UUID, filter ItemFilter, limit, offset int) ([]models.StoreItemPublic, int, error) {
				if gotUserID == nil || *gotUserID != userID {
					t.Fatalf("expected user id")
				}
				if limit != 20 || offset != 20 {
					t.Fatalf("unexpected pagination limit=%d offset=%d", limit, offset)
				}
				if filter.Search != "helmet" {
					t.Fatalf("unexpected filter search: %+v", filter)
				}
				return []models.StoreItemPublic{}, 0, nil
			},
		},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodGet, "/v1/store/items?search=helmet&limit=20&offset=20", nil), userID)
	rec := httptest.NewRecorder()
	h.GetItems(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetItem_NotFound(t *testing.T) {
	h := &Handler{
		store: &mockMarketplaceStoreService{
			getItemFn: func(context.Context, *uuid.UUID, uuid.UUID) (*models.StoreItemPublic, error) {
				return nil, ErrItemNotFound
			},
		},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	r := chi.NewRouter()
	r.Get("/v1/store/items/{itemID}", h.GetItem)
	req := httptest.NewRequest(http.MethodGet, "/v1/store/items/"+uuid.NewString(), nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestGetFeaturedItems_ResponseShape(t *testing.T) {
	h := &Handler{
		store: &mockMarketplaceStoreService{
			getFeaturedItemsFn: func(context.Context, *uuid.UUID, int) ([]models.StoreItemPublic, error) {
				return []models.StoreItemPublic{}, nil
			},
		},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/store/featured", nil)
	rec := httptest.NewRecorder()
	h.GetFeaturedItems(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestInitiatePurchase_ErrorPaths(t *testing.T) {
	buyerID := uuid.New()
	itemID := uuid.New()
	h := &Handler{
		store: &mockMarketplaceStoreService{},
		purchase: &mockMarketplacePurchaseService{
			initiatePurchaseFn: func(_ context.Context, _, _ uuid.UUID) (*PurchaseResult, error) {
				return nil, ErrAlreadyOwned
			},
		},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/store/purchase", bytes.NewBufferString(`{"item_id":"`+itemID.String()+`"}`)), buyerID)
	rec := httptest.NewRecorder()
	h.InitiatePurchase(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}

	h.purchase = &mockMarketplacePurchaseService{
		initiatePurchaseFn: func(_ context.Context, _, _ uuid.UUID) (*PurchaseResult, error) {
			return nil, ErrItemUnavailable
		},
	}
	rec2 := httptest.NewRecorder()
	h.InitiatePurchase(rec2, req)
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec2.Code)
	}
}

func TestBecomeCreator_Validation(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/creators", bytes.NewBufferString(`{"store_name":""}`)), userID)
	rec := httptest.NewRecorder()
	h.BecomeCreator(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}
