package marketplace

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/paymentintent"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrAlreadyOwned      = errors.New("you already own this item")
	ErrItemUnavailable   = errors.New("item is not available for purchase")
	ErrPaymentFailed     = errors.New("payment failed")
	ErrInvalidPayment    = errors.New("invalid payment")
	ErrPurchaseNotFound  = errors.New("purchase not found")
)

// PurchaseService handles item purchases
type PurchaseService struct {
	cfg *config.Config
	db  *database.DB
}

// NewPurchaseService creates a new purchase service
func NewPurchaseService(cfg *config.Config, db *database.DB) *PurchaseService {
	stripe.Key = cfg.StripeSecretKey
	return &PurchaseService{cfg: cfg, db: db}
}

// PurchaseResult contains the result of initiating a purchase
type PurchaseResult struct {
	PurchaseID   uuid.UUID `json:"purchase_id"`
	ClientSecret string    `json:"client_secret"` // For Stripe PaymentIntent
	Amount       int64     `json:"amount"`
	Currency     string    `json:"currency"`
}

// InitiatePurchase creates a purchase and Stripe PaymentIntent
func (s *PurchaseService) InitiatePurchase(ctx context.Context, buyerID, itemID uuid.UUID) (*PurchaseResult, error) {
	// Check if user already owns the item
	var alreadyOwned bool
	err := s.db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM user_inventory WHERE user_id = $1 AND item_id = $2)",
		buyerID, itemID,
	).Scan(&alreadyOwned)
	if err != nil {
		return nil, fmt.Errorf("check ownership: %w", err)
	}
	if alreadyOwned {
		return nil, ErrAlreadyOwned
	}

	// Get item details
	var item struct {
		ID        uuid.UUID
		CreatorID uuid.UUID
		Price     int64
		Currency  string
		Status    models.ItemStatus
	}
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id, creator_id, price, currency, status
		FROM store_items
		WHERE id = $1 AND deleted_at IS NULL
	`, itemID).Scan(&item.ID, &item.CreatorID, &item.Price, &item.Currency, &item.Status)

	if err == pgx.ErrNoRows {
		return nil, ErrItemNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query item: %w", err)
	}

	if item.Status != models.ItemStatusApproved {
		return nil, ErrItemUnavailable
	}

	// Calculate payout split
	platformFee, creatorPayout := models.CalculatePayoutSplit(item.Price)

	// Handle free items
	if item.Price == 0 {
		return s.completeFreeItem(ctx, buyerID, itemID, item.CreatorID)
	}

	// Get creator's Stripe account ID for destination charge
	var stripeAccountID *string
	err = s.db.Pool.QueryRow(ctx,
		"SELECT stripe_account_id FROM creators WHERE id = $1",
		item.CreatorID,
	).Scan(&stripeAccountID)
	if err != nil {
		return nil, fmt.Errorf("query creator: %w", err)
	}

	// Create Stripe PaymentIntent
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(item.Price),
		Currency: stripe.String(item.Currency),
		Metadata: map[string]string{
			"buyer_id":   buyerID.String(),
			"item_id":    itemID.String(),
			"creator_id": item.CreatorID.String(),
		},
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		},
	}

	// If creator has Stripe Connect, set up destination charge
	if stripeAccountID != nil && *stripeAccountID != "" {
		params.TransferData = &stripe.PaymentIntentTransferDataParams{
			Destination: stripeAccountID,
			Amount:      stripe.Int64(creatorPayout),
		}
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		return nil, fmt.Errorf("create payment intent: %w", err)
	}

	// Create purchase record
	purchaseID := uuid.New()
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO purchases (id, buyer_id, item_id, creator_id, amount, currency, platform_fee, creator_payout, stripe_payment_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
	`, purchaseID, buyerID, itemID, item.CreatorID, item.Price, item.Currency, platformFee, creatorPayout, pi.ID)

	if err != nil {
		return nil, fmt.Errorf("create purchase: %w", err)
	}

	return &PurchaseResult{
		PurchaseID:   purchaseID,
		ClientSecret: pi.ClientSecret,
		Amount:       item.Price,
		Currency:     item.Currency,
	}, nil
}

