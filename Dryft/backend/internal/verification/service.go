package verification

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"math/big"
	"time"

	"gorm.io/gorm"
)

var (
	ErrVerificationNotFound = errors.New("verification not found")
	ErrAlreadyVerified      = errors.New("already verified")
	ErrInvalidCode          = errors.New("invalid verification code")
	ErrCodeExpired          = errors.New("verification code expired")
	ErrTooManyAttempts      = errors.New("too many verification attempts")
)

type VerificationType string

const (
	TypePhoto  VerificationType = "photo"
	TypePhone  VerificationType = "phone"
	TypeEmail  VerificationType = "email"
	TypeID     VerificationType = "id"
	TypeSocial VerificationType = "social"
)

type VerificationStatus string

const (
	StatusNone     VerificationStatus = "none"
	StatusPending  VerificationStatus = "pending"
	StatusInReview VerificationStatus = "in_review"
	StatusApproved VerificationStatus = "approved"
	StatusRejected VerificationStatus = "rejected"
	StatusExpired  VerificationStatus = "expired"
)

// Verification represents a user verification record
type Verification struct {
	ID              string             `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID          string             `gorm:"type:varchar(36);not null;index" json:"user_id"`
	Type            VerificationType   `gorm:"type:varchar(32);not null" json:"type"`
	Status          VerificationStatus `gorm:"type:varchar(32);not null;default:'pending'" json:"status"`
	PhotoURL        string             `gorm:"type:text" json:"photo_url,omitempty"`
	PoseType        string             `gorm:"type:varchar(32)" json:"pose_type,omitempty"`
	PhoneNumber     string             `gorm:"type:varchar(32)" json:"phone_number,omitempty"`
	Email           string             `gorm:"type:varchar(255)" json:"email,omitempty"`
	SocialProvider  string             `gorm:"type:varchar(32)" json:"social_provider,omitempty"`
	SocialID        string             `gorm:"type:varchar(255)" json:"social_id,omitempty"`
	RejectionReason string             `gorm:"type:text" json:"rejection_reason,omitempty"`
	ReviewerID      string             `gorm:"type:varchar(36)" json:"reviewer_id,omitempty"`
	Metadata        map[string]any     `gorm:"type:jsonb" json:"metadata,omitempty"`
	ExpiresAt       *time.Time         `json:"expires_at,omitempty"`
	SubmittedAt     time.Time          `json:"submitted_at"`
	ReviewedAt      *time.Time         `json:"reviewed_at,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
}

