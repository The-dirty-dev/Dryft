package marketplace

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/webhook"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// Handler handles HTTP requests for marketplace
type Handler struct {
	cfg       *config.Config
	store     *StoreService
	purchase  *PurchaseService
	inventory *InventoryService
	creator   *CreatorService
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

// =============================================================================
// Store Endpoints
// =============================================================================

// GetItems handles GET /v1/store/items
func (h *Handler) GetItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	filter := parseItemFilter(r)
	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	items, total, err := h.store.GetItems(r.Context(), userID, filter, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetItem handles GET /v1/store/items/{itemID}
func (h *Handler) GetItem(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	itemIDStr := chi.URLParam(r, "itemID")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid item ID")
		return
	}

	item, err := h.store.GetItem(r.Context(), userID, itemID)
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "item not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get item")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, item)
}

// GetFeaturedItems handles GET /v1/store/featured
func (h *Handler) GetFeaturedItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	limit := httputil.ParsePagination(r, 10, 50).Limit

	items, err := h.store.GetFeaturedItems(r.Context(), userID, limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get featured items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": items,
	})
}

// GetPopularItems handles GET /v1/store/popular
func (h *Handler) GetPopularItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	limit := httputil.ParsePagination(r, 10, 50).Limit

	items, err := h.store.GetPopularItems(r.Context(), userID, limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get popular items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": items,
	})
}

// GetCategories handles GET /v1/store/categories
func (h *Handler) GetCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.store.GetCategories(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get categories")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"categories": categories,
	})
}

// GetItemsByCategory handles GET /v1/store/categories/{slug}/items
func (h *Handler) GetItemsByCategory(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	slug := chi.URLParam(r, "slug")
	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	items, total, err := h.store.GetItemsByCategory(r.Context(), userID, slug, limit, offset)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "category not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// SearchItems handles GET /v1/store/search
func (h *Handler) SearchItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)
	query := r.URL.Query().Get("q")
	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	items, total, err := h.store.SearchItems(r.Context(), userID, query, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to search items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"total":  total,
		"query":  query,
		"limit":  limit,
		"offset": offset,
	})
}

// =============================================================================
// Purchase Endpoints
// =============================================================================

// PurchaseItemRequest represents a purchase request
type PurchaseItemRequest struct {
	ItemID string `json:"item_id"`
}

// InitiatePurchase handles POST /v1/store/purchase
func (h *Handler) InitiatePurchase(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req PurchaseItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid item_id")
		return
	}

	result, err := h.purchase.InitiatePurchase(r.Context(), *userID, itemID)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlreadyOwned):
			httputil.WriteError(w, http.StatusConflict, "you already own this item")
		case errors.Is(err, ErrItemNotFound):
			httputil.WriteError(w, http.StatusNotFound, "item not found")
		case errors.Is(err, ErrItemUnavailable):
			httputil.WriteError(w, http.StatusBadRequest, "item is not available for purchase")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to initiate purchase")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, result)
}

// GetPurchaseHistory handles GET /v1/store/purchases
func (h *Handler) GetPurchaseHistory(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	purchases, err := h.purchase.GetPurchaseHistory(r.Context(), *userID, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get purchase history")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"purchases": purchases,
		"limit":     limit,
		"offset":    offset,
	})
}

// GetPurchase handles GET /v1/store/purchases/{purchaseID}
func (h *Handler) GetPurchase(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	purchaseIDStr := chi.URLParam(r, "purchaseID")
	purchaseID, err := uuid.Parse(purchaseIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid purchase ID")
		return
	}

	purchase, err := h.purchase.GetPurchase(r.Context(), *userID, purchaseID)
	if err != nil {
		if errors.Is(err, ErrPurchaseNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "purchase not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get purchase")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"purchase": purchase,
	})
}

// =============================================================================
// Inventory Endpoints
// =============================================================================

// GetInventory handles GET /v1/inventory
func (h *Handler) GetInventory(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	// Parse item type filter
	var itemType *models.ItemType
	if typeStr := r.URL.Query().Get("type"); typeStr != "" {
		t := models.ItemType(typeStr)
		itemType = &t
	}

	pg := httputil.ParsePagination(r, 50, 100)
	limit, offset := pg.Limit, pg.Offset

	items, err := h.inventory.GetInventory(r.Context(), *userID, itemType, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get inventory")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"limit":  limit,
		"offset": offset,
	})
}

