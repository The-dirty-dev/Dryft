package marketplace

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/account"
	"github.com/stripe/stripe-go/v78/accountlink"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

var (
	ErrCreatorNotFound      = errors.New("creator account not found")
	ErrAlreadyCreator       = errors.New("user already has a creator account")
	ErrCreatorNotOnboarded  = errors.New("creator has not completed Stripe onboarding")
	ErrStoreNameTaken       = errors.New("store name is already taken")
)

// CreatorService handles creator accounts and Stripe Connect
type CreatorService struct {
	cfg *config.Config
	db  *database.DB
}

// NewCreatorService creates a new creator service
func NewCreatorService(cfg *config.Config, db *database.DB) *CreatorService {
	stripe.Key = cfg.StripeSecretKey
	return &CreatorService{cfg: cfg, db: db}
}

// CreateCreatorRequest represents a request to become a creator
type CreateCreatorRequest struct {
	StoreName   string  `json:"store_name"`
	Description *string `json:"description,omitempty"`
}

// CreateCreator creates a new creator account
func (s *CreatorService) CreateCreator(ctx context.Context, userID uuid.UUID, req *CreateCreatorRequest) (*models.Creator, error) {
	// Check if user already has creator account
	var exists bool
	err := s.db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM creators WHERE user_id = $1)",
		userID,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check existing: %w", err)
	}
	if exists {
		return nil, ErrAlreadyCreator
	}

	// Check if store name is taken
	err = s.db.Pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM creators WHERE LOWER(store_name) = LOWER($1))",
		req.StoreName,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check store name: %w", err)
	}
	if exists {
		return nil, ErrStoreNameTaken
	}

	// Get user email for Stripe
	var email string
	err = s.db.Pool.QueryRow(ctx, "SELECT email FROM users WHERE id = $1", userID).Scan(&email)
	if err != nil {
		return nil, fmt.Errorf("get user email: %w", err)
	}

	// Create Stripe Connect account
	params := &stripe.AccountParams{
		Type:    stripe.String(string(stripe.AccountTypeExpress)),
		Country: stripe.String("US"),
		Email:   stripe.String(email),
		Capabilities: &stripe.AccountCapabilitiesParams{
			CardPayments: &stripe.AccountCapabilitiesCardPaymentsParams{
				Requested: stripe.Bool(true),
			},
			Transfers: &stripe.AccountCapabilitiesTransfersParams{
				Requested: stripe.Bool(true),
			},
		},
		BusinessProfile: &stripe.AccountBusinessProfileParams{
			Name: stripe.String(req.StoreName),
			URL:  stripe.String(fmt.Sprintf("https://dryft.site/creators/%s", userID)),
		},
	}

	stripeAccount, err := account.New(params)
	if err != nil {
		return nil, fmt.Errorf("create stripe account: %w", err)
	}

	// Create creator record
	creator := &models.Creator{
		ID:              uuid.New(),
		UserID:          userID,
		StoreName:       req.StoreName,
		Description:     req.Description,
		StripeAccountID: &stripeAccount.ID,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO creators (id, user_id, store_name, description, stripe_account_id)
		VALUES ($1, $2, $3, $4, $5)
	`, creator.ID, creator.UserID, creator.StoreName, creator.Description, creator.StripeAccountID)

	if err != nil {
		return nil, fmt.Errorf("insert creator: %w", err)
	}

	return creator, nil
}

// GetOnboardingLink generates a Stripe Connect onboarding link
func (s *CreatorService) GetOnboardingLink(ctx context.Context, userID uuid.UUID, returnURL, refreshURL string) (string, error) {
	// Get creator's Stripe account ID
	var stripeAccountID *string
	err := s.db.Pool.QueryRow(ctx,
		"SELECT stripe_account_id FROM creators WHERE user_id = $1",
		userID,
	).Scan(&stripeAccountID)

	if err == pgx.ErrNoRows {
		return "", ErrCreatorNotFound
	}
	if err != nil {
		return "", fmt.Errorf("query creator: %w", err)
	}

	if stripeAccountID == nil || *stripeAccountID == "" {
		return "", ErrCreatorNotFound
	}

	// Create account link
	params := &stripe.AccountLinkParams{
		Account:    stripeAccountID,
		RefreshURL: stripe.String(refreshURL),
		ReturnURL:  stripe.String(returnURL),
		Type:       stripe.String("account_onboarding"),
	}

	link, err := accountlink.New(params)
	if err != nil {
		return "", fmt.Errorf("create account link: %w", err)
	}

	return link.URL, nil
}

// UpdateOnboardingStatus updates the creator's onboarding status from webhook
func (s *CreatorService) UpdateOnboardingStatus(ctx context.Context, stripeAccountID string, onboarded bool) error {
	// Update our records
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE creators
		SET stripe_onboarded = $1, payouts_enabled = $1, updated_at = NOW()
		WHERE stripe_account_id = $2
	`, onboarded, stripeAccountID)

	if err != nil {
		return fmt.Errorf("update creator: %w", err)
	}

	return nil
}