// VerificationCode stores temporary verification codes
type VerificationCode struct {
	ID             string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	UserID         string    `gorm:"type:varchar(36);not null;index" json:"user_id"`
	Type           string    `gorm:"type:varchar(32);not null" json:"type"` // phone, email
	Code           string    `gorm:"type:varchar(10);not null" json:"code"`
	Target         string    `gorm:"type:varchar(255);not null" json:"target"` // phone number or email
	Attempts       int       `gorm:"default:0" json:"attempts"`
	MaxAttempts    int       `gorm:"default:3" json:"max_attempts"`
	ExpiresAt      time.Time `json:"expires_at"`
	VerifiedAt     *time.Time `json:"verified_at,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type Service struct {
	db          *gorm.DB
	photoStore  PhotoStore
	smsService  SMSService
	emailService EmailService
}

// PhotoStore interface for storing verification photos
type PhotoStore interface {
	Upload(ctx context.Context, userID string, data io.Reader, filename string) (string, error)
	Delete(ctx context.Context, url string) error
}

// SMSService interface for sending SMS
type SMSService interface {
	Send(ctx context.Context, phoneNumber, message string) error
}

// EmailService interface for sending emails
type EmailService interface {
	SendVerificationEmail(ctx context.Context, email, code string) error
}

func NewService(db *gorm.DB, photoStore PhotoStore, smsService SMSService, emailService EmailService) *Service {
	return &Service{
		db:          db,
		photoStore:  photoStore,
		smsService:  smsService,
		emailService: emailService,
	}
}

// AutoMigrate creates database tables
func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&Verification{}, &VerificationCode{})
}

// GetUserVerifications returns all verifications for a user
func (s *Service) GetUserVerifications(ctx context.Context, userID string) ([]Verification, error) {
	var verifications []Verification
	err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("type ASC").
		Find(&verifications).Error
	return verifications, err
}

// GetVerificationStatus returns the status of a specific verification type
func (s *Service) GetVerificationStatus(ctx context.Context, userID string, vType VerificationType) (*Verification, error) {
	var verification Verification
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND type = ?", userID, vType).
		Order("created_at DESC").
		First(&verification).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &verification, err
}

// SubmitPhotoVerification submits a photo for verification
func (s *Service) SubmitPhotoVerification(ctx context.Context, userID string, photoData io.Reader, filename, poseType string) (*Verification, error) {
	// Check if already verified
	existing, err := s.GetVerificationStatus(ctx, userID, TypePhoto)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Status == StatusApproved {
		return nil, ErrAlreadyVerified
	}

	// Upload photo
	photoURL, err := s.photoStore.Upload(ctx, userID, photoData, filename)
	if err != nil {
		return nil, fmt.Errorf("failed to upload photo: %w", err)
	}

	verification := &Verification{
		ID:          generateUUID(),
		UserID:      userID,
		Type:        TypePhoto,
		Status:      StatusPending,
		PhotoURL:    photoURL,
		PoseType:    poseType,
		SubmittedAt: time.Now(),
	}

	if err := s.db.WithContext(ctx).Create(verification).Error; err != nil {
		return nil, err
	}

	return verification, nil
}

// SendPhoneVerification sends a verification code via SMS
func (s *Service) SendPhoneVerification(ctx context.Context, userID, phoneNumber string) (*VerificationCode, error) {
	// Generate 6-digit code
	code, err := generateNumericCode(6)
	if err != nil {
		return nil, err
	}

	vc := &VerificationCode{
		ID:          generateUUID(),
		UserID:      userID,
		Type:        "phone",
		Code:        code,
		Target:      phoneNumber,
		MaxAttempts: 3,
		ExpiresAt:   time.Now().Add(10 * time.Minute),
	}

	if err := s.db.WithContext(ctx).Create(vc).Error; err != nil {
		return nil, err
	}

	// Send SMS
	message := fmt.Sprintf("Your Drift verification code is: %s. It expires in 10 minutes.", code)
	if err := s.smsService.Send(ctx, phoneNumber, message); err != nil {
		return nil, fmt.Errorf("failed to send SMS: %w", err)
	}

	// Don't return the code in the response
	vc.Code = ""
	return vc, nil
}

// VerifyPhoneCode verifies a phone verification code
func (s *Service) VerifyPhoneCode(ctx context.Context, userID, verificationID, code string) (*Verification, error) {
	var vc VerificationCode
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ? AND type = ?", verificationID, userID, "phone").
		First(&vc).Error
	if err != nil {
		return nil, ErrVerificationNotFound
	}

	// Check attempts
	if vc.Attempts >= vc.MaxAttempts {
		return nil, ErrTooManyAttempts
	}

	// Increment attempts
	s.db.WithContext(ctx).Model(&vc).Update("attempts", gorm.Expr("attempts + 1"))

	// Check expiration
	if time.Now().After(vc.ExpiresAt) {
		return nil, ErrCodeExpired
	}

	// Check code
	if vc.Code != code {
		return nil, ErrInvalidCode
	}

	// Mark as verified
	now := time.Now()
	s.db.WithContext(ctx).Model(&vc).Update("verified_at", now)

	// Create/update verification record
	verification := &Verification{
		ID:          generateUUID(),
		UserID:      userID,
		Type:        TypePhone,
		Status:      StatusApproved,
		PhoneNumber: vc.Target,
		SubmittedAt: now,
		ReviewedAt:  &now,
	}

	if err := s.db.WithContext(ctx).Create(verification).Error; err != nil {
		return nil, err
	}

	return verification, nil
}

// SendEmailVerification sends a verification email
func (s *Service) SendEmailVerification(ctx context.Context, userID, email string) (*VerificationCode, error) {
	code, err := generateNumericCode(6)
	if err != nil {
		return nil, err
	}

	vc := &VerificationCode{
		ID:          generateUUID(),
		UserID:      userID,
		Type:        "email",
		Code:        code,
		Target:      email,
		MaxAttempts: 5,
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}

	if err := s.db.WithContext(ctx).Create(vc).Error; err != nil {
		return nil, err
	}

	if err := s.emailService.SendVerificationEmail(ctx, email, code); err != nil {
		return nil, fmt.Errorf("failed to send email: %w", err)
	}

	vc.Code = ""
	return vc, nil
}

// VerifyEmailCode verifies an email verification code
func (s *Service) VerifyEmailCode(ctx context.Context, userID, token string) (*Verification, error) {
	var vc VerificationCode
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND type = ? AND code = ?", userID, "email", token).
		First(&vc).Error
	if err != nil {
		return nil, ErrInvalidCode
	}

	if time.Now().After(vc.ExpiresAt) {
		return nil, ErrCodeExpired
	}

	now := time.Now()
	s.db.WithContext(ctx).Model(&vc).Update("verified_at", now)

	verification := &Verification{
		ID:          generateUUID(),
		UserID:      userID,
		Type:        TypeEmail,
		Status:      StatusApproved,
		Email:       vc.Target,
		SubmittedAt: now,
		ReviewedAt:  &now,
	}

	if err := s.db.WithContext(ctx).Create(verification).Error; err != nil {
		return nil, err
	}

	return verification, nil
}

// SubmitIDVerification submits ID documents for verification
func (s *Service) SubmitIDVerification(ctx context.Context, userID string, frontData io.Reader, backData io.Reader) (*Verification, error) {
	frontURL, err := s.photoStore.Upload(ctx, userID, frontData, "id_front.jpg")
	if err != nil {
		return nil, err
	}

	var backURL string
	if backData != nil {
		backURL, err = s.photoStore.Upload(ctx, userID, backData, "id_back.jpg")
		if err != nil {
			return nil, err
		}
	}

	verification := &Verification{
		ID:          generateUUID(),
		UserID:      userID,
		Type:        TypeID,
		Status:      StatusPending,
		SubmittedAt: time.Now(),
		Metadata: map[string]any{
			"front_url": frontURL,
			"back_url":  backURL,
		},
	}

	if err := s.db.WithContext(ctx).Create(verification).Error; err != nil {
		return nil, err
	}

	return verification, nil
}

// ConnectSocialAccount verifies via social account connection
func (s *Service) ConnectSocialAccount(ctx context.Context, userID, provider, socialID, socialEmail string) (*Verification, error) {
	now := time.Now()
	verification := &Verification{
		ID:             generateUUID(),
		UserID:         userID,
		Type:           TypeSocial,
		Status:         StatusApproved,
		SocialProvider: provider,
		SocialID:       socialID,
		SubmittedAt:    now,
		ReviewedAt:     &now,
		Metadata: map[string]any{
			"email": socialEmail,
		},
	}

	if err := s.db.WithContext(ctx).Create(verification).Error; err != nil {
		return nil, err
	}

	return verification, nil
}

// ReviewVerification allows admins to approve/reject verifications
func (s *Service) ReviewVerification(ctx context.Context, verificationID, reviewerID string, approved bool, reason string) error {
	status := StatusApproved
	if !approved {
		status = StatusRejected
	}

	now := time.Now()
	updates := map[string]any{
		"status":      status,
		"reviewer_id": reviewerID,
		"reviewed_at": now,
	}

	if !approved && reason != "" {
		updates["rejection_reason"] = reason
	}

	return s.db.WithContext(ctx).
		Model(&Verification{}).
		Where("id = ?", verificationID).
		Updates(updates).Error
}

// GetPendingVerifications returns verifications awaiting review
func (s *Service) GetPendingVerifications(ctx context.Context, vType VerificationType, limit, offset int) ([]Verification, int64, error) {
	var verifications []Verification
	var count int64

	query := s.db.WithContext(ctx).Model(&Verification{}).Where("status = ?", StatusPending)
	if vType != "" {
		query = query.Where("type = ?", vType)
	}

	if err := query.Count(&count).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("submitted_at ASC").Limit(limit).Offset(offset).Find(&verifications).Error
	return verifications, count, err
}

// CalculateTrustScore calculates a user's trust score based on verifications
func (s *Service) CalculateTrustScore(ctx context.Context, userID string) (int, error) {
	verifications, err := s.GetUserVerifications(ctx, userID)
	if err != nil {
		return 0, err
	}

	score := 0
	for _, v := range verifications {
		if v.Status != StatusApproved {
			continue
		}
		switch v.Type {
		case TypePhoto:
			score += 40
		case TypePhone:
			score += 20
		case TypeEmail:
			score += 20
		case TypeID:
			score += 15
		case TypeSocial:
			score += 5
		}
	}

	if score > 100 {
		score = 100
	}
	return score, nil
}

// IsUserVerified checks if a user has at least photo verification
func (s *Service) IsUserVerified(ctx context.Context, userID string) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&Verification{}).
		Where("user_id = ? AND type = ? AND status = ?", userID, TypePhoto, StatusApproved).
		Count(&count).Error
	return count > 0, err
}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func generateNumericCode(length int) (string, error) {
	code := ""
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code += fmt.Sprintf("%d", n.Int64())
	}
	return code, nil
}
