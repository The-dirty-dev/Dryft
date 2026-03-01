package subscription

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func jsonReader(s string) io.Reader {
	return strings.NewReader(s)
}

// AppStoreValidator validates iOS App Store receipts via Apple's verifyReceipt endpoint.
type AppStoreValidator struct {
	sharedSecret string
	httpClient   *http.Client
	sandbox      bool
}

// NewAppStoreValidator creates a validator for iOS receipts.
// Set sandbox=true for development/TestFlight builds.
func NewAppStoreValidator(sharedSecret string, sandbox bool) *AppStoreValidator {
	return &AppStoreValidator{
		sharedSecret: sharedSecret,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
		sandbox:      sandbox,
	}
}

func (v *AppStoreValidator) Validate(ctx context.Context, receipt string) (*ReceiptInfo, error) {
	endpoint := "https://buy.itunes.apple.com/verifyReceipt"
	if v.sandbox {
		endpoint = "https://sandbox.itunes.apple.com/verifyReceipt"
	}

	resp, err := v.verifyWithEndpoint(ctx, endpoint, receipt)
	if err != nil {
		return nil, err
	}

	// Status 21007 means the receipt is from sandbox — retry against sandbox
	if resp.Status == 21007 && !v.sandbox {
		resp, err = v.verifyWithEndpoint(ctx, "https://sandbox.itunes.apple.com/verifyReceipt", receipt)
		if err != nil {
			return nil, err
		}
	}

	if resp.Status != 0 {
		return &ReceiptInfo{Valid: false}, fmt.Errorf("apple receipt status %d", resp.Status)
	}

	if len(resp.LatestReceiptInfo) == 0 {
		return &ReceiptInfo{Valid: false}, fmt.Errorf("no receipt info returned")
	}

	latest := resp.LatestReceiptInfo[len(resp.LatestReceiptInfo)-1]

	purchaseDate, _ := parseAppleTimestamp(latest.PurchaseDateMS)
	expiresAt, _ := parseAppleTimestamp(latest.ExpiresDateMS)

	info := &ReceiptInfo{
		Valid:         true,
		ProductID:     latest.ProductID,
		TransactionID: latest.TransactionID,
		OriginalTxID:  latest.OriginalTransactionID,
		PurchaseDate:  purchaseDate,
		ExpiresAt:     expiresAt,
		WillRenew:     resp.PendingRenewalInfo != nil && len(resp.PendingRenewalInfo) > 0 && resp.PendingRenewalInfo[0].AutoRenewStatus == "1",
	}

	if latest.IsTrialPeriod == "true" {
		info.IsTrialPeriod = true
	}
	if latest.CancellationDateMS != "" {
		t, err := parseAppleTimestamp(latest.CancellationDateMS)
		if err == nil {
			info.CancellationDate = &t
		}
	}

	return info, nil
}

func (v *AppStoreValidator) verifyWithEndpoint(ctx context.Context, endpoint, receipt string) (*appleVerifyResponse, error) {
	body := fmt.Sprintf(`{"receipt-data":%q,"password":%q,"exclude-old-transactions":true}`, receipt, v.sharedSecret)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, jsonReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call Apple verifyReceipt: %w", err)
	}
	defer resp.Body.Close()

	var result appleVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode Apple response: %w", err)
	}

	return &result, nil
}

type appleVerifyResponse struct {
	Status             int                   `json:"status"`
	LatestReceiptInfo  []appleReceiptInfo    `json:"latest_receipt_info"`
	PendingRenewalInfo []applePendingRenewal `json:"pending_renewal_info"`
}

type appleReceiptInfo struct {
	ProductID             string `json:"product_id"`
	TransactionID         string `json:"transaction_id"`
	OriginalTransactionID string `json:"original_transaction_id"`
	PurchaseDateMS        string `json:"purchase_date_ms"`
	ExpiresDateMS         string `json:"expires_date_ms"`
	IsTrialPeriod         string `json:"is_trial_period"`
	CancellationDateMS    string `json:"cancellation_date_ms"`
}

type applePendingRenewal struct {
	AutoRenewStatus string `json:"auto_renew_status"`
}

func parseAppleTimestamp(ms string) (time.Time, error) {
	var msInt int64
	_, err := fmt.Sscanf(ms, "%d", &msInt)
	if err != nil {
		return time.Time{}, err
	}
	return time.UnixMilli(msInt), nil
}
