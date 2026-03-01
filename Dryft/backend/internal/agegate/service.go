package agegate

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

// Service handles age verification business logic.
// LEGAL NOTE: This service implements the age verification flow required
// for adult content platforms. It coordinates card verification (Stripe),
// ID verification (Jumio), and face matching to ensure users are 18+.
type Service struct {
	cfg       *config.Config
	db        *database.DB
	stripe    *StripeClient
	jumio     *JumioClient
	faceMatch *FaceMatchService
}

func NewService(cfg *config.Config, db *database.DB) *Service {
	return &Service{
		cfg:       cfg,
		db:        db,
		stripe:    NewStripeClient(cfg),
		jumio:     NewJumioClient(cfg),
		faceMatch: NewFaceMatchService(cfg),
	}
}

// GetOrCreateVerificationAttempt gets the current verification attempt or creates a new one
func (s *Service) GetOrCreateVerificationAttempt(ctx context.Context, userID uuid.UUID) (*models.VerificationAttempt, error) {
	// Check for existing pending/in-progress attempt
	var attempt models.VerificationAttempt
	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, stripe_customer_id, stripe_verified, stripe_verified_at,
		       stripe_card_last4, stripe_card_brand, jumio_scan_ref, jumio_status,
		       jumio_verified_at, jumio_dob, jumio_document_type, jumio_document_country,
		       jumio_rejection_reason, face_match_score, face_match_passed, face_match_method,
		       overall_status, rejection_reason, reviewed_by, reviewed_at,
		       retry_count, last_retry_at, retry_cooldown_until, created_at, updated_at
		FROM verification_attempts
		WHERE user_id = $1 AND overall_status IN ('PENDING', 'MANUAL_REVIEW')
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(
		&attempt.ID, &attempt.UserID, &attempt.StripeCustomerID, &attempt.StripeVerified,
		&attempt.StripeVerifiedAt, &attempt.StripeCardLast4, &attempt.StripeCardBrand,
		&attempt.JumioScanRef, &attempt.JumioStatus, &attempt.JumioVerifiedAt,
		&attempt.JumioDOB, &attempt.JumioDocumentType, &attempt.JumioDocumentCountry,
		&attempt.JumioRejectionReason, &attempt.FaceMatchScore, &attempt.FaceMatchPassed,
		&attempt.FaceMatchMethod, &attempt.OverallStatus, &attempt.RejectionReason,
		&attempt.ReviewedBy, &attempt.ReviewedAt, &attempt.RetryCount, &attempt.LastRetryAt,
		&attempt.RetryCooldownUntil, &attempt.CreatedAt, &attempt.UpdatedAt,
	)

	if err == nil {
		return &attempt, nil
	}

	if err != pgx.ErrNoRows {
		return nil, fmt.Errorf("query verification attempt: %w", err)
	}

	// Create new attempt
	newID := uuid.New()
	now := time.Now()
	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO verification_attempts (id, user_id, overall_status, created_at, updated_at)
		VALUES ($1, $2, 'PENDING', $3, $3)
	`, newID, userID, now)

	if err != nil {
		return nil, fmt.Errorf("create verification attempt: %w", err)
	}

	return &models.VerificationAttempt{
		ID:            newID,
		UserID:        userID,
		OverallStatus: models.VerificationStatusPending,
		JumioStatus:   models.JumioStatusPending,
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

// InitiateCardVerification starts the Stripe card verification flow
func (s *Service) InitiateCardVerification(ctx context.Context, userID uuid.UUID, email string) (*models.CardVerificationInitResponse, error) {
	attempt, err := s.GetOrCreateVerificationAttempt(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Check if card already verified
	if attempt.StripeVerified {
		return nil, fmt.Errorf("card already verified")
	}

	// Create or get Stripe customer
	var customerID string
	if attempt.StripeCustomerID != nil {
		customerID = *attempt.StripeCustomerID
	} else {
		cust, err := s.stripe.CreateCustomer(ctx, email, userID.String())
		if err != nil {
			return nil, fmt.Errorf("create stripe customer: %w", err)
		}
		customerID = cust.ID

		// Save customer ID
		_, err = s.db.Pool.Exec(ctx, `
			UPDATE verification_attempts
			SET stripe_customer_id = $1, updated_at = NOW()
			WHERE id = $2
		`, customerID, attempt.ID)
		if err != nil {
			return nil, fmt.Errorf("save customer id: %w", err)
		}
	}

	// Create SetupIntent
	intent, err := s.stripe.CreateSetupIntent(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("create setup intent: %w", err)
	}

	return &models.CardVerificationInitResponse{
		ClientSecret: intent.ClientSecret,
	}, nil
}

// ConfirmCardVerification confirms the card was verified via Stripe
func (s *Service) ConfirmCardVerification(ctx context.Context, userID uuid.UUID, setupIntentID string) error {
	attempt, err := s.GetOrCreateVerificationAttempt(ctx, userID)
	if err != nil {
		return err
	}

	// Get user email for Stripe
	var email string
	err = s.db.Pool.QueryRow(ctx, "SELECT email FROM users WHERE id = $1", userID).Scan(&email)
	if err != nil {
		return fmt.Errorf("get user email: %w", err)
	}

	// Verify with Stripe
	result, err := s.stripe.VerifyCard(ctx, email, userID.String(), setupIntentID)
	if err != nil {
		return fmt.Errorf("verify card: %w", err)
	}

	if !result.Verified {
		return fmt.Errorf("card verification failed: %s", result.Error)
	}

	// Update attempt
	now := time.Now()
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE verification_attempts
		SET stripe_verified = true,
		    stripe_verified_at = $1,
		    stripe_card_last4 = $2,
		    stripe_card_brand = $3,
		    updated_at = $1
		WHERE id = $4
	`, now, result.Last4, result.Brand, attempt.ID)

	if err != nil {
		return fmt.Errorf("update verification: %w", err)
	}

	return nil
}

