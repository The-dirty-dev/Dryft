//go:build integration

package marketplace

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/testutil"
)

func TestPurchaseServiceInitiateFreeItem(t *testing.T) {
	tdb, err := testutil.SetupTestDB()
	if err != nil {
		t.Fatalf("setup db: %v", err)
	}
	defer tdb.Teardown()

	ctx := context.Background()

	buyerID, err := testutil.CreateTestUser(tdb, "buyer@example.com", "password")
	if err != nil {
		t.Fatalf("create buyer: %v", err)
	}

	creatorUserID, err := testutil.CreateTestUser(tdb, "creator@example.com", "password")
	if err != nil {
		t.Fatalf("create creator user: %v", err)
	}

	creatorID := uuid.New()
	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO creators (id, user_id, store_name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
		creatorID, creatorUserID, "Test Creator",
	)
	if err != nil {
		t.Fatalf("insert creator: %v", err)
	}

	itemID := uuid.New()
	_, err = tdb.DB.Pool.Exec(ctx, `
    INSERT INTO store_items (id, creator_id, type, name, description, price, currency, thumbnail_url, asset_bundle, status)
    VALUES ($1, $2, 'avatar', 'Free Item', 'Free item', 0, 'usd', 'https://example.com/thumb.png', 'bundle.key', 'approved')
  `, itemID, creatorID)
	if err != nil {
		t.Fatalf("insert store item: %v", err)
	}

	svc := NewPurchaseService(&config.Config{StripeSecretKey: "sk_test"}, tdb.DB)
	result, err := svc.InitiatePurchase(ctx, buyerID, itemID)
	if err != nil {
		t.Fatalf("initiate purchase: %v", err)
	}
	if result == nil || result.Amount != 0 {
		t.Fatalf("unexpected purchase result: %+v", result)
	}

	var count int
	if err := tdb.DB.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM user_inventory WHERE user_id = $1 AND item_id = $2",
		buyerID, itemID,
	).Scan(&count); err != nil {
		t.Fatalf("query inventory: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected inventory entry, got %d", count)
	}

	if _, err := svc.InitiatePurchase(ctx, buyerID, itemID); err != ErrAlreadyOwned {
		t.Fatalf("expected ErrAlreadyOwned, got %v", err)
	}
}
