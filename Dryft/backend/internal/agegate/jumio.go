package agegate

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/models"
)

// JumioClient handles Jumio Netverify API interactions.
// LEGAL NOTE: Jumio provides identity verification services that comply with
// KYC (Know Your Customer) and age verification requirements. They handle
// PII storage and processing according to their compliance certifications.
type JumioClient struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewJumioClient(cfg *config.Config) *JumioClient {
	return &JumioClient{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// InitiateVerificationRequest is sent to Jumio to start verification
type InitiateVerificationRequest struct {
	CustomerInternalReference string `json:"customerInternalReference"`
	UserReference            string `json:"userReference"`
	CallbackURL              string `json:"callbackUrl"`
	SuccessURL               string `json:"successUrl,omitempty"`
	ErrorURL                 string `json:"errorUrl,omitempty"`
	WorkflowID               int    `json:"workflowId"`
	PresetCountry            string `json:"presetCountry,omitempty"`
	Locale                   string `json:"locale,omitempty"`
}

// InitiateVerificationResponse is Jumio's response
type InitiateVerificationResponse struct {
	TransactionReference string `json:"transactionReference"`
	RedirectURL          string `json:"redirectUrl"`
	Timestamp            string `json:"timestamp"`
}

// JumioWorkflows - using ID + Selfie verification
const (
	JumioWorkflowIDSelfie = 200 // ID verification with selfie
)

// InitiateVerification starts a Jumio verification session.
// Returns the redirect URL for web flow or SDK token for native.
func (j *JumioClient) InitiateVerification(ctx context.Context, userID, callbackURL string) (*InitiateVerificationResponse, error) {
	reqBody := InitiateVerificationRequest{
		CustomerInternalReference: userID,
		UserReference:            userID,
		CallbackURL:              callbackURL,
		WorkflowID:               JumioWorkflowIDSelfie,
		Locale:                   "en",
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		j.cfg.JumioBaseURL+"/initiate",
		bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Jumio uses HTTP Basic Auth
	auth := base64.StdEncoding.EncodeToString(
		[]byte(j.cfg.JumioAPIToken + ":" + j.cfg.JumioAPISecret))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Drift/1.0")

	resp, err := j.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jumio api error: %s - %s", resp.Status, string(body))
	}

	var result InitiateVerificationResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &result, nil
}

// ValidateWebhookSignature validates the Jumio webhook signature.
// LEGAL NOTE: Always validate webhooks to prevent spoofing of verification results.
func (j *JumioClient) ValidateWebhookSignature(payload []byte, signature string) bool {
	if j.cfg.JumioWebhookSecret == "" {
		// In development, skip validation
		return j.cfg.IsDevelopment()
	}

	mac := hmac.New(sha256.New, []byte(j.cfg.JumioWebhookSecret))
	mac.Write(payload)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSig))
}

// ParseWebhookPayload parses and validates the Jumio webhook
func (j *JumioClient) ParseWebhookPayload(body []byte) (*models.JumioWebhookPayload, error) {
	var payload models.JumioWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("unmarshal webhook: %w", err)
	}

	return &payload, nil
}

// JumioVerificationResult is our processed result from Jumio
type JumioVerificationResult struct {
	ScanRef         string
	Status          models.JumioStatus
	DOB             *time.Time
	DocumentType    string
	DocumentCountry string
	FaceMatchScore  float64 // Jumio's similarity score
	RejectionReason string
}

// ProcessWebhookResult converts Jumio's webhook to our internal format
func (j *JumioClient) ProcessWebhookResult(payload *models.JumioWebhookPayload) (*JumioVerificationResult, error) {
	result := &JumioVerificationResult{
		ScanRef:         payload.ScanReference,
		DocumentType:    payload.Document.Type,
		DocumentCountry: payload.Document.Country,
	}

	// Parse verification status
	switch {
	case payload.VerificationStatus == "APPROVED_VERIFIED":
		result.Status = models.JumioStatusApproved
	case payload.VerificationStatus == "DENIED_FRAUD" ||
		payload.VerificationStatus == "DENIED_UNSUPPORTED_ID_TYPE" ||
		payload.VerificationStatus == "DENIED_UNSUPPORTED_ID_COUNTRY":
		result.Status = models.JumioStatusRejected
		result.RejectionReason = payload.Reason
	default:
		result.Status = models.JumioStatusRejected
		result.RejectionReason = payload.VerificationStatus
	}

	// Parse DOB
	if payload.Document.DOB != "" {
		dob, err := time.Parse("2006-01-02", payload.Document.DOB)
		if err == nil {
			result.DOB = &dob
		}
	}

	// Parse face similarity
	switch payload.Similarity {
	case "MATCH":
		result.FaceMatchScore = 1.0
	case "NO_MATCH":
		result.FaceMatchScore = 0.0
	case "NOT_POSSIBLE":
		result.FaceMatchScore = -1.0 // Indicates manual review needed
	}

	return result, nil
}

// IsAdult checks if the DOB indicates 18+ age
// LEGAL NOTE: Baseline age of 18. Adjust per jurisdiction if needed.
func (j *JumioClient) IsAdult(dob *time.Time) bool {
	if dob == nil {
		return false
	}

	now := time.Now()
	age := now.Year() - dob.Year()
	if now.YearDay() < dob.YearDay() {
		age--
	}

	return age >= 18
}
