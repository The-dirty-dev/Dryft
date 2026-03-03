package marketplace

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func TestParseItemFilter_MultipleFilters(t *testing.T) {
	creatorID := uuid.New()
	categoryID := uuid.New()
	req := httptest.NewRequest(http.MethodGet,
		"/v1/store/items?type=avatar&creator_id="+creatorID.String()+"&category_id="+categoryID.String()+"&min_price=100&max_price=500&tags=vr,featured&search=helmet&featured=true&sort_by=price&sort_order=desc",
		nil,
	)

	filter := parseItemFilter(req)
	if filter.Type == nil || *filter.Type != models.ItemType("avatar") {
		t.Fatalf("unexpected type filter: %+v", filter.Type)
	}
	if filter.CreatorID == nil || *filter.CreatorID != creatorID {
		t.Fatalf("unexpected creator filter: %+v", filter.CreatorID)
	}
	if filter.CategoryID == nil || *filter.CategoryID != categoryID {
		t.Fatalf("unexpected category filter: %+v", filter.CategoryID)
	}
	if filter.MinPrice == nil || *filter.MinPrice != 100 {
		t.Fatalf("unexpected min price: %+v", filter.MinPrice)
	}
	if filter.MaxPrice == nil || *filter.MaxPrice != 500 {
		t.Fatalf("unexpected max price: %+v", filter.MaxPrice)
	}
	if len(filter.Tags) != 2 || filter.Tags[0] != "vr" || filter.Tags[1] != "featured" {
		t.Fatalf("unexpected tags: %+v", filter.Tags)
	}
	if filter.SortBy != "price" || filter.SortOrder != "desc" {
		t.Fatalf("unexpected sort params: %s/%s", filter.SortBy, filter.SortOrder)
	}
}

func TestGetItems_PaginationEdgeCases(t *testing.T) {
	userID := uuid.New()
	h := &Handler{
		store: &mockMarketplaceStoreService{
			getItemsFn: func(_ context.Context, _ *uuid.UUID, _ ItemFilter, limit, offset int) ([]models.StoreItemPublic, int, error) {
				if limit != 20 || offset != 0 {
					t.Fatalf("expected default pagination limit=20 offset=0, got limit=%d offset=%d", limit, offset)
				}
				return []models.StoreItemPublic{}, 0, nil
			},
		},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodGet, "/v1/store/items?limit=-10&offset=-50", nil), userID)
	rec := httptest.NewRecorder()
	h.GetItems(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestGetFeaturedItems_DefaultLimit(t *testing.T) {
	h := &Handler{
		store: &mockMarketplaceStoreService{
			getFeaturedItemsFn: func(_ context.Context, _ *uuid.UUID, limit int) ([]models.StoreItemPublic, error) {
				if limit != 10 {
					t.Fatalf("expected default featured limit 10, got %d", limit)
				}
				return []models.StoreItemPublic{{ID: uuid.New()}}, nil
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
