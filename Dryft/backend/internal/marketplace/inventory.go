package marketplace

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrInventoryItemNotFound = errors.New("inventory item not found")
)

// InventoryService handles user inventory management
type InventoryService struct {
	db *database.DB
}

// NewInventoryService creates a new inventory service
func NewInventoryService(db *database.DB) *InventoryService {
	return &InventoryService{db: db}
}

// GetInventory returns all items in a user's inventory
func (s *InventoryService) GetInventory(ctx context.Context, userID uuid.UUID, itemType *models.ItemType, limit, offset int) ([]models.InventoryItemWithDetails, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT
			inv.id, inv.user_id, inv.item_id, inv.purchase_id, inv.is_equipped, inv.acquired_at,
			i.id, i.creator_id, i.type, i.name, i.description, i.price, i.currency,
			i.thumbnail_url, i.preview_url, i.asset_bundle, i.tags
		FROM user_inventory inv
		JOIN store_items i ON inv.item_id = i.id
		WHERE inv.user_id = $1
	`
	args := []interface{}{userID}
	argNum := 2

	if itemType != nil {
		query += fmt.Sprintf(" AND i.type = $%d", argNum)
		args = append(args, *itemType)
		argNum++
	}

	query += fmt.Sprintf(" ORDER BY inv.acquired_at DESC LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query inventory: %w", err)
	}
	defer rows.Close()

	var items []models.InventoryItemWithDetails
	for rows.Next() {
		var inv models.InventoryItemWithDetails
		var item models.StoreItem

		err := rows.Scan(
			&inv.ID, &inv.UserID, &inv.ItemID, &inv.PurchaseID, &inv.IsEquipped, &inv.AcquiredAt,
			&item.ID, &item.CreatorID, &item.Type, &item.Name, &item.Description, &item.Price, &item.Currency,
			&item.ThumbnailURL, &item.PreviewURL, &item.AssetBundle, &item.Tags,
		)
		if err != nil {
			return nil, fmt.Errorf("scan inventory: %w", err)
		}

		inv.Item = item
		items = append(items, inv)
	}

	return items, nil
}

// GetEquippedItems returns items currently equipped by the user
func (s *InventoryService) GetEquippedItems(ctx context.Context, userID uuid.UUID) ([]models.InventoryItemWithDetails, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT
			inv.id, inv.user_id, inv.item_id, inv.purchase_id, inv.is_equipped, inv.acquired_at,
			i.id, i.creator_id, i.type, i.name, i.description, i.price, i.currency,
			i.thumbnail_url, i.preview_url, i.asset_bundle, i.tags
		FROM user_inventory inv
		JOIN store_items i ON inv.item_id = i.id
		WHERE inv.user_id = $1 AND inv.is_equipped = true
		ORDER BY i.type
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query equipped: %w", err)
	}
	defer rows.Close()

	var items []models.InventoryItemWithDetails
	for rows.Next() {
		var inv models.InventoryItemWithDetails
		var item models.StoreItem

		err := rows.Scan(
			&inv.ID, &inv.UserID, &inv.ItemID, &inv.PurchaseID, &inv.IsEquipped, &inv.AcquiredAt,
			&item.ID, &item.CreatorID, &item.Type, &item.Name, &item.Description, &item.Price, &item.Currency,
			&item.ThumbnailURL, &item.PreviewURL, &item.AssetBundle, &item.Tags,
		)
		if err != nil {
			return nil, fmt.Errorf("scan equipped: %w", err)
		}

		inv.Item = item
		items = append(items, inv)
	}

	return items, nil
}

// EquipItem equips an item from the user's inventory
func (s *InventoryService) EquipItem(ctx context.Context, userID, itemID uuid.UUID) error {
	// Get item type first
	var itemType models.ItemType
	err := s.db.Pool.QueryRow(ctx, `
		SELECT i.type
		FROM user_inventory inv
		JOIN store_items i ON inv.item_id = i.id
		WHERE inv.user_id = $1 AND inv.item_id = $2
	`, userID, itemID).Scan(&itemType)

	if err == pgx.ErrNoRows {
		return ErrInventoryItemNotFound
	}
	if err != nil {
		return fmt.Errorf("query item type: %w", err)
	}

	// Start transaction
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Unequip any items of the same type
	_, err = tx.Exec(ctx, `
		UPDATE user_inventory inv
		SET is_equipped = false
		FROM store_items i
		WHERE inv.item_id = i.id
			AND inv.user_id = $1
			AND i.type = $2
			AND inv.is_equipped = true
	`, userID, itemType)
	if err != nil {
		return fmt.Errorf("unequip existing: %w", err)
	}

	// Equip the new item
	result, err := tx.Exec(ctx, `
		UPDATE user_inventory
		SET is_equipped = true
		WHERE user_id = $1 AND item_id = $2
	`, userID, itemID)
	if err != nil {
		return fmt.Errorf("equip item: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrInventoryItemNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	return nil
}

// UnequipItem unequips an item from the user's inventory
func (s *InventoryService) UnequipItem(ctx context.Context, userID, itemID uuid.UUID) error {
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE user_inventory
		SET is_equipped = false
		WHERE user_id = $1 AND item_id = $2
	`, userID, itemID)
	if err != nil {
		return fmt.Errorf("unequip item: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrInventoryItemNotFound
	}

	return nil
}

// HasItem checks if a user owns a specific item
func (s *InventoryService) HasItem(ctx context.Context, userID, itemID uuid.UUID) (bool, error) {
	var exists bool
	err := s.db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM user_inventory WHERE user_id = $1 AND item_id = $2)",
		userID, itemID,
	).Scan(&exists)
	return exists, err
}

// GetInventoryCount returns the count of items in a user's inventory
func (s *InventoryService) GetInventoryCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM user_inventory WHERE user_id = $1",
		userID,
	).Scan(&count)
	return count, err
}

// GetAssetBundle returns the asset bundle URL for an owned item
func (s *InventoryService) GetAssetBundle(ctx context.Context, userID, itemID uuid.UUID) (string, error) {
	var assetBundle string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT i.asset_bundle
		FROM user_inventory inv
		JOIN store_items i ON inv.item_id = i.id
		WHERE inv.user_id = $1 AND inv.item_id = $2
	`, userID, itemID).Scan(&assetBundle)

	if err == pgx.ErrNoRows {
		return "", ErrInventoryItemNotFound
	}
	if err != nil {
		return "", fmt.Errorf("query asset bundle: %w", err)
	}

	return assetBundle, nil
}
