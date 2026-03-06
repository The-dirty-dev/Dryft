package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/database"
)

var (
	ErrUserNotFound         = errors.New("user not found")
	ErrVerificationNotFound = errors.New("verification not found")
	ErrReportNotFound       = errors.New("report not found")
	ErrNotAdmin             = errors.New("admin access required")
	ErrReasonRequired       = errors.New("reason is required")
	ErrInvalidStatusFilter  = errors.New("invalid verification status filter")
)

// Service handles admin operations
type Service struct {
	db *database.DB
}

// NewService creates a new admin service
func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

func requireAdmin(adminID uuid.UUID) error {
	if adminID == uuid.Nil {
		return ErrNotAdmin
	}
	return nil
}

func normalizeVerificationStatus(status string) (string, error) {
	normalized := strings.TrimSpace(strings.ToLower(status))
	if normalized == "" || normalized == "all" {
		return "", nil
	}

	switch normalized {
	case "pending":
		return "PENDING", nil
	case "manual_review":
		return "MANUAL_REVIEW", nil
	case "verified":
		return "VERIFIED", nil
	case "rejected":
		return "REJECTED", nil
	default:
		return "", ErrInvalidStatusFilter
	}
}

// VerificationReview represents a verification pending manual review
type VerificationReview struct {
	ID                uuid.UUID  `json:"id"`
	UserID            uuid.UUID  `json:"user_id"`
	UserEmail         string     `json:"user_email"`
	UserName          *string    `json:"user_name"`
	UserAvatar        *string    `json:"user_avatar,omitempty"`
	ProfilePhotoURL   *string    `json:"profile_photo_url,omitempty"`
	IDSelfieURL       *string    `json:"id_selfie_url,omitempty"`
	StripeVerified    bool       `json:"stripe_verified"`
	StripeVerifiedAt  *time.Time `json:"stripe_verified_at,omitempty"`
	JumioScanRef      *string    `json:"jumio_scan_ref,omitempty"`
	JumioStatus       string     `json:"jumio_status"`
	JumioVerifiedAt   *time.Time `json:"jumio_verified_at,omitempty"`
	JumioDOB          *time.Time `json:"jumio_dob,omitempty"`
	JumioDocumentType *string    `json:"jumio_document_type,omitempty"`
	JumioCountry      *string    `json:"jumio_country,omitempty"`
	FaceMatchScore    *float64   `json:"face_match_score,omitempty"`
	FaceMatchPassed   *bool      `json:"face_match_passed,omitempty"`
	OverallStatus     string     `json:"overall_status"`
	RejectionReason   *string    `json:"rejection_reason,omitempty"`
	ReviewedBy        *uuid.UUID `json:"reviewed_by,omitempty"`
	ReviewedAt        *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// GetVerifications returns verifications with optional status filter
func (s *Service) GetVerifications(ctx context.Context, status string, limit, offset int) ([]VerificationReview, int, error) {
	if limit <= 0 {
		limit = 20
	}

	// Build query based on status filter
	var whereClause string
	var args []interface{}
	argIdx := 1

	dbStatus, err := normalizeVerificationStatus(status)
	if err != nil {
		return nil, 0, err
	}
	if dbStatus != "" {
		whereClause = fmt.Sprintf("WHERE v.overall_status = $%d", argIdx)
		args = append(args, dbStatus)
		argIdx++
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM verification_attempts v " + whereClause
	err = s.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count verifications: %w", err)
	}

	// Build main query
	query := fmt.Sprintf(`
		SELECT
			v.id, v.user_id, u.email, u.display_name, u.profile_photo,
			v.stripe_verified, v.stripe_verified_at,
			v.jumio_scan_ref, v.jumio_status, v.jumio_verified_at,
			v.jumio_dob, v.jumio_document_type, v.jumio_document_country,
			v.face_match_score, v.face_match_passed,
			v.overall_status, v.rejection_reason, v.reviewed_by, v.reviewed_at,
			v.created_at, v.updated_at
		FROM verification_attempts v
		JOIN users u ON v.user_id = u.id
		%s
		ORDER BY v.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := s.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query verifications: %w", err)
	}
	defer rows.Close()

	var reviews []VerificationReview
	for rows.Next() {
		var r VerificationReview
		err := rows.Scan(
			&r.ID, &r.UserID, &r.UserEmail, &r.UserName, &r.ProfilePhotoURL,
			&r.StripeVerified, &r.StripeVerifiedAt,
			&r.JumioScanRef, &r.JumioStatus, &r.JumioVerifiedAt,
			&r.JumioDOB, &r.JumioDocumentType, &r.JumioCountry,
			&r.FaceMatchScore, &r.FaceMatchPassed,
			&r.OverallStatus, &r.RejectionReason, &r.ReviewedBy, &r.ReviewedAt,
			&r.CreatedAt, &r.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan verification: %w", err)
		}
		// UserAvatar and ProfilePhotoURL are the same for now
		r.UserAvatar = r.ProfilePhotoURL
		reviews = append(reviews, r)
	}

	return reviews, total, nil
}

// GetVerification returns a specific verification
func (s *Service) GetVerification(ctx context.Context, verificationID uuid.UUID) (*VerificationReview, error) {
	var r VerificationReview

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			v.id, v.user_id, u.email, u.display_name, u.profile_photo,
			v.stripe_verified, v.stripe_verified_at,
			v.jumio_scan_ref, v.jumio_status, v.jumio_verified_at,
			v.jumio_dob, v.jumio_document_type, v.jumio_document_country,
			v.face_match_score, v.face_match_passed,
			v.overall_status, v.rejection_reason, v.reviewed_by, v.reviewed_at,
			v.created_at, v.updated_at
		FROM verification_attempts v
		JOIN users u ON v.user_id = u.id
		WHERE v.id = $1
	`, verificationID).Scan(
		&r.ID, &r.UserID, &r.UserEmail, &r.UserName, &r.ProfilePhotoURL,
		&r.StripeVerified, &r.StripeVerifiedAt,
		&r.JumioScanRef, &r.JumioStatus, &r.JumioVerifiedAt,
		&r.JumioDOB, &r.JumioDocumentType, &r.JumioCountry,
		&r.FaceMatchScore, &r.FaceMatchPassed,
		&r.OverallStatus, &r.RejectionReason, &r.ReviewedBy, &r.ReviewedAt,
		&r.CreatedAt, &r.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrVerificationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query verification: %w", err)
	}

	r.UserAvatar = r.ProfilePhotoURL
	return &r, nil
}

// ApproveVerification approves a manual review verification
func (s *Service) ApproveVerification(ctx context.Context, adminID, verificationID uuid.UUID, notes string) error {
	if err := requireAdmin(adminID); err != nil {
		return err
	}
	if verificationID == uuid.Nil {
		return ErrVerificationNotFound
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Get user ID from verification (allow pending or manual_review)
	var userID uuid.UUID
	err = tx.QueryRow(ctx,
		"SELECT user_id FROM verification_attempts WHERE id = $1 AND overall_status IN ('PENDING', 'MANUAL_REVIEW')",
		verificationID,
	).Scan(&userID)

	if err == pgx.ErrNoRows {
		return ErrVerificationNotFound
	}
	if err != nil {
		return fmt.Errorf("query verification: %w", err)
	}

	// Update verification status
	_, err = tx.Exec(ctx, `
		UPDATE verification_attempts
		SET overall_status = 'VERIFIED', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, verificationID, adminID)
	if err != nil {
		return fmt.Errorf("update verification: %w", err)
	}

	// Mark user as verified
	_, err = tx.Exec(ctx, `
		UPDATE users
		SET verified = true, verified_at = NOW()
		WHERE id = $1
	`, userID)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}

	// Log the admin action
	_, err = tx.Exec(ctx, `
		INSERT INTO admin_actions (id, admin_id, action_type, target_type, target_id, notes, created_at)
		VALUES ($1, $2, 'verify_approve', 'verification', $3, $4, NOW())
	`, uuid.New(), adminID, verificationID, notes)
	if err != nil {
		return fmt.Errorf("log admin action: %w", err)
	}

	return tx.Commit(ctx)
}

// RejectVerification rejects a manual review verification
func (s *Service) RejectVerification(ctx context.Context, adminID, verificationID uuid.UUID, reason, notes string) error {
	if err := requireAdmin(adminID); err != nil {
		return err
	}
	if verificationID == uuid.Nil {
		return ErrVerificationNotFound
	}
	if strings.TrimSpace(reason) == "" {
		return ErrReasonRequired
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update verification status
	result, err := tx.Exec(ctx, `
		UPDATE verification_attempts
		SET overall_status = 'REJECTED', rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND overall_status IN ('PENDING', 'MANUAL_REVIEW')
	`, verificationID, reason, adminID)
	if err != nil {
		return fmt.Errorf("update verification: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrVerificationNotFound
	}

	// Log the admin action
	_, err = tx.Exec(ctx, `
		INSERT INTO admin_actions (id, admin_id, action_type, target_type, target_id, notes, created_at)
		VALUES ($1, $2, 'verify_reject', 'verification', $3, $4, NOW())
	`, uuid.New(), adminID, verificationID, notes)
	if err != nil {
		return fmt.Errorf("log admin action: %w", err)
	}

	return tx.Commit(ctx)
}

// UserReport represents a user report
type UserReport struct {
	ID            uuid.UUID  `json:"id"`
	ReporterID    uuid.UUID  `json:"reporter_id"`
	ReporterEmail string     `json:"reporter_email"`
	ReportedID    uuid.UUID  `json:"reported_id"`
	ReportedEmail string     `json:"reported_email"`
	ReportedName  *string    `json:"reported_name"`
	Reason        string     `json:"reason"`
	Description   *string    `json:"description"`
	Status        string     `json:"status"` // pending, reviewed, action_taken, dismissed
	ReviewedBy    *uuid.UUID `json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time `json:"reviewed_at,omitempty"`
	ActionTaken   *string    `json:"action_taken,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// GetPendingReports returns reports pending review
func (s *Service) GetPendingReports(ctx context.Context, limit, offset int) ([]UserReport, int, error) {
	if limit <= 0 {
		limit = 20
	}

	var total int
	err := s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM user_reports WHERE status = 'pending'",
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count reports: %w", err)
	}

	rows, err := s.db.Pool.Query(ctx, `
		SELECT
			r.id, r.reporter_id, reporter.email,
			r.reported_user_id, reported.email, reported.display_name,
			r.reason, r.description, r.status,
			r.reviewed_by, r.reviewed_at, r.action_taken, r.created_at
		FROM user_reports r
		JOIN users reporter ON r.reporter_id = reporter.id
		JOIN users reported ON r.reported_user_id = reported.id
		WHERE r.status = 'pending'
		ORDER BY r.created_at ASC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query reports: %w", err)
	}
	defer rows.Close()

	var reports []UserReport
	for rows.Next() {
		var r UserReport
		err := rows.Scan(
			&r.ID, &r.ReporterID, &r.ReporterEmail,
			&r.ReportedID, &r.ReportedEmail, &r.ReportedName,
			&r.Reason, &r.Description, &r.Status,
			&r.ReviewedBy, &r.ReviewedAt, &r.ActionTaken, &r.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan report: %w", err)
		}
		reports = append(reports, r)
	}

	return reports, total, nil
}

// ReviewReport processes a user report
func (s *Service) ReviewReport(ctx context.Context, adminID, reportID uuid.UUID, action, notes string) error {
	if err := requireAdmin(adminID); err != nil {
		return err
	}
	if reportID == uuid.Nil {
		return ErrReportNotFound
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update report
	result, err := tx.Exec(ctx, `
		UPDATE user_reports
		SET status = 'reviewed', reviewed_by = $2, reviewed_at = NOW(), action_taken = $3
		WHERE id = $1 AND status = 'pending'
	`, reportID, adminID, action)
	if err != nil {
		return fmt.Errorf("update report: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrReportNotFound
	}

	// Log admin action
	_, err = tx.Exec(ctx, `
		INSERT INTO admin_actions (id, admin_id, action_type, target_type, target_id, notes, created_at)
		VALUES ($1, $2, 'review_report', 'report', $3, $4, NOW())
	`, uuid.New(), adminID, reportID, notes)
	if err != nil {
		return fmt.Errorf("log admin action: %w", err)
	}

	return tx.Commit(ctx)
}

// UserOverview provides admin view of a user
type UserOverview struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	DisplayName  *string    `json:"display_name"`
	ProfilePhoto *string    `json:"profile_photo"`
	Verified     bool       `json:"verified"`
	VerifiedAt   *time.Time `json:"verified_at"`
	IsBanned     bool       `json:"is_banned"`
	BannedAt     *time.Time `json:"banned_at"`
	BanReason    *string    `json:"ban_reason"`
	ReportCount  int        `json:"report_count"`
	MatchCount   int        `json:"match_count"`
	MessageCount int        `json:"message_count"`
	CreatedAt    time.Time  `json:"created_at"`
	LastActiveAt *time.Time `json:"last_active_at"`
}

// GetUser returns admin view of a user
func (s *Service) GetUser(ctx context.Context, userID uuid.UUID) (*UserOverview, error) {
	var u UserOverview

	err := s.db.Pool.QueryRow(ctx, `
		SELECT
			u.id, u.email, u.display_name, u.profile_photo,
			u.verified, u.verified_at, u.is_banned, u.banned_at, u.ban_reason,
			(SELECT COUNT(*) FROM user_reports WHERE reported_id = u.id) as report_count,
			(SELECT COUNT(*) FROM matches WHERE user_a = u.id OR user_b = u.id) as match_count,
			(SELECT COUNT(*) FROM messages WHERE sender_id = u.id) as message_count,
			u.created_at, u.last_active_at
		FROM users u
		WHERE u.id = $1 AND u.deleted_at IS NULL
	`, userID).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.ProfilePhoto,
		&u.Verified, &u.VerifiedAt, &u.IsBanned, &u.BannedAt, &u.BanReason,
		&u.ReportCount, &u.MatchCount, &u.MessageCount,
		&u.CreatedAt, &u.LastActiveAt,
	)

	if err == pgx.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}

	return &u, nil
}

// BanUser bans a user
func (s *Service) BanUser(ctx context.Context, adminID, userID uuid.UUID, reason, notes string) error {
	if err := requireAdmin(adminID); err != nil {
		return err
	}
	if userID == uuid.Nil {
		return ErrUserNotFound
	}
	if strings.TrimSpace(reason) == "" {
		return ErrReasonRequired
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ban user
	result, err := tx.Exec(ctx, `
		UPDATE users
		SET is_banned = true, banned_at = NOW(), ban_reason = $2
		WHERE id = $1 AND deleted_at IS NULL AND is_banned = false
	`, userID, reason)
	if err != nil {
		return fmt.Errorf("ban user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	// Log admin action
	_, err = tx.Exec(ctx, `
		INSERT INTO admin_actions (id, admin_id, action_type, target_type, target_id, notes, created_at)
		VALUES ($1, $2, 'ban_user', 'user', $3, $4, NOW())
	`, uuid.New(), adminID, userID, notes)
	if err != nil {
		return fmt.Errorf("log admin action: %w", err)
	}

	return tx.Commit(ctx)
}

// UnbanUser unbans a user
func (s *Service) UnbanUser(ctx context.Context, adminID, userID uuid.UUID, notes string) error {
	if err := requireAdmin(adminID); err != nil {
		return err
	}
	if userID == uuid.Nil {
		return ErrUserNotFound
	}

	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Unban user
	result, err := tx.Exec(ctx, `
		UPDATE users
		SET is_banned = false, banned_at = NULL, ban_reason = NULL
		WHERE id = $1 AND deleted_at IS NULL AND is_banned = true
	`, userID)
	if err != nil {
		return fmt.Errorf("unban user: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	// Log admin action
	_, err = tx.Exec(ctx, `
		INSERT INTO admin_actions (id, admin_id, action_type, target_type, target_id, notes, created_at)
		VALUES ($1, $2, 'unban_user', 'user', $3, $4, NOW())
	`, uuid.New(), adminID, userID, notes)
	if err != nil {
		return fmt.Errorf("log admin action: %w", err)
	}

	return tx.Commit(ctx)
}

// DashboardStats contains admin dashboard statistics
type DashboardStats struct {
	TotalUsers           int   `json:"total_users"`
	VerifiedUsers        int   `json:"verified_users"`
	PendingVerifications int   `json:"pending_verifications"`
	PendingReports       int   `json:"pending_reports"`
	TotalMatches         int   `json:"total_matches"`
	TotalMessages        int   `json:"total_messages"`
	ActiveUsersToday     int   `json:"active_users_today"`
	NewUsersToday        int   `json:"new_users_today"`
	TotalRevenue         int64 `json:"total_revenue"` // In cents
	RevenueToday         int64 `json:"revenue_today"`
}

// GetDashboardStats returns admin dashboard statistics
func (s *Service) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	var stats DashboardStats

	// Total and verified users
	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE deleted_at IS NULL",
	).Scan(&stats.TotalUsers)

	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE verified = true AND deleted_at IS NULL",
	).Scan(&stats.VerifiedUsers)

	// Pending items
	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM verification_attempts WHERE overall_status = 'MANUAL_REVIEW'",
	).Scan(&stats.PendingVerifications)

	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM user_reports WHERE status = 'pending'",
	).Scan(&stats.PendingReports)

	// Activity stats
	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM matches WHERE unmatched_at IS NULL",
	).Scan(&stats.TotalMatches)

	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM messages WHERE deleted_at IS NULL",
	).Scan(&stats.TotalMessages)

	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE last_active_at >= NOW() - INTERVAL '24 hours' AND deleted_at IS NULL",
	).Scan(&stats.ActiveUsersToday)

	s.db.Pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours' AND deleted_at IS NULL",
	).Scan(&stats.NewUsersToday)

	// Revenue stats
	s.db.Pool.QueryRow(ctx,
		"SELECT COALESCE(SUM(platform_fee), 0) FROM purchases WHERE status = 'completed'",
	).Scan(&stats.TotalRevenue)

	s.db.Pool.QueryRow(ctx,
		"SELECT COALESCE(SUM(platform_fee), 0) FROM purchases WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours'",
	).Scan(&stats.RevenueToday)

	return &stats, nil
}

// IsAdmin checks if a user has admin privileges
func (s *Service) IsAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	var isAdmin bool
	err := s.db.Pool.QueryRow(ctx,
		"SELECT is_admin FROM users WHERE id = $1 AND deleted_at IS NULL",
		userID,
	).Scan(&isAdmin)

	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return isAdmin, nil
}
