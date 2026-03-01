package agegate

import (
	"testing"

	"github.com/dryft-app/backend/internal/config"
	"github.com/stripe/stripe-go/v78"
)

func TestStripeClientGetPaymentMethodDetails(t *testing.T) {
	client := NewStripeClient(&config.Config{StripeSecretKey: "sk_test"})

	_, _, err := client.GetPaymentMethodDetails(&stripe.SetupIntent{})
	if err == nil {
		t.Fatalf("expected error when payment method missing")
	}

	intent := &stripe.SetupIntent{
		PaymentMethod: &stripe.PaymentMethod{},
	}
	_, _, err = client.GetPaymentMethodDetails(intent)
	if err == nil {
		t.Fatalf("expected error when card missing")
	}

	intent = &stripe.SetupIntent{
		PaymentMethod: &stripe.PaymentMethod{
			Card: &stripe.PaymentMethodCard{
				Last4: "4242",
				Brand: stripe.PaymentMethodCardBrandVisa,
			},
		},
	}

	last4, brand, err := client.GetPaymentMethodDetails(intent)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if last4 != "4242" || brand != string(stripe.PaymentMethodCardBrandVisa) {
		t.Fatalf("unexpected card details: %s %s", last4, brand)
	}
}

func TestStripeClientIsSetupIntentSucceeded(t *testing.T) {
	client := NewStripeClient(&config.Config{StripeSecretKey: "sk_test"})

	if client.IsSetupIntentSucceeded(&stripe.SetupIntent{Status: stripe.SetupIntentStatusProcessing}) {
		t.Fatalf("expected status to be not succeeded")
	}

	if !client.IsSetupIntentSucceeded(&stripe.SetupIntent{Status: stripe.SetupIntentStatusSucceeded}) {
		t.Fatalf("expected status succeeded")
	}
}
