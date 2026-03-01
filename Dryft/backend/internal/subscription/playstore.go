package subscription

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
)

// PlayStoreValidator validates Android Play Store purchases via the Google Play Developer API.
type PlayStoreValidator struct {
	packageName string
	httpClient  *http.Client
}

// NewPlayStoreValidator creates a validator for Android receipts.
// serviceAccountJSON is the contents of a Google service account key file.
func NewPlayStoreValidator(packageName string, serviceAccountJSON []byte) (*PlayStoreValidator, error) {
	conf, err := google.JWTConfigFromJSON(serviceAccountJSON, "https://www.googleapis.com/auth/androidpublisher")
	if err != nil {
		return nil, fmt.Errorf("parse service account: %w", err)
	}

	return &PlayStoreValidator{
		packageName: packageName,
		httpClient:  conf.Client(context.Background()),
	}, nil
}

func (v *PlayStoreValidator) Validate(ctx context.Context, receipt string) (*ReceiptInfo, error) {
	// Receipt format: "productId:purchaseToken"
	parts := strings.SplitN(receipt, ":", 2)
	if len(parts) != 2 {
		return &ReceiptInfo{Valid: false}, fmt.Errorf("invalid android receipt format")
	}

	productID := parts[0]
	purchaseToken := parts[1]

	apiURL := fmt.Sprintf(
		"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/%s/purchases/subscriptions/%s/tokens/%s",
		v.packageName, productID, purchaseToken,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call Google Play API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &ReceiptInfo{Valid: false}, fmt.Errorf("Google Play API status %d", resp.StatusCode)
	}

	var result googleSubscriptionPurchase
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode Google Play response: %w", err)
	}

	// PaymentState: 0=pending, 1=received, 2=free trial, 3=deferred
	if result.PaymentState == nil || (*result.PaymentState != 1 && *result.PaymentState != 2) {
		return &ReceiptInfo{Valid: false}, fmt.Errorf("payment not completed")
	}

	startTime := time.UnixMilli(result.StartTimeMillis)
	expiryTime := time.UnixMilli(result.ExpiryTimeMillis)

	info := &ReceiptInfo{
		Valid:         true,
		ProductID:     productID,
		TransactionID: result.OrderID,
		OriginalTxID:  result.OrderID,
		PurchaseDate:  startTime,
		ExpiresAt:     expiryTime,
		WillRenew:     result.AutoRenewing,
		IsTrialPeriod: result.PaymentState != nil && *result.PaymentState == 2,
	}

	if result.CancelReason != nil && *result.CancelReason >= 0 {
		cancelTime := time.UnixMilli(result.UserCancellationTimeMillis)
		info.CancellationDate = &cancelTime
	}

	return info, nil
}

type googleSubscriptionPurchase struct {
	OrderID                    string `json:"orderId"`
	StartTimeMillis            int64  `json:"startTimeMillis,string"`
	ExpiryTimeMillis           int64  `json:"expiryTimeMillis,string"`
	AutoRenewing               bool   `json:"autoRenewing"`
	PaymentState               *int   `json:"paymentState"`
	CancelReason               *int   `json:"cancelReason"`
	UserCancellationTimeMillis int64  `json:"userCancellationTimeMillis,string"`
}
