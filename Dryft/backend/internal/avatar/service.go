package avatar

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrItemNotOwned = errors.New("item not owned by user")
)

// AvatarState represents a user's avatar customization
type AvatarState struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID         uuid.UUID `gorm:"type:uuid;not null;uniqueIndex"`
	EquippedAvatar string    `gorm:"type:varchar(100)"`
	EquippedOutfit string    `gorm:"type:varchar(100)"`
	EquippedEffect string    `gorm:"type:varchar(100)"`
	SkinTone       string    `gorm:"type:varchar(20)"` // Hex color
	HairColor      string    `gorm:"type:varchar(20)"` // Hex color
	EyeColor       string    `gorm:"type:varchar(20)"` // Hex color
	DisplayName    string    `gorm:"type:varchar(50)"`
	IsVisible      bool      `gorm:"default:true"`
	UpdatedAt      time.Time `gorm:"not null;default:now()"`
}

// EquipHistory tracks item equip/unequip history
type EquipHistory struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	ItemID    string    `gorm:"type:varchar(100);not null"`
	ItemType  string    `gorm:"type:varchar(20);not null"` // avatar, outfit, effect
	Action    string    `gorm:"type:varchar(10);not null"` // equip, unequip
	CreatedAt time.Time `gorm:"not null;default:now()"`
}

// Service handles avatar customization
type Service struct {
	db *gorm.DB
}

// NewService creates a new avatar service
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// GetAvatarState gets a user's avatar state
func (s *Service) GetAvatarState(ctx context.Context, userID uuid.UUID) (*AvatarState, error) {
	var state AvatarState
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&state).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create default state
		state = AvatarState{
			UserID:    userID,
			SkinTone:  "FFFFFFFF", // White
			HairColor: "000000FF", // Black
			EyeColor:  "0000FFFF", // Blue
			IsVisible: true,
		}
		if err := s.db.WithContext(ctx).Create(&state).Error; err != nil {
			return nil, err
		}
		return &state, nil
	}

	return &state, err
}

// UpdateAvatarState updates a user's avatar state
func (s *Service) UpdateAvatarState(ctx context.Context, userID uuid.UUID, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()

	result := s.db.WithContext(ctx).
		Model(&AvatarState{}).
		Where("user_id = ?", userID).
		Updates(updates)

	if result.Error != nil {
		return result.Error
	}

	// If no rows affected, create the state
	if result.RowsAffected == 0 {
		state := AvatarState{
			UserID:    userID,
			SkinTone:  "FFFFFFFF",
			HairColor: "000000FF",
			EyeColor:  "0000FFFF",
			IsVisible: true,
		}

		// Apply updates
		if v, ok := updates["equipped_avatar"].(string); ok {
			state.EquippedAvatar = v
		}
		if v, ok := updates["equipped_outfit"].(string); ok {
			state.EquippedOutfit = v
		}
		if v, ok := updates["equipped_effect"].(string); ok {
			state.EquippedEffect = v
		}
		if v, ok := updates["skin_tone"].(string); ok {
			state.SkinTone = v
		}
		if v, ok := updates["hair_color"].(string); ok {
			state.HairColor = v
		}
		if v, ok := updates["eye_color"].(string); ok {
			state.EyeColor = v
		}
		if v, ok := updates["display_name"].(string); ok {
			state.DisplayName = v
		}
		if v, ok := updates["is_visible"].(bool); ok {
			state.IsVisible = v
		}

		return s.db.WithContext(ctx).Create(&state).Error
	}

	return nil
}

// EquipItem equips an item to the avatar
func (s *Service) EquipItem(ctx context.Context, userID uuid.UUID, itemID, itemType string) error {
	// Determine which field to update
	var field string
	switch itemType {
	case "avatar":
		field = "equipped_avatar"
	case "outfit":
		field = "equipped_outfit"
	case "effect":
		field = "equipped_effect"
	default:
		return errors.New("invalid item type")
	}

	// Update avatar state
	err := s.UpdateAvatarState(ctx, userID, map[string]interface{}{
		field: itemID,
	})
	if err != nil {
		return err
	}

	// Record history
	history := EquipHistory{
		UserID:   userID,
		ItemID:   itemID,
		ItemType: itemType,
		Action:   "equip",
	}
	return s.db.WithContext(ctx).Create(&history).Error
}

// UnequipItem removes an equipped item
func (s *Service) UnequipItem(ctx context.Context, userID uuid.UUID, itemType string) error {
	// Get current state to record unequip
	state, err := s.GetAvatarState(ctx, userID)
	if err != nil {
		return err
	}

	var field string
	var currentItemID string
	switch itemType {
	case "avatar":
		field = "equipped_avatar"
		currentItemID = state.EquippedAvatar
	case "outfit":
		field = "equipped_outfit"
		currentItemID = state.EquippedOutfit
	case "effect":
		field = "equipped_effect"
		currentItemID = state.EquippedEffect
	default:
		return errors.New("invalid item type")
	}

	// Update avatar state
	err = s.UpdateAvatarState(ctx, userID, map[string]interface{}{
		field: "",
	})
	if err != nil {
		return err
	}

	// Record history if there was an item
	if currentItemID != "" {
		history := EquipHistory{
			UserID:   userID,
			ItemID:   currentItemID,
			ItemType: itemType,
			Action:   "unequip",
		}
		return s.db.WithContext(ctx).Create(&history).Error
	}

	return nil
}

// SetColors updates avatar colors
func (s *Service) SetColors(ctx context.Context, userID uuid.UUID, skinTone, hairColor, eyeColor string) error {
	updates := make(map[string]interface{})

	if skinTone != "" {
		updates["skin_tone"] = skinTone
	}
	if hairColor != "" {
		updates["hair_color"] = hairColor
	}
	if eyeColor != "" {
		updates["eye_color"] = eyeColor
	}

	if len(updates) == 0 {
		return nil
	}

	return s.UpdateAvatarState(ctx, userID, updates)
}

// SetDisplayName updates the display name
func (s *Service) SetDisplayName(ctx context.Context, userID uuid.UUID, displayName string) error {
	return s.UpdateAvatarState(ctx, userID, map[string]interface{}{
		"display_name": displayName,
	})
}

// SetVisibility updates avatar visibility
func (s *Service) SetVisibility(ctx context.Context, userID uuid.UUID, visible bool) error {
	return s.UpdateAvatarState(ctx, userID, map[string]interface{}{
		"is_visible": visible,
	})
}

// GetEquipHistory gets equip history for a user
func (s *Service) GetEquipHistory(ctx context.Context, userID uuid.UUID, limit int) ([]EquipHistory, error) {
	var history []EquipHistory

	if limit == 0 {
		limit = 50
	}

	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&history).Error

	return history, err
}

// GetMultipleAvatarStates gets avatar states for multiple users (for displaying in VR)
func (s *Service) GetMultipleAvatarStates(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID]*AvatarState, error) {
	var states []AvatarState
	err := s.db.WithContext(ctx).Where("user_id IN ?", userIDs).Find(&states).Error
	if err != nil {
		return nil, err
	}

	result := make(map[uuid.UUID]*AvatarState)
	for i := range states {
		result[states[i].UserID] = &states[i]
	}

	return result, nil
}