// completeFreeItem handles acquisition of free items
func (s *PurchaseService) completeFreeItem(ctx context.Context, buyerID, itemID, creatorID uuid.UUID) (*PurchaseResult, error) {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Create purchase record
	purchaseID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO purchases (id, buyer_id, item_id, creator_id, amount, currency, platform_fee, creator_payout, status)
		VALUES ($1, $2, $3, $4, 0, 'usd', 0, 0, 'completed')
	`, purchaseID, buyerID, itemID, creatorID)
	if err != nil {
		return nil, fmt.Errorf("create purchase: %w", err)
	}

	// Add to inventory
	_, err = tx.Exec(ctx, `
		INSERT INTO user_inventory (user_id, item_id, purchase_id)
		VALUES ($1, $2, $3)
	`, buyerID, itemID, purchaseID)
	if err != nil {
		return nil, fmt.Errorf("add to inventory: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &PurchaseResult{
		PurchaseID: purchaseID,
		Amount:     0,
		Currency:   "usd",
	}, nil
}

// CompletePurchase is called after successful payment (via webhook)
func (s *PurchaseService) CompletePurchase(ctx context.Context, stripePaymentID string) error {
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get purchase
	var purchase struct {
		ID      uuid.UUID
		BuyerID uuid.UUID
		ItemID  uuid.UUID
		Status  models.PurchaseStatus
	}
	err = tx.QueryRow(ctx, `
		SELECT id, buyer_id, item_id, status
		FROM purchases
		WHERE stripe_payment_id = $1
	`, stripePaymentID).Scan(&purchase.ID, &purchase.BuyerID, &purchase.ItemID, &purchase.Status)

	if err == pgx.ErrNoRows {
		return ErrPurchaseNotFound
	}
	if err != nil {
		return fmt.Errorf("query purchase: %w", err)
	}

	// Skip if already completed
	if purchase.Status == models.PurchaseStatusCompleted {
		return nil
	}

	// Update purchase status
	_, err = tx.Exec(ctx, "UPDATE purchases SET status = 'completed' WHERE id = $1", purchase.ID)
	if err != nil {
		return fmt.Errorf("update purchase: %w", err)
	}

	// Add to inventory
	_, err = tx.Exec(ctx, `
		INSERT INTO user_inventory (user_id, item_id, purchase_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, item_id) DO NOTHING
	`, purchase.BuyerID, purchase.ItemID, purchase.ID)
	if err != nil {
		return fmt.Errorf("add to inventory: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	return nil
}

// FailPurchase marks a purchase as failed (via webhook)
func (s *PurchaseService) FailPurchase(ctx context.Context, stripePaymentID string) error {
	_, err := s.db.Pool.Exec(ctx,
		"UPDATE purchases SET status = 'failed' WHERE stripe_payment_id = $1 AND status = 'pending'",
		stripePaymentID,
	)
	return err
}

// PurchaseDetails contains full purchase info with item details
type PurchaseDetails struct {
	PurchaseID    uuid.UUID `json:"purchase_id"`
	ItemID        uuid.UUID `json:"item_id"`
	ItemName      string    `json:"item_name"`
	ItemThumbnail *string   `json:"item_thumbnail,omitempty"`
	ItemType      string    `json:"item_type"`
	CreatorID     uuid.UUID `json:"creator_id"`
	CreatorName   string    `json:"creator_name"`
	Amount        int64     `json:"amount"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"`
	CompletedAt   *string   `json:"completed_at,omitempty"`
	CreatedAt     string    `json:"created_at"`
}

// GetPurchase returns a single purchase by ID (with item details)
func (s *PurchaseService) GetPurchase(ctx context.Context, userID, purchaseID uuid.UUID) (*PurchaseDetails, error) {
	var purchase PurchaseDetails
	var completedAt *time.Time
	var createdAt time.Time

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			p.id, p.item_id, i.name, i.thumbnail_url, i.type,
			p.creator_id, c.store_name,
			p.amount, p.currency, p.status, p.created_at,
			CASE WHEN p.status = 'completed' THEN p.updated_at END as completed_at
		FROM purchases p
		JOIN store_items i ON i.id = p.item_id
		JOIN creators c ON c.id = p.creator_id
		WHERE p.id = $1 AND p.buyer_id = $2
	`, purchaseID, userID).Scan(
		&purchase.PurchaseID, &purchase.ItemID, &purchase.ItemName, &purchase.ItemThumbnail,
		&purchase.ItemType, &purchase.CreatorID, &purchase.CreatorName,
		&purchase.Amount, &purchase.Currency, &purchase.Status, &createdAt, &completedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrPurchaseNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query purchase: %w", err)
	}

	purchase.CreatedAt = createdAt.Format(time.RFC3339)
	if completedAt != nil {
		formatted := completedAt.Format(time.RFC3339)
		purchase.CompletedAt = &formatted
	}

	return &purchase, nil
}

// GetPurchaseHistory returns a user's purchase history
func (s *PurchaseService) GetPurchaseHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.Purchase, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, buyer_id, item_id, creator_id, amount, currency, platform_fee, creator_payout, stripe_payment_id, status, refunded_at, created_at
		FROM purchases
		WHERE buyer_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query purchases: %w", err)
	}
	defer rows.Close()

	var purchases []models.Purchase
	for rows.Next() {
		var p models.Purchase
		err := rows.Scan(&p.ID, &p.BuyerID, &p.ItemID, &p.CreatorID, &p.Amount, &p.Currency, &p.PlatformFee, &p.CreatorPayout, &p.StripePaymentID, &p.Status, &p.RefundedAt, &p.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("scan purchase: %w", err)
		}
		purchases = append(purchases, p)
	}

	return purchases, nil
}
