package models

import (
	"time"

	"github.com/google/uuid"
)

// VerificationStatus represents the overall status of a verification attempt
type VerificationStatus string

const (
	VerificationStatusPending      VerificationStatus = "PENDING"
	VerificationStatusVerified     VerificationStatus = "VERIFIED"
	VerificationStatusRejected     VerificationStatus = "REJECTED"
	VerificationStatusManualReview VerificationStatus = "MANUAL_REVIEW"
)

// JumioStatus represents the status from Jumio's verification
type JumioStatus string

const (
	JumioStatusPending  JumioStatus = "PENDING"
	JumioStatusApproved JumioStatus = "APPROVED"
	JumioStatusRejected JumioStatus = "REJECTED"
	JumioStatusExpired  JumioStatus = "EXPIRED"
)

// VerificationAttempt represents a single age verification attempt.
// LEGAL NOTE: This record serves as an audit trail for regulatory compliance.
// Retention period should comply with applicable laws (typically 7 years).
type VerificationAttempt struct {
	ID     uuid.UUID `json:"id"`
	UserID uuid.UUID `json:"user_id"`

	// Stripe card verification
	StripeCustomerID *string    `json:"-"` // Never expose to client
	StripeVerified   bool       `json:"stripe_verified"`
	StripeVerifiedAt *time.Time `json:"stripe_verified_at,omitempty"`
	StripeCardLast4  *string    `json:"stripe_card_last4,omitempty"`
	StripeCardBrand  *string    `json:"stripe_card_brand,omitempty"`

	// Jumio ID verification
	JumioScanRef        *string     `json:"-"` // Internal reference
	JumioStatus         JumioStatus `json:"jumio_status"`
	JumioVerifiedAt     *time.Time  `json:"jumio_verified_at,omitempty"`
	JumioDOB            *time.Time  `json:"-"` // PII - never expose
	JumioDocumentType   *string     `json:"jumio_document_type,omitempty"`
	JumioDocumentCountry *string    `json:"jumio_document_country,omitempty"`
	JumioRejectionReason *string    `json:"jumio_rejection_reason,omitempty"`

	// Face match
	FaceMatchScore  *float64 `json:"-"` // Internal score
	FaceMatchPassed *bool    `json:"face_match_passed,omitempty"`
	FaceMatchMethod *string  `json:"-"` // Internal

	// Overall status
	OverallStatus    VerificationStatus `json:"overall_status"`
	RejectionReason  *string            `json:"rejection_reason,omitempty"`
	ReviewedBy       *uuid.UUID         `json:"-"`
	ReviewedAt       *time.Time         `json:"reviewed_at,omitempty"`

	// Retry tracking
	RetryCount        int        `json:"retry_count"`
	LastRetryAt       *time.Time `json:"last_retry_at,omitempty"`
	RetryCooldownUntil *time.Time `json:"retry_cooldown_until,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// VerificationStatusResponse is the client-facing verification status
type VerificationStatusResponse struct {
	Status            VerificationStatus `json:"status"`
	CardVerified      bool               `json:"card_verified"`
	IDVerified        bool               `json:"id_verified"`
	FaceMatchVerified bool               `json:"face_match_verified"`
	RejectionReason   *string            `json:"rejection_reason,omitempty"`
	CanRetry          bool               `json:"can_retry"`
	RetryAvailableAt  *time.Time         `json:"retry_available_at,omitempty"`
}

// ToStatusResponse converts the full attempt to a client-safe response
func (v *VerificationAttempt) ToStatusResponse() VerificationStatusResponse {
	resp := VerificationStatusResponse{
		Status:            v.OverallStatus,
		CardVerified:      v.StripeVerified,
		IDVerified:        v.JumioStatus == JumioStatusApproved,
		FaceMatchVerified: v.FaceMatchPassed != nil && *v.FaceMatchPassed,
		RejectionReason:   v.RejectionReason,
	}

	// Can retry if rejected and cooldown has passed
	if v.OverallStatus == VerificationStatusRejected {
		now := time.Now()
		if v.RetryCooldownUntil == nil || now.After(*v.RetryCooldownUntil) {
			resp.CanRetry = true
		} else {
			resp.RetryAvailableAt = v.RetryCooldownUntil
		}
	}

	return resp
}

// CardVerificationRequest is the request to initiate card verification
type CardVerificationRequest struct {
	UserID uuid.UUID `json:"-"` // Set from auth context
}

// CardVerificationInitResponse is returned when starting card verification
type CardVerificationInitResponse struct {
	ClientSecret string `json:"client_secret"` // Stripe SetupIntent client secret
}

// CardVerificationConfirmRequest confirms the card was verified
type CardVerificationConfirmRequest struct {
	UserID        uuid.UUID `json:"-"`
	SetupIntentID string    `json:"setup_intent_id"`
}

// IDVerificationRequest initiates ID verification
type IDVerificationRequest struct {
	UserID uuid.UUID `json:"-"`
}

// IDVerificationInitResponse returns Jumio session info
type IDVerificationInitResponse struct {
	RedirectURL string `json:"redirect_url,omitempty"` // For web redirect flow
	SDKToken    string `json:"sdk_token,omitempty"`    // For native SDK flow
}

// JumioWebhookPayload represents the webhook from Jumio
// LEGAL NOTE: Contains verification results. Log and audit appropriately.
type JumioWebhookPayload struct {
	ScanReference   string `json:"scanReference"`
	TransactionDate string `json:"transactionDate"`
	VerificationStatus string `json:"verificationStatus"` // APPROVED_VERIFIED, DENIED_*
	Document        struct {
		Type      string `json:"type"`      // PASSPORT, DRIVERS_LICENSE, ID_CARD
		Country   string `json:"issuingCountry"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		DOB       string `json:"dob"` // YYYY-MM-DD
	} `json:"document"`
	Similarity string `json:"similarity"` // MATCH, NO_MATCH, NOT_POSSIBLE
	Reason     string `json:"reason,omitempty"`
}

// CalculateAge returns the user's age based on DOB
func (v *VerificationAttempt) CalculateAge() int {
	if v.JumioDOB == nil {
		return 0
	}
	now := time.Now()
	age := now.Year() - v.JumioDOB.Year()
	if now.YearDay() < v.JumioDOB.YearDay() {
		age--
	}
	return age
}

// IsAdult returns true if the user is 18 or older
// LEGAL NOTE: Age of majority varies by jurisdiction. 18 is used as
// the baseline. Adjust per regional requirements.
func (v *VerificationAttempt) IsAdult() bool {
	return v.CalculateAge() >= 18
}

// RetryCooldownDuration is how long users must wait between retries
const RetryCooldownDuration = 24 * time.Hour

// MaxRetryCount is the maximum number of verification retries
const MaxRetryCount = 3