// RefreshOnboardingStatus checks Stripe account status and updates our records
func (s *CreatorService) RefreshOnboardingStatus(ctx context.Context, stripeAccountID string) error {
	// Get account from Stripe
	acct, err := account.GetByID(stripeAccountID, nil)
	if err != nil {
		return fmt.Errorf("get stripe account: %w", err)
	}

	// Check if onboarding is complete
	onboarded := acct.DetailsSubmitted
	payoutsEnabled := acct.PayoutsEnabled

	// Update our records
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE creators
		SET stripe_onboarded = $1, payouts_enabled = $2, updated_at = NOW()
		WHERE stripe_account_id = $3
	`, onboarded, payoutsEnabled, stripeAccountID)

	if err != nil {
		return fmt.Errorf("update creator: %w", err)
	}

	return nil
}

// DisconnectStripeAccount handles when a creator disconnects their Stripe account
func (s *CreatorService) DisconnectStripeAccount(ctx context.Context, stripeAccountID string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE creators
		SET stripe_onboarded = false, payouts_enabled = false, updated_at = NOW()
		WHERE stripe_account_id = $1
	`, stripeAccountID)

	if err != nil {
		return fmt.Errorf("disconnect stripe account: %w", err)
	}

	return nil
}

// GetCreator returns a creator by user ID
func (s *CreatorService) GetCreator(ctx context.Context, userID uuid.UUID) (*models.Creator, error) {
	var creator models.Creator

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, store_name, description, logo_url, banner_url,
		       stripe_account_id, stripe_onboarded, payouts_enabled,
		       total_sales, total_earnings, item_count, rating, rating_count,
		       is_verified, is_featured, created_at, updated_at
		FROM creators
		WHERE user_id = $1
	`, userID).Scan(
		&creator.ID, &creator.UserID, &creator.StoreName, &creator.Description,
		&creator.LogoURL, &creator.BannerURL, &creator.StripeAccountID,
		&creator.StripeOnboarded, &creator.PayoutsEnabled, &creator.TotalSales,
		&creator.TotalEarnings, &creator.ItemCount, &creator.Rating, &creator.RatingCount,
		&creator.IsVerified, &creator.IsFeatured, &creator.CreatedAt, &creator.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrCreatorNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query creator: %w", err)
	}

	return &creator, nil
}

// GetCreatorByID returns a creator by their ID
func (s *CreatorService) GetCreatorByID(ctx context.Context, creatorID uuid.UUID) (*models.Creator, error) {
	var creator models.Creator

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, store_name, description, logo_url, banner_url,
		       stripe_account_id, stripe_onboarded, payouts_enabled,
		       total_sales, total_earnings, item_count, rating, rating_count,
		       is_verified, is_featured, created_at, updated_at
		FROM creators
		WHERE id = $1
	`, creatorID).Scan(
		&creator.ID, &creator.UserID, &creator.StoreName, &creator.Description,
		&creator.LogoURL, &creator.BannerURL, &creator.StripeAccountID,
		&creator.StripeOnboarded, &creator.PayoutsEnabled, &creator.TotalSales,
		&creator.TotalEarnings, &creator.ItemCount, &creator.Rating, &creator.RatingCount,
		&creator.IsVerified, &creator.IsFeatured, &creator.CreatedAt, &creator.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrCreatorNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query creator: %w", err)
	}

	return &creator, nil
}

// UpdateCreatorProfile updates a creator's profile
func (s *CreatorService) UpdateCreatorProfile(ctx context.Context, userID uuid.UUID, storeName, description *string) (*models.Creator, error) {
	// Check store name uniqueness if provided
	if storeName != nil {
		var exists bool
		err := s.db.Pool.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM creators WHERE LOWER(store_name) = LOWER($1) AND user_id != $2)",
			*storeName, userID,
		).Scan(&exists)
		if err != nil {
			return nil, fmt.Errorf("check store name: %w", err)
		}
		if exists {
			return nil, ErrStoreNameTaken
		}
	}

	_, err := s.db.Pool.Exec(ctx, `
		UPDATE creators
		SET store_name = COALESCE($2, store_name),
		    description = COALESCE($3, description),
		    updated_at = NOW()
		WHERE user_id = $1
	`, userID, storeName, description)

	if err != nil {
		return nil, fmt.Errorf("update creator: %w", err)
	}

	return s.GetCreator(ctx, userID)
}

