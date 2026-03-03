package marketplace

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func TestGetInventory_ParsesTypeAndPagination(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		store:    &mockMarketplaceStoreService{},
		purchase: &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryServiceWithFns{
			getInventoryFn: func(_ context.Context, gotUserID uuid.UUID, itemType *models.ItemType, limit, offset int) ([]models.InventoryItemWithDetails, error) {
				if gotUserID != userID {
					t.Fatalf("unexpected user id")
				}
				if itemType == nil || *itemType != models.ItemType("avatar") {
					t.Fatalf("expected avatar type filter, got %+v", itemType)
				}
				if limit != 50 || offset != 0 {
					t.Fatalf("unexpected pagination %d/%d", limit, offset)
				}
				return []models.InventoryItemWithDetails{}, nil
			},
		},
		creator: &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodGet, "/v1/inventory?type=avatar&limit=0&offset=-1", nil), userID)
	rec := httptest.NewRecorder()
	h.GetInventory(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetPurchaseHistory_DefaultPagination(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		store: &mockMarketplaceStoreService{},
		purchase: &mockMarketplacePurchaseService{
			getPurchaseHistoryFn: func(_ context.Context, gotUserID uuid.UUID, limit, offset int) ([]models.Purchase, error) {
				if gotUserID != userID {
					t.Fatalf("unexpected user id")
				}
				if limit != 20 || offset != 0 {
					t.Fatalf("expected default limit/offset 20/0, got %d/%d", limit, offset)
				}
				return []models.Purchase{}, nil
			},
		},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodGet, "/v1/store/purchases?limit=-1&offset=-5", nil), userID)
	rec := httptest.NewRecorder()
	h.GetPurchaseHistory(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestEquipItem_Validation(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/inventory/equip", bytes.NewBufferString(`{"item_id":"not-a-uuid"}`)), userID)
	rec := httptest.NewRecorder()
	h.EquipItem(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 invalid item id, got %d", rec.Code)
	}
}

// Dedicated override mock for inventory tests in this file.
type mockMarketplaceInventoryServiceWithFns struct {
	mockMarketplaceInventoryService
	getInventoryFn func(ctx context.Context, userID uuid.UUID, itemType *models.ItemType, limit, offset int) ([]models.InventoryItemWithDetails, error)
}

func (m *mockMarketplaceInventoryServiceWithFns) GetInventory(ctx context.Context, userID uuid.UUID, itemType *models.ItemType, limit, offset int) ([]models.InventoryItemWithDetails, error) {
	if m.getInventoryFn == nil {
		return m.mockMarketplaceInventoryService.GetInventory(ctx, userID, itemType, limit, offset)
	}
	return m.getInventoryFn(ctx, userID, itemType, limit, offset)
}