// GetEquippedItems handles GET /v1/inventory/equipped
func (h *Handler) GetEquippedItems(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	items, err := h.inventory.GetEquippedItems(r.Context(), *userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get equipped items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": items,
	})
}

// EquipItemRequest represents an equip/unequip request
type EquipItemRequest struct {
	ItemID string `json:"item_id"`
}

// EquipItem handles POST /v1/inventory/equip
func (h *Handler) EquipItem(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req EquipItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid item_id")
		return
	}

	err = h.inventory.EquipItem(r.Context(), *userID, itemID)
	if err != nil {
		if errors.Is(err, ErrInventoryItemNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "item not found in inventory")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to equip item")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "equipped",
	})
}

// UnequipItem handles POST /v1/inventory/unequip
func (h *Handler) UnequipItem(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req EquipItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid item_id")
		return
	}

	err = h.inventory.UnequipItem(r.Context(), *userID, itemID)
	if err != nil {
		if errors.Is(err, ErrInventoryItemNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "item not found in inventory")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to unequip item")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "unequipped",
	})
}

// GetAssetBundle handles GET /v1/inventory/{itemID}/asset
func (h *Handler) GetAssetBundle(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	itemIDStr := chi.URLParam(r, "itemID")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid item ID")
		return
	}

	assetBundle, err := h.inventory.GetAssetBundle(r.Context(), *userID, itemID)
	if err != nil {
		if errors.Is(err, ErrInventoryItemNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "item not found in inventory")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get asset bundle")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"asset_bundle": assetBundle,
	})
}

// =============================================================================
// Creator Endpoints
// =============================================================================

// BecomeCreator handles POST /v1/creators
func (h *Handler) BecomeCreator(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req CreateCreatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.StoreName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "store_name is required")
		return
	}

	creator, err := h.creator.CreateCreator(r.Context(), *userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlreadyCreator):
			httputil.WriteError(w, http.StatusConflict, "you already have a creator account")
		case errors.Is(err, ErrStoreNameTaken):
			httputil.WriteError(w, http.StatusConflict, "store name is already taken")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to create creator account")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, creator)
}

// GetMyCreatorAccount handles GET /v1/creators/me
func (h *Handler) GetMyCreatorAccount(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	creator, err := h.creator.GetCreator(r.Context(), *userID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get creator account")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, creator)
}

// OnboardingLinkRequest represents a request for onboarding link
type OnboardingLinkRequest struct {
	ReturnURL  string `json:"return_url"`
	RefreshURL string `json:"refresh_url"`
}

// GetOnboardingLink handles POST /v1/creators/onboarding-link
func (h *Handler) GetOnboardingLink(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req OnboardingLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ReturnURL == "" || req.RefreshURL == "" {
		httputil.WriteError(w, http.StatusBadRequest, "return_url and refresh_url are required")
		return
	}

	link, err := h.creator.GetOnboardingLink(r.Context(), *userID, req.ReturnURL, req.RefreshURL)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to create onboarding link")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{
		"url": link,
	})
}

