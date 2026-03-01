package links

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

var (
	ErrLinkNotFound  = errors.New("link not found")
	ErrLinkExpired   = errors.New("link has expired")
	ErrInvalidLink   = errors.New("invalid link")
	ErrLinkUsed      = errors.New("link has already been used")
)

type LinkType string

const (
	LinkTypeProfile      LinkType = "profile"
	LinkTypeVRInvite     LinkType = "vr_invite"
	LinkTypeVRRoom       LinkType = "vr_room"
	LinkTypePasswordReset LinkType = "password_reset"
	LinkTypeEmailVerify  LinkType = "email_verify"
	LinkTypeShare        LinkType = "share"
)

// Link represents a deep link in the database
type Link struct {
	ID          string            `gorm:"primaryKey;type:varchar(36)" json:"id"`
	Type        LinkType          `gorm:"type:varchar(32);not null;index" json:"type"`
	Code        string            `gorm:"type:varchar(64);uniqueIndex;not null" json:"code"`
	UserID      string            `gorm:"type:varchar(36);index" json:"user_id,omitempty"`
	TargetID    string            `gorm:"type:varchar(36)" json:"target_id,omitempty"`
	Metadata    map[string]string `gorm:"type:jsonb" json:"metadata,omitempty"`
	ExpiresAt   *time.Time        `json:"expires_at,omitempty"`
	UsedAt      *time.Time        `json:"used_at,omitempty"`
	MaxUses     int               `gorm:"default:1" json:"max_uses"`
	UseCount    int               `gorm:"default:0" json:"use_count"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// VRInvite represents a VR date invitation
type VRInvite struct {
	ID        string     `gorm:"primaryKey;type:varchar(36)" json:"id"`
	Code      string     `gorm:"type:varchar(16);uniqueIndex;not null" json:"code"`
	HostID    string     `gorm:"type:varchar(36);not null;index" json:"host_id"`
	GuestID   string     `gorm:"type:varchar(36);index" json:"guest_id,omitempty"`
	RoomID    string     `gorm:"type:varchar(36)" json:"room_id,omitempty"`
	RoomType  string     `gorm:"type:varchar(32);default:'private'" json:"room_type"`
	Status    string     `gorm:"type:varchar(32);default:'pending'" json:"status"`
	ExpiresAt time.Time  `json:"expires_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type Service struct {
	db      *gorm.DB
	baseURL string
}

func NewService(db *gorm.DB, baseURL string) *Service {
	return &Service{
		db:      db,
		baseURL: baseURL,
	}
}

// AutoMigrate creates the database tables
func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&Link{}, &VRInvite{})
}

// GenerateCode creates a random URL-safe code
func GenerateCode(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes)[:length], nil
}

// CreateLink creates a new deep link
func (s *Service) CreateLink(ctx context.Context, linkType LinkType, userID, targetID string, metadata map[string]string, expiresIn time.Duration, maxUses int) (*Link, error) {
	code, err := GenerateCode(12)
	if err != nil {
		return nil, fmt.Errorf("failed to generate code: %w", err)
	}

	var expiresAt *time.Time
	if expiresIn > 0 {
		t := time.Now().Add(expiresIn)
		expiresAt = &t
	}

	link := &Link{
		ID:        generateUUID(),
		Type:      linkType,
		Code:      code,
		UserID:    userID,
		TargetID:  targetID,
		Metadata:  metadata,
		ExpiresAt: expiresAt,
		MaxUses:   maxUses,
	}

	if err := s.db.WithContext(ctx).Create(link).Error; err != nil {
		return nil, fmt.Errorf("failed to create link: %w", err)
	}

	return link, nil
}

// GetLink retrieves a link by code
func (s *Service) GetLink(ctx context.Context, code string) (*Link, error) {
	var link Link
	if err := s.db.WithContext(ctx).Where("code = ?", code).First(&link).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrLinkNotFound
		}
		return nil, err
	}
	return &link, nil
}

// ValidateLink checks if a link is valid and usable
func (s *Service) ValidateLink(ctx context.Context, code string) (*Link, error) {
	link, err := s.GetLink(ctx, code)
	if err != nil {
		return nil, err
	}

	// Check expiration
	if link.ExpiresAt != nil && time.Now().After(*link.ExpiresAt) {
		return nil, ErrLinkExpired
	}

	// Check max uses
	if link.MaxUses > 0 && link.UseCount >= link.MaxUses {
		return nil, ErrLinkUsed
	}

	return link, nil
}

// UseLink marks a link as used
func (s *Service) UseLink(ctx context.Context, code string) (*Link, error) {
	link, err := s.ValidateLink(ctx, code)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	updates := map[string]interface{}{
		"use_count": gorm.Expr("use_count + 1"),
		"used_at":   now,
	}

	if err := s.db.WithContext(ctx).Model(link).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update link: %w", err)
	}

	link.UseCount++
	link.UsedAt = &now
	return link, nil
}

// VR Invite methods

