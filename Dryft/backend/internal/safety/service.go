package safety

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound     = errors.New("user not found")
	ErrAlreadyBlocked   = errors.New("user already blocked")
	ErrNotBlocked       = errors.New("user not blocked")
	ErrCannotBlockSelf  = errors.New("cannot block yourself")
	ErrInvalidCategory  = errors.New("invalid report category")
	ErrDuplicateReport  = errors.New("duplicate report within cooldown period")
)

// Valid report categories
var ValidCategories = []string{
	"harassment",
	"inappropriate_content",
	"spam",
	"impersonation",
	"underage",
	"threats",
	"other",
}

// Service handles safety features
type Service struct {
	db *gorm.DB
}

// NewService creates a new safety service
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// BlockedUser represents a blocked user relationship
type BlockedUser struct {
	ID            uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID        uuid.UUID `gorm:"type:uuid;not null;index:idx_blocked_user"`
	BlockedUserID uuid.UUID `gorm:"type:uuid;not null;index:idx_blocked_user"`
	Reason        string    `gorm:"type:varchar(500)"`
	CreatedAt     time.Time `gorm:"not null;default:now()"`
}

// Report represents a user report
type Report struct {
	ID             uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	ReporterID     uuid.UUID  `gorm:"type:uuid;not null;index"`
	ReportedUserID uuid.UUID  `gorm:"type:uuid;not null;index"`
	Category       string     `gorm:"type:varchar(50);not null"`
	Reason         string     `gorm:"type:varchar(500);not null"`
	Description    string     `gorm:"type:text"`
	EvidenceURLs   []string   `gorm:"type:text[];serializer:json"`
	SessionID      *uuid.UUID `gorm:"type:uuid"`
	Status         string     `gorm:"type:varchar(20);not null;default:'pending'"` // pending, reviewing, resolved, dismissed
	ReviewerID     *uuid.UUID `gorm:"type:uuid"`
	ReviewedAt     *time.Time
	Resolution     string    `gorm:"type:text"`
	CreatedAt      time.Time `gorm:"not null;default:now()"`
	UpdatedAt      time.Time `gorm:"not null;default:now()"`
}

// PanicEvent records panic button activations
type PanicEvent struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index"`
	SessionID *uuid.UUID `gorm:"type:uuid"`
	Location  string     `gorm:"type:varchar(100)"`
	CreatedAt time.Time  `gorm:"not null;default:now()"`
}

// Warning issued to a user
type Warning struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index"`
	Type      string     `gorm:"type:varchar(20);not null"` // warning, strike, suspension, ban
	Reason    string     `gorm:"type:text;not null"`
	Message   string     `gorm:"type:text"`
	IssuedBy  uuid.UUID  `gorm:"type:uuid;not null"` // Admin/moderator ID
	ExpiresAt *time.Time
	CreatedAt time.Time `gorm:"not null;default:now()"`
}

// BlockUser blocks another user
func (s *Service) BlockUser(ctx context.Context, userID, blockedUserID uuid.UUID, reason string) error {
	if userID == blockedUserID {
		return ErrCannotBlockSelf
	}

	// Check if already blocked
	var existing BlockedUser
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND blocked_user_id = ?", userID, blockedUserID).
		First(&existing).Error

	if err == nil {
		return ErrAlreadyBlocked
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// Create block
	block := BlockedUser{
		UserID:        userID,
		BlockedUserID: blockedUserID,
		Reason:        reason,
	}

	return s.db.WithContext(ctx).Create(&block).Error
}

// UnblockUser removes a block
func (s *Service) UnblockUser(ctx context.Context, userID, blockedUserID uuid.UUID) error {
	result := s.db.WithContext(ctx).
		Where("user_id = ? AND blocked_user_id = ?", userID, blockedUserID).
		Delete(&BlockedUser{})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotBlocked
	}
	return nil
}

// IsBlocked checks if a user is blocked
func (s *Service) IsBlocked(ctx context.Context, userID, potentiallyBlockedID uuid.UUID) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&BlockedUser{}).
		Where("user_id = ? AND blocked_user_id = ?", userID, potentiallyBlockedID).
		Count(&count).Error

	return count > 0, err
}

// GetBlockedUsers returns all users blocked by a user
func (s *Service) GetBlockedUsers(ctx context.Context, userID uuid.UUID) ([]BlockedUser, error) {
	var blocks []BlockedUser
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&blocks).Error

	return blocks, err
}