// UpdateCreatorProfileRequest represents a profile update request
type UpdateCreatorProfileRequest struct {
	StoreName   *string `json:"store_name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// UpdateCreatorProfile handles PATCH /v1/creators/me
func (h *Handler) UpdateCreatorProfile(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	var req UpdateCreatorProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	creator, err := h.creator.UpdateCreatorProfile(r.Context(), *userID, req.StoreName, req.Description)
	if err != nil {
		switch {
		case errors.Is(err, ErrCreatorNotFound):
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
		case errors.Is(err, ErrStoreNameTaken):
			httputil.WriteError(w, http.StatusConflict, "store name is already taken")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to update profile")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, creator)
}

// GetMyEarnings handles GET /v1/creators/earnings
func (h *Handler) GetMyEarnings(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	earnings, err := h.creator.GetCreatorEarnings(r.Context(), *userID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get earnings")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, earnings)
}

// GetMyItems handles GET /v1/creators/items
func (h *Handler) GetMyItems(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	// Get creator ID
	creator, err := h.creator.GetCreator(r.Context(), *userID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "you don't have a creator account")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get creator account")
		return
	}

	// Parse status filter
	var status *models.ItemStatus
	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		s := models.ItemStatus(statusStr)
		status = &s
	}

	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	items, err := h.creator.GetCreatorItems(r.Context(), creator.ID, status, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"limit":  limit,
		"offset": offset,
	})
}

// GetFeaturedCreators handles GET /v1/creators/featured
func (h *Handler) GetFeaturedCreators(w http.ResponseWriter, r *http.Request) {
	limit := httputil.ParsePagination(r, 10, 50).Limit

	creators, err := h.creator.GetFeaturedCreators(r.Context(), limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get featured creators")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"creators": creators,
	})
}

// GetCreator handles GET /v1/creators/{creatorID}
func (h *Handler) GetCreator(w http.ResponseWriter, r *http.Request) {
	creatorIDStr := chi.URLParam(r, "creatorID")
	creatorID, err := uuid.Parse(creatorIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid creator ID")
		return
	}

	creator, err := h.creator.GetCreatorByID(r.Context(), creatorID)
	if err != nil {
		if errors.Is(err, ErrCreatorNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "creator not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get creator")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, creator)
}

// GetCreatorItems handles GET /v1/creators/{creatorID}/items
func (h *Handler) GetCreatorItems(w http.ResponseWriter, r *http.Request) {
	creatorIDStr := chi.URLParam(r, "creatorID")
	creatorID, err := uuid.Parse(creatorIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid creator ID")
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)
	limit, offset := pg.Limit, pg.Offset

	// Only show approved items for public view
	approved := models.ItemStatusApproved
	items, err := h.creator.GetCreatorItems(r.Context(), creatorID, &approved, limit, offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get items")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items":  items,
		"limit":  limit,
		"offset": offset,
	})
}

// =============================================================================
// Webhook Endpoints
// =============================================================================

const maxBodyBytes = int64(65536)

// HandleStripeWebhook handles POST /v1/webhooks/stripe/marketplace
func (h *Handler) HandleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[Webhook] Error reading body: %v", err)
		httputil.WriteError(w, http.StatusServiceUnavailable, "error reading request body")
		return
	}

	// Verify webhook signature
	sigHeader := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sigHeader, h.cfg.StripeWebhookSecret)
	if err != nil {
		log.Printf("[Webhook] Signature verification failed: %v", err)
		httputil.WriteError(w, http.StatusBadRequest, "invalid webhook signature")
		return
	}

	log.Printf("[Webhook] Received event: %s", event.Type)

	switch event.Type {
	case "payment_intent.succeeded":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("[Webhook] Error parsing payment_intent: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		if err := h.purchase.CompletePurchase(r.Context(), pi.ID); err != nil {
			log.Printf("[Webhook] Error completing purchase for %s: %v", pi.ID, err)
			// Still return 200 to acknowledge receipt - we'll retry manually if needed
		} else {
			log.Printf("[Webhook] Completed purchase for payment_intent: %s", pi.ID)
		}

	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("[Webhook] Error parsing payment_intent: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		if err := h.purchase.FailPurchase(r.Context(), pi.ID); err != nil {
			log.Printf("[Webhook] Error failing purchase for %s: %v", pi.ID, err)
		} else {
			log.Printf("[Webhook] Marked purchase as failed for payment_intent: %s", pi.ID)
		}

	case "payment_intent.canceled":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Printf("[Webhook] Error parsing payment_intent: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		if err := h.purchase.FailPurchase(r.Context(), pi.ID); err != nil {
			log.Printf("[Webhook] Error canceling purchase for %s: %v", pi.ID, err)
		} else {
			log.Printf("[Webhook] Marked purchase as canceled for payment_intent: %s", pi.ID)
		}

	default:
		log.Printf("[Webhook] Unhandled event type: %s", event.Type)
	}

	w.WriteHeader(http.StatusOK)
}

// HandleStripeConnectWebhook handles POST /v1/webhooks/stripe/connect
func (h *Handler) HandleStripeConnectWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[ConnectWebhook] Error reading body: %v", err)
		httputil.WriteError(w, http.StatusServiceUnavailable, "error reading request body")
		return
	}

	// Verify webhook signature
	sigHeader := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sigHeader, h.cfg.StripeConnectWebhookSecret)
	if err != nil {
		log.Printf("[ConnectWebhook] Signature verification failed: %v", err)
		httputil.WriteError(w, http.StatusBadRequest, "invalid webhook signature")
		return
	}

	log.Printf("[ConnectWebhook] Received event: %s", event.Type)

	switch event.Type {
	case "account.updated":
		var account stripe.Account
		if err := json.Unmarshal(event.Data.Raw, &account); err != nil {
			log.Printf("[ConnectWebhook] Error parsing account: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		// Check if account is fully onboarded
		chargesEnabled := account.ChargesEnabled
		payoutsEnabled := account.PayoutsEnabled

		if chargesEnabled && payoutsEnabled {
			if err := h.creator.UpdateOnboardingStatus(r.Context(), account.ID, true); err != nil {
				log.Printf("[ConnectWebhook] Error updating onboarding status for %s: %v", account.ID, err)
			} else {
				log.Printf("[ConnectWebhook] Creator %s onboarding complete", account.ID)
			}
		} else {
			log.Printf("[ConnectWebhook] Account %s: charges=%v, payouts=%v", account.ID, chargesEnabled, payoutsEnabled)
		}

	case "account.application.deauthorized":
		var account stripe.Account
		if err := json.Unmarshal(event.Data.Raw, &account); err != nil {
			log.Printf("[ConnectWebhook] Error parsing account: %v", err)
			httputil.WriteError(w, http.StatusBadRequest, "error parsing event data")
			return
		}

		// Creator disconnected their Stripe account
		if err := h.creator.DisconnectStripeAccount(r.Context(), account.ID); err != nil {
			log.Printf("[ConnectWebhook] Error disconnecting account %s: %v", account.ID, err)
		} else {
			log.Printf("[ConnectWebhook] Disconnected account: %s", account.ID)
		}

	default:
		log.Printf("[ConnectWebhook] Unhandled event type: %s", event.Type)
	}

	w.WriteHeader(http.StatusOK)
}

// =============================================================================
// Helper Functions
// =============================================================================

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

func parseItemFilter(r *http.Request) ItemFilter {
	filter := ItemFilter{}

	if typeStr := r.URL.Query().Get("type"); typeStr != "" {
		t := models.ItemType(typeStr)
		filter.Type = &t
	}

	if creatorIDStr := r.URL.Query().Get("creator_id"); creatorIDStr != "" {
		if id, err := uuid.Parse(creatorIDStr); err == nil {
			filter.CreatorID = &id
		}
	}

	if categoryIDStr := r.URL.Query().Get("category_id"); categoryIDStr != "" {
		if id, err := uuid.Parse(categoryIDStr); err == nil {
			filter.CategoryID = &id
		}
	}

	if minPriceStr := r.URL.Query().Get("min_price"); minPriceStr != "" {
		if price, err := strconv.ParseInt(minPriceStr, 10, 64); err == nil {
			filter.MinPrice = &price
		}
	}

	if maxPriceStr := r.URL.Query().Get("max_price"); maxPriceStr != "" {
		if price, err := strconv.ParseInt(maxPriceStr, 10, 64); err == nil {
			filter.MaxPrice = &price
		}
	}

	if tagsStr := r.URL.Query().Get("tags"); tagsStr != "" {
		tags := strings.Split(tagsStr, ",")
		for i := range tags {
			tags[i] = strings.TrimSpace(tags[i])
		}
		filter.Tags = tags
	}

	if searchStr := r.URL.Query().Get("search"); searchStr != "" {
		filter.Search = searchStr
	}

	if featuredStr := r.URL.Query().Get("featured"); featuredStr == "true" {
		featured := true
		filter.Featured = &featured
	}

	filter.SortBy = r.URL.Query().Get("sort_by")
	filter.SortOrder = r.URL.Query().Get("sort_order")

	return filter
}

