package subscription

import (
	"context"
	"errors"
	"log/slog"
)

var ErrReceiptValidatorNotConfigured = errors.New("receipt validator not configured")

// LogReceiptValidator is a stub ReceiptValidator that logs calls and returns
// an error. Use this as a safe default when App Store / Play Store validation
// is not configured.
type LogReceiptValidator struct {
	Platform string // "ios" or "android", for log clarity
}

func (v LogReceiptValidator) Validate(_ context.Context, receipt string) (*ReceiptInfo, error) {
	slog.Warn("receipt validation attempted but validator not configured",
		"platform", v.Platform, "receipt_len", len(receipt))
	return nil, ErrReceiptValidatorNotConfigured
}
