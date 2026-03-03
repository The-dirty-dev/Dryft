package marketplace

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// Handler handles HTTP requests for marketplace
type Handler struct {
	cfg       *config.Config
	store     marketplaceStoreService
	purchase  marketplacePurchaseService
	inventory marketplaceInventoryService
	creator   marketplaceCreatorService
}

type marketplaceStoreService interface {
	GetItems(ctx context.Context, userID *uuid.UUID, filter ItemFilter, limit, offset int) ([]models.StoreItemPublic, int, error)
	GetItem(ctx context.Context, userID *uuid.UUID, itemID uuid.UUID) (*models.StoreItemPublic, error)
	GetFeaturedItems(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error)
	GetPopularItems(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error)
	GetCategories(ctx context.Context) ([]models.ItemCategory, error)
	GetItemsByCategory(ctx context.Context, userID *uuid.UUID, slug string, limit, offset int) ([]models.StoreItemPublic, int, error)
	SearchItems(ctx context.Context, userID *uuid.UUID, query string, limit, offset int) ([]models.StoreItemPublic, int, error)
}

type marketplacePurchaseService interface {
	InitiatePurchase(ctx context.Context, buyerID, itemID uuid.UUID) (*PurchaseResult, error)
	GetPurchaseHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.Purchase, error)
	GetPurchase(ctx context.Context, userID, purchaseID uuid.UUID) (*PurchaseDetails, error)
	CompletePurchase(ctx context.Context, stripePaymentID string) error
	FailPurchase(ctx context.Context, stripePaymentID string) error
}

type marketplaceInventoryService interface {
	GetInventory(ctx context.Context, userID uuid.UUID, itemType *models.ItemType, limit, offset int) ([]models.InventoryItemWithDetails, error)
	GetEquippedItems(ctx context.Context, userID uuid.UUID) ([]models.InventoryItemWithDetails, error)
	EquipItem(ctx context.Context, userID, itemID uuid.UUID) error
	UnequipItem(ctx context.Context, userID, itemID uuid.UUID) error
	GetAssetBundle(ctx context.Context, userID, itemID uuid.UUID) (string, error)
}

type marketplaceCreatorService interface {
	CreateCreator(ctx context.Context, userID uuid.UUID, req *CreateCreatorRequest) (*models.Creator, error)
	GetCreator(ctx context.Context, userID uuid.UUID) (*models.Creator, error)
	GetOnboardingLink(ctx context.Context, userID uuid.UUID, returnURL, refreshURL string) (string, error)
	UpdateCreatorProfile(ctx context.Context, userID uuid.UUID, storeName, description *string) (*models.Creator, error)
	GetCreatorEarnings(ctx context.Context, userID uuid.UUID) (*EarningsSummary, error)
	GetCreatorItems(ctx context.Context, creatorID uuid.UUID, status *models.ItemStatus, limit, offset int) ([]models.StoreItem, error)
	GetFeaturedCreators(ctx context.Context, limit int) ([]models.Creator, error)
	GetCreatorByID(ctx context.Context, creatorID uuid.UUID) (*models.Creator, error)
	UpdateOnboardingStatus(ctx context.Context, stripeAccountID string, onboarded bool) error
	DisconnectStripeAccount(ctx context.Context, stripeAccountID string) error
}

// NewHandler creates a new marketplace handler
func NewHandler(cfg *config.Config, store *StoreService, purchase *PurchaseService, inventory *InventoryService, creator *CreatorService) *Handler {
	return &Handler{
		cfg:       cfg,
		store:     store,
		purchase:  purchase,
		inventory: inventory,
		creator:   creator,
	}
}

type contextKey string

const userIDContextKey contextKey = "user_id"

func getUserIDFromContext(r *http.Request) *uuid.UUID {
	if id, ok := r.Context().Value(userIDContextKey).(uuid.UUID); ok {
		return &id
	}
	return nil
}

func getRequiredUserID(r *http.Request, w http.ResponseWriter) *uuid.UUID {
	userID := getUserIDFromContext(r)
	if userID == nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return nil
	}
	return userID
}