// SubmitReport creates a new report
func (s *Service) SubmitReport(ctx context.Context, report *Report) error {
	// Validate category
	if !isValidCategory(report.Category) {
		return ErrInvalidCategory
	}

	// Check for duplicate reports (same reporter, same user, within 24 hours)
	var recentCount int64
	s.db.WithContext(ctx).
		Model(&Report{}).
		Where("reporter_id = ? AND reported_user_id = ? AND created_at > ?",
			report.ReporterID, report.ReportedUserID, time.Now().Add(-24*time.Hour)).
		Count(&recentCount)

	if recentCount > 0 {
		return ErrDuplicateReport
	}

	report.Status = "pending"
	return s.db.WithContext(ctx).Create(report).Error
}

// GetReport gets a report by ID
func (s *Service) GetReport(ctx context.Context, reportID uuid.UUID) (*Report, error) {
	var report Report
	err := s.db.WithContext(ctx).First(&report, reportID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &report, err
}

// GetUserReports gets reports filed by a user
func (s *Service) GetUserReports(ctx context.Context, userID uuid.UUID) ([]Report, error) {
	var reports []Report
	err := s.db.WithContext(ctx).
		Where("reporter_id = ?", userID).
		Order("created_at DESC").
		Find(&reports).Error

	return reports, err
}

// GetReportsAgainstUser gets reports against a user (admin only)
func (s *Service) GetReportsAgainstUser(ctx context.Context, userID uuid.UUID) ([]Report, error) {
	var reports []Report
	err := s.db.WithContext(ctx).
		Where("reported_user_id = ?", userID).
		Order("created_at DESC").
		Find(&reports).Error

	return reports, err
}

// GetPendingReports gets all pending reports (admin only)
func (s *Service) GetPendingReports(ctx context.Context, limit, offset int) ([]Report, int64, error) {
	var reports []Report
	var total int64

	s.db.WithContext(ctx).Model(&Report{}).Where("status = ?", "pending").Count(&total)

	err := s.db.WithContext(ctx).
		Where("status = ?", "pending").
		Order("created_at ASC").
		Limit(limit).
		Offset(offset).
		Find(&reports).Error

	return reports, total, err
}

// UpdateReportStatus updates a report's status (admin only)
func (s *Service) UpdateReportStatus(ctx context.Context, reportID uuid.UUID, reviewerID uuid.UUID, status, resolution string) error {
	now := time.Now()
	return s.db.WithContext(ctx).
		Model(&Report{}).
		Where("id = ?", reportID).
		Updates(map[string]interface{}{
			"status":      status,
			"reviewer_id": reviewerID,
			"reviewed_at": now,
			"resolution":  resolution,
			"updated_at":  now,
		}).Error
}

// RecordPanicEvent records a panic button activation
func (s *Service) RecordPanicEvent(ctx context.Context, event *PanicEvent) error {
	return s.db.WithContext(ctx).Create(event).Error
}

// GetPanicEvents gets panic events for a user (admin)
func (s *Service) GetPanicEvents(ctx context.Context, userID uuid.UUID) ([]PanicEvent, error) {
	var events []PanicEvent
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&events).Error

	return events, err
}

// IssueWarning issues a warning to a user (admin only)
func (s *Service) IssueWarning(ctx context.Context, warning *Warning) error {
	return s.db.WithContext(ctx).Create(warning).Error
}

// GetUserWarnings gets warnings for a user
func (s *Service) GetUserWarnings(ctx context.Context, userID uuid.UUID) ([]Warning, error) {
	var warnings []Warning
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&warnings).Error

	return warnings, err
}

// GetActiveWarnings gets active (non-expired) warnings
func (s *Service) GetActiveWarnings(ctx context.Context, userID uuid.UUID) ([]Warning, error) {
	var warnings []Warning
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND (expires_at IS NULL OR expires_at > ?)", userID, time.Now()).
		Order("created_at DESC").
		Find(&warnings).Error

	return warnings, err
}

// CountStrikes counts active strikes for a user
func (s *Service) CountStrikes(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&Warning{}).
		Where("user_id = ? AND type IN (?, ?) AND (expires_at IS NULL OR expires_at > ?)",
			userID, "strike", "warning", time.Now()).
		Count(&count).Error

	return count, err
}

// IsUserSuspended checks if a user is currently suspended
func (s *Service) IsUserSuspended(ctx context.Context, userID uuid.UUID) (bool, *Warning, error) {
	var warning Warning
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND type IN (?, ?) AND (expires_at IS NULL OR expires_at > ?)",
			userID, "suspension", "ban", time.Now()).
		Order("created_at DESC").
		First(&warning).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	return true, &warning, nil
}

func isValidCategory(category string) bool {
	for _, c := range ValidCategories {
		if c == category {
			return true
		}
	}
	return false
}
