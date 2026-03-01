package subscription

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

var (
	ErrSubscriptionNotFound = errors.New("subscription not found")
	ErrInvalidReceipt       = errors.New("invalid receipt")
	ErrAlreadySubscribed    = errors.New("already subscribed")
	ErrInsufficientCredits  = errors.New("insufficient credits")
)

type Tier string

const (
	TierFree    Tier = "free"
	TierPlus    Tier = "plus"
	TierPremium Tier = "premium"
	TierVIP     Tier = "vip"
)

type Platform string

const (
	PlatformIOS     Platform = "ios"
	PlatformAndroid Platform = "android"
)

// Subscription represents a user's subscription
type Subscription struct {
	ID                string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID            string    `gorm:"type:varchar(36);uniqueIndex;not null" json:"user_id"`
	Tier              Tier      `gorm:"type:varchar(32);not null" json:"tier"`
	ProductID         string    `gorm:"type:varchar(128)" json:"product_id"`
	Platform          Platform  `gorm:"type:varchar(16)" json:"platform"`
	OriginalTxID      string    `gorm:"type:varchar(255)" json:"original_tx_id"`
	LatestTxID        string    `gorm:"type:varchar(255)" json:"latest_tx_id"`
	PurchaseDate      time.Time `json:"purchase_date"`
	ExpiresAt         time.Time `json:"expires_at"`
	WillRenew         bool      `gorm:"default:true" json:"will_renew"`
	CancelledAt       *time.Time `json:"cancelled_at,omitempty"`
	IsTrialPeriod     bool      `gorm:"default:false" json:"is_trial_period"`
	IsIntroOfferPeriod bool     `gorm:"default:false" json:"is_intro_offer_period"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// UserCredits tracks consumable purchases and daily allowances
type UserCredits struct {
	ID                string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID            string    `gorm:"type:varchar(36);uniqueIndex;not null" json:"user_id"`
	Boosts            int       `gorm:"default:0" json:"boosts"`
	SuperLikes        int       `gorm:"default:0" json:"super_likes"`
	DailyLikesUsed    int       `gorm:"default:0" json:"daily_likes_used"`
	DailySuperLikesUsed int     `gorm:"default:0" json:"daily_super_likes_used"`
	LastDailyReset    time.Time `json:"last_daily_reset"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// Purchase records all purchases for audit
type Purchase struct {
	ID            string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID        string    `gorm:"type:varchar(36);index;not null" json:"user_id"`
	ProductID     string    `gorm:"type:varchar(128);not null" json:"product_id"`
	TransactionID string    `gorm:"type:varchar(255);uniqueIndex" json:"transaction_id"`
	Platform      Platform  `gorm:"type:varchar(16)" json:"platform"`
	Receipt       string    `gorm:"type:text" json:"receipt"`
	Amount        float64   `json:"amount"`
	Currency      string    `gorm:"type:varchar(8)" json:"currency"`
	Status        string    `gorm:"type:varchar(32)" json:"status"`
	PurchasedAt   time.Time `json:"purchased_at"`
	CreatedAt     time.Time `json:"created_at"`
}

// Entitlements defines what each tier gets
type Entitlements struct {
	DailyLikes          int  `json:"daily_likes"`          // -1 = unlimited
	DailySuperLikes     int  `json:"daily_super_likes"`
	Rewind              bool `json:"rewind"`
	SeeWhoLikesYou      bool `json:"see_who_likes_you"`
	AdvancedFilters     bool `json:"advanced_filters"`
	VRAccess            bool `json:"vr_access"`
	PrivateVRRooms      bool `json:"private_vr_rooms"`
	CustomAvatars       bool `json:"custom_avatars"`
	PremiumEnvironments bool `json:"premium_environments"`
	MonthlyBoosts       int  `json:"monthly_boosts"`
	PriorityMatching    bool `json:"priority_matching"`
	ReadReceipts        bool `json:"read_receipts"`
	IncognitoMode       bool `json:"incognito_mode"`
	PrioritySupport     bool `json:"priority_support"`
}

var TierEntitlements = map[Tier]Entitlements{
	TierFree: {
		DailyLikes:      50,
		DailySuperLikes: 1,
		VRAccess:        true,
	},
	TierPlus: {
		DailyLikes:       -1,
		DailySuperLikes:  5,
		Rewind:           true,
		SeeWhoLikesYou:   true,
		AdvancedFilters:  true,
		VRAccess:         true,
		MonthlyBoosts:    1,
		ReadReceipts:     true,
	},
	TierPremium: {
		DailyLikes:          -1,
		DailySuperLikes:     -1,
		Rewind:              true,
		SeeWhoLikesYou:      true,
		AdvancedFilters:     true,
		VRAccess:            true,
		PrivateVRRooms:      true,
		CustomAvatars:       true,
		PremiumEnvironments: true,
		MonthlyBoosts:       3,
		PriorityMatching:    true,
		ReadReceipts:        true,
		IncognitoMode:       true,
	},
	TierVIP: {
		DailyLikes:          -1,
		DailySuperLikes:     -1,
		Rewind:              true,
		SeeWhoLikesYou:      true,
		AdvancedFilters:     true,
		VRAccess:            true,
		PrivateVRRooms:      true,
		CustomAvatars:       true,
		PremiumEnvironments: true,
		MonthlyBoosts:       5,
		PriorityMatching:    true,
		ReadReceipts:        true,
		IncognitoMode:       true,
		PrioritySupport:     true,
	},
}

type Service struct {
	db            *gorm.DB
	iosValidator  ReceiptValidator
	androidValidator ReceiptValidator
}

type ReceiptValidator interface {
	Validate(ctx context.Context, receipt string) (*ReceiptInfo, error)
}

type ReceiptInfo struct {
	Valid             bool
	ProductID         string
	TransactionID     string
	OriginalTxID      string
	PurchaseDate      time.Time
	ExpiresAt         time.Time
	IsTrialPeriod     bool
	WillRenew         bool
	CancellationDate  *time.Time
}

func NewService(db *gorm.DB, iosValidator, androidValidator ReceiptValidator) *Service {
	return &Service{
		db:              db,
		iosValidator:    iosValidator,
		androidValidator: androidValidator,
	}
}

func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&Subscription{}, &UserCredits{}, &Purchase{})
}