// GetCreatorItems returns items created by a creator
func (s *CreatorService) GetCreatorItems(ctx context.Context, creatorID uuid.UUID, status *models.ItemStatus, limit, offset int) ([]models.StoreItem, error) {
	if limit <= 0 {
		limit = 20
	}

	query := `
		SELECT id, creator_id, type, name, description, price, currency,
		       thumbnail_url, preview_url, asset_bundle, tags, attributes,
		       purchase_count, rating, rating_count, status, is_featured,
		       created_at, updated_at
		FROM store_items
		WHERE creator_id = $1 AND deleted_at IS NULL
	`
	args := []interface{}{creatorID}
	argNum := 2

	if status != nil {
		query += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, *status)
		argNum++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query items: %w", err)
	}
	defer rows.Close()

	var items []models.StoreItem
	for rows.Next() {
		var item models.StoreItem
		err := rows.Scan(
			&item.ID, &item.CreatorID, &item.Type, &item.Name, &item.Description,
			&item.Price, &item.Currency, &item.ThumbnailURL, &item.PreviewURL,
			&item.AssetBundle, &item.Tags, &item.Attributes, &item.PurchaseCount,
			&item.Rating, &item.RatingCount, &item.Status, &item.IsFeatured,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan item: %w", err)
		}
		items = append(items, item)
	}

	return items, nil
}

// GetCreatorEarnings returns earnings summary for a creator
func (s *CreatorService) GetCreatorEarnings(ctx context.Context, userID uuid.UUID) (*EarningsSummary, error) {
	var summary EarningsSummary

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			c.total_earnings,
			COALESCE(SUM(CASE WHEN p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '30 days' THEN p.creator_payout ELSE 0 END), 0) as last_30_days,
			COALESCE(SUM(CASE WHEN p.status = 'completed' AND p.created_at >= NOW() - INTERVAL '7 days' THEN p.creator_payout ELSE 0 END), 0) as last_7_days,
			c.total_sales,
			(SELECT COALESCE(SUM(amount), 0) FROM creator_payouts WHERE creator_id = c.id AND status = 'paid') as total_paid_out
		FROM creators c
		LEFT JOIN purchases p ON p.creator_id = c.id
		WHERE c.user_id = $1
		GROUP BY c.id, c.total_earnings, c.total_sales
	`, userID).Scan(
		&summary.TotalEarnings,
		&summary.Last30Days,
		&summary.Last7Days,
		&summary.TotalSales,
		&summary.TotalPaidOut,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrCreatorNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query earnings: %w", err)
	}

	summary.AvailableBalance = summary.TotalEarnings - summary.TotalPaidOut

	return &summary, nil
}

// EarningsSummary represents a creator's earnings overview
type EarningsSummary struct {
	TotalEarnings    int64 `json:"total_earnings"`    // All-time earnings in cents
	TotalPaidOut     int64 `json:"total_paid_out"`    // Total paid out
	AvailableBalance int64 `json:"available_balance"` // Ready to withdraw
	Last30Days       int64 `json:"last_30_days"`      // Earnings in last 30 days
	Last7Days        int64 `json:"last_7_days"`       // Earnings in last 7 days
	TotalSales       int64 `json:"total_sales"`       // Number of sales
}

// GetFeaturedCreators returns featured creator accounts
func (s *CreatorService) GetFeaturedCreators(ctx context.Context, limit int) ([]models.Creator, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, store_name, description, logo_url, banner_url,
		       stripe_onboarded, payouts_enabled,
		       total_sales, total_earnings, item_count, rating, rating_count,
		       is_verified, is_featured, created_at
		FROM creators
		WHERE is_featured = true AND stripe_onboarded = true
		ORDER BY total_sales DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("query creators: %w", err)
	}
	defer rows.Close()

	var creators []models.Creator
	for rows.Next() {
		var c models.Creator
		err := rows.Scan(
			&c.ID, &c.UserID, &c.StoreName, &c.Description, &c.LogoURL, &c.BannerURL,
			&c.StripeOnboarded, &c.PayoutsEnabled, &c.TotalSales, &c.TotalEarnings,
			&c.ItemCount, &c.Rating, &c.RatingCount, &c.IsVerified, &c.IsFeatured, &c.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan creator: %w", err)
		}
		creators = append(creators, c)
	}

	return creators, nil
}
