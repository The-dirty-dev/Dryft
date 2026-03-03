package marketplace

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// GetPurchaseHistory handles GET /v1/store/purchases
func (h *Handler) GetPurchaseHistory(w http.ResponseWriter, r *http.Request) {
	userID := getRequiredUserID(r, w)
	if userID == nil {
		return
	}

	pg := httputil.ParseLimitOffset(r, 20, 100)
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

	pg := httputil.ParseLimitOffset(r, 50, 100)
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
