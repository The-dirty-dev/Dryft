package marketplace

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrItemNotFound     = errors.New("item not found")
	ErrCategoryNotFound = errors.New("category not found")
	ErrNotItemOwner     = errors.New("you don't own this item")
)

// StoreService handles store browsing and item management
type StoreService struct {
	db *database.DB
}

// NewStoreService creates a new store service
func NewStoreService(db *database.DB) *StoreService {
	return &StoreService{db: db}
}

// ItemFilter represents filters for browsing items
type ItemFilter struct {
	Type       *models.ItemType
	CategoryID *uuid.UUID
	CreatorID  *uuid.UUID
	MinPrice   *int64
	MaxPrice   *int64
	Tags       []string
	Search     string
	Featured   *bool
	SortBy     string // "price", "rating", "popular", "newest"
	SortOrder  string // "asc", "desc"
}

// GetItems returns paginated store items with filters
func (s *StoreService) GetItems(ctx context.Context, userID *uuid.UUID, filter ItemFilter, limit, offset int) ([]models.StoreItemPublic, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	// Build query
	query := `
		SELECT
			i.id, i.creator_id, c.store_name, i.type, i.name, i.description,
			i.price, i.currency, i.thumbnail_url, i.preview_url, i.tags,
			i.purchase_count, i.rating, i.rating_count, i.is_featured,
			EXISTS(SELECT 1 FROM user_inventory inv WHERE inv.item_id = i.id AND inv.user_id = $1) as is_owned
		FROM store_items i
		JOIN creators c ON i.creator_id = c.id
		WHERE i.status = 'approved' AND i.deleted_at IS NULL
	`
	countQuery := `
		SELECT COUNT(*)
		FROM store_items i
		WHERE i.status = 'approved' AND i.deleted_at IS NULL
	`

	args := []interface{}{userID}
	countArgs := []interface{}{}
	argNum := 2
	countArgNum := 1

	// Apply filters
	if filter.Type != nil {
		query += fmt.Sprintf(" AND i.type = $%d", argNum)
		countQuery += fmt.Sprintf(" AND i.type = $%d", countArgNum)
		args = append(args, *filter.Type)
		countArgs = append(countArgs, *filter.Type)
		argNum++
		countArgNum++
	}

	if filter.CategoryID != nil {
		query += fmt.Sprintf(" AND i.category_id = $%d", argNum)
		countQuery += fmt.Sprintf(" AND i.category_id = $%d", countArgNum)
		args = append(args, *filter.CategoryID)
		countArgs = append(countArgs, *filter.CategoryID)
		argNum++
		countArgNum++
	}

	if filter.CreatorID != nil {
		query += fmt.Sprintf(" AND i.creator_id = $%d", argNum)
		countQuery += fmt.Sprintf(" AND i.creator_id = $%d", countArgNum)
		args = append(args, *filter.CreatorID)
		countArgs = append(countArgs, *filter.CreatorID)
		argNum++
		countArgNum++
	}

	if filter.MinPrice != nil {
		query += fmt.Sprintf(" AND i.price >= $%d", argNum)
		countQuery += fmt.Sprintf(" AND i.price >= $%d", countArgNum)
		args = append(args, *filter.MinPrice)
		countArgs = append(countArgs, *filter.MinPrice)
		argNum++
		countArgNum++
	}

	if filter.MaxPrice != nil {
		query += fmt.Sprintf(" AND i.price <= $%d", argNum)
		countQuery += fmt.Sprintf(" AND i.price <= $%d", countArgNum)
		args = append(args, *filter.MaxPrice)
		countArgs = append(countArgs, *filter.MaxPrice)
		argNum++
		countArgNum++
	}

	if len(filter.Tags) > 0 {
		query += fmt.Sprintf(" AND i.tags && $%d", argNum)
		countQuery += fmt.Sprintf(" AND i.tags && $%d", countArgNum)
		args = append(args, filter.Tags)
		countArgs = append(countArgs, filter.Tags)
		argNum++
		countArgNum++
	}

	if filter.Search != "" {
		query += fmt.Sprintf(" AND to_tsvector('english', i.name || ' ' || i.description) @@ plainto_tsquery('english', $%d)", argNum)
		countQuery += fmt.Sprintf(" AND to_tsvector('english', i.name || ' ' || i.description) @@ plainto_tsquery('english', $%d)", countArgNum)
		args = append(args, filter.Search)
		countArgs = append(countArgs, filter.Search)
		argNum++
		countArgNum++
	}

	if filter.Featured != nil && *filter.Featured {
		query += " AND i.is_featured = true"
		countQuery += " AND i.is_featured = true"
	}

	// Get total count
	var total int
	err := s.db.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count items: %w", err)
	}

	// Apply sorting
	orderBy := "i.created_at DESC" // default
	switch filter.SortBy {
	case "price":
		if filter.SortOrder == "desc" {
			orderBy = "i.price DESC"
		} else {
			orderBy = "i.price ASC"
		}
	case "rating":
		orderBy = "i.rating DESC, i.rating_count DESC"
	case "popular":
		orderBy = "i.purchase_count DESC"
	case "newest":
		orderBy = "i.created_at DESC"
	}
	query += fmt.Sprintf(" ORDER BY %s LIMIT $%d OFFSET $%d", orderBy, argNum, argNum+1)
	args = append(args, limit, offset)

	// Execute query
	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query items: %w", err)
	}
	defer rows.Close()

	var items []models.StoreItemPublic
	for rows.Next() {
		var item models.StoreItemPublic
		err := rows.Scan(
			&item.ID, &item.CreatorID, &item.CreatorName, &item.Type, &item.Name, &item.Description,
			&item.Price, &item.Currency, &item.ThumbnailURL, &item.PreviewURL, &item.Tags,
			&item.PurchaseCount, &item.Rating, &item.RatingCount, &item.IsFeatured, &item.IsOwned,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan item: %w", err)
		}
		items = append(items, item)
	}

	return items, total, nil
}

