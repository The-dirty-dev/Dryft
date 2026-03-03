package marketplace

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// GetItems handles GET /v1/store/items
func (h *Handler) GetItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserIDFromContext(r)

	filter := parseItemFilter(r)
	pg := httputil.ParseLimitOffset(r, 20, 100)
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
	limit := httputil.ParseLimitOffset(r, 10, 50).Limit

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
	limit := httputil.ParseLimitOffset(r, 10, 50).Limit

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
	pg := httputil.ParseLimitOffset(r, 20, 100)
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
	pg := httputil.ParseLimitOffset(r, 20, 100)
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
