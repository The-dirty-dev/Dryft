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

func TestBecomeCreator_RequiresStoreName(t *testing.T) {
	h := &Handler{
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/creators", bytes.NewBufferString(`{"description":"x"}`)), uuid.New())
	rec := httptest.NewRecorder()
	h.BecomeCreator(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 missing store_name, got %d", rec.Code)
	}
}

func TestGetOnboardingLink_RequiresURLs(t *testing.T) {
	h := &Handler{
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator:   &mockMarketplaceCreatorService{},
	}

	req := withMarketplaceUser(httptest.NewRequest(http.MethodPost, "/v1/creators/onboarding-link", bytes.NewBufferString(`{"return_url":""}`)), uuid.New())
	rec := httptest.NewRecorder()
	h.GetOnboardingLink(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 missing urls, got %d", rec.Code)
	}
}

func TestUpdateCreatorProfile_Conflict(t *testing.T) {
	h := &Handler{
		store:     &mockMarketplaceStoreService{},
		purchase:  &mockMarketplacePurchaseService{},
		inventory: &mockMarketplaceInventoryService{},
		creator: &mockMarketplaceCreatorServiceWithFns{
			updateCreatorProfileFn: func(context.Context, uuid.UUID, *string, *string) (*models.Creator, error) {
				return nil, ErrStoreNameTaken
			},
		},
	}

	name := "Taken"
	req := withMarketplaceUser(httptest.NewRequest(http.MethodPatch, "/v1/creators/me", bytes.NewBufferString(`{"store_name":"`+name+`"}`)), uuid.New())
	rec := httptest.NewRecorder()
	h.UpdateCreatorProfile(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict, got %d", rec.Code)
	}
}

// Dedicated override mock for creator tests in this file.
type mockMarketplaceCreatorServiceWithFns struct {
	mockMarketplaceCreatorService
	updateCreatorProfileFn func(context.Context, uuid.UUID, *string, *string) (*models.Creator, error)
}

func (m *mockMarketplaceCreatorServiceWithFns) UpdateCreatorProfile(ctx context.Context, userID uuid.UUID, storeName, description *string) (*models.Creator, error) {
	if m.updateCreatorProfileFn == nil {
		return m.mockMarketplaceCreatorService.UpdateCreatorProfile(ctx, userID, storeName, description)
	}
	return m.updateCreatorProfileFn(ctx, userID, storeName, description)
}