// CreateVRInvite creates a new VR date invitation
func (s *Service) CreateVRInvite(ctx context.Context, hostID string, guestID string, roomType string, expiresIn time.Duration) (*VRInvite, error) {
	code, err := GenerateCode(8)
	if err != nil {
		return nil, fmt.Errorf("failed to generate invite code: %w", err)
	}

	// Make code uppercase for easier sharing
	code = fmt.Sprintf("%s", code[:8])

	invite := &VRInvite{
		ID:        generateUUID(),
		Code:      code,
		HostID:    hostID,
		GuestID:   guestID,
		RoomType:  roomType,
		Status:    "pending",
		ExpiresAt: time.Now().Add(expiresIn),
	}

	if err := s.db.WithContext(ctx).Create(invite).Error; err != nil {
		return nil, fmt.Errorf("failed to create VR invite: %w", err)
	}

	return invite, nil
}

// GetVRInvite retrieves a VR invite by code
func (s *Service) GetVRInvite(ctx context.Context, code string) (*VRInvite, error) {
	var invite VRInvite
	if err := s.db.WithContext(ctx).Where("code = ?", code).First(&invite).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrLinkNotFound
		}
		return nil, err
	}
	return &invite, nil
}

// ValidateVRInvite checks if a VR invite is valid
func (s *Service) ValidateVRInvite(ctx context.Context, code string) (*VRInvite, error) {
	invite, err := s.GetVRInvite(ctx, code)
	if err != nil {
		return nil, err
	}

	// Check expiration
	if time.Now().After(invite.ExpiresAt) {
		return nil, ErrLinkExpired
	}

	// Check status
	if invite.Status != "pending" {
		return nil, ErrLinkUsed
	}

	return invite, nil
}

// AcceptVRInvite marks an invite as accepted
func (s *Service) AcceptVRInvite(ctx context.Context, code string, guestID string) (*VRInvite, error) {
	invite, err := s.ValidateVRInvite(ctx, code)
	if err != nil {
		return nil, err
	}

	// If invite has a specific guest, verify it matches
	if invite.GuestID != "" && invite.GuestID != guestID {
		return nil, ErrInvalidLink
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":      "accepted",
		"guest_id":    guestID,
		"accepted_at": now,
	}

	if err := s.db.WithContext(ctx).Model(invite).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to accept invite: %w", err)
	}

	invite.Status = "accepted"
	invite.GuestID = guestID
	invite.AcceptedAt = &now
	return invite, nil
}

// DeclineVRInvite marks an invite as declined
func (s *Service) DeclineVRInvite(ctx context.Context, code string) error {
	invite, err := s.GetVRInvite(ctx, code)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Model(invite).Update("status", "declined").Error
}

// CancelVRInvite cancels an invite (by host)
func (s *Service) CancelVRInvite(ctx context.Context, code string, hostID string) error {
	invite, err := s.GetVRInvite(ctx, code)
	if err != nil {
		return err
	}

	if invite.HostID != hostID {
		return ErrInvalidLink
	}

	return s.db.WithContext(ctx).Model(invite).Update("status", "cancelled").Error
}

// GetUserVRInvites gets all VR invites for a user (as host or guest)
func (s *Service) GetUserVRInvites(ctx context.Context, userID string, status string) ([]VRInvite, error) {
	var invites []VRInvite
	query := s.db.WithContext(ctx).Where("host_id = ? OR guest_id = ?", userID, userID)

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Order("created_at DESC").Find(&invites).Error; err != nil {
		return nil, err
	}

	return invites, nil
}

// BuildLinkURL constructs the full URL for a link
func (s *Service) BuildLinkURL(linkType LinkType, code string) string {
	switch linkType {
	case LinkTypeProfile:
		return fmt.Sprintf("%s/profile/%s", s.baseURL, code)
	case LinkTypeVRInvite:
		return fmt.Sprintf("%s/vr/invite/%s", s.baseURL, code)
	case LinkTypeVRRoom:
		return fmt.Sprintf("%s/vr/room/%s", s.baseURL, code)
	case LinkTypePasswordReset:
		return fmt.Sprintf("%s/reset-password/%s", s.baseURL, code)
	case LinkTypeEmailVerify:
		return fmt.Sprintf("%s/verify-email/%s", s.baseURL, code)
	default:
		return fmt.Sprintf("%s/link/%s", s.baseURL, code)
	}
}

// CleanupExpiredLinks removes old expired links
func (s *Service) CleanupExpiredLinks(ctx context.Context) error {
	// Delete links expired more than 30 days ago
	cutoff := time.Now().Add(-30 * 24 * time.Hour)

	if err := s.db.WithContext(ctx).Where("expires_at < ?", cutoff).Delete(&Link{}).Error; err != nil {
		return err
	}

	if err := s.db.WithContext(ctx).Where("expires_at < ?", cutoff).Delete(&VRInvite{}).Error; err != nil {
		return err
	}

	return nil
}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