// GetItem returns a single item by ID
func (s *StoreService) GetItem(ctx context.Context, userID *uuid.UUID, itemID uuid.UUID) (*models.StoreItemPublic, error) {
	var item models.StoreItemPublic

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			i.id, i.creator_id, c.store_name, i.type, i.name, i.description,
			i.price, i.currency, i.thumbnail_url, i.preview_url, i.tags,
			i.purchase_count, i.rating, i.rating_count, i.is_featured,
			EXISTS(SELECT 1 FROM user_inventory inv WHERE inv.item_id = i.id AND inv.user_id = $1) as is_owned
		FROM store_items i
		JOIN creators c ON i.creator_id = c.id
		WHERE i.id = $2 AND i.status = 'approved' AND i.deleted_at IS NULL
	`, userID, itemID).Scan(
		&item.ID, &item.CreatorID, &item.CreatorName, &item.Type, &item.Name, &item.Description,
		&item.Price, &item.Currency, &item.ThumbnailURL, &item.PreviewURL, &item.Tags,
		&item.PurchaseCount, &item.Rating, &item.RatingCount, &item.IsFeatured, &item.IsOwned,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrItemNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query item: %w", err)
	}

	return &item, nil
}

// GetFeaturedItems returns featured items
func (s *StoreService) GetFeaturedItems(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error) {
	featured := true
	return s.getItemsSimple(ctx, userID, ItemFilter{Featured: &featured}, limit)
}

// GetPopularItems returns popular items by purchase count
func (s *StoreService) GetPopularItems(ctx context.Context, userID *uuid.UUID, limit int) ([]models.StoreItemPublic, error) {
	items, _, err := s.GetItems(ctx, userID, ItemFilter{SortBy: "popular"}, limit, 0)
	return items, err
}

// GetCategories returns all item categories
func (s *StoreService) GetCategories(ctx context.Context) ([]models.ItemCategory, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, name, slug, description, parent_id, sort_order, icon_url
		FROM item_categories
		ORDER BY sort_order ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	var categories []models.ItemCategory
	for rows.Next() {
		var cat models.ItemCategory
		err := rows.Scan(&cat.ID, &cat.Name, &cat.Slug, &cat.Description, &cat.ParentID, &cat.SortOrder, &cat.IconURL)
		if err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// GetItemsByCategory returns items in a category by slug
func (s *StoreService) GetItemsByCategory(ctx context.Context, userID *uuid.UUID, slug string, limit, offset int) ([]models.StoreItemPublic, int, error) {
	// Get category ID from slug
	var categoryID uuid.UUID
	err := s.db.Pool.QueryRow(ctx, "SELECT id FROM item_categories WHERE slug = $1", slug).Scan(&categoryID)
	if err == pgx.ErrNoRows {
		return nil, 0, ErrCategoryNotFound
	}
	if err != nil {
		return nil, 0, fmt.Errorf("query category: %w", err)
	}

	return s.GetItems(ctx, userID, ItemFilter{CategoryID: &categoryID}, limit, offset)
}

// SearchItems performs text search on items
func (s *StoreService) SearchItems(ctx context.Context, userID *uuid.UUID, query string, limit, offset int) ([]models.StoreItemPublic, int, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []models.StoreItemPublic{}, 0, nil
	}

	return s.GetItems(ctx, userID, ItemFilter{Search: query}, limit, offset)
}

func (s *StoreService) getItemsSimple(ctx context.Context, userID *uuid.UUID, filter ItemFilter, limit int) ([]models.StoreItemPublic, error) {
	items, _, err := s.GetItems(ctx, userID, filter, limit, 0)
	return items, err
}