// GetSubscription returns the user's current subscription
func (s *Service) GetSubscription(ctx context.Context, userID string) (*Subscription, error) {
	var sub Subscription
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &sub, err
}

// GetUserTier returns the user's current tier
func (s *Service) GetUserTier(ctx context.Context, userID string) (Tier, error) {
	sub, err := s.GetSubscription(ctx, userID)
	if err != nil {
		return TierFree, err
	}
	if sub == nil || time.Now().After(sub.ExpiresAt) {
		return TierFree, nil
	}
	return sub.Tier, nil
}

// GetEntitlements returns the user's current entitlements
func (s *Service) GetEntitlements(ctx context.Context, userID string) (Entitlements, error) {
	tier, err := s.GetUserTier(ctx, userID)
	if err != nil {
		return TierEntitlements[TierFree], err
	}
	return TierEntitlements[tier], nil
}

// VerifyAndCreateSubscription verifies a purchase receipt and creates/updates subscription
func (s *Service) VerifyAndCreateSubscription(ctx context.Context, userID, productID, receipt string, platform Platform) (*Subscription, error) {
	// Select validator based on platform
	var validator ReceiptValidator
	if platform == PlatformIOS {
		validator = s.iosValidator
	} else {
		validator = s.androidValidator
	}

	// Validate receipt
	info, err := validator.Validate(ctx, receipt)
	if err != nil {
		return nil, fmt.Errorf("receipt validation failed: %w", err)
	}
	if !info.Valid {
		return nil, ErrInvalidReceipt
	}

	// Determine tier from product ID
	tier := getTierFromProductID(productID)

	// Record purchase
	purchase := &Purchase{
		ID:            generateUUID(),
		UserID:        userID,
		ProductID:     productID,
		TransactionID: info.TransactionID,
		Platform:      platform,
		Receipt:       receipt,
		Status:        "completed",
		PurchasedAt:   info.PurchaseDate,
	}
	if err := s.db.WithContext(ctx).Create(purchase).Error; err != nil {
		// Ignore duplicate transaction errors
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, err
		}
	}

	// Create or update subscription
	var sub Subscription
	err = s.db.WithContext(ctx).Where("user_id = ?", userID).First(&sub).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create new subscription
		sub = Subscription{
			ID:           generateUUID(),
			UserID:       userID,
			Tier:         tier,
			ProductID:    productID,
			Platform:     platform,
			OriginalTxID: info.OriginalTxID,
			LatestTxID:   info.TransactionID,
			PurchaseDate: info.PurchaseDate,
			ExpiresAt:    info.ExpiresAt,
			WillRenew:    info.WillRenew,
			IsTrialPeriod: info.IsTrialPeriod,
		}
		if err := s.db.WithContext(ctx).Create(&sub).Error; err != nil {
			return nil, err
		}
	} else if err == nil {
		// Update existing subscription
		sub.Tier = tier
		sub.ProductID = productID
		sub.LatestTxID = info.TransactionID
		sub.ExpiresAt = info.ExpiresAt
		sub.WillRenew = info.WillRenew
		sub.IsTrialPeriod = info.IsTrialPeriod
		if err := s.db.WithContext(ctx).Save(&sub).Error; err != nil {
			return nil, err
		}
	} else {
		return nil, err
	}

	// Grant monthly boosts if applicable
	entitlements := TierEntitlements[tier]
	if entitlements.MonthlyBoosts > 0 {
		s.AddBoosts(ctx, userID, entitlements.MonthlyBoosts)
	}

	return &sub, nil
}

// CancelSubscription marks a subscription as cancelled
func (s *Service) CancelSubscription(ctx context.Context, userID string) error {
	now := time.Now()
	return s.db.WithContext(ctx).
		Model(&Subscription{}).
		Where("user_id = ?", userID).
		Updates(map[string]interface{}{
			"will_renew":    false,
			"cancelled_at":  now,
		}).Error
}

