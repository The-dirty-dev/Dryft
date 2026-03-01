package models

import (
	"time"

	"github.com/google/uuid"
)

// ItemType represents the type of marketplace item
type ItemType string

const (
	ItemTypeAvatar  ItemType = "avatar"
	ItemTypeOutfit  ItemType = "outfit"
	ItemTypeToy     ItemType = "toy"
	ItemTypeEffect  ItemType = "effect"
	ItemTypeGesture ItemType = "gesture"
)

// ItemStatus represents the status of an item listing
type ItemStatus string

const (
	ItemStatusDraft    ItemStatus = "draft"
	ItemStatusPending  ItemStatus = "pending"  // Awaiting review
	ItemStatusApproved ItemStatus = "approved"
	ItemStatusRejected ItemStatus = "rejected"
	ItemStatusDisabled ItemStatus = "disabled"
)

// StoreItem represents a purchasable item in the marketplace
type StoreItem struct {
	ID          uuid.UUID  `json:"id"`
	CreatorID   uuid.UUID  `json:"creator_id"`
	Type        ItemType   `json:"type"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Price       int64      `json:"price"` // Price in cents
	Currency    string     `json:"currency"`

	// Assets
	ThumbnailURL string  `json:"thumbnail_url"`
	PreviewURL   *string `json:"preview_url,omitempty"`   // 3D preview or video
	AssetBundle  string  `json:"asset_bundle"`            // Unity asset bundle URL

	// Metadata
	Tags       []string          `json:"tags"`
	Attributes map[string]string `json:"attributes,omitempty"` // e.g., color, size

	// Stats
	PurchaseCount int64   `json:"purchase_count"`
	Rating        float64 `json:"rating"`
	RatingCount   int64   `json:"rating_count"`

	// Status
	Status     ItemStatus `json:"status"`
	IsFeatured bool       `json:"is_featured"`

	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"-"`
}

// ItemCategory represents a category for organizing items
type ItemCategory struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description,omitempty"`
	ParentID    *uuid.UUID `json:"parent_id,omitempty"`
	SortOrder   int       `json:"sort_order"`
	IconURL     *string   `json:"icon_url,omitempty"`
}

// Purchase represents a completed purchase
type Purchase struct {
	ID        uuid.UUID `json:"id"`
	BuyerID   uuid.UUID `json:"buyer_id"`
	ItemID    uuid.UUID `json:"item_id"`
	CreatorID uuid.UUID `json:"creator_id"`

	// Payment details
	Amount          int64  `json:"amount"`           // Amount paid in cents
	Currency        string `json:"currency"`
	PlatformFee     int64  `json:"platform_fee"`     // Our cut
	CreatorPayout   int64  `json:"creator_payout"`   // Creator's share
	StripePaymentID string `json:"stripe_payment_id"`

	// Status
	Status    PurchaseStatus `json:"status"`
	RefundedAt *time.Time    `json:"refunded_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

// PurchaseStatus represents the status of a purchase
type PurchaseStatus string

const (
	PurchaseStatusPending   PurchaseStatus = "pending"
	PurchaseStatusCompleted PurchaseStatus = "completed"
	PurchaseStatusRefunded  PurchaseStatus = "refunded"
	PurchaseStatusFailed    PurchaseStatus = "failed"
)

// UserInventory represents an item owned by a user
type UserInventory struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	ItemID     uuid.UUID  `json:"item_id"`
	PurchaseID uuid.UUID  `json:"purchase_id"`
	IsEquipped bool       `json:"is_equipped"`
	AcquiredAt time.Time  `json:"acquired_at"`
}

// InventoryItemWithDetails combines inventory entry with item details
type InventoryItemWithDetails struct {
	UserInventory
	Item StoreItem `json:"item"`
}

// Creator represents a creator account for selling items
type Creator struct {
	ID     uuid.UUID `json:"id"`
	UserID uuid.UUID `json:"user_id"`

	// Profile
	StoreName   string  `json:"store_name"`
	Description *string `json:"description,omitempty"`
	LogoURL     *string `json:"logo_url,omitempty"`
	BannerURL   *string `json:"banner_url,omitempty"`

	// Stripe Connect
	StripeAccountID   *string `json:"stripe_account_id,omitempty"`
	StripeOnboarded   bool    `json:"stripe_onboarded"`
	PayoutsEnabled    bool    `json:"payouts_enabled"`

	// Stats
	TotalSales    int64   `json:"total_sales"`
	TotalEarnings int64   `json:"total_earnings"` // In cents
	ItemCount     int     `json:"item_count"`
	Rating        float64 `json:"rating"`
	RatingCount   int64   `json:"rating_count"`

	// Status
	IsVerified bool `json:"is_verified"`
	IsFeatured bool `json:"is_featured"`

	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// CreatorPayout represents a payout to a creator
type CreatorPayout struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`

	Amount   int64  `json:"amount"` // In cents
	Currency string `json:"currency"`

	// Stripe
	StripeTransferID *string `json:"stripe_transfer_id,omitempty"`
	StripePayoutID   *string `json:"stripe_payout_id,omitempty"`

	Status    PayoutStatus `json:"status"`
	PaidAt    *time.Time   `json:"paid_at,omitempty"`
	FailedAt  *time.Time   `json:"failed_at,omitempty"`
	FailReason *string     `json:"fail_reason,omitempty"`

	// Period this payout covers
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`

	CreatedAt time.Time `json:"created_at"`
}

// PayoutStatus represents the status of a payout
type PayoutStatus string

const (
	PayoutStatusPending    PayoutStatus = "pending"
	PayoutStatusProcessing PayoutStatus = "processing"
	PayoutStatusPaid       PayoutStatus = "paid"
	PayoutStatusFailed     PayoutStatus = "failed"
)

// ItemReview represents a user review of an item
type ItemReview struct {
	ID       uuid.UUID `json:"id"`
	ItemID   uuid.UUID `json:"item_id"`
	UserID   uuid.UUID `json:"user_id"`
	Rating   int       `json:"rating"` // 1-5
	Comment  *string   `json:"comment,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// StoreItemPublic is the public view of a store item
type StoreItemPublic struct {
	ID            uuid.UUID  `json:"id"`
	CreatorID     uuid.UUID  `json:"creator_id"`
	CreatorName   string     `json:"creator_name"`
	Type          ItemType   `json:"type"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	Price         int64      `json:"price"`
	Currency      string     `json:"currency"`
	ThumbnailURL  string     `json:"thumbnail_url"`
	PreviewURL    *string    `json:"preview_url,omitempty"`
	Tags          []string   `json:"tags"`
	PurchaseCount int64      `json:"purchase_count"`
	Rating        float64    `json:"rating"`
	RatingCount   int64      `json:"rating_count"`
	IsFeatured    bool       `json:"is_featured"`
	IsOwned       bool       `json:"is_owned"` // Whether current user owns it
}

// PlatformFeePercent is the platform's cut of each sale (15%)
const PlatformFeePercent = 15

// CalculatePayoutSplit calculates the platform fee and creator payout
func CalculatePayoutSplit(priceInCents int64) (platformFee, creatorPayout int64) {
	platformFee = (priceInCents * PlatformFeePercent) / 100
	creatorPayout = priceInCents - platformFee
	return
}
