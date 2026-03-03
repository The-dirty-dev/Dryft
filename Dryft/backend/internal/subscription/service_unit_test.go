package subscription

import (
	"context"
	"errors"
	"testing"
)

type mockReceiptValidator struct {
	validateFn func(ctx context.Context, receipt string) (*ReceiptInfo, error)
}

func (m *mockReceiptValidator) Validate(ctx context.Context, receipt string) (*ReceiptInfo, error) {
	if m.validateFn == nil {
		return &ReceiptInfo{Valid: false}, nil
	}
	return m.validateFn(ctx, receipt)
}

func TestServiceGetTierFromProductID(t *testing.T) {
	tests := []struct {
		productID string
		tier      Tier
	}{
		{"com.dryft.vip.monthly", TierVIP},
		{"com.dryft.premium.yearly", TierPremium},
		{"com.dryft.plus.monthly", TierPlus},
		{"unknown", TierFree},
	}

	for _, tc := range tests {
		if got := getTierFromProductID(tc.productID); got != tc.tier {
			t.Fatalf("product %q: expected %s, got %s", tc.productID, tc.tier, got)
		}
	}
}

func TestVerifyAndCreateSubscription_InvalidReceipt(t *testing.T) {
	svc := &Service{
		iosValidator: &mockReceiptValidator{
			validateFn: func(context.Context, string) (*ReceiptInfo, error) {
				return &ReceiptInfo{Valid: false}, nil
			},
		},
		androidValidator: &mockReceiptValidator{
			validateFn: func(context.Context, string) (*ReceiptInfo, error) {
				return &ReceiptInfo{Valid: false}, nil
			},
		},
	}

	_, err := svc.VerifyAndCreateSubscription(context.Background(), "u1", "com.dryft.plus.monthly", "bad-receipt", PlatformIOS)
	if !errors.Is(err, ErrInvalidReceipt) {
		t.Fatalf("expected ErrInvalidReceipt, got %v", err)
	}
}

func TestContainsHelpers(t *testing.T) {
	if !contains("com.dryft.plus.monthly", "plus") {
		t.Fatal("expected contains helper to find substring")
	}
	if containsAt("abc", "bc", 2) {
		t.Fatal("expected containsAt false when start index cannot fit substring")
	}
}