// GetUserCredits returns or creates user credits
func (s *Service) GetUserCredits(ctx context.Context, userID string) (*UserCredits, error) {
	var credits UserCredits
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&credits).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		credits = UserCredits{
			ID:             generateUUID(),
			UserID:         userID,
			LastDailyReset: time.Now(),
		}
		if err := s.db.WithContext(ctx).Create(&credits).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	// Check if daily reset needed
	if time.Since(credits.LastDailyReset) > 24*time.Hour {
		credits.DailyLikesUsed = 0
		credits.DailySuperLikesUsed = 0
		credits.LastDailyReset = time.Now()
		s.db.WithContext(ctx).Save(&credits)
	}

	return &credits, nil
}

// AddBoosts adds boosts to user's account
func (s *Service) AddBoosts(ctx context.Context, userID string, count int) error {
	credits, err := s.GetUserCredits(ctx, userID)
	if err != nil {
		return err
	}

	credits.Boosts += count
	return s.db.WithContext(ctx).Save(credits).Error
}

// UseBoost consumes a boost
func (s *Service) UseBoost(ctx context.Context, userID string) (int, error) {
	credits, err := s.GetUserCredits(ctx, userID)
	if err != nil {
		return 0, err
	}

	if credits.Boosts <= 0 {
		return 0, ErrInsufficientCredits
	}

	credits.Boosts--
	if err := s.db.WithContext(ctx).Save(credits).Error; err != nil {
		return 0, err
	}

	return credits.Boosts, nil
}

// AddSuperLikes adds super likes to user's account
func (s *Service) AddSuperLikes(ctx context.Context, userID string, count int) error {
	credits, err := s.GetUserCredits(ctx, userID)
	if err != nil {
		return err
	}

	credits.SuperLikes += count
	return s.db.WithContext(ctx).Save(credits).Error
}

// UseSuperLike consumes a super like
func (s *Service) UseSuperLike(ctx context.Context, userID string) (int, error) {
	credits, err := s.GetUserCredits(ctx, userID)
	if err != nil {
		return 0, err
	}

	entitlements, _ := s.GetEntitlements(ctx, userID)

	// Check if user has unlimited super likes
	if entitlements.DailySuperLikes == -1 {
		return -1, nil
	}

	// Check purchased super likes first
	if credits.SuperLikes > 0 {
		credits.SuperLikes--
		s.db.WithContext(ctx).Save(credits)
		return credits.SuperLikes, nil
	}

	// Check daily allowance
	remaining := entitlements.DailySuperLikes - credits.DailySuperLikesUsed
	if remaining <= 0 {
		return 0, ErrInsufficientCredits
	}

	credits.DailySuperLikesUsed++
	if err := s.db.WithContext(ctx).Save(credits).Error; err != nil {
		return 0, err
	}

	return remaining - 1, nil
}

// CanUseLike checks if user can use a like
func (s *Service) CanUseLike(ctx context.Context, userID string) (bool, int, error) {
	credits, err := s.GetUserCredits(ctx, userID)
	if err != nil {
		return false, 0, err
	}

	entitlements, _ := s.GetEntitlements(ctx, userID)

	if entitlements.DailyLikes == -1 {
		return true, -1, nil
	}

	remaining := entitlements.DailyLikes - credits.DailyLikesUsed
	return remaining > 0, remaining, nil
}

// UseLike records a like usage
func (s *Service) UseLike(ctx context.Context, userID string) (int, error) {
	can, remaining, err := s.CanUseLike(ctx, userID)
	if err != nil {
		return 0, err
	}
	if !can {
		return 0, ErrInsufficientCredits
	}

	credits, _ := s.GetUserCredits(ctx, userID)
	credits.DailyLikesUsed++
	s.db.WithContext(ctx).Save(credits)

	return remaining - 1, nil
}

// HasEntitlement checks if user has a specific entitlement
func (s *Service) HasEntitlement(ctx context.Context, userID string, entitlement string) (bool, error) {
	e, err := s.GetEntitlements(ctx, userID)
	if err != nil {
		return false, err
	}

	switch entitlement {
	case "rewind":
		return e.Rewind, nil
	case "see_who_likes_you":
		return e.SeeWhoLikesYou, nil
	case "advanced_filters":
		return e.AdvancedFilters, nil
	case "private_vr_rooms":
		return e.PrivateVRRooms, nil
	case "custom_avatars":
		return e.CustomAvatars, nil
	case "premium_environments":
		return e.PremiumEnvironments, nil
	case "priority_matching":
		return e.PriorityMatching, nil
	case "read_receipts":
		return e.ReadReceipts, nil
	case "incognito_mode":
		return e.IncognitoMode, nil
	case "priority_support":
		return e.PrioritySupport, nil
	default:
		return false, nil
	}
}

func getTierFromProductID(productID string) Tier {
	switch {
	case contains(productID, "vip"):
		return TierVIP
	case contains(productID, "premium"):
		return TierPremium
	case contains(productID, "plus"):
		return TierPlus
	default:
		return TierFree
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr, 0))
}

func containsAt(s, substr string, start int) bool {
	for i := start; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