// InitiateIDVerification starts the Jumio ID verification flow
func (s *Service) InitiateIDVerification(ctx context.Context, userID uuid.UUID, callbackURL string) (*models.IDVerificationInitResponse, error) {
	attempt, err := s.GetOrCreateVerificationAttempt(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Card must be verified first
	if !attempt.StripeVerified {
		return nil, fmt.Errorf("card verification required before ID verification")
	}

	// Check if ID already verified
	if attempt.JumioStatus == models.JumioStatusApproved {
		return nil, fmt.Errorf("ID already verified")
	}

	// Initiate Jumio verification
	resp, err := s.jumio.InitiateVerification(ctx, userID.String(), callbackURL)
	if err != nil {
		return nil, fmt.Errorf("initiate jumio: %w", err)
	}

	// Save Jumio scan reference
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE verification_attempts
		SET jumio_scan_ref = $1, jumio_status = 'PENDING', updated_at = NOW()
		WHERE id = $2
	`, resp.TransactionReference, attempt.ID)

	if err != nil {
		return nil, fmt.Errorf("save jumio ref: %w", err)
	}

	return &models.IDVerificationInitResponse{
		RedirectURL: resp.RedirectURL,
	}, nil
}

// HandleJumioWebhook processes the callback from Jumio.
// LEGAL NOTE: This is called when Jumio completes ID verification.
// The webhook contains the verification result and extracted data.
func (s *Service) HandleJumioWebhook(ctx context.Context, payload []byte, signature string) error {
	// Validate signature
	if !s.jumio.ValidateWebhookSignature(payload, signature) {
		return fmt.Errorf("invalid webhook signature")
	}

	// Parse payload
	webhookData, err := s.jumio.ParseWebhookPayload(payload)
	if err != nil {
		return fmt.Errorf("parse webhook: %w", err)
	}

	// Process result
	result, err := s.jumio.ProcessWebhookResult(webhookData)
	if err != nil {
		return fmt.Errorf("process webhook: %w", err)
	}

	// Find the verification attempt by scan reference
	var attemptID uuid.UUID
	var userID uuid.UUID
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id, user_id FROM verification_attempts WHERE jumio_scan_ref = $1
	`, result.ScanRef).Scan(&attemptID, &userID)

	if err != nil {
		return fmt.Errorf("find verification attempt: %w", err)
	}

	// Update with Jumio results
	now := time.Now()
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE verification_attempts
		SET jumio_status = $1,
		    jumio_verified_at = $2,
		    jumio_dob = $3,
		    jumio_document_type = $4,
		    jumio_document_country = $5,
		    jumio_rejection_reason = $6,
		    updated_at = $2
		WHERE id = $7
	`, result.Status, now, result.DOB, result.DocumentType, result.DocumentCountry,
		nullString(result.RejectionReason), attemptID)

	if err != nil {
		return fmt.Errorf("update jumio results: %w", err)
	}

	// If Jumio approved, process face match and determine outcome
	if result.Status == models.JumioStatusApproved {
		if err := s.ProcessFaceMatchAndOutcome(ctx, attemptID, userID, result); err != nil {
			return fmt.Errorf("process outcome: %w", err)
		}
	} else {
		// Jumio rejected - update overall status
		_, err = s.db.Pool.Exec(ctx, `
			UPDATE verification_attempts
			SET overall_status = 'REJECTED',
			    rejection_reason = $1,
			    updated_at = NOW()
			WHERE id = $2
		`, result.RejectionReason, attemptID)

		if err != nil {
			return fmt.Errorf("update rejection: %w", err)
		}
	}

	return nil
}

// ProcessFaceMatchAndOutcome runs face matching and determines final verification status
func (s *Service) ProcessFaceMatchAndOutcome(ctx context.Context, attemptID, userID uuid.UUID, jumioResult *JumioVerificationResult) error {
	// Get the verification attempt
	var attempt models.VerificationAttempt
	err := s.db.Pool.QueryRow(ctx, `
		SELECT stripe_verified FROM verification_attempts WHERE id = $1
	`, attemptID).Scan(&attempt.StripeVerified)
	if err != nil {
		return fmt.Errorf("get attempt: %w", err)
	}

	// Run face match using Jumio's similarity score
	faceResult := s.faceMatch.CompareFromJumio(jumioResult.FaceMatchScore)

	// Update face match results
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE verification_attempts
		SET face_match_score = $1,
		    face_match_passed = $2,
		    face_match_method = $3,
		    updated_at = NOW()
		WHERE id = $4
	`, faceResult.Score, faceResult.Passed, faceResult.Method, attemptID)

	if err != nil {
		return fmt.Errorf("update face match: %w", err)
	}

	// Determine final outcome
	isAdult := s.jumio.IsAdult(jumioResult.DOB)
	outcome := s.faceMatch.DetermineVerificationOutcome(
		attempt.StripeVerified,
		true, // ID verified at this point
		isAdult,
		faceResult,
	)

	// Update overall status
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE verification_attempts
		SET overall_status = $1,
		    rejection_reason = $2,
		    updated_at = NOW()
		WHERE id = $3
	`, outcome.Status, nullString(outcome.Reason), attemptID)

	if err != nil {
		return fmt.Errorf("update outcome: %w", err)
	}

	// If verified, update user's verified status
	if outcome.Status == "VERIFIED" {
		_, err = s.db.Pool.Exec(ctx, `
			UPDATE users
			SET verified = true, verified_at = NOW(), updated_at = NOW()
			WHERE id = $1
		`, userID)

		if err != nil {
			return fmt.Errorf("update user verified: %w", err)
		}
	}

	return nil
}

// GetVerificationStatus returns the current verification status for a user
func (s *Service) GetVerificationStatus(ctx context.Context, userID uuid.UUID) (*models.VerificationStatusResponse, error) {
	attempt, err := s.GetOrCreateVerificationAttempt(ctx, userID)
	if err != nil {
		return nil, err
	}

	resp := attempt.ToStatusResponse()
	return &resp, nil
}

// RetryVerification creates a new verification attempt after rejection
func (s *Service) RetryVerification(ctx context.Context, userID uuid.UUID) error {
	// Check for previous rejected attempt
	var prevAttemptID uuid.UUID
	var retryCount int
	var cooldownUntil *time.Time

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, retry_count, retry_cooldown_until
		FROM verification_attempts
		WHERE user_id = $1 AND overall_status = 'REJECTED'
		ORDER BY created_at DESC
		LIMIT 1
	`, userID).Scan(&prevAttemptID, &retryCount, &cooldownUntil)

	if err == pgx.ErrNoRows {
		return fmt.Errorf("no rejected verification to retry")
	}
	if err != nil {
		return fmt.Errorf("query previous attempt: %w", err)
	}

	// Check cooldown
	if cooldownUntil != nil && time.Now().Before(*cooldownUntil) {
		return fmt.Errorf("retry available after %s", cooldownUntil.Format(time.RFC3339))
	}

	// Check retry limit
	if retryCount >= models.MaxRetryCount {
		return fmt.Errorf("maximum retry attempts reached")
	}

	// Create new attempt with incremented retry count
	newID := uuid.New()
	now := time.Now()
	cooldown := now.Add(models.RetryCooldownDuration)

	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO verification_attempts (id, user_id, overall_status, retry_count, last_retry_at, retry_cooldown_until, created_at, updated_at)
		VALUES ($1, $2, 'PENDING', $3, $4, $5, $4, $4)
	`, newID, userID, retryCount+1, now, cooldown)

	if err != nil {
		return fmt.Errorf("create retry attempt: %w", err)
	}

	return nil
}

// Helper function for nullable strings
func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
